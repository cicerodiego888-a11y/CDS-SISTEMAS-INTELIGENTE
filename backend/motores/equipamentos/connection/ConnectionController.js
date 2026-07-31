/**
 * Sprint 14.3 / 15.1 — ConnectionController
 */

'use strict';

const connectionManager = require('./ConnectionManager');

function responderErro(res, error, mensagemPadrao, statusPadrao = 500) {
  const status = error.statusCode || statusPadrao;
  return res.status(status).json({
    success: false,
    error: error.message || mensagemPadrao,
    code: error.code || null
  });
}

function extrairAlvo(req) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const q = req.query || {};
  const id = req.params?.id != null ? Number(req.params.id) : null;
  return {
    id: id || body.id || body.equipamento_id || body.equipamentoId || null,
    equipamentoId: id || body.equipamentoId || body.equipamento_id || null,
    host: body.host || body.ip || q.host || q.ip,
    porta: body.porta != null ? body.porta : (body.porta_tcp != null ? body.porta_tcp : (q.porta != null ? q.porta : q.porta_tcp)),
    porta_com: body.porta_com || q.porta_com,
    transporte: body.transporte || q.transporte,
    timeoutMs: body.timeoutMs != null ? body.timeoutMs : q.timeoutMs,
    persistir: body.persistir !== false
  };
}

/** POST /api/equipamentos/connect */
async function connect(req, res) {
  try {
    const alvo = extrairAlvo(req);
    const result = await connectionManager.connect(alvo);
    return res.json({
      status: result.status,
      estado: result.estado,
      latencia: result.latencia,
      reutilizada: result.reutilizada || false,
      equipamentoId: result.equipamentoId || null,
      transporte: result.transporte || null
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao conectar.');
  }
}

/** GET /api/equipamentos/status */
async function status(req, res) {
  try {
    const alvo = extrairAlvo(req);
    if (!alvo.host && !alvo.porta && !alvo.equipamentoId && !alvo.id) {
      const err = new Error('Informe host/porta ou id do equipamento.');
      err.statusCode = 400;
      throw err;
    }
    // host/porta sync path
    if (alvo.host && alvo.porta && !alvo.equipamentoId) {
      const h = connectionManager.health({ host: alvo.host, porta: alvo.porta });
      return res.json({
        status: h.status,
        estado: h.estado,
        latencia: h.latencia,
        uptime: h.uptime,
        metricas: h.metricas,
        socket: h.socket,
        heartbeat: h.heartbeat
      });
    }
    const opts = await Promise.resolve(alvo);
    const h = connectionManager.health(opts);
    return res.json({
      status: h.status,
      estado: h.estado,
      latencia: h.latencia,
      uptime: h.uptime,
      metricas: h.metricas,
      socket: h.socket,
      heartbeat: h.heartbeat,
      equipamentoId: h.equipamentoId
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao consultar status.');
  }
}

/** POST /api/equipamentos/disconnect */
async function disconnect(req, res) {
  try {
    const alvo = extrairAlvo(req);
    const result = await connectionManager.disconnect(alvo);
    return res.json({
      status: result.status,
      estado: result.estado,
      latencia: result.latencia
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao desconectar.');
  }
}

/** POST /api/equipamentos/reconnect */
async function reconnect(req, res) {
  try {
    const alvo = extrairAlvo(req);
    const result = await connectionManager.reconnect(alvo);
    return res.json({
      status: result.status,
      estado: result.estado,
      latencia: result.latencia,
      reconexoes: result.reconexoes
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao reconectar.');
  }
}

/** POST /api/equipamentos/ping  ou  POST /:id/ping */
async function ping(req, res) {
  try {
    const alvo = extrairAlvo(req);
    const result = await connectionManager.ping(alvo);
    return res.json(result);
  } catch (error) {
    return responderErro(res, error, 'Erro ao executar ping.');
  }
}

/** GET /api/equipamentos/connections */
async function listConnections(req, res) {
  try {
    const connections = connectionManager.listConnections();
    return res.json({ success: true, connections, total: connections.length });
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar conexões.');
  }
}

/** Sprint 15.1 — por equipamento id */
async function connectById(req, res) {
  req.params = req.params || {};
  return connect(req, res);
}

async function disconnectById(req, res) {
  return disconnect(req, res);
}

async function reconnectById(req, res) {
  return reconnect(req, res);
}

async function pingById(req, res) {
  return ping(req, res);
}

async function statusById(req, res) {
  return status(req, res);
}

module.exports = {
  connect,
  status,
  disconnect,
  reconnect,
  ping,
  listConnections,
  connectById,
  disconnectById,
  reconnectById,
  pingById,
  statusById
};
