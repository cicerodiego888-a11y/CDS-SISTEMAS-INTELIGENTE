/**
 * RC4.31.25 — Utilizar Histórico da Última Compra do Produto
 * Executar: npm run test:compras-rc43125
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const comprasJs = fs.readFileSync(path.join(ROOT, 'frontend/erp/js/compras.js'), 'utf8');
const produtosRota = fs.readFileSync(path.join(ROOT, 'backend/rotas/produtos.js'), 'utf8');

const MARGEM_PADRAO_FALLBACK_COMPRA = 30;
const ORIGEM = {
  ULTIMA_COMPRA: 'ultima_compra',
  CADASTRO: 'cadastro',
  PADRAO: 'padrao'
};

function extrairMargemCadastradaProduto(produto) {
  if (!produto || typeof produto !== 'object') {
    return { margem: MARGEM_PADRAO_FALLBACK_COMPRA, fallback: true, origem: ORIGEM.PADRAO };
  }
  const candidatos = [
    produto.lucro_percentual,
    produto.margem_lucro,
    produto.margem_padrao,
    produto.percentual_lucro
  ];
  for (const raw of candidatos) {
    if (raw === undefined || raw === null || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n)) {
      return { margem: n, fallback: false, origem: ORIGEM.CADASTRO };
    }
  }
  return { margem: MARGEM_PADRAO_FALLBACK_COMPRA, fallback: true, origem: ORIGEM.PADRAO };
}

function resolverDadosComerciaisProdutoCompra(produto, ultimaCompra = null) {
  const cadastro = extrairMargemCadastradaProduto(produto);
  const precoCadastro = Number(produto?.preco_compra || 0);
  const vendaCadastro = Number(produto?.preco_venda || 0);

  if (ultimaCompra && typeof ultimaCompra === 'object') {
    const precoHist = Number(
      ultimaCompra.custo
      ?? ultimaCompra.custo_unitario_final
      ?? ultimaCompra.preco_unitario
      ?? 0
    );
    const margemRaw = ultimaCompra.margem_lucro;
    const temMargemHist = margemRaw !== undefined && margemRaw !== null && margemRaw !== ''
      && Number.isFinite(Number(margemRaw));
    const margem = temMargemHist ? Number(margemRaw) : cadastro.margem;
    const vendaHist = Number(ultimaCompra.preco_venda_sugerido || 0);
    const preco = precoHist > 0 ? precoHist : precoCadastro;
    const venda = vendaHist > 0
      ? vendaHist
      : (vendaCadastro > 0
        ? vendaCadastro
        : (preco > 0 ? Number((preco * (1 + margem / 100)).toFixed(2)) : 0));
    const usouHistorico = precoHist > 0 || temMargemHist || vendaHist > 0;
    return {
      preco_unitario: preco,
      margem_lucro: margem,
      preco_venda_sugerido: venda,
      atualizar_preco_venda: Number(ultimaCompra.atualizar_preco_venda ?? 1) === 0 ? 0 : 1,
      origem: usouHistorico
        ? ORIGEM.ULTIMA_COMPRA
        : (cadastro.fallback ? ORIGEM.PADRAO : ORIGEM.CADASTRO),
      fallback: !temMargemHist && cadastro.fallback
    };
  }

  if (!cadastro.fallback) {
    const venda = vendaCadastro > 0
      ? vendaCadastro
      : (precoCadastro > 0
        ? Number((precoCadastro * (1 + cadastro.margem / 100)).toFixed(2))
        : 0);
    return {
      preco_unitario: precoCadastro,
      margem_lucro: cadastro.margem,
      preco_venda_sugerido: venda,
      atualizar_preco_venda: 1,
      origem: ORIGEM.CADASTRO,
      fallback: false
    };
  }

  return {
    preco_unitario: precoCadastro,
    margem_lucro: MARGEM_PADRAO_FALLBACK_COMPRA,
    preco_venda_sugerido: precoCadastro > 0
      ? Number((precoCadastro * 1.3).toFixed(2))
      : vendaCadastro,
    atualizar_preco_venda: 1,
    origem: ORIGEM.PADRAO,
    fallback: true
  };
}

let ok = 0;
let falhas = 0;

function test(nome, fn) {
  try {
    fn();
    ok += 1;
    console.log(`  OK  ${nome}`);
  } catch (err) {
    falhas += 1;
    console.error(`  FAIL  ${nome}`);
    console.error(`       ${err.message}`);
  }
}

console.log('\n=== RC4.31.25 — Histórico Última Compra ===\n');

test('Frontend expõe resolver/buscar/aplicar última compra', () => {
  assert.match(comprasJs, /function resolverDadosComerciaisProdutoCompra/);
  assert.match(comprasJs, /function buscarUltimaCompraProduto/);
  assert.match(comprasJs, /function aplicarDadosComerciaisProdutoFormularioCompra/);
  assert.match(comprasJs, /ORIGEM_BASE_COMERCIAL_COMPRA/);
});

test('API ultimas-compras retorna margem e preço de venda', () => {
  assert.match(produtosRota, /ci\.margem_lucro AS margem_lucro/);
  assert.match(produtosRota, /ci\.preco_venda_sugerido AS preco_venda_sugerido/);
  assert.match(produtosRota, /ci\.atualizar_preco_venda AS atualizar_preco_venda/);
});

test('Prioridade 1 — última compra (margem 18%, preço 10.09)', () => {
  const produto = { preco_compra: 9, lucro_percentual: 40, preco_venda: 12 };
  const ultima = {
    custo: 10.09,
    margem_lucro: 18,
    preco_venda_sugerido: 11.91,
    atualizar_preco_venda: 1
  };
  const r = resolverDadosComerciaisProdutoCompra(produto, ultima);
  assert.strictEqual(r.origem, ORIGEM.ULTIMA_COMPRA);
  assert.strictEqual(r.preco_unitario, 10.09);
  assert.strictEqual(r.margem_lucro, 18);
  assert.strictEqual(r.preco_venda_sugerido, 11.91);
});

test('Prioridade 2 — sem histórico usa cadastro (28%)', () => {
  const produto = { preco_compra: 20, lucro_percentual: 28, preco_venda: 25.6 };
  const r = resolverDadosComerciaisProdutoCompra(produto, null);
  assert.strictEqual(r.origem, ORIGEM.CADASTRO);
  assert.strictEqual(r.margem_lucro, 28);
  assert.strictEqual(r.fallback, false);
});

test('Prioridade 3 — sem histórico nem cadastro → 30%', () => {
  const produto = { preco_compra: 10, nome: 'Novo' };
  const r = resolverDadosComerciaisProdutoCompra(produto, null);
  assert.strictEqual(r.origem, ORIGEM.PADRAO);
  assert.strictEqual(r.margem_lucro, 30);
  assert.strictEqual(r.fallback, true);
});

test('Produto recém-cadastrado com margem no cadastro não usa 30%', () => {
  const produto = { preco_compra: 5, lucro_percentual: 45 };
  const r = resolverDadosComerciaisProdutoCompra(produto, null);
  assert.strictEqual(r.margem_lucro, 45);
  assert.strictEqual(r.origem, ORIGEM.CADASTRO);
});

test('Indicador Base: ✓ Última compra / Cadastro / Padrão', () => {
  assert.match(comprasJs, /Base: ✓ Última compra/);
  assert.match(comprasJs, /Base: ✓ Cadastro do produto/);
  assert.match(comprasJs, /Base: ✓ Padrão \(30%\)/);
});

test('onProdutoSelecionado usa aplicarDadosComerciaisProdutoFormularioCompra', () => {
  const fn = comprasJs.match(/function onProdutoSelecionado\(\) \{[\s\S]*?\n\}/);
  assert.ok(fn);
  assert.match(fn[0], /aplicarDadosComerciaisProdutoFormularioCompra/);
  assert.match(fn[0], /preservarSeEdicao:\s*true/);
});

test('Edição preserva item (não sobrescreve com padrão)', () => {
  assert.match(comprasJs, /ORIGEM_BASE_COMERCIAL_COMPRA\.ITEM/);
  assert.match(comprasJs, /preservarSeEdicao/);
});

test('Após gravar compra invalida cache da última compra', () => {
  assert.match(comprasJs, /invalidarCacheUltimaCompraProduto/);
  const fn = comprasJs.match(/function executarGravacaoCompra\([\s\S]*?\n\}/);
  assert.ok(fn);
  assert.match(fn[0], /invalidarCacheUltimaCompraProduto/);
});

test('atualizar_preco_venda vem da última compra', () => {
  const r = resolverDadosComerciaisProdutoCompra(
    { preco_compra: 1 },
    { custo: 1, margem_lucro: 10, atualizar_preco_venda: 0 }
  );
  assert.strictEqual(r.atualizar_preco_venda, 0);
});

console.log(`\n--- Resultado: ${ok} OK, ${falhas} falha(s) ---\n`);
process.exit(falhas > 0 ? 1 : 0);
