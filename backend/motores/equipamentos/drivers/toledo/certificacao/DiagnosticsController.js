/**
 * Sprint 14.12 — DiagnosticsController
 */

'use strict';

const { getVersion } = require('./ToledoVersion');
const { health, diagnostics } = require('./ToledoDiagnostics');
const { buildCertificationReport } = require('./CertificationReport');
const { auditArchitecture } = require('./ArchitectureAuditor');

function responderErro(res, error, mensagemPadrao, statusPadrao = 500) {
  const status = error.statusCode || statusPadrao;
  return res.status(status).json({
    success: false,
    error: error.message || mensagemPadrao,
    code: error.code || null
  });
}

async function version(req, res) {
  try {
    return res.json({ success: true, ...getVersion() });
  } catch (error) {
    return responderErro(res, error, 'Erro ao obter versão do driver.');
  }
}

async function healthHandler(req, res) {
  try {
    const result = health({
      host: req.query.host,
      porta: req.query.porta != null ? Number(req.query.porta) : undefined
    });
    return res.json(result);
  } catch (error) {
    return responderErro(res, error, 'Erro ao consultar health do driver.');
  }
}

async function diagnosticsHandler(req, res) {
  try {
    const result = diagnostics({
      host: req.query.host,
      porta: req.query.porta != null ? Number(req.query.porta) : undefined
    });
    return res.json(result);
  } catch (error) {
    return responderErro(res, error, 'Erro ao gerar diagnóstico.');
  }
}

async function certification(req, res) {
  try {
    return res.json({
      success: true,
      report: buildCertificationReport({
        host: req.query.host,
        porta: req.query.porta != null ? Number(req.query.porta) : undefined
      })
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao gerar relatório de certificação.');
  }
}

async function architecture(req, res) {
  try {
    return res.json(auditArchitecture());
  } catch (error) {
    return responderErro(res, error, 'Erro na auditoria arquitetural.');
  }
}

module.exports = {
  version,
  health: healthHandler,
  diagnostics: diagnosticsHandler,
  certification,
  architecture
};
