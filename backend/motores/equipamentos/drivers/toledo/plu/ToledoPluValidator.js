/**
 * Sprint 14.7 — ToledoPluValidator
 */

'use strict';

const { PluError, CODES } = require('./ToledoPluErrors');

const LIMITES = Object.freeze({
  pluMaxLen: 8,
  descricaoMax: 22,
  codigoBarrasMax: 14,
  precoMax: 999999.99,
  departamentoMax: 99
});

/**
 * @param {object} plu
 * @returns {{ok:boolean, errors:string[]}}
 */
function validate(plu = {}) {
  const errors = [];

  if (plu.plu == null || String(plu.plu).trim() === '') {
    errors.push(CODES.PLU_REQUIRED);
  } else if (String(plu.plu).length > LIMITES.pluMaxLen) {
    errors.push(CODES.TAMANHO_EXCEDIDO);
  }

  if (!plu.descricao || String(plu.descricao).trim() === '') {
    errors.push(CODES.DESCRICAO_REQUIRED);
  } else if (String(plu.descricao).length > LIMITES.descricaoMax) {
    errors.push(CODES.TAMANHO_EXCEDIDO);
  }

  if (plu.preco == null || Number.isNaN(Number(plu.preco))) {
    errors.push(CODES.PRECO_REQUIRED);
  } else if (Number(plu.preco) < 0 || Number(plu.preco) > LIMITES.precoMax) {
    errors.push(CODES.PRECO_INVALIDO);
  }

  if (plu.codigoBarras && String(plu.codigoBarras).length > LIMITES.codigoBarrasMax) {
    errors.push(CODES.TAMANHO_EXCEDIDO);
  }

  if (plu.departamento != null && Number(plu.departamento) > LIMITES.departamentoMax) {
    errors.push(CODES.TAMANHO_EXCEDIDO);
  }

  return { ok: errors.length === 0, errors, limites: LIMITES };
}

function assertValid(plu) {
  const r = validate(plu);
  if (!r.ok) {
    throw PluError.fromCode(CODES.VALIDATION_ERROR, `PLU inválido: ${r.errors.join(', ')}`, {
      errors: r.errors,
      statusCode: 400
    });
  }
  return true;
}

module.exports = {
  validate,
  assertValid,
  LIMITES
};
