/**
 * Sincroniza cadastro de produto com o PDV (venda em aberto).
 * ERP publica no save; PDV escuta e inclui o SKU no catálogo local sem limpar o carrinho.
 */
(function (global) {
  'use strict';

  const CANAL = 'cds-catalogo-produtos';

  function obterCanal() {
    if (typeof BroadcastChannel === 'undefined') return null;
    try {
      if (!global.__cdsCatalogoProdutoChannel) {
        global.__cdsCatalogoProdutoChannel = new BroadcastChannel(CANAL);
      }
      return global.__cdsCatalogoProdutoChannel;
    } catch (_) {
      return null;
    }
  }

  function publicarProdutoSalvo(produto) {
    if (!produto || produto.id == null) return false;
    const ch = obterCanal();
    const payload = {
      tipo: 'produto-salvo',
      produto: produto,
      ts: Date.now()
    };
    if (ch) {
      try {
        ch.postMessage(payload);
      } catch (_) { /* ignore */ }
    }
    try {
      global.dispatchEvent(new CustomEvent(CANAL, { detail: payload }));
    } catch (_) { /* ignore */ }
    return true;
  }

  function ouvir(handler) {
    if (typeof handler !== 'function') return function () {};
    const ch = obterCanal();
    const onBroadcast = function (ev) {
      handler(ev && ev.data ? ev.data : ev);
    };
    const onLocal = function (ev) {
      handler(ev && ev.detail ? ev.detail : ev);
    };
    if (ch && typeof ch.addEventListener === 'function') {
      ch.addEventListener('message', onBroadcast);
    }
    if (global.addEventListener) {
      global.addEventListener(CANAL, onLocal);
    }
    return function cancelar() {
      if (ch && typeof ch.removeEventListener === 'function') {
        ch.removeEventListener('message', onBroadcast);
      }
      if (global.removeEventListener) {
        global.removeEventListener(CANAL, onLocal);
      }
    };
  }

  global.CdsCatalogoProdutoSync = {
    CANAL: CANAL,
    publicarProdutoSalvo: publicarProdutoSalvo,
    ouvir: ouvir
  };
})(typeof window !== 'undefined' ? window : global);
