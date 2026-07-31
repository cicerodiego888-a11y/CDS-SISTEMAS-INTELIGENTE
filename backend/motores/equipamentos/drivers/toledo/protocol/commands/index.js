/**
 * Sprint 15.2 — commands (registro de estratégias)
 */

'use strict';

const ToledoResponseMatcher = require('../ToledoResponseMatcher');

function def(nome, wire, opcoes = {}) {
  return {
    name: nome,
    wireCommand: wire,
    timeoutMs: opcoes.timeoutMs != null ? opcoes.timeoutMs : 1500,
    retries: opcoes.retries != null ? opcoes.retries : 1,
    buildPayload: typeof opcoes.buildPayload === 'function'
      ? opcoes.buildPayload
      : ((payload) => payload || null),
    matcher: opcoes.matcher || new ToledoResponseMatcher({
      accept: opcoes.accept || ['AK'],
      reject: opcoes.reject || ['NK'],
      requestCommand: wire
    }),
    describe: opcoes.describe || nome
  };
}

const identify = def('identify', 'HS', {
  timeoutMs: 2000,
  retries: 2,
  accept: ['AK', 'RS', 'ST'],
  buildPayload: (p) => ({
    driver: 'TOLEDO_PRIX4',
    versao: '15.2',
    firmware_alvo: '90AX',
    ...(p || {})
  }),
  describe: 'Identificação / handshake 90AX'
});

const handshake = def('handshake', 'HS', {
  timeoutMs: 2000,
  retries: 2,
  accept: ['AK', 'RS'],
  buildPayload: (p) => ({
    driver: 'TOLEDO_PRIX4',
    versao: '15.2',
    firmware_alvo: '90AX',
    ...(p || {})
  })
});

const ping = def('ping', 'PN', {
  timeoutMs: 1500,
  retries: 1,
  accept: ['AK'],
  buildPayload: (p) => ({ ts: Date.now(), ...(p || {}) })
});

const status = def('status', 'ST', {
  timeoutMs: 2000,
  retries: 1,
  accept: ['AK', 'RS'],
  buildPayload: (p) => p || { ts: Date.now() }
});

const keepAlive = def('keepAlive', 'PN', {
  timeoutMs: 1000,
  retries: 0,
  accept: ['AK'],
  buildPayload: () => ({ keepalive: true, ts: Date.now() })
});

const uploadPlu = def('uploadPlu', 'EP', {
  timeoutMs: 3000,
  retries: 1,
  accept: ['AK'],
  buildPayload: (p) => p || {}
});

const uploadDepartment = def('uploadDepartment', 'DP', {
  timeoutMs: 3000,
  retries: 1,
  accept: ['AK'],
  buildPayload: (p) => p || {}
});

const uploadPrice = def('uploadPrice', 'EP', {
  timeoutMs: 3000,
  retries: 1,
  accept: ['AK'],
  buildPayload: (p) => ({ tipo: 'preco', ...(p || {}) })
});

const uploadLabel = def('uploadLabel', 'EP', {
  timeoutMs: 3000,
  retries: 1,
  accept: ['AK'],
  buildPayload: (p) => ({ tipo: 'etiqueta', ...(p || {}) })
});

module.exports = {
  identify,
  handshake,
  ping,
  status,
  keepAlive,
  uploadPlu,
  uploadDepartment,
  uploadPrice,
  uploadLabel
};
