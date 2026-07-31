/**
 * Sprint 14.7 — PluController
 */

'use strict';

const toledoPluEngine = require('./ToledoPluEngine');

function responderErro(res, error, mensagemPadrao, statusPadrao = 500) {
  const status = error.statusCode || statusPadrao;
  return res.status(status).json({
    success: false,
    error: error.message || mensagemPadrao,
    code: error.code || null
  });
}

async function upload(req, res) {
  try {
    const body = req.body || {};
    const produto = body.produto || body;
    const result = await toledoPluEngine.upload(produto, {
      host: body.host || body.ip,
      porta: body.porta != null ? body.porta : body.porta_tcp,
      persistir: body.persistir !== false,
      timeout: body.timeout
    });
    return res.json(result);
  } catch (error) {
    return responderErro(res, error, 'Erro no upload de PLU.');
  }
}

async function uploadMany(req, res) {
  try {
    const body = req.body || {};
    const lista = body.produtos || body.lista || body.items || [];
    const result = await toledoPluEngine.uploadMany(lista, {
      host: body.host || body.ip,
      porta: body.porta != null ? body.porta : body.porta_tcp,
      persistir: body.persistir !== false,
      timeout: body.timeout
    });
    return res.json(result);
  } catch (error) {
    return responderErro(res, error, 'Erro no upload em lote.');
  }
}

async function history(req, res) {
  try {
    const historico = await toledoPluEngine.history({
      limite: Number(req.query.limite) || 50,
      host: req.query.host,
      porta: req.query.porta != null ? Number(req.query.porta) : undefined,
      plu: req.query.plu
    });
    return res.json({ success: true, historico });
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar histórico PLU.');
  }
}

async function status(req, res) {
  try {
    return res.json({ success: true, ...toledoPluEngine.status() });
  } catch (error) {
    return responderErro(res, error, 'Erro ao consultar status PLU.');
  }
}

async function cancel(req, res) {
  try {
    return res.json({ success: true, ...toledoPluEngine.cancel() });
  } catch (error) {
    return responderErro(res, error, 'Erro ao cancelar upload.');
  }
}

async function retry(req, res) {
  try {
    const body = req.body || {};
    const result = await toledoPluEngine.retry(body.syncId || body.id, {
      host: body.host,
      porta: body.porta,
      produto: body.produto
    });
    return res.json(result);
  } catch (error) {
    return responderErro(res, error, 'Erro no retry de PLU.');
  }
}

module.exports = {
  upload,
  uploadMany,
  history,
  status,
  cancel,
  retry
};
