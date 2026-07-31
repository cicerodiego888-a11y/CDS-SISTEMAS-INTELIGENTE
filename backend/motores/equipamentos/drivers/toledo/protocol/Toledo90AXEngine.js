/**
 * Sprint 15.2 — Toledo90AXEngine
 * Motor oficial do protocolo. Toda comunicação lógica passa por aqui.
 * Transporte: apenas Connection Manager (send/receive ou getTcp).
 */

'use strict';

const frameBuilder = require('./ToledoFrameBuilder');
const frameParser = require('./ToledoFrameParser');
const checksum = require('./ToledoChecksum');
const commandRegistry = require('./ToledoCommandRegistry');
const ToledoSession = require('./ToledoSession');
const {
  TimeoutError,
  ConnectionLostError,
  InvalidFrameError
} = require('./ToledoProtocolErrors');

const FIRMWARE = '90AX';
const DRIVER = 'TOLEDO_PRIX4';

let logger = null;
function getLogger() {
  if (logger) return logger;
  try {
    logger = require('../../../services/LoggerService');
  } catch (_) {
    logger = {
      info: async (msg, ctx) => console.log('[toledo-90ax]', msg, ctx || ''),
      error: async (msg, ctx) => console.error('[toledo-90ax]', msg, ctx || '')
    };
  }
  return logger;
}

class Toledo90AXEngine {
  /**
   * @param {object} [deps]
   * @param {object} [deps.connectionManager]
   * @param {object} [deps.registry]
   */
  constructor(deps = {}) {
    this.cm = deps.connectionManager || require('../../../connection/ConnectionManager');
    this.registry = deps.registry || commandRegistry;
    this.host = null;
    this.porta = null;
    this.equipamentoId = null;
    this._historico = [];
    this._sessaoAtual = null;
    this._ultimo = null;
  }

  /**
   * Vincula alvo de transporte (sem abrir socket — ConnectionManager já conectou).
   */
  bind(alvo = {}) {
    this.host = alvo.host || alvo.ip || this.host;
    this.porta = alvo.porta != null ? Number(alvo.porta) : this.porta;
    this.equipamentoId = alvo.equipamentoId || alvo.equipamento_id || this.equipamentoId;
    return this;
  }

  _alvo() {
    return {
      host: this.host,
      porta: this.porta,
      equipamentoId: this.equipamentoId
    };
  }

  async _enviar(buf) {
    const alvo = this._alvo();
    if (typeof this.cm.send === 'function') {
      try {
        return await this.cm.send(alvo, buf);
      } catch (err) {
        // Fallback V1 getTcp
        if (err.code !== 'NOT_CONNECTED') throw err;
      }
    }
    const tcp = this.cm.getTcp?.(alvo);
    if (!tcp || !tcp.aberto) {
      throw new ConnectionLostError('Connection Manager: não conectado');
    }
    return tcp.write(buf);
  }

  async _receber(timeoutMs) {
    const alvo = this._alvo();
    if (typeof this.cm.receive === 'function') {
      try {
        return await this.cm.receive(alvo, { timeoutMs });
      } catch (err) {
        if (err.code !== 'NOT_CONNECTED') throw err;
      }
    }
    const tcp = this.cm.getTcp?.(alvo);
    if (!tcp || !tcp.aberto) {
      throw new ConnectionLostError('Connection Manager: não conectado');
    }
    return tcp.read({ timeoutMs });
  }

  async _labObserve(direction, bytes, meta = {}) {
    try {
      const lab = require('../../../laboratorio/EngineeringLab');
      if (direction === 'TX') await lab.observeTx(bytes, meta);
      else await lab.observeRx(bytes, meta);
    } catch (_) { /* lab nunca bloqueia */ }
  }

  _registrarHistorico(entrada) {
    this._historico.unshift(entrada);
    if (this._historico.length > 200) this._historico.length = 200;
    this._ultimo = entrada;
  }

  /**
   * API principal — Driver chama engine.execute(command).
   * @param {string} command — nome lógico (ping, identify, handshake…)
   * @param {object} [payload]
   * @param {object} [opcoes]
   */
  async execute(command, payload = null, opcoes = {}) {
    if (opcoes.host || opcoes.porta || opcoes.equipamentoId) {
      this.bind(opcoes);
    }

    const def = this.registry.obter(command);
    const timeoutMs = opcoes.timeoutMs != null ? opcoes.timeoutMs : def.timeoutMs;
    const retries = opcoes.retries != null ? opcoes.retries : def.retries;
    const session = new ToledoSession({ comando: def.name });
    this._sessaoAtual = session;

    const inicioTotal = Date.now();
    let ultimoErro = null;

    for (let tentativa = 0; tentativa <= retries; tentativa += 1) {
      session.tentativa = tentativa + 1;
      session.iniciar(def.name);
      try {
        const bodyPayload = def.buildPayload(payload);
        const tx = frameBuilder.build(def.wireCommand, bodyPayload);
        const chkTx = (() => {
          try {
            return frameParser.parse(tx).checksum;
          } catch (_) {
            return null;
          }
        })();

        session.marcarEnviado(tx);
        await this._labObserve('TX', tx, {
          host: this.host,
          porta: this.porta,
          comando: def.wireCommand,
          driver: DRIVER,
          firmware: FIRMWARE
        });
        await this._enviar(tx);

        await getLogger().info('Frame TX', {
          operacao: 'toledo_90ax',
          contexto: {
            comando: def.name,
            wire: def.wireCommand,
            checksum: chkTx,
            bytes: tx.length,
            tentativa: tentativa + 1
          }
        });

        const rx = await this._receber(timeoutMs);
        if (!rx || !rx.length) {
          session.marcarTimeout();
          throw new TimeoutError(`Timeout aguardando resposta de ${def.name}`, {
            comando: def.name,
            timeoutMs
          });
        }

        session.marcarRecebido(rx);
        await this._labObserve('RX', rx, {
          host: this.host,
          porta: this.porta,
          comando: def.name,
          driver: DRIVER,
          firmware: FIRMWARE
        });

        let parsed;
        try {
          parsed = frameParser.parse(rx);
        } catch (err) {
          session.marcarErro(err);
          throw err;
        }

        const match = def.matcher.match(parsed, {
          requestCommand: def.wireCommand,
          payload: bodyPayload
        });
        session.marcarSucesso(parsed);

        const resultado = {
          sucesso: true,
          command: def.name,
          wireCommand: def.wireCommand,
          responseCommand: match.command,
          payload: match.payload,
          checksum: parsed.checksum,
          latenciaMs: session.latenciaMs,
          tentativa: tentativa + 1,
          txHex: tx.toString('hex'),
          rxHex: rx.toString('hex'),
          tx: tx,
          rx: rx,
          parsed,
          session: session.snapshot(),
          firmware: FIRMWARE,
          driver: DRIVER,
          validacao: true,
          tempoTotalMs: Date.now() - inicioTotal
        };

        this._registrarHistorico({
          em: new Date().toISOString(),
          ...resultado,
          tx: undefined,
          rx: undefined,
          parsed: {
            command: parsed.command,
            payload: parsed.payload,
            checksum: parsed.checksum,
            valid: parsed.valid
          }
        });

        await getLogger().info('Frame RX OK', {
          operacao: 'toledo_90ax',
          contexto: {
            comando: def.name,
            response: match.command,
            checksum: parsed.checksum,
            latenciaMs: session.latenciaMs
          }
        });

        return resultado;
      } catch (err) {
        ultimoErro = err;
        if (err instanceof TimeoutError) {
          session.marcarTimeout();
        } else if (session.estado !== 'ERROR' && session.estado !== 'TIMEOUT') {
          session.marcarErro(err);
        }
        this._registrarHistorico({
          em: new Date().toISOString(),
          sucesso: false,
          command: def.name,
          wireCommand: def.wireCommand,
          erro: { mensagem: err.message, codigo: err.code },
          session: session.snapshot(),
          tentativa: tentativa + 1,
          firmware: FIRMWARE,
          driver: DRIVER
        });
        if (tentativa >= retries) break;
      }
    }

    throw ultimoErro || new InvalidFrameError(`Falha ao executar ${command}`);
  }

  /** Envia frame bruto já montado (lab / engenharia reversa). */
  async executeRaw(buffer, opcoes = {}) {
    if (opcoes.host || opcoes.porta) this.bind(opcoes);
    const tx = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || [], 'hex');
    const session = new ToledoSession({ comando: 'raw' });
    this._sessaoAtual = session;
    session.iniciar('raw');
    session.marcarEnviado(tx);
    await this._labObserve('TX', tx, { host: this.host, porta: this.porta, comando: 'RAW' });
    await this._enviar(tx);
    const timeoutMs = opcoes.timeoutMs != null ? opcoes.timeoutMs : 1500;
    const rx = await this._receber(timeoutMs);
    if (!rx || !rx.length) {
      session.marcarTimeout();
      throw new TimeoutError('Timeout em raw');
    }
    session.marcarRecebido(rx);
    await this._labObserve('RX', rx, { host: this.host, porta: this.porta, comando: 'RAW' });
    let parsed = null;
    try {
      parsed = frameParser.parse(rx);
      session.marcarSucesso(parsed);
    } catch (err) {
      session.marcarErro(err);
    }
    const out = {
      sucesso: Boolean(parsed?.valid),
      command: 'raw',
      checksum: parsed?.checksum || null,
      latenciaMs: session.latenciaMs,
      txHex: tx.toString('hex'),
      rxHex: rx.toString('hex'),
      parsed,
      session: session.snapshot(),
      firmware: FIRMWARE,
      driver: DRIVER
    };
    this._registrarHistorico({ em: new Date().toISOString(), ...out });
    return out;
  }

  history({ limite = 50 } = {}) {
    return this._historico.slice(0, Math.max(1, Math.min(200, Number(limite) || 50)));
  }

  status() {
    return {
      host: this.host,
      porta: this.porta,
      equipamentoId: this.equipamentoId,
      sessao: this._sessaoAtual ? this._sessaoAtual.snapshot() : null,
      ultimo: this._ultimo,
      comandos: this.registry.listar(),
      firmware: FIRMWARE,
      driver: DRIVER
    };
  }

  // Atalhos
  identify(payload, opcoes) { return this.execute('identify', payload, opcoes); }
  handshake(payload, opcoes) { return this.execute('handshake', payload, opcoes); }
  ping(payload, opcoes) { return this.execute('ping', payload, opcoes); }
  getStatus(payload, opcoes) { return this.execute('status', payload, opcoes); }
}

const engineSingleton = new Toledo90AXEngine();

module.exports = engineSingleton;
module.exports.Toledo90AXEngine = Toledo90AXEngine;
module.exports.createEngine = (deps) => new Toledo90AXEngine(deps);
module.exports.frameBuilder = frameBuilder;
module.exports.frameParser = frameParser;
module.exports.checksum = checksum;
module.exports.FIRMWARE = FIRMWARE;
module.exports.DRIVER = DRIVER;
