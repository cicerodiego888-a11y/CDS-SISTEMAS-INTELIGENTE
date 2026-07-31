/**
 * Sprint 14.7 — ToledoPluMapper
 * Converte Produto CDS → estrutura da balança. Sem comunicação.
 */

'use strict';

function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function str(v, max) {
  const s = v == null ? '' : String(v).trim();
  return max != null ? s.slice(0, max) : s;
}

/**
 * @param {object} produto CDS
 * @returns {object} PLU Toledo
 */
function map(produto = {}) {
  const plu = produto.plu != null
    ? String(produto.plu).trim()
    : (produto.codigo != null ? String(produto.codigo).trim() : '');

  return {
    produto_id: produto.id != null ? produto.id : (produto.produto_id != null ? produto.produto_id : null),
    plu,
    descricao: str(produto.descricao || produto.nome || produto.descricao_reduzida, 22),
    preco: num(produto.preco != null ? produto.preco : produto.preco_venda, NaN),
    validade: produto.validade != null ? str(produto.validade, 20) : (produto.dias_validade != null ? String(produto.dias_validade) : null),
    tara: num(produto.tara, 0),
    departamento: produto.departamento != null
      ? num(produto.departamento, 0)
      : (produto.departamento_id != null ? num(produto.departamento_id, 0) : 0),
    codigoBarras: str(produto.codigoBarras || produto.codigo_barras || produto.ean || produto.gtin, 14)
  };
}

function mapMany(lista) {
  return (Array.isArray(lista) ? lista : []).map(map);
}

module.exports = {
  map,
  mapMany
};
