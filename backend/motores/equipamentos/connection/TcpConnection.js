/**
 * Sprint 14.3 — TcpConnection
 * Abre/fecha sockets. Não interpreta bytes. Não conhece protocolo.
 */

'use strict';

const net = require('net');
const { EventEmitter } = require('events');

const TIMEOUT_PADRAO_MS = 1000;

class TcpConnection extends EventEmitter {
  /**
   * @param {{host:string, porta:number, timeoutMs?:number}} opcoes
   */
  constructor(opcoes = {}) {
    super();
    this.host = String(opcoes.host || '');
    this.porta = Number(opcoes.porta) || 0;
    this.timeoutMs = opcoes.timeoutMs != null ? Number(opcoes.timeoutMs) : TIMEOUT_PADRAO_MS;
    this.socket = null;
    this._aberto = false;
    this._latenciaConnect = null;
    /** Fila RX — evita perda se a resposta chegar antes de read()/receive(). */
    this._rxQueue = [];
  }

  get aberto() {
    return this._aberto && this.socket && !this.socket.destroyed;
  }

  /**
   * Abre socket TCP (apenas handshake). Não envia comandos.
   * @returns {Promise<{latencia:number}>}
   */
  open() {
    if (this.aberto) {
      return Promise.resolve({ latencia: this._latenciaConnect });
    }
    if (!this.host || !this.porta) {
      return Promise.reject(Object.assign(new Error('host e porta obrigatórios'), {
        code: 'TCP_INPUT_INVALIDO',
        statusCode: 400
      }));
    }

    return new Promise((resolve, reject) => {
      const inicio = process.hrtime.bigint();
      const socket = new net.Socket();
      this.socket = socket;
      let finalizado = false;

      const falhar = (err, status = 'error') => {
        if (finalizado) return;
        finalizado = true;
        this._aberto = false;
        try { socket.destroy(); } catch (_) { /* ignore */ }
        // Evita uncaughtException do EventEmitter em 'error' sem listener.
        if (status !== 'error' || this.listenerCount('error') > 0) {
          this.emit(status, err instanceof Error ? err : new Error(String(err)));
        } else if (status === 'error' && this.listenerCount('fail') > 0) {
          this.emit('fail', err);
        }
        reject(err instanceof Error ? err : new Error(String(err)));
      };

      socket.setTimeout(this.timeoutMs);

      socket.once('timeout', () => {
        const err = new Error('Timeout de conexão TCP');
        err.code = 'TCP_TIMEOUT';
        err.statusCode = 408;
        this.emit('timeout', err);
        falhar(err, 'timeout');
      });

      socket.once('error', (err) => falhar(err));

      socket.once('connect', () => {
        if (finalizado) return;
        finalizado = true;
        socket.removeAllListeners('timeout');
        socket.removeAllListeners('error');
        this._latenciaConnect = Math.max(0, Math.round(Number(process.hrtime.bigint() - inicio) / 1e6));
        this._aberto = true;
        // Handshake concluído: remove timeout de conexão.
        // Idle timeout agressivo ficará para Auto Recovery (sprint futura).
        socket.setTimeout(0);
        socket.on('error', (err) => {
          this._aberto = false;
          this.emit('error', err);
        });
        socket.on('close', () => {
          this._aberto = false;
          this.emit('close');
        });
        socket.on('data', (buf) => {
          // Apenas encaminha bytes crus — sem parser.
          // Bufferiza para read() não perder frames rápidos (echo/lab).
          this._rxQueue.push(Buffer.from(buf));
          this.emit('data', buf);
        });
        this.emit('connect', { latencia: this._latenciaConnect });
        resolve({ latencia: this._latenciaConnect });
      });

      this.emit('creating');
      try {
        socket.connect(this.porta, this.host);
      } catch (err) {
        falhar(err);
      }
    });
  }

  /**
   * Escreve bytes crus (infraestrutura para Drivers futuros).
   * Sprint 14.3: ConnectionManager NÃO chama write com protocolo.
   */
  write(data) {
    if (!this.aberto) {
      throw Object.assign(new Error('Socket não conectado'), { code: 'TCP_NOT_CONNECTED' });
    }
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    this.socket.write(buf);
    this.emit('write', buf.length);
    return buf.length;
  }

  /**
   * Lê próximo pacote (Promise única) ou null se timeoutMs esgotar.
   * Sem interpretação.
   */
  read({ timeoutMs = 500 } = {}) {
    if (!this.aberto) {
      return Promise.reject(Object.assign(new Error('Socket não conectado'), { code: 'TCP_NOT_CONNECTED' }));
    }
    if (this._rxQueue.length) {
      return Promise.resolve(this._rxQueue.shift());
    }
    return new Promise((resolve) => {
      let finalizado = false;
      const concluir = (valor) => {
        if (finalizado) return;
        finalizado = true;
        limpar();
        resolve(valor);
      };
      const onData = () => {
        // O handler do socket já enfileirou o buffer.
        concluir(this._rxQueue.length ? this._rxQueue.shift() : null);
      };
      const onClose = () => concluir(null);
      const timer = setTimeout(() => concluir(null), Math.max(0, Number(timeoutMs) || 0));
      const limpar = () => {
        clearTimeout(timer);
        this.removeListener('data', onData);
        this.removeListener('close', onClose);
        this.removeListener('destroy', onClose);
      };
      this.once('data', onData);
      this.once('close', onClose);
      this.once('destroy', onClose);
      // Corrida: dados podem ter entrado entre o check inicial e o once().
      if (this._rxQueue.length) {
        concluir(this._rxQueue.shift());
      }
    });
  }

  close() {
    this._rxQueue = [];
    if (!this.socket) {
      this._aberto = false;
      return Promise.resolve();
    }
    if (this.socket.destroyed) {
      this._aberto = false;
      this.socket = null;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const sock = this.socket;
      let doneOnce = false;
      const done = () => {
        if (doneOnce) return;
        doneOnce = true;
        this._aberto = false;
        resolve();
      };
      try {
        sock.removeAllListeners('timeout');
        sock.once('close', done);
        sock.end();
        setTimeout(() => {
          try { sock.destroy(); } catch (_) { /* ignore */ }
          done();
        }, 150).unref?.();
      } catch (_) {
        try { sock.destroy(); } catch (__) { /* ignore */ }
        done();
      }
    });
  }

  destroy() {
    this._aberto = false;
    this._rxQueue = [];
    if (!this.socket) return;
    try {
      this.socket.removeAllListeners();
      this.socket.destroy();
    } catch (_) { /* ignore */ }
    this.socket = null;
    this.emit('destroy');
  }
}

module.exports = TcpConnection;
module.exports.TcpConnection = TcpConnection;
module.exports.TIMEOUT_PADRAO_MS = TIMEOUT_PADRAO_MS;
