/**
 * Sprint 14.4 — ToledoFrameBuilder
 * Monta frames. Sem comunicação.
 *
 * Formato V1:
 *   [STX][CMD 2 ASCII][SEP][PAYLOAD UTF-8][CHK 2 hex ASCII][ETX]
 */

'use strict';

const {
  STX, ETX, SEP, COMMANDS, LIMITS
} = require('./ToledoProtocol');
const { ToledoError, CODES } = require('./ToledoErrors');

function xorChecksum(buffer) {
  let x = 0;
  for (let i = 0; i < buffer.length; i += 1) x ^= buffer[i];
  return x & 0xff;
}

/**
 * @param {Buffer} bodyBytes bytes após STX e antes do checksum
 * @returns {string} 2 hex uppercase
 */
function checksum(bodyBytes) {
  const hex = xorChecksum(Buffer.isBuffer(bodyBytes) ? bodyBytes : Buffer.from(bodyBytes)).toString(16);
  return hex.padStart(LIMITS.checksumLen, '0').toUpperCase().slice(-LIMITS.checksumLen);
}

function encode(payload) {
  if (payload == null) return Buffer.alloc(0);
  if (Buffer.isBuffer(payload)) return payload;
  if (typeof payload === 'string') return Buffer.from(payload, 'utf8');
  return Buffer.from(JSON.stringify(payload), 'utf8');
}

/**
 * @param {string} comando
 * @param {*} [payload]
 * @returns {Buffer}
 */
function build(comando, payload) {
  const cmd = String(comando || '').toUpperCase().slice(0, LIMITS.cmdLen);
  if (cmd.length !== LIMITS.cmdLen) {
    throw ToledoError.fromCode(CODES.INVALID_FRAME, `Comando inválido: ${comando}`);
  }
  const payloadBuf = encode(payload);
  if (payloadBuf.length > LIMITS.maxPayloadBytes) {
    throw ToledoError.fromCode(CODES.INVALID_FRAME, 'Payload excede limite');
  }
  const body = Buffer.concat([
    Buffer.from(cmd, 'ascii'),
    Buffer.from([SEP]),
    payloadBuf
  ]);
  const chk = checksum(body);
  return Buffer.concat([
    Buffer.from([STX]),
    body,
    Buffer.from(chk, 'ascii'),
    Buffer.from([ETX])
  ]);
}

function buildHandshake(extra = {}) {
  return build(COMMANDS.HANDSHAKE, {
    driver: 'TOLEDO_PRIX4',
    versao: '14.4',
    firmware_alvo: '90AX',
    ...extra
  });
}

function buildPing(extra = {}) {
  return build(COMMANDS.PING, { ts: Date.now(), ...extra });
}

function buildAck(payload = null) {
  return build(require('./ToledoProtocol').RESPONSES.ACK, payload);
}

module.exports = {
  build,
  checksum,
  encode,
  buildHandshake,
  buildPing,
  buildAck,
  xorChecksum
};
