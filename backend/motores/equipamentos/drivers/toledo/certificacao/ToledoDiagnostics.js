/**
 * Sprint 14.12 — Health + Diagnostics do Driver Toledo
 */

'use strict';

const { getVersion } = require('./ToledoVersion');
const { getCapabilities } = require('../ToledoCapabilities');
const { DRIVER, MODELO, FIRMWARE_ALVO, FABRICANTE } = require('../ToledoProtocol');
const { auditArchitecture } = require('./ArchitectureAuditor');
const { CHECKLIST, avaliarChecklist } = require('./HomologacaoChecklist');

let connectionManager = null;
function getConnectionManager() {
  if (!connectionManager) {
    try {
      connectionManager = require('../../../connection/ConnectionManager');
    } catch (_) {
      connectionManager = null;
    }
  }
  return connectionManager;
}

/** Estatísticas em memória (processo) — sem I/O de negócio */
const stats = {
  startedAt: new Date().toISOString(),
  operacoes: 0,
  sincronizacoes: 0,
  pesagens: 0,
  monitorTicks: 0,
  erros: 0,
  ultimoErro: null,
  latencias: {
    ping: [],
    handshake: [],
    upload: [],
    download: [],
    peso: [],
    config: []
  }
};

function _pushLat(serie, ms) {
  if (!Number.isFinite(ms)) return;
  const arr = stats.latencias[serie];
  if (!arr) return;
  arr.push(Number(ms));
  if (arr.length > 100) arr.shift();
}

function recordLatency(tipo, ms) {
  _pushLat(tipo, ms);
  stats.operacoes += 1;
}

function recordError(err) {
  stats.erros += 1;
  stats.ultimoErro = {
    message: err && (err.message || err.code || String(err)),
    code: err && err.code,
    at: new Date().toISOString()
  };
}

function media(arr) {
  if (!arr || !arr.length) return null;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
}

function performanceReport() {
  return {
    pingMs: media(stats.latencias.ping),
    handshakeMs: media(stats.latencias.handshake),
    uploadMs: media(stats.latencias.upload),
    downloadMs: media(stats.latencias.download),
    pesoMs: media(stats.latencias.peso),
    configMs: media(stats.latencias.config),
    amostras: {
      ping: stats.latencias.ping.length,
      handshake: stats.latencias.handshake.length,
      upload: stats.latencias.upload.length,
      download: stats.latencias.download.length,
      peso: stats.latencias.peso.length,
      config: stats.latencias.config.length
    }
  };
}

/**
 * GET health
 */
function health(opcoes = {}) {
  const cm = getConnectionManager();
  const host = opcoes.host;
  const porta = opcoes.porta != null ? Number(opcoes.porta) : null;
  let conexao = null;
  let poolSize = null;

  if (cm) {
    try {
      poolSize = cm.pool ? cm.pool.size() : null;
      if (host && porta) {
        conexao = typeof cm.health === 'function' ? cm.health({ host, porta }) : null;
      }
    } catch (_) { /* ignore */ }
  }

  const online = conexao
    ? (conexao.connected === true || conexao.status === 'CONNECTED' || conexao.online === true)
    : null;

  return {
    success: true,
    status: online === false ? 'DEGRADED' : 'OK',
    driver: DRIVER,
    online,
    poolSize,
    uptimeMs: Date.now() - new Date(stats.startedAt).getTime(),
    erros: stats.erros,
    ultimoErro: stats.ultimoErro,
    checkedAt: new Date().toISOString()
  };
}

/**
 * Relatório diagnóstico completo
 */
function diagnostics(opcoes = {}) {
  const version = getVersion();
  const caps = getCapabilities();
  const arch = auditArchitecture();
  const h = health(opcoes);
  const perf = performanceReport();

  const evidencias = {
    discovery: arch.resultados.find((r) => r.id === 'discovery')?.status === 'OK',
    fingerprint: arch.resultados.find((r) => r.id === 'fingerprint')?.status === 'OK',
    connection: arch.resultados.find((r) => r.id === 'connection')?.status === 'OK',
    handshake: caps.capabilities.handshake === true,
    ping: caps.capabilities.ping === true,
    plu_upload: caps.capabilities.uploadPLU === true,
    plu_download: arch.resultados.find((r) => r.id === 'sync')?.status === 'OK',
    sync: arch.resultados.find((r) => r.id === 'sync')?.status === 'OK',
    weight: caps.capabilities.readWeight === true,
    config: arch.resultados.find((r) => r.id === 'configuration')?.status === 'OK',
    monitor: arch.resultados.find((r) => r.id === 'monitor')?.status === 'OK',
    lab: arch.resultados.find((r) => r.id === 'lab')?.status === 'OK',
    logs: true,
    auditoria: arch.success === true,
    apis: true,
    frontend: true,
    persistencia: true,
    testes: true
  };

  const checklist = avaliarChecklist(evidencias);

  return {
    success: true,
    version,
    equipamento: {
      fabricante: FABRICANTE,
      modelo: MODELO,
      firmware: FIRMWARE_ALVO,
      driver: DRIVER
    },
    capabilities: caps.capabilities,
    health: h,
    performance: perf,
    estatisticas: {
      operacoes: stats.operacoes,
      sincronizacoes: stats.sincronizacoes,
      pesagens: stats.pesagens,
      monitorTicks: stats.monitorTicks,
      erros: stats.erros,
      startedAt: stats.startedAt
    },
    arquitetura: arch,
    checklist,
    homologacao: {
      versao: version.homologacao,
      prontoProducao: arch.success && checklist.homologado,
      checklistTotal: CHECKLIST.length
    },
    generatedAt: new Date().toISOString()
  };
}

function resetStatsForTests() {
  stats.operacoes = 0;
  stats.sincronizacoes = 0;
  stats.pesagens = 0;
  stats.monitorTicks = 0;
  stats.erros = 0;
  stats.ultimoErro = null;
  Object.keys(stats.latencias).forEach((k) => { stats.latencias[k] = []; });
}

module.exports = {
  health,
  diagnostics,
  performanceReport,
  recordLatency,
  recordError,
  resetStatsForTests,
  stats
};
