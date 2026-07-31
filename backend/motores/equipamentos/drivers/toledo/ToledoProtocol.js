/**
 * Sprint 14.4 — ToledoProtocol
 * Constantes, comandos, respostas e limites. Nada hardcoded no Driver.
 */

'use strict';

const DRIVER = 'TOLEDO_PRIX4';
const FABRICANTE = 'Toledo';
const MODELO = 'Prix IV Uno';
const FIRMWARE_ALVO = '90AX';

const STX = 0x02;
const ETX = 0x03;
const SEP = 0x1c;

const COMMANDS = Object.freeze({
  HANDSHAKE: 'HS',
  PING: 'PN',
  STATUS: 'ST',
  UPLOAD_PLU: 'EP',
  DOWNLOAD_PLU: 'DP',
  READ_WEIGHT: 'PW',
  CONFIG_READ: 'CR',
  CONFIG_WRITE: 'CW'
});

const RESPONSES = Object.freeze({
  ACK: 'AK',
  NAK: 'NK',
  STATUS: 'RS',
  PLU_DATA: 'PD',
  WEIGHT: 'PW',
  CONFIG: 'CF'
});

const ERRORS = Object.freeze({
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  INVALID_FRAME: 'INVALID_FRAME',
  CHECKSUM_ERROR: 'CHECKSUM_ERROR',
  UNSUPPORTED_PROTOCOL: 'UNSUPPORTED_PROTOCOL',
  DEVICE_OFFLINE: 'DEVICE_OFFLINE',
  INVALID_RESPONSE: 'INVALID_RESPONSE'
});

const LIMITS = Object.freeze({
  cmdLen: 2,
  checksumLen: 2,
  maxPayloadBytes: 4096,
  handshakeTimeoutMs: 2000,
  pingTimeoutMs: 1500,
  connectTimeoutMs: 1000,
  readTimeoutMs: 1500
});

const PORTA_PADRAO = 9000;

module.exports = {
  DRIVER,
  FABRICANTE,
  MODELO,
  FIRMWARE_ALVO,
  STX,
  ETX,
  SEP,
  COMMANDS,
  RESPONSES,
  ERRORS,
  LIMITS,
  PORTA_PADRAO
};
