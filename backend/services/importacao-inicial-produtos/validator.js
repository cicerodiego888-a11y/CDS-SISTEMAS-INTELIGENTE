/**
 * Validação e matching — Importação Inicial de Produtos V1.0.8.
 * Produto EXISTENTE pode ser enriquecido com apresentação comercial nova.
 */
'use strict';

const {
  linhaBloqueiaPorClassificacao,
  linhaAtencaoPermiteImportar,
  STATUS,
  MARKUP_PADRAO,
  chaveNomeCadastroSimples,
  calcularFormacaoPrecoOficial,
  arredondarCasas,
  texto,
  resolverFatorConversao,
  calcularEstoqueInicial,
  calcularCustoTotalEstoqueInicial,
  flagOpcional,
  classificarApresentacoesArquivo,
  normalizarUnidadeBaseCadastro,
  validarModoFiscalImportacao,
  itemFiscalDeModoImportacao,
  rotuloModoFiscalImportacao,
  campoNumericoInformado,
  valoresNumericosDivergem,
  LABEL_NAO_ALTERAR
} = require('./helpers');
const { classificarProduto, resolverClassificacaoExistente, STATUS_CLASSIFICACAO, chaveCategoriaEquivalente } = require('./classificadorCategoria');

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });
}

function vincularApresentacoes(produto, apresentacoes) {
  const chaveOrigem = chaveNomeCadastroSimples(produto.codigo_origem);
  const chaveNome = chaveNomeCadastroSimples(produto.nome);
  return (apresentacoes || []).filter((a) => {
    const ao = chaveNomeCadastroSimples(a.codigo_origem);
    const an = chaveNomeCadastroSimples(a.nome_produto);
    if (chaveOrigem && ao && chaveOrigem === ao) return true;
    if (chaveNome && an && chaveNome === an) return true;
    return false;
  });
}

function escolherPrincipal(apresentacoesDoProduto) {
  return apresentacoesDoProduto.find((a) => Number(a.principal) === 1)
    || apresentacoesDoProduto.find((a) => a.tipo !== 'UN' && Number(a.quantidade) > 1)
    || apresentacoesDoProduto[0]
    || null;
}

function resolverCustosEPrecos(produto, apresentacoesDoProduto) {
  const markup = Number.isFinite(Number(produto.markup)) ? Number(produto.markup) : MARKUP_PADRAO;
  const principal = escolherPrincipal(apresentacoesDoProduto);

  let custoUnitario = produto.custo_informado;
  let precoUnitario = produto.preco_informado;
  let custoEmbalagem = null;
  let precoEmbalagem = null;
  let quantidadeEmbalagem = null;
  let tipoEmbalagem = null;

  if (principal && Number(principal.quantidade) > 1
    && (Number(principal.custo) > 0 || Number(principal.valor_compra) > 0)) {
    custoEmbalagem = Number(principal.valor_compra ?? principal.custo);
    quantidadeEmbalagem = Number(principal.quantidade);
    tipoEmbalagem = principal.tipo;

    const formacao = calcularFormacaoPrecoOficial({
      valorEmbalagemCompra: custoEmbalagem,
      quantidadePorEmbalagem: quantidadeEmbalagem,
      tipo: tipoEmbalagem,
      markup,
      // custo da planilha pode ser o valor do rolo — formação ignora quando há apresentação
      custoUnitarioInformado: custoUnitario,
      precoVendaInformado: precoUnitario
    });

    // Unidade base: sempre o resultado da conversão (nunca o valor da embalagem)
    custoUnitario = formacao.custo_unitario;
    precoUnitario = formacao.preco_venda;
    // Preço do arquivo só se for escala de embalagem (não flag 0/1 nem preço unitário)
    const precoAprArq = Number(principal.preco ?? principal.preco_venda);
    const tetoApr = Number(custoEmbalagem) * (1 + markup / 100) * 1.2;
    const pisoApr = Number(custoEmbalagem) * 0.5;
    precoEmbalagem = Number.isFinite(precoAprArq) && precoAprArq > 1
      && precoAprArq >= pisoApr && precoAprArq <= tetoApr
      ? precoAprArq
      : formacao.preco_apresentacao;
  } else if (Number.isFinite(Number(produto.custo_apresentacao)) && Number(produto.custo_apresentacao) > 0
    && (!Number.isFinite(Number(custoUnitario)) || Number(custoUnitario) <= 0)) {
    custoEmbalagem = Number(produto.custo_apresentacao);
  } else {
    const formacao = calcularFormacaoPrecoOficial({
      valorEmbalagemCompra: 0,
      quantidadePorEmbalagem: 1,
      markup,
      custoUnitarioInformado: custoUnitario,
      precoVendaInformado: precoUnitario
    });
    if (!Number.isFinite(Number(custoUnitario))) custoUnitario = null;
    else custoUnitario = formacao.custo_unitario;
    if (!Number.isFinite(Number(precoUnitario)) || Number(precoUnitario) <= 0) {
      precoUnitario = formacao.preco_venda;
    }
  }

  return {
    markup,
    custo_unitario: custoUnitario,
    preco_venda: precoUnitario,
    apresentacao_principal: principal ? {
      tipo: tipoEmbalagem || principal.tipo,
      descricao: principal.descricao || null,
      quantidade: quantidadeEmbalagem || Number(principal.quantidade) || 1,
      custo: custoEmbalagem ?? principal.custo ?? principal.valor_compra,
      valor_compra: custoEmbalagem ?? principal.valor_compra ?? principal.custo,
      preco: precoEmbalagem ?? principal.preco,
      preco_venda: precoEmbalagem ?? principal.preco_venda ?? principal.preco,
      unidade: principal.unidade || produto.unidade_base || 'UN',
      codigo_barras: principal.codigo_barras || principal.gtin || null,
      gtin: principal.gtin || principal.codigo_barras || null,
      codigo_fornecedor: principal.codigo_fornecedor || null,
      fornecedor_nome: principal.fornecedor_nome || null,
      principal: flagOpcional(principal.principal) ?? 1,
      compra: flagOpcional(principal.compra),
      venda: flagOpcional(principal.venda),
      estoque: flagOpcional(principal.estoque),
      ativa: flagOpcional(principal.ativa)
    } : null,
    apresentacoes: apresentacoesDoProduto.map((a) => {
      const qtd = Number(a.quantidade) || 1;
      const custo = Number(a.valor_compra ?? a.custo);
      let preco = Number(a.preco_venda ?? a.preco);
      // Ignora flag 0/1 ou valor absurdo vs custo da embalagem
      const precoAprInvalido = !Number.isFinite(preco) || preco <= 1
        || (Number.isFinite(custo) && custo > 0 && preco < custo * 0.5);
      if (precoAprInvalido && Number.isFinite(custo) && custo > 0 && qtd > 1) {
        const f = calcularFormacaoPrecoOficial({
          valorEmbalagemCompra: custo,
          quantidadePorEmbalagem: qtd,
          tipo: a.tipo,
          markup
        });
        preco = f.preco_apresentacao;
      }
      return {
        tipo: a.tipo,
        descricao: a.descricao || null,
        quantidade: qtd,
        unidade: a.unidade || produto.unidade_base || 'UN',
        custo: Number.isFinite(custo) ? custo : null,
        valor_compra: Number.isFinite(custo) ? custo : null,
        preco: Number.isFinite(preco) ? preco : null,
        preco_venda: Number.isFinite(preco) ? preco : null,
        codigo_barras: a.codigo_barras || a.gtin || null,
        gtin: a.gtin || a.codigo_barras || null,
        codigo_fornecedor: a.codigo_fornecedor || null,
        fornecedor_nome: a.fornecedor_nome || null,
        principal: flagOpcional(a.principal),
        compra: flagOpcional(a.compra),
        venda: flagOpcional(a.venda),
        estoque: flagOpcional(a.estoque),
        ativa: flagOpcional(a.ativa)
      };
    })
  };
}

function montarEstoquePreview(produto, pricing) {
  const fatorInfo = resolverFatorConversao(pricing.apresentacoes);
  const calc = calcularEstoqueInicial({
    quantidadeDocumento: produto.quantidade_documento,
    fatorConversao: fatorInfo.fator
  });
  const unidadeBase = String(
    normalizarUnidadeBaseCadastro(produto.unidade_base || 'UN')
  ).toUpperCase();
  const unidadeOrigem = String(
    produto.unidade_origem
    || fatorInfo.tipo
    || unidadeBase
  ).toUpperCase();
  const custoTotal = calcularCustoTotalEstoqueInicial({
    quantidadeOrigem: calc.quantidade_origem,
    custoUnitario: pricing.custo_unitario,
    apresentacao: pricing.apresentacao_principal
  });

  return {
    quantidade_origem: calc.quantidade_origem,
    unidade_origem: unidadeOrigem,
    qtd_origem_label: `${calc.quantidade_origem} ${unidadeOrigem}`,
    fator_conversao: calc.fator_conversao,
    conversao_label: fatorInfo.label,
    estoque_inicial: calc.estoque_inicial,
    estoque_inicial_label: `${calc.estoque_inicial} ${unidadeBase}`,
    unidade_base: unidadeBase,
    custo_total_estoque: custoTotal
  };
}

function deveAtualizarCustoExistente(produtoRaw, pricing, produtoDb) {
  return campoNumericoInformado(produtoRaw.custo_informado)
    && valoresNumericosDivergem(pricing.custo_unitario, produtoDb?.preco_compra, 0.0001);
}

function deveAtualizarPrecoExistente(produtoRaw, pricing, produtoDb) {
  return campoNumericoInformado(produtoRaw.preco_informado)
    && valoresNumericosDivergem(pricing.preco_venda, produtoDb?.preco_venda, 0.02);
}

function montarPreviewAtualizacao({
  produtoDb,
  produtoRaw,
  pricing,
  estoque,
  precisaStock,
  alterarCategoria = false,
  alterarSubcategoria = false
}) {
  const estoqueAtual = Number(produtoDb?.estoque_atual || 0);
  const qtdArquivo = Number(estoque?.estoque_inicial || 0);
  const qtdSomar = precisaStock && Number.isFinite(qtdArquivo) && qtdArquivo > 0 ? qtdArquivo : 0;
  const alteraCusto = deveAtualizarCustoExistente(produtoRaw, pricing, produtoDb);
  const alteraPreco = deveAtualizarPrecoExistente(produtoRaw, pricing, produtoDb);
  const custoAtual = Number.isFinite(Number(produtoDb?.preco_compra)) ? Number(produtoDb.preco_compra) : null;
  const precoAtual = Number.isFinite(Number(produtoDb?.preco_venda)) ? Number(produtoDb.preco_venda) : null;

  return {
    estoque_atual: estoqueAtual,
    quantidade_importada: qtdSomar,
    quantidade_arquivo: qtdArquivo,
    estoque_final: arredondarCasas(estoqueAtual + qtdSomar, 3),
    custo_atual: custoAtual,
    novo_custo: alteraCusto ? pricing.custo_unitario : null,
    novo_custo_label: alteraCusto ? pricing.custo_unitario : LABEL_NAO_ALTERAR,
    preco_atual: precoAtual,
    novo_preco: alteraPreco ? pricing.preco_venda : null,
    novo_preco_label: alteraPreco ? pricing.preco_venda : LABEL_NAO_ALTERAR,
    categoria_preservada: produtoDb?.categoria_nome || null,
    subcategoria_preservada: produtoDb?.subcategoria_nome || null,
    item_fiscal_preservado: Number(produtoDb?.item_fiscal) === 0 ? 0 : 1,
    saldo_fiscal: Number(produtoDb?.saldo_fiscal || 0),
    saldo_nao_fiscal: Number(produtoDb?.saldo_nao_fiscal || 0),
    alterar_custo: alteraCusto,
    alterar_preco: alteraPreco,
    alterar_estoque: qtdSomar > 0,
    alterar_categoria: alterarCategoria === true,
    alterar_subcategoria: alterarSubcategoria === true
  };
}

async function carregarIndicesExistentes(db) {
  const produtos = await dbAll(db, `
    SELECT p.id, p.codigo, p.nome, p.codigo_barras, p.marca_id, p.preco_compra, p.preco_venda,
           p.unidade, p.estoque_atual, p.saldo_fiscal, p.saldo_nao_fiscal, p.item_fiscal,
           p.categoria_id, p.subcategoria_id,
           m.nome AS marca_nome,
           c.nome AS categoria_nome,
           s.nome AS subcategoria_nome
    FROM produtos p
    LEFT JOIN marcas m ON m.id = p.marca_id
    LEFT JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
  `);
  const porCodigo = new Map();
  const porBarras = new Map();
  const porRefMarca = new Map();
  const porNomeMarca = new Map();

  produtos.forEach((p) => {
    const codigo = texto(p.codigo);
    const barras = texto(p.codigo_barras);
    const marca = chaveNomeCadastroSimples(p.marca_nome);
    const nome = chaveNomeCadastroSimples(p.nome);
    if (codigo) porCodigo.set(chaveNomeCadastroSimples(codigo), p);
    if (barras) porBarras.set(barras, p);
    if (nome && marca) porNomeMarca.set(`${nome}|${marca}`, p);
  });

  return { produtos, porCodigo, porBarras, porRefMarca, porNomeMarca };
}

async function carregarEmbalagensProduto(db, produtoId) {
  return dbAll(
    db,
    `SELECT * FROM produto_embalagens WHERE produto_id = ? ORDER BY principal DESC, id ASC`,
    [produtoId]
  );
}

async function jaTemEstoqueInicialImportacao(db, produtoId) {
  const row = await dbGet(
    db,
    `SELECT id FROM produtos_ajustes_estoque
     WHERE produto_id = ?
       AND motivo LIKE 'ESTOQUE INICIAL — IMPORTAÇÃO DE PRODUTOS%'
     LIMIT 1`,
    [produtoId]
  );
  return Boolean(row);
}

function encontrarCorrespondencia(produto, indices) {
  const codigo = chaveNomeCadastroSimples(produto.codigo_origem);
  if (codigo && indices.porCodigo.has(codigo)) {
    return { seguro: true, motivo: 'codigo_origem', produto: indices.porCodigo.get(codigo) };
  }
  const barras = texto(produto.codigo_barras);
  if (barras && indices.porBarras.has(barras)) {
    return { seguro: true, motivo: 'codigo_barras', produto: indices.porBarras.get(barras) };
  }
  const marca = chaveNomeCadastroSimples(produto.marca);
  const ref = chaveNomeCadastroSimples(produto.referencia_fabricante);
  if (ref && marca) {
    const hit = indices.produtos.find(() => false);
    if (hit) return { seguro: true, motivo: 'referencia_marca', produto: hit };
  }
  const nome = chaveNomeCadastroSimples(produto.nome);
  if (nome && marca && indices.porNomeMarca.has(`${nome}|${marca}`)) {
    return { seguro: true, motivo: 'nome_marca', produto: indices.porNomeMarca.get(`${nome}|${marca}`) };
  }
  if (nome && !marca) {
    const homonimos = indices.produtos.filter((p) => chaveNomeCadastroSimples(p.nome) === nome);
    if (homonimos.length === 1) {
      return { seguro: false, motivo: 'nome_sem_marca', produto: homonimos[0] };
    }
    if (homonimos.length > 1) {
      return { seguro: false, motivo: 'nome_ambiguo', produto: homonimos[0], candidatos: homonimos.length };
    }
  }
  return null;
}

function precisaCorrigirUnidadeBase(produtoDb, unidadeArquivo, apresentacoes) {
  // Compara canônico do arquivo com valor persistido (ex.: "m" legado ≠ "mt" do cadastro)
  const unArq = normalizarUnidadeBaseCadastro(unidadeArquivo);
  const unDbRaw = String(produtoDb?.unidade || '').trim().toLowerCase();
  if (!unArq || unArq === unDbRaw) return false;
  return (apresentacoes || []).some((a) => a.tipo !== 'UN' && Number(a.quantidade) > 1);
}

/**
 * V1.0.14 — indexa codigo_origem duplicado dentro do próprio arquivo.
 * Usa a mesma normalização do matching (chaveNomeCadastroSimples).
 * Não remove/mescla linhas — apenas identifica conflitos.
 */
function mapearDuplicidadesCodigoArquivo(produtos) {
  const porChave = new Map();
  (produtos || []).forEach((p, idx) => {
    const chave = chaveNomeCadastroSimples(p.codigo_origem);
    if (!chave) return;
    if (!porChave.has(chave)) {
      porChave.set(chave, {
        codigo: texto(p.codigo_origem),
        linhas: [],
        nomes: []
      });
    }
    const entry = porChave.get(chave);
    entry.linhas.push(idx + 1);
    entry.nomes.push(texto(p.nome));
  });

  const duplicados = new Map();
  for (const [chave, info] of porChave.entries()) {
    if (info.linhas.length > 1) {
      duplicados.set(chave, {
        codigo: info.codigo,
        ocorrencias: info.linhas.length,
        linhas: info.linhas.slice(),
        nomes: info.nomes.slice()
      });
    }
  }
  return duplicados;
}

function statusBloqueiaImportacao(status) {
  return status === STATUS.ERRO
    || status === STATUS.CODIGO_DUPLICADO_ARQUIVO
    || status === STATUS.CATEGORIA_NAO_ENCONTRADA
    || status === STATUS.SUBCATEGORIA_INCOMPATIVEL;
}

async function carregarCatalogoClassificacao(db) {
  const categorias = await dbAll(
    db,
    `SELECT id, nome, tipo, COALESCE(ativo, 1) AS ativo FROM categorias`
  );
  const subcategorias = await dbAll(
    db,
    `SELECT id, nome, categoria_id, COALESCE(ativo, 1) AS ativo FROM subcategorias`
  );
  return { categorias, subcategorias };
}

function contarEstruturasNovas(linhas) {
  const cats = new Set();
  const subs = new Set();
  const importaveis = new Set([
    STATUS.PRONTO,
    STATUS.EXISTENTE_ATUALIZAR,
    STATUS.EXISTENTE_APRESENTACAO_NOVA
  ]);
  for (const l of linhas || []) {
    if (!importaveis.has(l.status)) continue;
    const cl = l.classificacao || {};
    if (cl.criar_categoria && cl.categoria_nome) {
      cats.add(chaveCategoriaEquivalente(cl.categoria_nome));
    }
    if (cl.criar_subcategoria && cl.subcategoria_nome) {
      const catNome = cl.categoria_nome || cl.categoria_atual_nome || '';
      subs.add(`${chaveCategoriaEquivalente(catNome)}|${chaveCategoriaEquivalente(cl.subcategoria_nome)}`);
    }
  }
  return { categorias_novas: cats.size, subcategorias_novas: subs.size };
}

async function validarImportacao(db, dadosExtraidos, { nomeArquivo, modo_fiscal_importacao } = {}) {
  const modoFiscal = validarModoFiscalImportacao(modo_fiscal_importacao);
  const itemFiscalNovos = itemFiscalDeModoImportacao(modoFiscal);
  const indices = await carregarIndicesExistentes(db);
  const catalogoClassificacao = await carregarCatalogoClassificacao(db);
  const duplicidadesArquivo = mapearDuplicidadesCodigoArquivo(dadosExtraidos.produtos);
  const linhas = [];
  let prontos = 0;
  let erros = 0;
  let existentes = 0;
  let enriquecimentos = 0;
  let atualizacoes = 0;
  let atencao = 0;
  let pendentesClassificacao = 0;
  let estoqueInicialTotal = 0;
  let quantidadePlanilhaTotal = 0;
  let apresentacoesNovasTotal = 0;
  let novosFiscais = 0;
  let novosNaoFiscais = 0;
  let existentesEncontrados = 0;

  for (let idx = 0; idx < (dadosExtraidos.produtos || []).length; idx += 1) {
    const produtoRaw = dadosExtraidos.produtos[idx];
    const apresentacoes = vincularApresentacoes(produtoRaw, dadosExtraidos.apresentacoes);
    const pricing = resolverCustosEPrecos(produtoRaw, apresentacoes);
    const estoque = montarEstoquePreview(produtoRaw, pricing);
    quantidadePlanilhaTotal = arredondarCasas(
      quantidadePlanilhaTotal + Number(estoque.estoque_inicial || 0),
      3
    );
    const mensagens = [];
    let status = STATUS.PRONTO;
    let enriquecimento = null;
    let previewAtualizacao = null;
    let classificacao = null;
    const chaveCodigo = chaveNomeCadastroSimples(produtoRaw.codigo_origem);
    const duplicidadeArquivo = chaveCodigo ? duplicidadesArquivo.get(chaveCodigo) || null : null;

    if (!produtoRaw.nome) {
      status = STATUS.ERRO;
      mensagens.push('Nome obrigatório');
    }

    // V1.0.14 — duplicidade no XLSX tem prioridade (bloqueia antes do INSERT/UNIQUE)
    if (duplicidadeArquivo) {
      status = STATUS.CODIGO_DUPLICADO_ARQUIVO;
      mensagens.push('Código duplicado no arquivo.');
    }

    const match = duplicidadeArquivo
      ? null
      : encontrarCorrespondencia(produtoRaw, indices);
    if (match?.produto) existentesEncontrados += 1;

    // Produto novo: exige custo/preço válidos
    if (!match && !statusBloqueiaImportacao(status)) {
      if (!Number.isFinite(Number(pricing.custo_unitario)) || Number(pricing.custo_unitario) < 0) {
        status = STATUS.ERRO;
        mensagens.push('Custo unitário inválido');
      }
      if (!Number.isFinite(Number(pricing.preco_venda)) || Number(pricing.preco_venda) <= 0) {
        status = STATUS.ERRO;
        mensagens.push('Preço de venda inválido');
      }
    }

    if (match && !statusBloqueiaImportacao(status)) {
      if (campoNumericoInformado(produtoRaw.custo_informado) && Number(produtoRaw.custo_informado) < 0) {
        status = STATUS.ERRO;
        mensagens.push('Custo unitário inválido');
      }
      if (campoNumericoInformado(produtoRaw.preco_informado) && Number(produtoRaw.preco_informado) < 0) {
        status = STATUS.ERRO;
        mensagens.push('Preço de venda inválido');
      }
    }

    if (match && !statusBloqueiaImportacao(status)) {
      if (!match.seguro) {
        status = STATUS.ATENCAO;
        mensagens.push(`Requer conferência (${match.motivo})`);
        atencao += 1;
        const classificacaoExistente = resolverClassificacaoExistente(match.produto, {
          descricao: produtoRaw.nome,
          marca: produtoRaw.marca,
          categoriaInformada: produtoRaw.categoria,
          subcategoriaInformada: produtoRaw.subcategoria
        }, catalogoClassificacao);
        const atencaoApto = linhaAtencaoPermiteImportar({
          status: STATUS.ATENCAO,
          classificacao: classificacaoExistente
        });
        classificacao = atencaoApto
          ? classificacaoExistente
          : {
            ...classificacaoExistente,
            alterar_categoria: false,
            alterar_subcategoria: false
          };
      } else {
        const embDb = await carregarEmbalagensProduto(db, match.produto.id);
        const classif = classificarApresentacoesArquivo(pricing.apresentacoes, embDb);
        const jaEstoque = await jaTemEstoqueInicialImportacao(db, match.produto.id);
        const precisaStock = Number(estoque.estoque_inicial || 0) > 0 && !jaEstoque;
        const corrigeUnidade = precisaCorrigirUnidadeBase(
          match.produto,
          produtoRaw.unidade_base,
          pricing.apresentacoes
        );
        // V1.0.10: preço/custo da unidade base divergente (ex.: 501,47 no lugar de 5,01)
        const temApresentacaoPreco = (pricing.apresentacoes || []).some(
          (a) => a.tipo !== 'UN' && Number(a.quantidade) > 1
            && Number(a.valor_compra ?? a.custo) > 0
        );
        const custoDb = Number(match.produto.preco_compra);
        const precoDb = Number(match.produto.preco_venda);
        const custoEsp = Number(pricing.custo_unitario);
        const precoEsp = Number(pricing.preco_venda);
        const corrigePreco = temApresentacaoPreco
          && Number.isFinite(custoEsp) && custoEsp > 0
          && Number.isFinite(precoEsp) && precoEsp > 0
          && (
            !Number.isFinite(custoDb)
            || !Number.isFinite(precoDb)
            || Math.abs(custoDb - custoEsp) > 0.01
            || Math.abs(precoDb - precoEsp) > 0.02
            || precoDb >= Number(pricing.apresentacao_principal?.valor_compra
              || pricing.apresentacao_principal?.custo || 0) * 0.9
          );

        // V1.0.16 — GTIN/EAN: preencher codigo_barras vazio (nunca sobrescrever)
        const barrasDb = texto(match.produto.codigo_barras);
        const barrasArq = texto(produtoRaw.codigo_barras);
        const corrigeCodigoBarras = !barrasDb && Boolean(barrasArq);

        const alteraCusto = deveAtualizarCustoExistente(produtoRaw, pricing, match.produto);
        const alteraPreco = deveAtualizarPrecoExistente(produtoRaw, pricing, match.produto);
        const classificacaoExistente = resolverClassificacaoExistente(match.produto, {
          descricao: produtoRaw.nome,
          marca: produtoRaw.marca,
          categoriaInformada: produtoRaw.categoria,
          subcategoriaInformada: produtoRaw.subcategoria
        }, catalogoClassificacao);
        classificacao = classificacaoExistente;
        const alteraClassificacao = Boolean(
          classificacaoExistente.alterar_categoria || classificacaoExistente.alterar_subcategoria
        );
        const temEnriquecimento = classif.novas.length > 0
          || corrigeUnidade
          || corrigePreco
          || corrigeCodigoBarras;
        const temAtualizacao = precisaStock || alteraCusto || alteraPreco || alteraClassificacao;

        previewAtualizacao = montarPreviewAtualizacao({
          produtoDb: match.produto,
          produtoRaw,
          pricing,
          estoque,
          precisaStock,
          alterarCategoria: alteraClassificacao && classificacaoExistente.alterar_categoria,
          alterarSubcategoria: alteraClassificacao && classificacaoExistente.alterar_subcategoria
        });

        if (classificacaoExistente.status === STATUS_CLASSIFICACAO.PENDENTE_CLASSIFICACAO) {
          status = STATUS.PENDENTE_CLASSIFICACAO;
          mensagens.push(classificacaoExistente.motivo || 'Revisão de classificação necessária');
          if (precisaStock) {
            estoqueInicialTotal = arredondarCasas(
              estoqueInicialTotal + Number(estoque.estoque_inicial || 0),
              3
            );
          }
        } else if (classificacaoExistente.status === STATUS_CLASSIFICACAO.CATEGORIA_NAO_ENCONTRADA) {
          status = STATUS.CATEGORIA_NAO_ENCONTRADA;
          mensagens.push(classificacaoExistente.motivo || 'Categoria não encontrada');
        } else if (classificacaoExistente.status === STATUS_CLASSIFICACAO.SUBCATEGORIA_INCOMPATIVEL) {
          status = STATUS.SUBCATEGORIA_INCOMPATIVEL;
          mensagens.push(classificacaoExistente.motivo || 'Subcategoria incompatível');
        } else if (temEnriquecimento) {
          status = STATUS.EXISTENTE_APRESENTACAO_NOVA;
          mensagens.push(
            corrigeCodigoBarras && classif.novas.length === 0 && !precisaStock && !corrigeUnidade && !corrigePreco
              ? `Produto já existente (#${match.produto.id}) — código de barras a aplicar`
              : `Produto já existente (#${match.produto.id}) — apresentação/complemento a aplicar`
          );
          enriquecimentos += 1;
          apresentacoesNovasTotal += classif.novas.length;
          estoqueInicialTotal = arredondarCasas(
            estoqueInicialTotal + (precisaStock ? Number(estoque.estoque_inicial || 0) : 0),
            3
          );
          enriquecimento = {
            apresentacoes_novas: classif.novas.length,
            apresentacoes_existentes: classif.existentes.length,
            precisa_estoque: precisaStock,
            corrigir_unidade_base: corrigeUnidade,
            corrigir_preco: corrigePreco,
            corrigir_codigo_barras: corrigeCodigoBarras,
            alterar_custo: alteraCusto,
            alterar_preco: alteraPreco,
            alterar_categoria: classificacaoExistente.alterar_categoria === true,
            alterar_subcategoria: classificacaoExistente.alterar_subcategoria === true,
            unidade_atual: match.produto.unidade,
            unidade_arquivo: produtoRaw.unidade_base
          };
        } else if (temAtualizacao) {
          status = STATUS.EXISTENTE_ATUALIZAR;
          mensagens.push(
            alteraClassificacao && !precisaStock && !alteraCusto && !alteraPreco
              ? `Produto já existente (#${match.produto.id}) — classificação a aplicar`
              : `Produto já existente (#${match.produto.id}) — estoque/custo/preço a atualizar`
          );
          atualizacoes += 1;
          estoqueInicialTotal = arredondarCasas(
            estoqueInicialTotal + (precisaStock ? Number(estoque.estoque_inicial || 0) : 0),
            3
          );
        } else {
          status = STATUS.EXISTENTE;
          mensagens.push(`Produto já existente (#${match.produto.id} via ${match.motivo})`);
          existentes += 1;
        }
      }
    }

    if (!classificacao && match?.produto) {
      classificacao = resolverClassificacaoExistente(match.produto, {
        descricao: produtoRaw.nome,
        marca: produtoRaw.marca,
        categoriaInformada: produtoRaw.categoria,
        subcategoriaInformada: produtoRaw.subcategoria
      }, catalogoClassificacao);
    } else if (!match && !statusBloqueiaImportacao(status) && status === STATUS.PRONTO) {
      classificacao = classificarProduto({
        descricao: produtoRaw.nome,
        marca: produtoRaw.marca,
        categoriaInformada: produtoRaw.categoria,
        subcategoriaInformada: produtoRaw.subcategoria
      }, catalogoClassificacao);
      classificacao = {
        ...classificacao,
        categoria_atual_id: null,
        categoria_atual_nome: null,
        subcategoria_atual_id: null,
        subcategoria_atual_nome: null,
        categoria_sugerida_id: classificacao.categoria_id,
        categoria_sugerida_nome: classificacao.categoria_nome,
        subcategoria_sugerida_id: classificacao.subcategoria_id,
        subcategoria_sugerida_nome: classificacao.subcategoria_nome,
        alterar_categoria: Boolean(classificacao.categoria_id || classificacao.criar_categoria),
        alterar_subcategoria: Boolean(classificacao.subcategoria_id || classificacao.criar_subcategoria)
      };
      if (classificacao.status === STATUS_CLASSIFICACAO.CATEGORIA_NAO_ENCONTRADA) {
        status = STATUS.CATEGORIA_NAO_ENCONTRADA;
        mensagens.push(classificacao.motivo || 'Categoria não encontrada');
      } else if (classificacao.status === STATUS_CLASSIFICACAO.SUBCATEGORIA_INCOMPATIVEL) {
        status = STATUS.SUBCATEGORIA_INCOMPATIVEL;
        mensagens.push(classificacao.motivo || 'Subcategoria incompatível');
      } else if (classificacao.status === STATUS_CLASSIFICACAO.PENDENTE_CLASSIFICACAO) {
        status = STATUS.PENDENTE_CLASSIFICACAO;
        mensagens.push(classificacao.motivo || 'Revisão de classificação necessária');
      }
    }

    if (!match && status === STATUS.PRONTO) {
      prontos += 1;
      estoqueInicialTotal = arredondarCasas(estoqueInicialTotal + Number(estoque.estoque_inicial || 0), 3);
    }

    if (statusBloqueiaImportacao(status)) erros += 1;

    // V1.0.18 — item_fiscal: novos seguem o modo; existentes preservam o banco
    let itemFiscalLinha;
    let fiscalFonte;
    if (match?.produto) {
      itemFiscalLinha = Number(match.produto.item_fiscal) === 0 ? 0 : 1;
      fiscalFonte = 'EXISTENTE';
    } else {
      itemFiscalLinha = itemFiscalNovos;
      fiscalFonte = 'MODO_IMPORTACAO';
      if (!match && status === STATUS.PRONTO) {
        if (itemFiscalLinha === 1) novosFiscais += 1;
        else novosNaoFiscais += 1;
      }
    }

    const apresentacaoLabel = pricing.apresentacao_principal
      ? `${pricing.apresentacao_principal.tipo} ${pricing.apresentacao_principal.quantidade} ${pricing.apresentacao_principal.unidade}`
      : '—';

    linhas.push({
      linha: idx + 1,
      status,
      mensagens,
      produto: {
        ...produtoRaw,
        item_fiscal: itemFiscalLinha,
        fiscal: itemFiscalLinha === 1,
        fiscal_fonte: fiscalFonte,
        markup: pricing.markup,
        custo_unitario: pricing.custo_unitario,
        preco_venda: pricing.preco_venda,
        unidade_base: normalizarUnidadeBaseCadastro(produtoRaw.unidade_base || 'UN')
      },
      apresentacoes: pricing.apresentacoes,
      apresentacao_label: apresentacaoLabel,
      estoque,
      existente_id: match?.produto?.id || null,
      match_motivo: match?.motivo || null,
      enriquecimento,
      preview_atualizacao: previewAtualizacao,
      classificacao,
      duplicidade_arquivo: duplicidadeArquivo
    });
  }

  pendentesClassificacao = linhas.filter(linhaBloqueiaPorClassificacao).length;
  const atencaoImportaveis = linhas.filter(linhaAtencaoPermiteImportar).length;
  const importaveis = prontos + enriquecimentos + atualizacoes + atencaoImportaveis;
  const estruturasNovas = contarEstruturasNovas(linhas);

  return {
    arquivo: nomeArquivo || null,
    modo_fiscal_importacao: modoFiscal,
    tratamento_fiscal: rotuloModoFiscalImportacao(modoFiscal),
    resumo: {
      produtos_encontrados: linhas.length,
      produtos_validos: prontos + existentes + enriquecimentos + atualizacoes + atencao,
      com_erro: erros,
      possiveis_duplicados: existentes + atencao,
      prontos,
      existentes,
      enriquecimentos,
      atualizacoes,
      pendentes_classificacao: pendentesClassificacao,
      atencao_importaveis: atencaoImportaveis,
      produtos_classificados: importaveis,
      produtos_pendentes: pendentesClassificacao,
      exige_politica_pendentes: pendentesClassificacao > 0,
      produtos_sem_alteracao: existentes,
      apresentacoes_novas: apresentacoesNovasTotal,
      atencao,
      erros,
      estoque_inicial_total: estoqueInicialTotal,
      estoque_a_lancar: estoqueInicialTotal,
      quantidade_planilha_total: quantidadePlanilhaTotal,
      estoque_inicial_unidade: 'UN',
      modo_fiscal_importacao: modoFiscal,
      tratamento_fiscal: rotuloModoFiscalImportacao(modoFiscal),
      produtos_novos: prontos,
      produtos_existentes: existentesEncontrados,
      produtos_fiscais_novos: novosFiscais,
      produtos_nao_fiscais_novos: novosNaoFiscais,
      categorias_novas: estruturasNovas.categorias_novas,
      subcategorias_novas: estruturasNovas.subcategorias_novas
    },
    linhas,
    pode_importar: erros === 0 && (importaveis > 0 || pendentesClassificacao > 0),
    exige_politica_pendentes: pendentesClassificacao > 0
  };
}

module.exports = {
  validarImportacao,
  resolverCustosEPrecos,
  vincularApresentacoes,
  encontrarCorrespondencia,
  carregarIndicesExistentes,
  montarEstoquePreview,
  montarPreviewAtualizacao,
  classificarApresentacoesArquivo,
  carregarEmbalagensProduto,
  mapearDuplicidadesCodigoArquivo,
  statusBloqueiaImportacao,
  carregarCatalogoClassificacao
};
