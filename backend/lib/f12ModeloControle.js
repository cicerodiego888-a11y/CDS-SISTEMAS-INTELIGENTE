/**
 * Modelo oficial de controle do F12.
 *
 * Nível 1 — quem controla: OPERADOR | ADMINISTRADOR
 * Nível 2 — se ADMINISTRADOR, como aplicar: TODOS | INDIVIDUAL
 *
 * Matriz de permissões (tecla F12 = podeAlterar):
 *   SUPER_ADMIN → sempre true (permissão total, independente de controle/escopo)
 *   ADMIN       → sempre false pela tecla F12 (usa a tela administrativa)
 *   OPERADOR    → true só com controle OPERADOR e somente o próprio caixa
 *
 * Mapeamento legado (compatibilidade):
 *   POR_CAIXA   → OPERADOR
 *   GLOBAL      → ADMINISTRADOR + TODOS
 *   MODO_ADMIN  → ADMINISTRADOR + INDIVIDUAL
 */

const CONTROLES = ['OPERADOR', 'ADMINISTRADOR'];
const ESCOPOS_ADMIN = ['TODOS', 'INDIVIDUAL'];
const POLITICAS_LEGADAS = ['POR_CAIXA', 'GLOBAL', 'MODO_ADMIN'];

function normalizarTexto(valor) {
  return String(valor || '').trim().toUpperCase();
}

function mapearPoliticaLegadaParaModelo(politica) {
  const p = normalizarTexto(politica);
  if (p === 'GLOBAL') {
    return { controle: 'ADMINISTRADOR', escopo: 'TODOS' };
  }
  if (p === 'MODO_ADMIN') {
    return { controle: 'ADMINISTRADOR', escopo: 'INDIVIDUAL' };
  }
  return { controle: 'OPERADOR', escopo: null };
}

function mapearModeloParaPoliticaLegada(controle, escopo) {
  const c = normalizarTexto(controle);
  const e = normalizarTexto(escopo);
  if (c === 'ADMINISTRADOR' && e === 'TODOS') return 'GLOBAL';
  if (c === 'ADMINISTRADOR' && e === 'INDIVIDUAL') return 'MODO_ADMIN';
  return 'POR_CAIXA';
}

function normalizarModeloControle(controle, escopo) {
  const c = normalizarTexto(controle);
  if (!CONTROLES.includes(c)) {
    return { ok: false, erro: `Controle inválido: ${controle}` };
  }
  if (c === 'OPERADOR') {
    return { ok: true, controle: 'OPERADOR', escopo: null };
  }
  const e = normalizarTexto(escopo);
  if (!ESCOPOS_ADMIN.includes(e)) {
    return { ok: false, erro: 'Escopo administrativo inválido. Use TODOS ou INDIVIDUAL.' };
  }
  return { ok: true, controle: 'ADMINISTRADOR', escopo: e };
}

function resolverEstadoEfetivoF12({ controle, escopo, globalAtivo, caixaAtivo }) {
  if (controle === 'ADMINISTRADOR' && escopo === 'TODOS') {
    return globalAtivo === true;
  }
  return caixaAtivo === true;
}

/**
 * SUPER_ADMIN possui permissão total sobre o controle F12.
 * Nunca confundir com ADMIN: ADMIN != SUPER_ADMIN.
 */
function temPermissaoTotalF12(usuario) {
  return normalizarTexto(usuario && usuario.perfil) === 'SUPER_ADMIN';
}

function isSuperAdminF12(usuario) {
  return temPermissaoTotalF12(usuario);
}

function isSuperAdmin(user) {
  return temPermissaoTotalF12(user);
}

function isPerfilAdmin(user) {
  return normalizarTexto(user && user.perfil) === 'ADMIN';
}

/**
 * ADMIN ou SUPER_ADMIN — somente para tela / endpoints administrativos.
 * Nunca usar esta função para liberar a tecla F12.
 */
function isAdmin(user) {
  return temPermissaoTotalF12(user) || isPerfilAdmin(user);
}

function podeAdministrarConfiguracaoF12(user) {
  return isAdmin(user);
}

/**
 * Matriz oficial: podeAlterar via tecla F12.
 *
 * SUPER_ADMIN → true em qualquer controle/escopo/caixa.
 * ADMIN       → false (não possui bypass automático pela tecla F12).
 * OPERADOR    → true só quando f12_controle = OPERADOR e o caixa é o próprio.
 */
function resolverPodeAlterarF12({ controle, user, caixaId } = {}) {
  if (temPermissaoTotalF12(user)) return true;
  if (isPerfilAdmin(user)) return false;
  if (normalizarTexto(controle) !== 'OPERADOR') return false;
  if (caixaId == null || caixaId === '') return true;
  return operadorPodeAlterarEsteCaixa(user, caixaId);
}

function podeAlterarViaTeclaF12(controle, user, caixaId) {
  return resolverPodeAlterarF12({ controle, user, caixaId });
}

function operadorPodeAlterarEsteCaixa(user, caixaId) {
  if (temPermissaoTotalF12(user)) return true;
  if (isPerfilAdmin(user)) return false;
  const proprio = Number(user && user.caixa_id);
  const alvo = Number(caixaId);
  if (!Number.isInteger(proprio) || proprio <= 0) return false;
  if (!Number.isInteger(alvo) || alvo <= 0) return false;
  return proprio === alvo;
}

function resolverAcaoToggleF12(controle, escopo) {
  if (normalizarTexto(controle) === 'ADMINISTRADOR' && normalizarTexto(escopo) === 'TODOS') {
    return 'GLOBAL';
  }
  return 'CAIXA';
}

function erroAutorizacaoF12(status, mensagem) {
  const erro = new Error(mensagem);
  erro.status = status;
  return erro;
}

/**
 * Autoriza o fluxo oficial da tecla F12 (PUT /caixas/:id/alternar).
 * Fonte: podeAlterar já resolvido no backend. Sem bypass por isAdmin.
 */
function autorizarToggleF12(user, contexto) {
  if (!contexto || contexto.podeAlterar !== true) {
    return {
      ok: false,
      erro: erroAutorizacaoF12(
        403,
        'Você não pode alterar o modo Fiscal / Não Fiscal deste caixa.'
      )
    };
  }
  return {
    ok: true,
    acao: resolverAcaoToggleF12(contexto.controle, contexto.escopo)
  };
}

/**
 * PUT /caixas/:id/estado — configuração de estado por caixa (não é bypass da tecla F12).
 */
function autorizarDefinirEstadoCaixa(user, modelo, caixaId) {
  if (temPermissaoTotalF12(user)) return { ok: true };

  const controle = modelo && modelo.controle;
  const escopo = modelo && modelo.escopo;

  if (controle === 'ADMINISTRADOR' && escopo === 'TODOS') {
    return {
      ok: false,
      erro: erroAutorizacaoF12(
        400,
        'Com o mesmo estado para todos os caixas, use o controle geral.'
      )
    };
  }

  if (isPerfilAdmin(user)) {
    if (controle === 'ADMINISTRADOR' && escopo === 'INDIVIDUAL') {
      return { ok: true };
    }
    return {
      ok: false,
      erro: erroAutorizacaoF12(
        403,
        'O administrador não altera o F12 pela tecla. Use a tela administrativa conforme o modelo de controle.'
      )
    };
  }

  if (controle === 'OPERADOR' && operadorPodeAlterarEsteCaixa(user, caixaId)) {
    return { ok: true };
  }

  if (controle === 'OPERADOR') {
    return {
      ok: false,
      erro: erroAutorizacaoF12(
        403,
        'Você só pode alterar o modo Fiscal / Não Fiscal do caixa em que está operando.'
      )
    };
  }

  return {
    ok: false,
    erro: erroAutorizacaoF12(
      403,
      'Apenas administrador pode alterar o modo Fiscal / Não Fiscal de cada caixa.'
    )
  };
}

/**
 * PUT /estado-global
 * ADMIN: somente quando ADMINISTRADOR + TODOS.
 * SUPER_ADMIN: sempre.
 */
function autorizarDefinirEstadoGlobal(user, modelo) {
  if (temPermissaoTotalF12(user)) return { ok: true };

  if (isPerfilAdmin(user)
      && modelo
      && modelo.controle === 'ADMINISTRADOR'
      && modelo.escopo === 'TODOS') {
    return { ok: true };
  }

  if (isPerfilAdmin(user)) {
    return {
      ok: false,
      erro: erroAutorizacaoF12(
        400,
        'Estado único para todos os caixas só é válido quando o administrador aplica o mesmo estado a todos.'
      )
    };
  }

  return {
    ok: false,
    erro: erroAutorizacaoF12(403, 'Apenas administrador pode alterar o estado global do F12.')
  };
}

function autorizarDefinirModeloControle(user) {
  if (podeAdministrarConfiguracaoF12(user)) return { ok: true };
  return {
    ok: false,
    erro: erroAutorizacaoF12(403, 'Apenas administrador pode alterar o controle do F12.')
  };
}

/**
 * Compatibilidade com podeOperadorAlterarF12(politica, user).
 * Aceita política legada ou controle novo.
 */
function podeOperadorAlterarF12Compat(politicaOuControle, user) {
  if (isSuperAdmin(user)) return true;

  const valor = normalizarTexto(politicaOuControle);
  const politica = valor === 'OPERADOR'
    ? 'POR_CAIXA'
    : (valor === 'ADMINISTRADOR' ? 'GLOBAL' : valor);

  if (politica === 'POR_CAIXA') {
    return !isAdmin(user);
  }
  return isAdmin(user);
}

module.exports = {
  CONTROLES,
  ESCOPOS_ADMIN,
  POLITICAS_LEGADAS,
  mapearPoliticaLegadaParaModelo,
  mapearModeloParaPoliticaLegada,
  normalizarModeloControle,
  resolverEstadoEfetivoF12,
  temPermissaoTotalF12,
  isSuperAdminF12,
  isSuperAdmin,
  isPerfilAdmin,
  isAdmin,
  podeAdministrarConfiguracaoF12,
  resolverPodeAlterarF12,
  podeAlterarViaTeclaF12,
  operadorPodeAlterarEsteCaixa,
  resolverAcaoToggleF12,
  autorizarToggleF12,
  autorizarDefinirEstadoCaixa,
  autorizarDefinirEstadoGlobal,
  autorizarDefinirModeloControle,
  podeOperadorAlterarF12Compat
};
