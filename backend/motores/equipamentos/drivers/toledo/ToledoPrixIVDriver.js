/**
 * Sprint 14.4 — ToledoPrixIVDriver
 * Comunicação lógica via ConnectionManager. Nunca abre socket.
 */

'use strict';

const connectionManager = require('../../connection/ConnectionManager');
const ToledoHandshake = require('./ToledoHandshake');
const frameBuilder = require('./ToledoFrameBuilder');
const frameParser = require('./ToledoFrameParser');
const { getCapabilities } = require('./ToledoCapabilities');
const {
  DRIVER, FABRICANTE, MODELO, LIMITS, PORTA_PADRAO
} = require('./ToledoProtocol');
const { ToledoError, CODES } = require('./ToledoErrors');
const { createEngine } = require('./protocol/Toledo90AXEngine');

let logger = null;
function getLogger() {
  if (logger) return logger;
  try {
    logger = require('../../services/LoggerService');
  } catch (_) {
    logger = {
      info: async (msg, ctx) => console.log('[toledo-v1]', msg, ctx || ''),
      error: async (msg, ctx) => console.error('[toledo-v1]', msg, ctx || '')
    };
  }
  return logger;
}

class ToledoPrixIVDriver {
  /**
   * @param {object} [deps]
   * @param {object} [deps.connectionManager]
   * @param {object} [deps.engine]
   */
  constructor(deps = {}) {
    this.cm = deps.connectionManager || connectionManager;
    this.engine = deps.engine || createEngine({ connectionManager: this.cm });
    this.host = null;
    this.porta = null;
    this.status = 'OFFLINE';
    this.handshakeOk = false;
    this.latencia = null;
    this._online = false;
  }

  /**
   * Sprint 15.2 — executa comando via Motor 90AX (sem montar bytes no Driver).
   */
  async execute(command, payload = null, opcoes = {}) {
    this.engine.bind({ host: this.host, porta: this.porta, ...opcoes });
    return this.engine.execute(command, payload, {
      host: this.host,
      porta: this.porta,
      ...opcoes
    });
  }

  getCapabilities() {
    return getCapabilities();
  }

  _alvo() {
    if (!this.host || !this.porta) {
      throw ToledoError.fromCode(CODES.NOT_CONNECTED, 'Driver sem host/porta', { statusCode: 400 });
    }
    return { host: this.host, porta: this.porta };
  }

  _tcp() {
    const tcp = this.cm.getTcp(this._alvo());
    if (!tcp || !tcp.aberto) {
      throw ToledoError.fromCode(CODES.DEVICE_OFFLINE, 'Equipamento offline / sem conexão TCP', {
        statusCode: 503
      });
    }
    return tcp;
  }

  /**
   * Envia frame via ConnectionManager → TcpConnection.write
   * Observação passiva pelo EngineeringLab (não altera bytes).
   */
  async sendFrame(buffer) {
    const tcp = this._tcp();
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    tcp.write(buf);
    try {
      const lab = require('../../laboratorio/EngineeringLab');
      await lab.observeTx(buf, { host: this.host, porta: this.porta });
    } catch (_) { /* lab nunca bloqueia o Driver */ }
    return buf.length;
  }

  /**
   * Recebe frame via TcpConnection.read (sem parser de peso).
   * Observação passiva pelo EngineeringLab.
   */
  async receiveFrame({ timeoutMs } = {}) {
    const tcp = this._tcp();
    const raw = await tcp.read({
      timeoutMs: timeoutMs != null ? timeoutMs : LIMITS.readTimeoutMs
    });
    if (raw && raw.length) {
      try {
        const lab = require('../../laboratorio/EngineeringLab');
        await lab.observeRx(raw, { host: this.host, porta: this.porta });
      } catch (_) { /* lab nunca bloqueia o Driver */ }
    }
    return raw;
  }

  async handshake(opcoes = {}) {
    const log = getLogger();
    await log.info('Handshake enviado', {
      operacao: 'toledo_driver_v1',
      contexto: this._alvo()
    });

    // Sprint 15.2 — preferência Motor 90AX
    try {
      this.engine.bind(this._alvo());
      const result = await this.engine.execute('handshake', null, {
        ...this._alvo(),
        timeoutMs: opcoes.timeoutMs != null ? opcoes.timeoutMs : LIMITS.handshakeTimeoutMs
      });
      this.handshakeOk = true;
      this.latencia = result.latenciaMs;
      this.status = 'ONLINE';
      this._online = true;
      await log.info('Handshake validado (90AX)', {
        operacao: 'toledo_driver_v1',
        contexto: { ...this._alvo(), latencia: result.latenciaMs, checksum: result.checksum }
      });
      return {
        ok: true,
        latencia: result.latenciaMs,
        frame: result.parsed,
        engine: '90AX',
        checksum: result.checksum
      };
    } catch (err90) {
      // Fallback legado (compat testes sem ACK 90AX)
      try {
        const result = await ToledoHandshake.executar({
          sendFrame: (f) => this.sendFrame(f),
          receiveFrame: (o) => this.receiveFrame(o)
        }, opcoes);
        this.handshakeOk = true;
        this.latencia = result.latencia;
        this.status = 'ONLINE';
        this._online = true;
        return { ...result, engine: 'legacy-fallback', erro90ax: err90.message };
      } catch (_) {
        throw err90;
      }
    }
  }

  async ping(opcoes = {}) {
    try {
      this.engine.bind(this._alvo());
      const result = await this.engine.execute('ping', null, {
        ...this._alvo(),
        timeoutMs: opcoes.timeoutMs != null ? opcoes.timeoutMs : LIMITS.pingTimeoutMs
      });
      return { ok: true, frame: result.parsed, engine: '90AX', checksum: result.checksum, latenciaMs: result.latenciaMs };
    } catch (err90) {
      const frame = frameBuilder.buildPing();
      await this.sendFrame(frame);
      const raw = await this.receiveFrame({
        timeoutMs: opcoes.timeoutMs != null ? opcoes.timeoutMs : LIMITS.pingTimeoutMs
      });
      if (!raw) {
        throw ToledoError.fromCode(CODES.CONNECTION_TIMEOUT, 'Timeout no ping', { statusCode: 408 });
      }
      const parsed = frameParser.parse(raw);
      if (!parsed.isAck) {
        throw ToledoError.fromCode(CODES.INVALID_RESPONSE, `Ping sem ACK: ${parsed.comando}`);
      }
      return { ok: true, frame: parsed, engine: 'legacy-fallback' };
    }
  }

  /**
   * Conecta via ConnectionManager + handshake.
   * @param {{host:string, porta?:number, timeoutMs?:number, persistir?:boolean}} opcoes
   */
  async connect(opcoes = {}) {
    const log = getLogger();
    const host = String(opcoes.host || opcoes.ip || '');
    const porta = Number(opcoes.porta || opcoes.porta_tcp || PORTA_PADRAO);

    if (!host || !porta) {
      throw ToledoError.fromCode(CODES.DRIVER_ERROR, 'host e porta obrigatórios', { statusCode: 400 });
    }

    this.host = host;
    this.porta = porta;
    this.handshakeOk = false;
    this._online = false;
    this.status = 'CONNECTING';

    await log.info('Driver iniciado', {
      operacao: 'toledo_driver_v1',
      contexto: { host, porta, driver: DRIVER }
    });
    await log.info('ConnectionManager solicitado', {
      operacao: 'toledo_driver_v1',
      contexto: { host, porta }
    });

    let conn;
    try {
      conn = await this.cm.connect({
        host,
        porta,
        timeoutMs: opcoes.timeoutMs != null ? opcoes.timeoutMs : LIMITS.connectTimeoutMs,
        persistir: opcoes.persistir !== false
      });
    } catch (err) {
      this.status = 'OFFLINE';
      if (err.code === 'TCP_TIMEOUT' || /timeout/i.test(err.message || '')) {
        throw ToledoError.fromCode(CODES.CONNECTION_TIMEOUT, err.message, { statusCode: 408 });
      }
      throw ToledoError.fromCode(CODES.DEVICE_OFFLINE, err.message || 'Falha ao conectar', {
        statusCode: err.statusCode || 503
      });
    }

    await log.info('Socket conectado', {
      operacao: 'toledo_driver_v1',
      contexto: { host, porta, latencia: conn.latencia }
    });

    try {
      await this.handshake({
        timeoutMs: opcoes.handshakeTimeoutMs != null
          ? opcoes.handshakeTimeoutMs
          : LIMITS.handshakeTimeoutMs
      });
    } catch (err) {
      try { await this.cm.disconnect({ host, porta }); } catch (_) { /* ignore */ }
      this.status = 'OFFLINE';
      this._online = false;
      this.handshakeOk = false;
      throw err;
    }

    await log.info('Driver ONLINE', {
      operacao: 'toledo_driver_v1',
      contexto: { host, porta, driver: DRIVER, latencia: this.latencia }
    });

    return {
      driver: DRIVER,
      status: 'CONNECTED',
      handshake: true,
      latencia: this.latencia != null ? this.latencia : conn.latencia,
      fabricante: FABRICANTE,
      modelo: MODELO
    };
  }

  async disconnect() {
    if (!this.host || !this.porta) {
      this.status = 'OFFLINE';
      this._online = false;
      this.handshakeOk = false;
      return { status: 'DISCONNECTED', driver: DRIVER };
    }
    const alvo = { host: this.host, porta: this.porta };
    try {
      await this.cm.disconnect(alvo);
    } finally {
      this.status = 'OFFLINE';
      this._online = false;
      this.handshakeOk = false;
    }
    return { status: 'DISCONNECTED', driver: DRIVER };
  }

  isOnline() {
    return Boolean(this._online && this.handshakeOk && this.cm.isConnected(this._alvo()));
  }
}

module.exports = ToledoPrixIVDriver;
module.exports.ToledoPrixIVDriver = ToledoPrixIVDriver;
