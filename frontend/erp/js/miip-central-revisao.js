/**
 * Central de Revisão MIIP — Sprint 6B / RC7.5
 * Módulo independente do fluxo de Compras/Pedido.
 *
 * RC7.5 — "Confirmar Produto" apenas confirma, aprende e avança.
 * Nunca abre Pedido, Compra ou Cadastro a partir desse botão.
 *
 * Uso:
 *   MiipCentralRevisao.iniciar({ dadosImportacao, apiUrl, produtos, onConcluir, onCancelar, ... })
 */
(function initMiipCentralRevisao(global) {
  'use strict';

  const MOTOR_LABELS = {
    motor_gtin: 'Código de barras',
    motor_associacao_fornecedor: 'Histórico do fornecedor'
  };

  let estado = null;

  function escapeHtml(texto) {
    return String(texto ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatarMoeda(valor) {
    const numero = Number(valor || 0);
    if (typeof formatCurrency === 'function') return formatCurrency(numero);
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarTempo(ms) {
    const totalSeg = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const h = Math.floor(totalSeg / 3600);
    const m = Math.floor((totalSeg % 3600) / 60);
    const s = totalSeg % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function calcularPrecisao(resumo, confirmadosManualmente) {
    const total = Number(resumo?.totalItens ?? 0);
    if (total <= 0) return 0;
    const auto = Number(resumo?.identificadosAutomaticamente ?? 0);
    const conf = Number(confirmadosManualmente ?? 0);
    return Math.round(((auto + conf) / total) * 100);
  }

  function extrairPendencias(resultados) {
    return (resultados || []).filter((r) => r.precisaConfirmacao || r.precisaCadastro);
  }

  function ordenarPendencias(pendencias) {
    return [...pendencias].sort((a, b) => {
      const semA = Boolean(a.precisaCadastro && !a.produtoEncontrado);
      const semB = Boolean(b.precisaCadastro && !b.produtoEncontrado);
      if (semA && !semB) return 1;
      if (!semA && semB) return -1;
      return Number(b.score ?? 0) - Number(a.score ?? 0);
    });
  }

  function extrairEvidencias(candidato, motor) {
    const lista = [];
    if (motor && MOTOR_LABELS[motor]) lista.push(MOTOR_LABELS[motor]);
    (candidato?.evidencias || []).forEach((ev) => {
      const t = ev?.descricao || ev?.tipo || ev?.valor;
      if (t && !lista.includes(t)) lista.push(String(t));
    });
    if (candidato?.produto?.marca && !lista.includes('Marca')) lista.push('Marca');
    return lista;
  }

  function montarSessao(dadosImportacao) {
    const miip = dadosImportacao?.miip_importacao || {};
    const resultados = miip.resultados || [];
    const itens = (dadosImportacao?.itens || []).map((item) => ({ ...item }));

    return {
      dadosImportacao,
      operacaoId: miip.operacaoId || dadosImportacao?.chave_acesso || null,
      resumo: {
        totalItens: Number(miip.resumo?.totalItens ?? itens.length),
        identificadosAutomaticamente: Number(miip.resumo?.identificadosAutomaticamente ?? 0),
        precisamConfirmacao: Number(miip.resumo?.precisamConfirmacao ?? 0),
        precisamCadastro: Number(miip.resumo?.precisamCadastro ?? 0),
        tempoProcessamento: Number(miip.resumo?.tempoProcessamento ?? 0)
      },
      fornecedor: dadosImportacao?.fornecedor || '',
      fornecedorCnpj: dadosImportacao?.fornecedor_cnpj || '',
      pendencias: ordenarPendencias(extrairPendencias(resultados)),
      itens,
      indiceAtual: 0,
      resolvidas: [],
      ignoradas: [],
      aprendizados: 0,
      confirmadosManualmente: 0,
      fase: 'revisao'
    };
  }

  function pendenciaAberta(sessao, pendencia) {
    return !sessao.resolvidas.includes(pendencia.indice)
      && !sessao.ignoradas.includes(pendencia.indice);
  }

  function contarAbertas(sessao) {
    return sessao.pendencias.filter((p) => pendenciaAberta(sessao, p)).length;
  }

  function proximaAberta(sessao, direcao) {
    const total = sessao.pendencias.length;
    let idx = sessao.indiceAtual;
    for (let i = 0; i < total; i += 1) {
      idx = (idx + direcao + total) % total;
      if (pendenciaAberta(sessao, sessao.pendencias[idx])) {
        sessao.indiceAtual = idx;
        return;
      }
    }
  }

  function notificar(mensagem, tipo) {
    const container = document.getElementById('notification-container');
    if (container) {
      container.style.zIndex = '23000';
    }
    if (typeof showNotification === 'function') {
      showNotification(mensagem, tipo || 'info');
    }
  }

  function mostrarAprendizado() {
    const toast = document.getElementById('miipCentralAprendizadoToast');
    if (!toast) return;
    toast.classList.add('miip-central-toast--visivel');
    setTimeout(() => toast.classList.remove('miip-central-toast--visivel'), 4200);
  }

  function enviarAprendizado(pendencia, produtoId, produto) {
    const { opcoes, sessao } = estado;
    const item = sessao.itens[pendencia.indice] || pendencia.produtoXML || {};
    const usuario = opcoes.obterUsuario ? opcoes.obterUsuario() : null;
    const fornecedorCnpj = sessao.fornecedorCnpj;

    if (!fornecedorCnpj || !item.codigo_fornecedor) return Promise.resolve(false);

    return $.ajax({
      url: `${opcoes.apiUrl}/miip/feedback`,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        confirmado: true,
        produtoId: Number(produtoId),
        fornecedorCnpj,
        codigoFornecedor: item.codigo_fornecedor,
        fornecedorNome: sessao.fornecedor,
        nomeItem: item.produto_nome,
        codigoBarras: item.codigo_barras,
        ncm: item.ncm,
        unidade: item.unidade,
        usuarioId: usuario?.id ?? null,
        operacaoId: pendencia.operacaoId || sessao.operacaoId,
        origem: 'Confirmacao Manual',
        origemDetalhe: 'central_revisao_miip',
        item
      })
    }).then(() => true).catch(() => false);
  }

  function renderResumoTopo(sessao) {
    const precisao = calcularPrecisao(sessao.resumo, sessao.confirmadosManualmente);
    return `
      <div class="miip-central-resumo-grid">
        <div class="miip-central-metrica"><span>Itens da Nota</span><strong>${sessao.resumo.totalItens}</strong></div>
        <div class="miip-central-metrica miip-central-metrica--ok"><span>Associados automaticamente</span><strong>${sessao.resumo.identificadosAutomaticamente}</strong></div>
        <div class="miip-central-metrica miip-central-metrica--warn"><span>Precisam confirmação</span><strong>${sessao.resumo.precisamConfirmacao}</strong></div>
        <div class="miip-central-metrica miip-central-metrica--alert"><span>Precisam cadastro</span><strong>${sessao.resumo.precisamCadastro}</strong></div>
        <div class="miip-central-metrica"><span>Precisão desta importação</span><strong>${precisao}%</strong></div>
        <div class="miip-central-metrica"><span>Tempo de processamento</span><strong>${formatarTempo(sessao.resumo.tempoProcessamento)}</strong></div>
      </div>
    `;
  }

  function renderListaPendencias(sessao) {
    // RC7.5 — lista lateral só com pendências abertas (resolvidas saem imediatamente).
    return sessao.pendencias.map((pendencia, idx) => {
      if (!pendenciaAberta(sessao, pendencia)) return '';

      const ativo = idx === sessao.indiceAtual ? ' miip-central-lista-item--ativo' : '';
      const tipo = pendencia.precisaCadastro && !pendencia.produtoEncontrado ? 'cadastro' : 'confirmacao';
      const nome = pendencia.produtoXML?.produto_nome || 'Item sem nome';
      const score = Number(pendencia.score ?? 0);

      return `
        <button type="button" class="miip-central-lista-item${ativo}" data-lista-idx="${idx}">
          <div class="miip-central-lista-titulo">${escapeHtml(nome)}</div>
          <div class="miip-central-lista-meta">
            <span class="miip-central-tag miip-central-tag--${tipo}">${tipo === 'cadastro' ? 'Cadastro' : 'Confirmação'}</span>
            <span>${score > 0 ? `${score}%` : 'Sem candidato'}</span>
          </div>
        </button>
      `;
    }).join('');
  }

  function renderDetalhes(pendencia, sessao) {
    const xml = pendencia.produtoXML || sessao.itens[pendencia.indice] || {};
    return `
      <div class="miip-central-detalhe-bloco">
        <h6>Produto do XML</h6>
        <p class="miip-central-detalhe-nome">${escapeHtml(xml.produto_nome || '-')}</p>
        <dl class="miip-central-dl">
          <dt>Fornecedor</dt><dd>${escapeHtml(sessao.fornecedor || '-')}</dd>
          <dt>Código fornecedor</dt><dd>${escapeHtml(xml.codigo_fornecedor || '-')}</dd>
          <dt>Quantidade</dt><dd>${escapeHtml(xml.quantidade ?? '-')} ${escapeHtml(xml.unidade || '')}</dd>
          <dt>Valor</dt><dd>${formatarMoeda(xml.preco_unitario || xml.subtotal)}</dd>
          <dt>Descrição completa</dt><dd>${escapeHtml(xml.produto_nome || '-')}</dd>
        </dl>
      </div>
    `;
  }

  function renderCandidato(pendencia) {
    const produto = pendencia.produtoEncontrado;
    if (!produto) {
      return `
        <div class="miip-central-candidato miip-central-candidato--vazio">
          <h6>Melhor candidato</h6>
          <p>Nenhum candidato confiável encontrado. Cadastre um novo produto ou escolha manualmente.</p>
        </div>
      `;
    }

    const score = Number(pendencia.score ?? 0);
    const evidencias = extrairEvidencias(pendencia.candidatoSelecionado, pendencia.motor);

    return `
      <div class="miip-central-candidato">
        <h6>Produto CDS</h6>
        <p class="miip-central-candidato-nome">${escapeHtml(produto.nome || '-')}</p>
        <div class="miip-central-candidato-score">
          <span>Nível de Certeza</span>
          <strong>${score}%</strong>
        </div>
        <div class="miip-central-evidencias">
          <span>Baseado em</span>
          <ul>${evidencias.map((ev) => `<li><i class="fas fa-check"></i> ${escapeHtml(ev)}</li>`).join('')}</ul>
        </div>
      </div>
    `;
  }

  function renderTelaRevisao() {
    const { sessao } = estado;
    const abertas = contarAbertas(sessao);

    if (abertas === 0) {
      encerrarRevisaoAutomaticamente('todas_pendencias_resolvidas');
      return;
    }

    if (!pendenciaAberta(sessao, sessao.pendencias[sessao.indiceAtual])) {
      proximaAberta(sessao, 1);
    }

    const pendencia = sessao.pendencias[sessao.indiceAtual];
    const totalPend = sessao.pendencias.length;
    const resolvidas = sessao.resolvidas.length + sessao.ignoradas.length;

    $('#miipCentralResumo').html(renderResumoTopo(sessao));
    $('#miipCentralLista').html(renderListaPendencias(sessao));
    $('#miipCentralDetalhes').html(renderDetalhes(pendencia, sessao));
    $('#miipCentralCandidato').html(renderCandidato(pendencia));
    $('#miipCentralContador').text(
      `${resolvidas + 1} / ${totalPend} · ${abertas} pendente${abertas === 1 ? '' : 's'}`
    );
  }

  /**
   * RC7.5 — encerra a Central MIIP e devolve o controle ao caller (Central de Entradas).
   * Nunca navega para Pedido/Compra daqui.
   */
  function encerrarRevisaoAutomaticamente(motivo) {
    if (!estado || estado._encerrando) return;
    estado._encerrando = true;
    estado.sessao.fase = 'final';
    notificar('Revisão MIIP concluída. Retornando à Central de Entradas…', 'success');
    concluirRevisao({ motivoEncerramento: motivo || 'auto' });
  }

  function renderModal() {
    const html = `
      <div class="modal fade miip-central-modal" id="miipCentralRevisaoModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
        <div class="modal-dialog modal-fullscreen">
          <div class="modal-content miip-central-content">
            <div class="modal-header miip-central-header">
              <div>
                <h5 class="modal-title"><i class="fas fa-robot"></i> Central de Revisão MIIP</h5>
                <small id="miipCentralContador" class="text-muted"></small>
              </div>
              <button type="button" class="btn btn-sm btn-outline-light" id="miipCentralBtnCancelar" title="ESC — Cancelar revisão">
                <i class="fas fa-times"></i> Cancelar (ESC)
              </button>
            </div>
            <div class="modal-body p-0" id="miipCentralCorpo">
              <div id="miipCentralResumo" class="miip-central-resumo"></div>
              <div class="miip-central-layout">
                <aside class="miip-central-lista" id="miipCentralLista"></aside>
                <section class="miip-central-painel">
                  <div id="miipCentralDetalhes"></div>
                  <div id="miipCentralCandidato"></div>
                  <div class="miip-central-acoes">
                    <button type="button" class="btn btn-success" id="miipCentralBtnConfirmar"><i class="fas fa-check"></i> Confirmar Produto <small>(Enter)</small></button>
                    <button type="button" class="btn btn-primary" id="miipCentralBtnEscolher"><i class="fas fa-search"></i> Escolher outro <small>(F2)</small></button>
                    <button type="button" class="btn btn-warning" id="miipCentralBtnCadastrar"><i class="fas fa-plus"></i> Cadastrar Novo <small>(F3)</small></button>
                    <button type="button" class="btn btn-outline-secondary" id="miipCentralBtnIgnorar"><i class="fas fa-ban"></i> Ignorar Item</button>
                  </div>
                  <div class="miip-central-atalhos">
                    <span><kbd>Enter</kbd> Confirmar</span>
                    <span><kbd>Tab</kbd> Próximo</span>
                    <span><kbd>Shift</kbd>+<kbd>Tab</kbd> Anterior</span>
                    <span><kbd>F2</kbd> Pesquisar</span>
                    <span><kbd>F3</kbd> Cadastrar</span>
                    <span><kbd>Esc</kbd> Cancelar</span>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div id="miipCentralAprendizadoToast" class="miip-central-toast">
        <i class="fas fa-check"></i>
        <div>
          <strong>MIIP aprendeu esta associação.</strong>
          <span>Próximas importações serão automáticas.</span>
        </div>
      </div>
      <div class="modal fade" id="miipCentralBuscaModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">Pesquisar produto (F2)</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
            <div class="modal-body">
              <input type="text" class="form-control mb-2" id="miipCentralBuscaInput" placeholder="Nome, código ou GTIN...">
              <div id="miipCentralBuscaResultados" class="miip-central-busca-lista"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    $('#miipCentralRevisaoRoot').remove();
    $('body').append(`<div id="miipCentralRevisaoRoot">${html}</div>`);
  }

  function abrirModal() {
    renderModal();
    const modal = new bootstrap.Modal(document.getElementById('miipCentralRevisaoModal'));
    estado.modal = modal;
    modal.show();
    bindEventos();
  }

  function fecharModal() {
    if (estado?.modal) estado.modal.hide();
    $('#miipCentralRevisaoRoot').remove();
    $(document).off('.miipCentral');
    $(document).off('.miipCentralCadastro');
  }

  /**
   * RC7.5 — "Confirmar Produto" só confirma/aprende/avança.
   * Nunca abre Pedido, Compra, Cadastro ou fluxo comercial.
   */
  function confirmarAtual() {
    const pendencia = estado.sessao.pendencias[estado.sessao.indiceAtual];
    if (!pendencia || !pendenciaAberta(estado.sessao, pendencia)) return;

    const produtoId = pendencia.produtoEncontrado?.id;
    if (!produtoId) {
      notificar('Selecione um produto para continuar.', 'warning');
      return;
    }

    aplicarConfirmacao(pendencia, produtoId, pendencia.produtoEncontrado);
  }

  function atualizarIndicadoresAposResolucao(pendencia) {
    const resumo = estado.sessao.resumo;
    if (pendencia.precisaConfirmacao && Number(resumo.precisamConfirmacao) > 0) {
      resumo.precisamConfirmacao -= 1;
    }
    if (pendencia.precisaCadastro && Number(resumo.precisamCadastro) > 0) {
      resumo.precisamCadastro -= 1;
    }
  }

  function aplicarConfirmacao(pendencia, produtoId, produto, aprendeuExplicito) {
    if (!pendencia || !produtoId) {
      notificar('Selecione um produto para continuar.', 'warning');
      return;
    }

    const item = estado.sessao.itens[pendencia.indice];
    if (item) {
      item.produto_id = Number(produtoId);
      item.miip_revisao_status = 'confirmado';
      item.miip_revisao_origem = 'Confirmacao Manual';
      if (produto?.nome) item.produto_nome_associado = produto.nome;
    }

    if (!estado.sessao.resolvidas.includes(pendencia.indice)) {
      estado.sessao.resolvidas.push(pendencia.indice);
      estado.sessao.confirmadosManualmente += 1;
      atualizarIndicadoresAposResolucao(pendencia);
    }

    const promessa = aprendeuExplicito === false
      ? Promise.resolve(false)
      : enviarAprendizado(pendencia, produtoId, produto);

    promessa.then((aprendeu) => {
      if (aprendeu) {
        estado.sessao.aprendizados += 1;
        mostrarAprendizado();
      }

      if (contarAbertas(estado.sessao) === 0) {
        encerrarRevisaoAutomaticamente('ultimo_item_resolvido');
        return;
      }

      proximaAberta(estado.sessao, 1);
      renderTelaRevisao();
    });
  }

  function ignorarAtual() {
    const pendencia = estado.sessao.pendencias[estado.sessao.indiceAtual];
    if (!pendencia || !pendenciaAberta(estado.sessao, pendencia)) return;
    estado.sessao.ignoradas.push(pendencia.indice);
    atualizarIndicadoresAposResolucao(pendencia);

    if (contarAbertas(estado.sessao) === 0) {
      encerrarRevisaoAutomaticamente('ultimo_item_ignorado');
      return;
    }

    proximaAberta(estado.sessao, 1);
    renderTelaRevisao();
  }

  function abrirBuscaProduto() {
    const produtos = estado.opcoes.produtos || [];
    const modalEl = document.getElementById('miipCentralBuscaModal');
    if (!modalEl) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    elevarModalSobreMiip(modalEl);
    const renderBusca = (termo) => {
      const lower = String(termo || '').toLowerCase().trim();
      const filtrados = produtos.filter((p) => {
        if (!lower) return true;
        return String(p.nome || '').toLowerCase().includes(lower)
          || String(p.codigo || '').includes(lower)
          || String(p.codigo_barras || '').includes(lower)
          || String(p.plu || '').includes(lower);
      }).slice(0, 30);

      $('#miipCentralBuscaResultados').html(filtrados.map((p) => `
        <button type="button" class="miip-central-busca-item" data-produto-id="${p.id}">
          <strong>${escapeHtml(p.nome)}</strong>
          <small>${escapeHtml(p.codigo_barras || p.codigo || '')}</small>
        </button>
      `).join('') || '<p class="text-muted p-2">Nenhum produto encontrado.</p>');
    };

    $('#miipCentralBuscaInput').val('').off('input.miip').on('input.miip', function onBusca() {
      renderBusca(this.value);
    });
    $('#miipCentralBuscaResultados').off('click.miip').on('click.miip', '.miip-central-busca-item', function onSelect() {
      const produtoId = Number($(this).data('produto-id'));
      const produto = produtos.find((p) => Number(p.id) === produtoId);
      const pendencia = estado.sessao.pendencias[estado.sessao.indiceAtual];
      modal.hide();
      if (produto && pendencia) {
        aplicarConfirmacao(pendencia, produtoId, { id: produtoId, nome: produto.nome });
      }
    });

    renderBusca('');
    modal.show();
    setTimeout(() => $('#miipCentralBuscaInput').trigger('focus'), 200);
  }

  function elevarModalSobreMiip(modalEl) {
    if (!modalEl) return;

    // Garante que o modal não fique preso em stacking context da página.
    if (modalEl.parentElement !== document.body) {
      document.body.appendChild(modalEl);
    }

    modalEl.classList.add('produto-modal-sobre-miip');
    modalEl.style.zIndex = '22000';

    requestAnimationFrame(() => {
      const backdrops = document.querySelectorAll('.modal-backdrop');
      const last = backdrops[backdrops.length - 1];
      if (last) {
        last.classList.add('produto-modal-sobre-miip-backdrop');
        last.style.zIndex = '21990';
      }
    });
  }

  /**
   * Une produtoXML + item da nota + fornecedor da sessão (UI usa produtoXML).
   */
  function montarItemCadastroXml(pendencia) {
    const sessao = estado?.sessao || {};
    const doXml = pendencia?.produtoXML || {};
    const doItem = sessao.itens?.[pendencia?.indice] || {};
    const precoUnitario = primeiroNumero(
      doXml.preco_unitario, doXml.precoUnitario, doXml.valor_unitario, doXml.valorUnitario,
      doItem.preco_unitario, doItem.precoUnitario, doItem.valor_unitario, doItem.valorUnitario
    );
    const margem = primeiroNumero(
      doXml.margem_lucro, doXml.margemLucro,
      doItem.margem_lucro, doItem.margemLucro,
      30
    );
    const precoVenda = primeiroNumero(
      doXml.preco_venda_sugerido, doXml.precoVendaSugerido,
      doItem.preco_venda_sugerido, doItem.precoVendaSugerido,
      precoUnitario != null && margem != null ? precoUnitario * (1 + margem / 100) : null
    );
    const quantidade = primeiroNumero(
      doXml.quantidade, doXml.qtd, doItem.quantidade, doItem.qtd
    );

    return {
      ...doItem,
      ...doXml,
      produto_nome: doXml.produto_nome || doXml.produtoNome || doItem.produto_nome
        || doXml.descricao || doItem.descricao || doItem.nome || '',
      descricao: doXml.descricao || doXml.produto_nome || doXml.produtoNome
        || doItem.descricao || doItem.produto_nome || '',
      codigo_fornecedor: doXml.codigo_fornecedor || doXml.codigoFornecedor
        || doItem.codigo_fornecedor || doItem.codigoFornecedor || '',
      codigo_barras: doXml.codigo_barras || doXml.codigoBarras || doXml.gtin
        || doItem.codigo_barras || doItem.codigoBarras || doItem.gtin || '',
      gtin: doXml.gtin || doItem.gtin || doXml.codigo_barras || doItem.codigo_barras || '',
      ncm: doXml.ncm || doItem.ncm || '',
      cest: doXml.cest || doItem.cest || '',
      cfop: doXml.cfop || doItem.cfop || '',
      unidade: doXml.unidade || doItem.unidade || 'UN',
      quantidade,
      preco_unitario: precoUnitario,
      valor_unitario: precoUnitario,
      margem_lucro: margem,
      preco_venda_sugerido: precoVenda,
      fornecedor: sessao.fornecedor || doItem.fornecedor || doXml.fornecedor || ''
    };
  }

  function primeiroNumero(...candidatos) {
    for (const c of candidatos) {
      if (c == null || c === '') continue;
      const n = Number(String(c).replace(/\s/g, '').replace(',', '.'));
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  /** Campos type=number do cadastro exigem ponto decimal (não vírgula). */
  function formatarPrecoCadastro(valor, casas = 4) {
    const n = Number(String(valor ?? '').replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(n)) return '';
    const fixed = n.toFixed(casas);
    return fixed.replace(/\.?0+$/, '') || '0';
  }

  function setCampoNumero($el, valor, casas = 4) {
    if (!$el || !$el.length) return false;
    const formatado = formatarPrecoCadastro(valor, casas);
    if (formatado === '') return false;
    $el.val(formatado);
    $el.trigger('input').trigger('change');
    return true;
  }

  function preencherCamposCadastroProduto(item) {
    const xml = item || {};
    const nome = String(xml.produto_nome || xml.descricao || xml.nome || '').trim();
    const $modal = $('#produtoModal');
    if (!$modal.length) return;

    if (nome && $('#nome').length) $('#nome').val(nome);

    const barras = String(xml.codigo_barras || xml.gtin || '').trim();
    if (barras && $('#codigo_barras').length) {
      $('#codigo_barras').val(barras).trigger('input.espelhoCodigo');
    }

    if ($('#ncm').length && xml.ncm) $('#ncm').val(String(xml.ncm).trim());
    if ($('#cest').length && xml.cest) $('#cest').val(String(xml.cest).trim());
    if ($('#cfop').length && xml.cfop) $('#cfop').val(String(xml.cfop).trim());

    if ($('#unidade').length) {
      const und = String(xml.unidade || 'UN').trim().toUpperCase() || 'UN';
      const $und = $('#unidade');
      if ($und.find(`option[value="${und}"]`).length) $und.val(und);
      else $und.val('UN');
      $und.trigger('change');
    }

    const preco = xml.preco_unitario ?? xml.valor_unitario ?? xml.precoUnitario ?? xml.valorUnitario;
    const precoOk = setCampoNumero($('#preco_compra'), preco, 4);

    const margem = xml.margem_lucro ?? xml.margemLucro;
    if ($('#lucro_percentual').length && margem != null && margem !== '') {
      setCampoNumero($('#lucro_percentual'), margem, 2);
    } else if (precoOk && $('#lucro_percentual').length && String($('#lucro_percentual').val() || '').trim() === '') {
      setCampoNumero($('#lucro_percentual'), 30, 2);
    }

    const precoVenda = xml.preco_venda_sugerido ?? xml.precoVendaSugerido;
    if (precoVenda != null && precoVenda !== '') {
      setCampoNumero($('#preco_venda'), precoVenda, 2);
    }

    if (typeof sincronizarFormacaoPrecoProduto === 'function') {
      sincronizarFormacaoPrecoProduto(precoVenda != null ? 'venda' : 'compra');
    } else {
      $('#preco_compra').trigger('input.precoMotor').trigger('change.precoMotor');
    }

    if ($('#fornecedor').length && xml.fornecedor) {
      $('#fornecedor').val(String(xml.fornecedor).trim());
    }

    // Código do fornecedor no XML → código interno (associação MIIP).
    // Só preenche se ainda vazio / ainda for a sugestão automática.
    const codForn = String(xml.codigo_fornecedor || xml.codigoFornecedor || '').trim();
    if (codForn && $('#codigo').length) {
      const atual = String($('#codigo').val() || '').trim();
      const auto = String($modal.data('codigoAutoSugerido') || '').trim();
      if (!atual || (auto && atual === auto)) {
        $('#codigo').val(codForn);
      }
    }

    $modal.data('miipPrefillXml', xml);
  }

  async function resolverProdutoRecemCadastrado(nomeHint) {
    try {
      const token = localStorage.getItem('token') || '';
      const resp = await fetch(`${estado.opcoes.apiUrl}/produtos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) return null;
      const lista = await resp.json().catch(() => []);
      if (!Array.isArray(lista) || !lista.length) return null;

      const hint = String(nomeHint || '').trim().toLowerCase();
      if (hint) {
        const porNome = [...lista].reverse().find((p) =>
          String(p.nome || '').trim().toLowerCase() === hint
        );
        if (porNome) return porNome;
      }

      return lista.reduce((a, b) => (Number(a?.id || 0) > Number(b?.id || 0) ? a : b));
    } catch (_) {
      return null;
    }
  }

  /**
   * Garante o script de cadastro de produtos (lazy) antes de abrir o modal.
   */
  async function garantirShowProdutoModal() {
    if (typeof showProdutoModal === 'function') return true;

    try {
      if (typeof window.CdsErpLazyLoader?.loadPageScripts === 'function') {
        await window.CdsErpLazyLoader.loadPageScripts('produtos');
      } else if (typeof window.CdsErpLazyLoader?.loadFeatureScript === 'function') {
        await window.CdsErpLazyLoader.loadFeatureScript('/erp/js/categorias.js').catch(() => {});
        await window.CdsErpLazyLoader.loadFeatureScript('/erp/js/subcategorias.js').catch(() => {});
        await window.CdsErpLazyLoader.loadFeatureScript('/erp/js/produtos.js');
      } else {
        const carregarScript = (src) => new Promise((resolve, reject) => {
          const el = document.createElement('script');
          el.src = src;
          el.async = false;
          el.onload = () => resolve();
          el.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
          document.head.appendChild(el);
        });
        await carregarScript('/erp/js/categorias.js').catch(() => {});
        await carregarScript('/erp/js/subcategorias.js').catch(() => {});
        await carregarScript('/erp/js/produtos.js');
      }
      return typeof showProdutoModal === 'function';
    } catch (err) {
      console.warn('[MIIP] Não foi possível carregar produtos.js:', err);
      return false;
    }
  }

  /**
   * Abre o cadastro de produto na frente da Central MIIP (sem sair da revisão),
   * já com os dados do XML preenchidos.
   */
  async function abrirCadastroProdutoPadrao(item, callback) {
    const ok = await garantirShowProdutoModal();
    if (!ok || typeof showProdutoModal !== 'function') {
      notificar('Módulo de Produtos indisponível. Atualize a página (Ctrl+F5) e tente novamente.', 'danger');
      if (typeof callback === 'function') callback(null);
      return;
    }

    showProdutoModal(null);

    const el = document.getElementById('produtoModal');
    if (!el) {
      notificar('Não foi possível abrir o cadastro de produto.', 'danger');
      if (typeof callback === 'function') callback(null);
      return;
    }

    elevarModalSobreMiip(el);

    try {
      bootstrap.Modal.getOrCreateInstance(el, { backdrop: true, keyboard: true, focus: true }).show();
    } catch (_) {
      try { $(el).modal('show'); } catch (__) { /* ignore */ }
    }

    const aplicarPrefill = () => {
      elevarModalSobreMiip(el);
      preencherCamposCadastroProduto(item);
    };

    const onShown = () => {
      aplicarPrefill();
      // Reaplica após init async (código interno sugerido, cálculo de preço, etc.).
      setTimeout(aplicarPrefill, 120);
      setTimeout(aplicarPrefill, 350);
      setTimeout(() => {
        const campo = document.getElementById('nome');
        if (campo) {
          campo.focus();
          campo.select();
        }
      }, 180);
    };

    el.addEventListener('shown.bs.modal', onShown, { once: true });
    if (el.classList.contains('show')) onShown();
    else setTimeout(aplicarPrefill, 50);

    el.addEventListener('hidden.bs.modal', async () => {
      el.classList.remove('produto-modal-sobre-miip');
      document.querySelectorAll('.produto-modal-sobre-miip-backdrop').forEach((b) => {
        b.classList.remove('produto-modal-sobre-miip-backdrop');
      });

      const $modal = $('#produtoModal');
      const salvoDireto = $modal.data('produtoRecemSalvo') || null;
      const salvouOk = $modal.data('produtoSalvoComSucesso') === true;
      $modal.removeData('produtoRecemSalvo');
      $modal.removeData('produtoSalvoComSucesso');

      // Cancelou sem salvar → não confirma pendência.
      if (!salvouOk && !salvoDireto?.id) {
        if (typeof callback === 'function') callback(null);
        return;
      }

      const nomeHint = item?.produto_nome || item?.descricao || item?.nome || '';
      let produto = salvoDireto && salvoDireto.id ? salvoDireto : null;
      if (!produto) {
        produto = await resolverProdutoRecemCadastrado(nomeHint);
      }

      if (produto?.id && Array.isArray(estado?.opcoes?.produtos)) {
        const ja = estado.opcoes.produtos.some((p) => Number(p.id) === Number(produto.id));
        if (!ja) estado.opcoes.produtos.unshift(produto);
      }

      if (typeof callback === 'function') callback(produto || null);
      if (!produto) {
        notificar('Produto salvo, mas não foi possível vinculá-lo automaticamente. Use F2 para selecioná-lo.', 'warning');
      } else {
        notificar('Produto cadastrado e vinculado ao item da NF.', 'success');
      }
    }, { once: true });
  }

  async function cadastrarNovo() {
    const pendencia = estado.sessao.pendencias[estado.sessao.indiceAtual];
    if (!pendencia || !pendenciaAberta(estado.sessao, pendencia)) {
      notificar('Selecione um item pendente para cadastrar.', 'warning');
      return;
    }

    const item = montarItemCadastroXml(pendencia);
    const aoCadastrar = (produto) => {
      if (produto?.id) {
        aplicarConfirmacao(pendencia, produto.id, produto, false);
      }
    };

    // Sempre usa o fluxo empilhado sobre a Central (não abre a busca F2).
    await abrirCadastroProdutoPadrao(item, aoCadastrar);
  }

  function concluirRevisao(meta) {
    if (!estado) return;
    const { sessao, opcoes } = estado;
    const resultado = {
      itens: sessao.itens,
      estatisticas: {
        identificadosAutomaticamente: sessao.resumo.identificadosAutomaticamente,
        aprendeu: sessao.aprendizados,
        precisao: calcularPrecisao(sessao.resumo, sessao.confirmadosManualmente),
        confirmadosManualmente: sessao.confirmadosManualmente
      },
      // RC7.5 — caller (Central) decide o próximo passo; MIIP não abre Compra/Pedido.
      navegacao: {
        abrirCompra: false,
        abrirPedido: false,
        permanecerNaCentral: true,
        motivo: meta?.motivoEncerramento || 'manual'
      }
    };

    fecharModal();
    estado = null;
    if (typeof opcoes.onConcluir === 'function') opcoes.onConcluir(resultado);
  }

  function cancelarRevisao() {
    const cb = estado?.opcoes?.onCancelar;
    fecharModal();
    estado = null;
    if (typeof cb === 'function') cb();
  }

  function onKeydown(event) {
    if (!estado || !document.getElementById('miipCentralRevisaoModal')?.classList.contains('show')) return;

    // Cadastro de produto aberto na frente: não interceptar atalhos da revisão.
    if (document.getElementById('produtoModal')?.classList.contains('show')) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      cancelarRevisao();
      return;
    }

    if (estado.sessao.fase === 'final') return;

    if (event.key === 'Enter' && !$(event.target).is('input, textarea, select')) {
      event.preventDefault();
      confirmarAtual();
      return;
    }

    if (event.key === 'F2') {
      event.preventDefault();
      abrirBuscaProduto();
      return;
    }

    if (event.key === 'F3') {
      event.preventDefault();
      cadastrarNovo();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      proximaAberta(estado.sessao, event.shiftKey ? -1 : 1);
      renderTelaRevisao();
    }
  }

  function bindEventos() {
    $(document).off('.miipCentral');
    $(document).off('.miipCentralCadastro');
    $(document).on('keydown.miipCentral', onKeydown);

    $('#miipCentralBtnConfirmar').on('click', confirmarAtual);
    $('#miipCentralBtnEscolher').on('click', abrirBuscaProduto);
    $(document).off('click.miipCentralCadastro').on('click.miipCentralCadastro', '#miipCentralBtnCadastrar', function (e) {
      e.preventDefault();
      cadastrarNovo();
    });
    $('#miipCentralBtnIgnorar').on('click', ignorarAtual);
    $('#miipCentralBtnCancelar').on('click', cancelarRevisao);

    $('#miipCentralLista').on('click', '.miip-central-lista-item', function onListaClick() {
      estado.sessao.indiceAtual = Number($(this).data('lista-idx'));
      renderTelaRevisao();
    });

  }

  function iniciar(opcoes) {
    if (!opcoes?.dadosImportacao?.miip_importacao?.usarMiipImportacaoXML) {
      if (typeof opcoes.onConcluir === 'function') {
        opcoes.onConcluir({ itens: opcoes.dadosImportacao?.itens || [], estatisticas: {} });
      }
      return;
    }

    estado = {
      opcoes: {
        apiUrl: opcoes.apiUrl || (typeof API_URL !== 'undefined' ? API_URL : '/api'),
        produtos: opcoes.produtos || [],
        obterUsuario: opcoes.obterUsuario || (() => null),
        abrirCadastroProduto: opcoes.abrirCadastroProduto || null,
        onConcluir: opcoes.onConcluir,
        onCancelar: opcoes.onCancelar
      },
      sessao: montarSessao(opcoes.dadosImportacao),
      modal: null,
      _encerrando: false
    };

    // RC7.5 — sem pendências: conclui e devolve à Central (sem UI de Compra).
    if (estado.sessao.pendencias.length === 0) {
      encerrarRevisaoAutomaticamente('xml_sem_pendencias');
      return;
    }

    abrirModal();
    renderTelaRevisao();
  }

  global.MiipCentralRevisao = {
    iniciar,
    _test: {
      montarSessao,
      ordenarPendencias,
      extrairPendencias,
      calcularPrecisao,
      /** RC7.5 — validação pura do botão Confirmar Produto */
      validarConfirmacao(pendencia) {
        const produtoId = pendencia?.produtoEncontrado?.id;
        if (!produtoId) {
          return { ok: false, mensagem: 'Selecione um produto para continuar.' };
        }
        return { ok: true, produtoId: Number(produtoId) };
      }
    }
  };
})(typeof window !== 'undefined' ? window : global);
