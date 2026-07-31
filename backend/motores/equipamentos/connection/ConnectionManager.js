/**
 * Sprint 15.1 — ConnectionManager V2
 * Gerenciador universal: Ethernet / Serial / USB.
 * Pool único, heartbeat, reconexão com backoff 2/4/8s, estados unificados.
 *
 * Compatibilidade V1: connect/disconnect/reconnect/isConnected/health/latency/getTcp
 */

'use strict';

const ConnectionFactory = require('./ConnectionFactory');
const ConnectionPool = require('./ConnectionPool');
const ConnectionHealth = require('./ConnectionHealth');
const { STATUS } = require('./ConnectionHealth');
const ConnectionRepository = require('./ConnectionRepository');
const ConnectionStateMachine = require('./ConnectionStateMachine');
const { STATES } = require('./ConnectionStateMachine');
const ConnectionMetrics = require('./ConnectionMetrics');
const ConnectionHeartbeat = require('./ConnectionHeartbeat');
const connectionEvents = require('./ConnectionEvents');
const { EVENTS } = require('./ConnectionEvents');

const BACKOFF_MS = Object.freeze([2000, 4000, 8000]);
const MAX_RECONNECT = 3;
const HEARTBEAT_MS = 30000;

let logger = null;
function getLogger() {
  if (logger) return logger;
  try {
    logger = require('../services/LoggerService');
  } catch (_) {
    logger = {
      info: async (msg, ctx) => console.log('[connection-v2]', msg, ctx || ''),
      error: async (msg, ctx) => console.error('[connection-v2]', msg, ctx || '')
    };
  }
  return logger;
}

function validarHostPorta(host, porta) {
  const h = String(host || '');
  const p = Number(porta) || 0;
  if (!h || !p) {
    const err = new Error('host e porta são obrigatórios.');
    err.statusCode = 400;
    err.code = 'CONNECTION_INPUT_INVALIDO';
    throw err;
  }
  return { host: h, porta: p };
}

function mapEstadoParaHealth(estado) {
  switch (estado) {
    case STATES.CONNECTED:
    case STATES.IDLE:
    case STATES.BUSY:
      return STATUS.ONLINE;
    case STATES.CONNECTING:
    case STATES.RECONNECTING:
      return STATUS.CONNECTING;
    case STATES.ERROR:
      return STATUS.OFFLINE;
    case STATES.DISCONNECTED:
    default:
      return STATUS.DISCONNECTED;
  }
}

function erroReconectavel(err) {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return (
    code === 'ECONNRESET'
    || code === 'ETIMEDOUT'
    || code === 'ECONNREFUSED'
    || code === 'TCP_TIMEOUT'
    || /socket closed|socket destru|ECONNRESET|ETIMEDOUT|ECONNREFUSED|closed/i.test(msg)
  );
}

class ConnectionManager {
  constructor(deps = {}) {
    this.factory = deps.factory || new ConnectionFactory();
    this.pool = deps.pool || new ConnectionPool();
    this.repository = deps.repository || new ConnectionRepository();
    this.events = deps.events || connectionEvents;
    this.timeoutMs = deps.timeoutMs != null ? Number(deps.timeoutMs) : 1000;
    this.heartbeatMs = deps.heartbeatMs != null ? Number(deps.heartbeatMs) : HEARTBEAT_MS;
    this.autoReconnect = deps.autoReconnect !== false;
    this.autoHeartbeat = deps.autoHeartbeat !== false;
    this._version = '2.0';
  }

  get eventsBus() {
    return this.events;
  }

  _logEstado(entry, from, to, extra = {}) {
    const ctx = {
      from,
      to,
      host: entry.host,
      porta: entry.porta,
      equipamentoId: entry.equipamentoId,
      latencia: entry.metrics?.latenciaMedia ?? entry.health?.latencia,
      ...extra
    };
    getLogger().info(`${from} → ${to}`, {
      operacao: 'connection_v2',
      contexto: ctx
    }).catch(() => {});
  }

  _transitar(entry, para, meta = {}) {
    const from = entry.fsm.estado;
    let evento;
    try {
      evento = entry.fsm.transitar(para, meta);
    } catch (_) {
      evento = entry.fsm.forcar(para, meta);
    }
    if (evento?.noop) return evento;
    entry.health.setStatus(mapEstadoParaHealth(para));
    this._logEstado(entry, from, para, meta);
    this.events.emitStateChanged({
      key: entry._poolKey,
      host: entry.host,
      porta: entry.porta,
      equipamentoId: entry.equipamentoId,
      from,
      to: para,
      ...meta
    });
    return evento;
  }

  async _persistir(entry) {
    if (!entry || entry.persistir === false) return;
    const snap = entry.health.snapshot();
    const metrics = entry.metrics.snapshot();
    try {
      await this.repository.salvar({
        host: entry.host,
        porta: entry.porta,
        equipamento_id: entry.equipamentoId || null,
        transporte: entry.transporte || 'ethernet',
        status: entry.fsm.estado,
        latencia: snap.latencia,
        conectado_em: snap.conectadoEm,
        desconectado_em: snap.desconectadoEm,
        ultima_atividade: snap.ultimaAtividade,
        reconexoes: metrics.reconexoes,
        metricas: metrics
      });
    } catch (_) { /* não bloqueia */ }
  }

  _bindTransportEvents(entry) {
    const tr = entry.transport;
    if (!tr || typeof tr.on !== 'function') return;

    tr.removeAllListeners?.('close');
    tr.removeAllListeners?.('error');
    tr.removeAllListeners?.('timeout');
    tr.removeAllListeners?.('data');

    tr.on('data', (buf) => {
      const n = Buffer.isBuffer(buf) ? buf.length : 0;
      entry.metrics.registrarRecebimento(n);
      entry.health.touch();
      this.events.emitPacketReceived({
        host: entry.host,
        porta: entry.porta,
        equipamentoId: entry.equipamentoId,
        bytes: n
      });
    });

    tr.on('timeout', async () => {
      entry.metrics.registrarErro({ code: 'TIMEOUT', message: 'Timeout de conexão' });
      this.events.emitTimeout({ host: entry.host, porta: entry.porta });
      if (entry.fsm.ativo) {
        this._transitar(entry, STATES.ERROR, { motivo: 'timeout' });
        await this._persistir(entry);
        if (this.autoReconnect && !entry._manualClose) {
          this._agendarReconexao(entry).catch(() => {});
        }
      }
    });

    tr.on('close', async () => {
      if (entry._manualClose) return;
      if (entry.fsm.ativo || entry.fsm.estado === STATES.CONNECTING) {
        entry.metrics.marcarDesconectado();
        this._transitar(entry, STATES.DISCONNECTED, { motivo: 'socket_closed' });
        this.events.emitDisconnected({
          host: entry.host,
          porta: entry.porta,
          equipamentoId: entry.equipamentoId
        });
        await this._persistir(entry);
        if (this.autoReconnect) {
          this._agendarReconexao(entry).catch(() => {});
        }
      }
    });

    tr.on('error', async (err) => {
      entry.metrics.registrarErro(err);
      this.events.emitError({
        host: entry.host,
        porta: entry.porta,
        erro: err?.message,
        codigo: err?.code
      });
      if (erroReconectavel(err) && this.autoReconnect && !entry._manualClose) {
        this._agendarReconexao(entry).catch(() => {});
      } else if (entry.fsm.ativo) {
        this._transitar(entry, STATES.ERROR, { motivo: err?.code || err?.message });
        await this._persistir(entry);
      }
    });
  }

  _iniciarHeartbeat(entry) {
    if (!this.autoHeartbeat) return;
    if (entry.heartbeat) entry.heartbeat.parar();

    entry.heartbeat = new ConnectionHeartbeat({
      intervaloMs: this.heartbeatMs,
      onTick: async () => {
        if (!entry.fsm.ativo) return { ok: false, motivo: 'inativo' };
        try {
          const r = await entry.transport.ping();
          entry.metrics.registrarHeartbeat(Boolean(r?.ok), { latencia: r?.latencia });
          if (r?.latencia != null) entry.health.latencia = r.latencia;
          this.events.emitHeartbeat({
            host: entry.host,
            porta: entry.porta,
            equipamentoId: entry.equipamentoId,
            ok: Boolean(r?.ok),
            latencia: r?.latencia
          });
          entry.health.touch();
          await this._persistir(entry);
          return { ok: Boolean(r?.ok), latencia: r?.latencia };
        } catch (err) {
          entry.metrics.registrarHeartbeat(false);
          return { ok: false, erro: err };
        }
      },
      onFalha: async () => {
        if (entry._manualClose) return;
        this._transitar(entry, STATES.RECONNECTING, { motivo: 'heartbeat_falhou' });
        await this._agendarReconexao(entry);
      }
    });
    entry.heartbeat.iniciar();
  }

  async _agendarReconexao(entry) {
    if (entry._reconnectLock) return;
    entry._reconnectLock = true;
    entry._manualClose = false;

    try {
      this._transitar(entry, STATES.RECONNECTING, {});
      this.events.emitReconnecting({
        host: entry.host,
        porta: entry.porta,
        equipamentoId: entry.equipamentoId
      });

      for (let tentativa = 0; tentativa < MAX_RECONNECT; tentativa += 1) {
        if (entry._manualClose) return;
        const delay = BACKOFF_MS[Math.min(tentativa, BACKOFF_MS.length - 1)];
        await getLogger().info('Reconexão automática', {
          operacao: 'connection_v2',
          contexto: {
            host: entry.host,
            porta: entry.porta,
            tentativa: tentativa + 1,
            delayMs: delay
          }
        });
        await new Promise((r) => setTimeout(r, delay));
        if (entry._manualClose) return;

        try {
          try { entry.transport.destroy(); } catch (_) { /* ignore */ }
          entry.transport = this.factory.create({
            transporte: entry.transporte,
            host: entry.host,
            porta: entry.porta,
            porta_com: entry.porta_com,
            vid: entry.vid,
            pid: entry.pid,
            caminho_dispositivo: entry.caminho,
            timeoutMs: entry.timeoutMs || this.timeoutMs
          });
          this._bindTransportEvents(entry);
          this._transitar(entry, STATES.CONNECTING, { tentativa: tentativa + 1 });
          const r = await entry.transport.connect();
          entry.metrics.incrementarReconexoes();
          entry.metrics.marcarConectado(r?.latencia);
          entry.health.marcarConectado(r?.latencia);
          entry.health.reconexoes = entry.metrics.reconexoes;
          this._transitar(entry, STATES.IDLE, { latencia: r?.latencia });
          this.events.emitConnected({
            host: entry.host,
            porta: entry.porta,
            latencia: r?.latencia,
            reconexao: true
          });
          this._iniciarHeartbeat(entry);
          await this._persistir(entry);
          return;
        } catch (err) {
          entry.metrics.registrarErro(err);
        }
      }

      this._transitar(entry, STATES.ERROR, { motivo: 'max_reconnect' });
      entry.health.marcarDesconectado(STATUS.OFFLINE);
      await this._persistir(entry);
      this.events.emitError({
        host: entry.host,
        porta: entry.porta,
        codigo: 'MAX_RECONNECT',
        erro: 'Falha definitiva após 3 tentativas'
      });
    } finally {
      entry._reconnectLock = false;
    }
  }

  /**
   * Resolve alvo a partir de id de equipamento cadastrado.
   */
  async _resolverEquipamento(id) {
    try {
      const equipamentosRepository = require('../repositories/EquipamentosRepository');
      const eq = await equipamentosRepository.buscarPorId(id);
      if (!eq) {
        const err = new Error(`Equipamento ${id} não encontrado.`);
        err.statusCode = 404;
        err.code = 'EQUIPAMENTO_NAO_ENCONTRADO';
        throw err;
      }
      return {
        equipamentoId: Number(eq.id),
        host: eq.ip || eq.host || null,
        porta: Number(eq.porta_tcp || eq.porta) || null,
        porta_com: eq.porta_com || null,
        transporte: String(eq.transporte || 'ethernet').toLowerCase(),
        vid: eq.vid || null,
        pid: eq.pid || null,
        timeoutMs: Number(eq.timeout_ms) || this.timeoutMs
      };
    } catch (err) {
      if (err.statusCode) throw err;
      throw err;
    }
  }

  async _normalizarOpcoes(opcoes = {}) {
    const opts = { ...opcoes };
    if (opts.equipamentoId != null || opts.equipamento_id != null || opts.id != null) {
      const id = opts.equipamentoId ?? opts.equipamento_id ?? opts.id;
      const eq = await this._resolverEquipamento(id);
      return {
        ...eq,
        ...opts,
        equipamentoId: eq.equipamentoId,
        host: opts.host || opts.ip || eq.host,
        porta: opts.porta || opts.porta_tcp || eq.porta,
        transporte: opts.transporte || eq.transporte
      };
    }
    return {
      ...opts,
      host: opts.host || opts.ip,
      porta: opts.porta || opts.porta_tcp,
      transporte: String(opts.transporte || 'ethernet').toLowerCase()
    };
  }

  /**
   * Conecta (ou reutiliza) — V1 + V2.
   */
  async connect(opcoes = {}) {
    const alvo = await this._normalizarOpcoes(opcoes);
    const transporte = String(alvo.transporte || 'ethernet').toLowerCase();
    const log = getLogger();

    // Localizar existente
    let existente = null;
    if (alvo.equipamentoId != null) {
      existente = this.pool.get({ equipamentoId: alvo.equipamentoId });
    }
    if (!existente && alvo.host && alvo.porta) {
      existente = this.pool.get(alvo.host, alvo.porta);
    }
    if (!existente && alvo.porta_com) {
      existente = this.pool.get({ porta_com: alvo.porta_com });
    }

    if (existente && existente.fsm?.ativo && existente.transport?.aberto) {
      await log.info('Conexão ativa (pool)', {
        operacao: 'connection_v2',
        contexto: { host: existente.host, porta: existente.porta, reutilizada: true }
      });
      return {
        status: 'CONNECTED',
        estado: existente.fsm.estado,
        latencia: existente.health.latencia,
        reutilizada: true,
        equipamentoId: existente.equipamentoId
      };
    }

    if (existente) {
      try { existente.heartbeat?.parar(); } catch (_) { /* ignore */ }
      try { existente.transport?.destroy(); } catch (_) { /* ignore */ }
      this.pool.delete(existente);
    }

    if (transporte === 'ethernet' || transporte === 'tcp') {
      validarHostPorta(alvo.host, alvo.porta);
    }

    const fsm = new ConnectionStateMachine({
      onTransition: (ev) => {
        /* log já em _transitar */
      }
    });
    const health = new ConnectionHealth({ status: STATUS.CONNECTING });
    const metrics = new ConnectionMetrics();

    const transport = this.factory.create({
      transporte,
      host: alvo.host,
      porta: alvo.porta,
      porta_com: alvo.porta_com,
      vid: alvo.vid,
      pid: alvo.pid,
      caminho_dispositivo: alvo.caminho_dispositivo,
      timeoutMs: alvo.timeoutMs != null ? alvo.timeoutMs : this.timeoutMs
    });

    const entry = {
      equipamentoId: alvo.equipamentoId || null,
      host: alvo.host || null,
      porta: alvo.porta || null,
      porta_com: alvo.porta_com || null,
      vid: alvo.vid || null,
      pid: alvo.pid || null,
      caminho: alvo.caminho_dispositivo || null,
      transporte,
      transport,
      tcp: typeof transport.getTcp === 'function' ? transport.getTcp() : null,
      fsm,
      health,
      metrics,
      heartbeat: null,
      persistir: alvo.persistir !== false,
      timeoutMs: alvo.timeoutMs != null ? alvo.timeoutMs : this.timeoutMs,
      _manualClose: false,
      _reconnectLock: false,
      meta: {
        host: alvo.host || null,
        porta: alvo.porta || null,
        transporte,
        equipamentoId: alvo.equipamentoId || null
      }
    };

    // Compat V1: entry.tcp aponta para TcpConnection
    if (!entry.tcp && transport.getTcp) {
      entry.tcp = transport.getTcp();
    }

    this.pool.set({
      equipamentoId: entry.equipamentoId,
      host: entry.host,
      porta: entry.porta,
      porta_com: entry.porta_com,
      vid: entry.vid,
      pid: entry.pid,
      caminho_dispositivo: entry.caminho
    }, entry);

    // Alias V1 host:porta (sem duplicar entrada)
    if (entry.host && entry.porta && entry._poolKey) {
      this.pool._aliases.set(
        require('./ConnectionPool').chaveHostPorta(entry.host, entry.porta),
        entry._poolKey
      );
    }

    this._bindTransportEvents(entry);
    this._transitar(entry, STATES.CONNECTING, {});

    await log.info('Solicitação de conexão', {
      operacao: 'connection_v2',
      contexto: { host: entry.host, porta: entry.porta, transporte, equipamentoId: entry.equipamentoId }
    });

    try {
      const { latencia } = await transport.connect();
      health.marcarConectado(latencia);
      metrics.marcarConectado(latencia);
      this._transitar(entry, STATES.IDLE, { latencia });
      this.events.emitConnected({
        host: entry.host,
        porta: entry.porta,
        equipamentoId: entry.equipamentoId,
        latencia,
        transporte
      });
      this._iniciarHeartbeat(entry);
      await this._persistir(entry);

      await log.info('Conexão ativa', {
        operacao: 'connection_v2',
        contexto: { host: entry.host, porta: entry.porta, latencia, estado: STATES.IDLE }
      });

      return {
        status: 'CONNECTED',
        estado: entry.fsm.estado,
        latencia,
        equipamentoId: entry.equipamentoId,
        transporte
      };
    } catch (err) {
      metrics.registrarErro(err);
      this._transitar(entry, STATES.ERROR, { motivo: err.code || err.message });
      health.marcarDesconectado(err.code === 'TCP_TIMEOUT' ? STATUS.TIMEOUT : STATUS.OFFLINE);
      await this._persistir(entry);
      try { transport.destroy(); } catch (_) { /* ignore */ }
      this.pool.delete(entry);
      if (entry.host && entry.porta) this.pool.delete(entry.host, entry.porta);
      throw err;
    }
  }

  async disconnect(opcoes = {}) {
    const alvo = await this._normalizarOpcoes(opcoes);
    const entry = this.getConnection(alvo);
    if (!entry) {
      return { status: 'DISCONNECTED', estado: STATES.DISCONNECTED, latencia: null };
    }

    entry._manualClose = true;
    try { entry.heartbeat?.parar(); } catch (_) { /* ignore */ }

    try {
      await entry.transport.disconnect();
    } finally {
      try { entry.transport.destroy(); } catch (_) { /* ignore */ }
      entry.metrics.marcarDesconectado();
      this._transitar(entry, STATES.DISCONNECTED, { motivo: 'manual' });
      entry.health.marcarDesconectado(STATUS.DISCONNECTED);
      await this._persistir(entry);
      this.events.emitDisconnected({
        host: entry.host,
        porta: entry.porta,
        equipamentoId: entry.equipamentoId,
        manual: true
      });
      this.pool.delete(entry);
      if (entry.host && entry.porta) this.pool.delete(entry.host, entry.porta);
    }

    return {
      status: 'DISCONNECTED',
      estado: STATES.DISCONNECTED,
      latencia: entry.health.latencia
    };
  }

  isConnected(opcoes = {}) {
    try {
      if ((opcoes.host || opcoes.ip) && (opcoes.porta || opcoes.porta_tcp)) {
        const entry = this.pool.get(opcoes.host || opcoes.ip, opcoes.porta || opcoes.porta_tcp);
        return Boolean(entry && entry.fsm?.ativo && entry.transport?.aberto);
      }
      if (opcoes.equipamentoId != null || opcoes.equipamento_id != null || opcoes.id != null) {
        const entry = this.pool.get({
          equipamentoId: opcoes.equipamentoId ?? opcoes.equipamento_id ?? opcoes.id
        });
        return Boolean(entry && entry.fsm?.ativo && entry.transport?.aberto);
      }
      if (opcoes.porta_com || opcoes.vid || opcoes.pid || opcoes.caminho_dispositivo) {
        const entry = this.pool.get(opcoes);
        return Boolean(entry && entry.fsm?.ativo && entry.transport?.aberto);
      }
      const entry = this.getConnection(opcoes);
      return Boolean(entry && entry.fsm?.ativo && entry.transport?.aberto);
    } catch (_) {
      return false;
    }
  }

  async reconnect(opcoes = {}) {
    const alvo = await this._normalizarOpcoes(opcoes);
    const prev = this.getConnection(alvo);
    const reconexoesAnteriores = prev ? Number(prev.metrics?.reconexoes) || 0 : 0;

    if (prev) {
      try { await this.disconnect(alvo); } catch (_) { /* ignore */ }
    }

    const result = await this.connect({ ...alvo, persistir: opcoes.persistir });
    const entry = this.getConnection(alvo);
    if (entry) {
      entry.metrics.reconexoes = reconexoesAnteriores + 1;
      entry.health.reconexoes = entry.metrics.reconexoes;
      await this._persistir(entry);
    }

    return { ...result, reconexoes: reconexoesAnteriores + 1 };
  }

  /**
   * Envia bytes via Connection Manager (Drivers NÃO abrem socket).
   */
  async send(opcoes = {}, data) {
    const entry = this.getConnection(await this._normalizarOpcoes(opcoes));
    if (!entry || !entry.fsm.ativo) {
      const err = new Error('EthernetTransport: não conectado');
      err.code = 'NOT_CONNECTED';
      err.statusCode = 409;
      throw err;
    }
    this._transitar(entry, STATES.BUSY, { op: 'send' });
    try {
      const n = await entry.transport.send(data);
      entry.metrics.registrarEnvio(n);
      entry.health.touch();
      this.events.emitPacketSent({
        host: entry.host,
        porta: entry.porta,
        bytes: n
      });
      return n;
    } finally {
      if (entry.fsm.estado === STATES.BUSY) {
        this._transitar(entry, STATES.IDLE, { op: 'send_done' });
      }
    }
  }

  async receive(opcoes = {}, readOpts = {}) {
    const entry = this.getConnection(await this._normalizarOpcoes(opcoes));
    if (!entry || !entry.fsm.ativo) {
      const err = new Error('EthernetTransport: não conectado');
      err.code = 'NOT_CONNECTED';
      err.statusCode = 409;
      throw err;
    }
    this._transitar(entry, STATES.BUSY, { op: 'receive' });
    try {
      const buf = await entry.transport.receive(readOpts);
      if (buf) {
        entry.metrics.registrarRecebimento(buf.length);
        this.events.emitPacketReceived({
          host: entry.host,
          porta: entry.porta,
          bytes: buf.length
        });
      }
      entry.health.touch();
      return buf;
    } finally {
      if (entry.fsm.estado === STATES.BUSY) {
        this._transitar(entry, STATES.IDLE, { op: 'receive_done' });
      }
    }
  }

  async ping(opcoes = {}) {
    const alvo = await this._normalizarOpcoes(opcoes);
    let entry = this.getConnection(alvo);
    if (!entry || !entry.fsm.ativo) {
      // Auto-connect para ping por id
      if (alvo.equipamentoId || (alvo.host && alvo.porta)) {
        await this.connect(alvo);
        entry = this.getConnection(alvo);
      }
    }
    if (!entry || !entry.transport) {
      return { ok: false, status: 'DISCONNECTED', latencia: null };
    }
    const inicio = Date.now();
    const r = await entry.transport.ping();
    const latencia = r?.latencia != null ? r.latencia : (Date.now() - inicio);
    if (r?.ok) {
      entry.metrics.registrarHeartbeat(true, { latencia });
      entry.health.latencia = latencia;
      entry.health.touch();
    }
    this.events.emitHeartbeat({
      host: entry.host,
      porta: entry.porta,
      ok: Boolean(r?.ok),
      latencia,
      manual: true
    });
    return {
      ok: Boolean(r?.ok),
      status: entry.fsm.estado,
      latencia,
      estado: entry.fsm.estado
    };
  }

  getConnection(opcoes = {}) {
    if (!opcoes || typeof opcoes !== 'object') return null;
    if (opcoes.equipamentoId != null || opcoes.equipamento_id != null || opcoes.id != null) {
      const found = this.pool.get({
        equipamentoId: opcoes.equipamentoId ?? opcoes.equipamento_id ?? opcoes.id
      });
      if (found) return found;
    }
    if (opcoes.host || opcoes.ip) {
      return this.pool.get(opcoes.host || opcoes.ip, opcoes.porta || opcoes.porta_tcp);
    }
    if (opcoes.porta_com) return this.pool.get({ porta_com: opcoes.porta_com });
    return this.pool.get(opcoes);
  }

  /** Compat V1 — acesso ao TcpConnection. */
  getTcp(opcoes = {}) {
    const entry = this.getConnection(opcoes);
    if (!entry) return null;
    if (entry.tcp) return entry.tcp;
    if (entry.transport && typeof entry.transport.getTcp === 'function') {
      return entry.transport.getTcp();
    }
    return null;
  }

  health(opcoes = {}) {
    const entry = this.getConnection(opcoes);
    if (!entry) {
      return {
        ...new ConnectionHealth({ status: STATUS.OFFLINE }).paraApi(),
        estado: STATES.DISCONNECTED,
        metricas: new ConnectionMetrics().snapshot()
      };
    }
    if (!entry.transport?.aberto && entry.fsm.ativo) {
      this._transitar(entry, STATES.DISCONNECTED, { motivo: 'socket_caiu' });
    }
    const api = entry.health.paraApi();
    return {
      ...api,
      status: entry.fsm.ativo ? 'CONNECTED' : (entry.fsm.estado === STATES.CONNECTING || entry.fsm.estado === STATES.RECONNECTING
        ? entry.fsm.estado
        : (entry.fsm.estado === STATES.ERROR ? 'ERROR' : api.status)),
      estado: entry.fsm.estado,
      transporte: entry.transporte,
      equipamentoId: entry.equipamentoId,
      metricas: entry.metrics.snapshot(),
      socket: Boolean(entry.transport?.aberto),
      heartbeat: entry.heartbeat?.ativo === true,
      ultimoHeartbeat: entry.metrics.ultimoHeartbeat
    };
  }

  latency(opcoes = {}) {
    const entry = this.getConnection(opcoes);
    return entry ? entry.health.latencia : null;
  }

  listConnections() {
    return this.pool.entries().map(([key, entry]) => ({
      key,
      equipamentoId: entry.equipamentoId,
      host: entry.host,
      porta: entry.porta,
      porta_com: entry.porta_com,
      transporte: entry.transporte,
      estado: entry.fsm.estado,
      status: entry.fsm.ativo ? 'CONNECTED' : entry.fsm.estado,
      latencia: entry.health.latencia,
      socket: Boolean(entry.transport?.aberto),
      heartbeat: entry.heartbeat?.ativo === true,
      metricas: entry.metrics.snapshot()
    }));
  }

  async closeAll() {
    const lista = this.pool.entries().map(([, e]) => e);
    for (const entry of lista) {
      try {
        await this.disconnect({
          equipamentoId: entry.equipamentoId,
          host: entry.host,
          porta: entry.porta,
          porta_com: entry.porta_com
        });
      } catch (_) { /* ignore */ }
    }
    this.pool.clear();
    return { fechadas: lista.length };
  }
}

const connectionManager = new ConnectionManager();

module.exports = connectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.BACKOFF_MS = BACKOFF_MS;
module.exports.STATES = STATES;
module.exports.EVENTS = EVENTS;
