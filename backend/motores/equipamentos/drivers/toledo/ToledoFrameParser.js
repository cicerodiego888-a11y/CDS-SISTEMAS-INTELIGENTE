/**
 * Sprint 14.4 — ToledoFrameParser
 * Valida estrutura de frames. Sem interpretar peso.
 */

'use strict';

const { STX, ETX, SEP, LIMITS, RESPONSES } = require('./ToledoProtocol');
const { checksum } = require('./ToledoFrameBuilder');
const { ToledoError, CODES } = require('./ToledoErrors');

/**
 * @param {Buffer|string} raw
 * @returns {Buffer}
 */
function decode(raw) {
  if (Buffer.isBuffer(raw)) return raw;
  if (typeof raw === 'string') return Buffer.from(raw, 'binary');
  throw ToledoError.fromCode(CODES.INVALID_FRAME, 'Frame vazio ou inválido');
}

/**
 * @param {Buffer} buf
 * @returns {{ok:boolean, error?:string, code?:string}}
 */
function validate(buf) {
  try {
    parse(buf);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      code: err.code || CODES.INVALID_FRAME
    };
  }
}

/**
 * @param {Buffer|string} raw
 * @returns {{comando:string, payload:object|string|null, checksum:string, raw:Buffer, isAck:boolean, isNak:boolean}}
 */
function parse(raw) {
  const buf = decode(raw);
  if (!buf || buf.length < 6) {
    throw ToledoError.fromCode(CODES.INVALID_FRAME, 'Frame muito curto');
  }
  if (buf[0] !== STX) {
    throw ToledoError.fromCode(CODES.INVALID_FRAME, 'STX ausente');
  }
  if (buf[buf.length - 1] !== ETX) {
    throw ToledoError.fromCode(CODES.INVALID_FRAME, 'ETX ausente');
  }

  const inner = buf.subarray(1, buf.length - 1);
  if (inner.length < LIMITS.cmdLen + 1 + LIMITS.checksumLen) {
    throw ToledoError.fromCode(CODES.INVALID_FRAME, 'Estrutura incompleta');
  }

  const chkAscii = inner.subarray(inner.length - LIMITS.checksumLen).toString('ascii');
  const body = inner.subarray(0, inner.length - LIMITS.checksumLen);
  const expected = checksum(body);
  if (chkAscii.toUpperCase() !== expected) {
    throw ToledoError.fromCode(CODES.CHECKSUM_ERROR, `Checksum inválido: ${chkAscii} ≠ ${expected}`);
  }

  const comando = body.subarray(0, LIMITS.cmdLen).toString('ascii').toUpperCase();
  if (body[LIMITS.cmdLen] !== SEP) {
    throw ToledoError.fromCode(CODES.INVALID_FRAME, 'SEP ausente');
  }
  const payloadBuf = body.subarray(LIMITS.cmdLen + 1);
  let payload = null;
  if (payloadBuf.length) {
    const texto = payloadBuf.toString('utf8');
    try {
      payload = JSON.parse(texto);
    } catch (_) {
      payload = texto;
    }
  }

  return {
    comando,
    payload,
    checksum: chkAscii.toUpperCase(),
    raw: buf,
    isAck: comando === RESPONSES.ACK,
    isNak: comando === RESPONSES.NAK
  };
}

module.exports = {
  parse,
  validate,
  decode
};
