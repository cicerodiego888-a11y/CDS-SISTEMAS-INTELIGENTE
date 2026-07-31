/**
 * Sprint 15.7 — Controller HTTP do Device Profile SDK
 * Não importa ./index (evita dependência circular com Routes).
 */

'use strict';

const registry = require('./DriverRegistry');
const loader = require('./DriverLoader');

function ensureLoaded(opcoes = {}) {
  if (!loader.estaCarregado() || opcoes.forcar) {
    return loader.carregarTodos(opcoes);
  }
  return loader.obterRelatorio();
}

function reloadSdk() {
  return loader.reload();
}

function ok(res, data) {
  return res.json({ success: true, ...data });
}

function fail(res, error, status = 500) {
  return res.status(status).json({
    success: false,
    error: error.message || String(error)
  });
}

async function enriquecerContagem(profiles) {
  let contagem = {};
  try {
    const db = require('../../../config/database');
    const rows = await new Promise((resolve, reject) => {
      db.all(
        `SELECT UPPER(COALESCE(fabricante,'')) AS fab,
                UPPER(COALESCE(modelo,'')) AS mod,
                COUNT(*) AS qtd
         FROM equipamentos
         GROUP BY fab, mod`,
        [],
        (err, r) => (err ? reject(err) : resolve(r || []))
      );
    });
    rows.forEach((r) => {
      contagem[`${r.fab}|${r.mod}`] = Number(r.qtd) || 0;
    });
  } catch {
    contagem = {};
  }

  return profiles.map((p) => {
    const key = `${String(p.fabricante || '').toUpperCase()}|${String(p.modelo || '').toUpperCase()}`;
    const alt = Object.keys(contagem).find((k) => {
      const [f, m] = k.split('|');
      return f.includes(String(p.fabricante || '').toUpperCase().slice(0, 4))
        && m.includes(String(p.modelo || '').toUpperCase().replace(/\s+/g, '').slice(0, 4));
    });
    return {
      ...p,
      equipamentosCount: contagem[key] || (alt ? contagem[alt] : 0)
    };
  });
}

const DriverSdkController = {
  async listar(req, res) {
    try {
      ensureLoaded();
      let drivers = registry.listar({
        categoria: req.query.categoria,
        fabricante: req.query.fabricante,
        capability: req.query.capability
      });
      drivers = await enriquecerContagem(drivers);
      return ok(res, {
        drivers,
        total: drivers.length,
        relatorio: loader.obterRelatorio()
      });
    } catch (error) {
      return fail(res, error);
    }
  },

  async obter(req, res) {
    try {
      ensureLoaded();
      const profile = registry.buscar(req.params.id);
      if (!profile) {
        return fail(res, new Error(`Driver não encontrado: ${req.params.id}`), 404);
      }
      const [enriquecido] = await enriquecerContagem([profile.toJSON()]);
      return ok(res, { driver: enriquecido });
    } catch (error) {
      return fail(res, error);
    }
  },

  async categorias(req, res) {
    try {
      ensureLoaded();
      return ok(res, {
        categories: registry.listarCategorias(),
        fabricantes: registry.listarFabricantes(),
        capabilities: require('./DriverCapabilities').ALL_CANONICAL
      });
    } catch (error) {
      return fail(res, error);
    }
  },

  async reload(req, res) {
    try {
      const relatorio = reloadSdk();
      return ok(res, {
        mensagem: 'Drivers recarregados',
        relatorio
      });
    } catch (error) {
      return fail(res, error);
    }
  },

  async laboratorio(req, res) {
    try {
      ensureLoaded();
      const rel = loader.obterRelatorio() || {};
      return ok(res, {
        laboratorio: {
          drivers: registry.listar(),
          manifests: (rel.carregados || []).map((c) => ({
            id: c.id,
            arquivo: c.arquivo,
            tempoCargaMs: c.tempoCargaMs,
            estado: c.estado,
            capabilities: c.capabilities
          })),
          validacao: {
            erros: rel.erros || [],
            ignorados: rel.ignorados || []
          },
          registro: {
            total: registry.tamanho(),
            categorias: registry.listarCategorias()
          },
          tempoCargaMs: rel.tempoTotalMs || null,
          timestamp: rel.timestamp || null
        }
      });
    } catch (error) {
      return fail(res, error);
    }
  }
};

module.exports = DriverSdkController;
