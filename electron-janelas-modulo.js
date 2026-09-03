/**
 * Abertura de PDV/ERP em tela cheia no Electron.
 * window.open de comprovante continua pequeno; módulo nunca herda 420x720.
 */
const { BrowserWindow, screen } = require('electron');
const path = require('path');
const os = require('os');
const { resolverIconeJanela } = require('./electron-icon');

const janelasModulo = { pdv: null, erp: null };

function injetarHostnameEstacao(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  const hostname = os.hostname();
  const script = `(function(){try{var h=${JSON.stringify(hostname)};sessionStorage.setItem('cds_estacao_hostname',h);window.__CDS_ESTACAO_HOSTNAME__=h;}catch(e){}})();`;
  webContents.executeJavaScript(script, true).catch(() => {});
}

function aplicarJanelaModuloTelaCheia(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const area = screen.getPrimaryDisplay().workAreaSize;
    win.setAlwaysOnTop(false);
    win.setMinimumSize(1024, 640);
    win.setBounds({
      x: 0,
      y: 0,
      width: Math.max(area.width, 1024),
      height: Math.max(area.height, 640)
    });
    win.maximize();
    win.show();
    win.focus();
  } catch (_) {
    try {
      if (!win.isDestroyed()) {
        win.setAlwaysOnTop(false);
        win.maximize();
        win.show();
      }
    } catch (__) { /* ignore */ }
  }
}

function janelaAbertaEhModuloApp(details = {}) {
  const destino = String(details.url || '');
  const nome = String(details.frameName || '');
  if (nome === 'cds-pdv' || nome === 'cds-erp') return true;
  if (/[?&]modulo=pdv/i.test(destino) || /[?&]page=licenca/i.test(destino)) return true;
  return /\/(erp|pdv|login)(\/|\?|$)/i.test(destino);
}

function janelaAbertaEhComprovante(details = {}) {
  if (janelaAbertaEhModuloApp(details)) return false;
  const destino = String(details.url || '');
  const feats = String(details.features || '');
  if (/^data:/i.test(destino)) return true;
  if (/width\s*=\s*(3\d{2}|4[0-2]\d)/i.test(feats)) return true;
  return false;
}

function resolverUrlModulo(url, sender) {
  const bruto = String(url || '').trim();
  if (/^https?:\/\//i.test(bruto)) return bruto;
  let origin = 'http://127.0.0.1:3001';
  try {
    if (sender && typeof sender.getURL === 'function') {
      const atual = sender.getURL();
      if (atual && /^https?:/i.test(atual)) origin = new URL(atual).origin;
    }
  } catch (_) { /* ignore */ }
  const caminho = bruto
    ? (bruto.startsWith('/') ? bruto : `/${bruto}`)
    : '/erp';
  return origin + caminho;
}

function opcoesJanelaModulo(titulo) {
  let width = 1280;
  let height = 800;
  try {
    const area = screen.getPrimaryDisplay().workAreaSize;
    width = Math.max(area.width, 1280);
    height = Math.max(area.height, 800);
  } catch (_) { /* ignore */ }
  return {
    width,
    height,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: titulo,
    autoHideMenuBar: true,
    alwaysOnTop: false,
    icon: resolverIconeJanela(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  };
}

function registrarJanelaPrincipalComoModulo(modulo, win) {
  const tipo = String(modulo || '').toLowerCase() === 'pdv' ? 'pdv' : 'erp';
  if (!win) return;
  janelasModulo[tipo] = win;
  win.on('closed', () => {
    if (janelasModulo[tipo] === win) janelasModulo[tipo] = null;
  });
}

function abrirJanelaModuloApp({ url, modulo, sender } = {}) {
  const tipo = String(modulo || '').toLowerCase() === 'pdv' ? 'pdv' : 'erp';
  const absoluta = resolverUrlModulo(url || (tipo === 'pdv' ? '/pdv' : '/erp'), sender);
  const existente = janelasModulo[tipo];
  if (existente && !existente.isDestroyed()) {
    try {
      const atual = existente.webContents.getURL();
      if (absoluta && atual !== absoluta && !String(atual).startsWith(absoluta)) {
        existente.loadURL(absoluta);
      }
    } catch (_) { /* ignore */ }
    aplicarJanelaModuloTelaCheia(existente);
    return existente;
  }

  const titulo = tipo === 'pdv'
    ? 'CDS Sistemas - PDV'
    : 'CDS Sistemas - Plataforma Inteligente de Gestão';
  const nova = new BrowserWindow(opcoesJanelaModulo(titulo));
  janelasModulo[tipo] = nova;
  nova.on('closed', () => {
    if (janelasModulo[tipo] === nova) janelasModulo[tipo] = null;
  });
  configurarAberturaJanelas(nova);
  nova.webContents.on('did-finish-load', () => {
    injetarHostnameEstacao(nova.webContents);
    aplicarJanelaModuloTelaCheia(nova);
  });
  nova.loadURL(absoluta);
  aplicarJanelaModuloTelaCheia(nova);
  return nova;
}

function configurarAberturaJanelas(win) {
  if (!win || win.isDestroyed() || !win.webContents) return;

  win.webContents.setWindowOpenHandler((details) => {
    if (janelaAbertaEhComprovante(details || {})) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 420,
          height: 720,
          title: 'Comprovante',
          alwaysOnTop: true,
          autoHideMenuBar: true,
          modal: false,
          webPreferences: { nodeIntegration: false, contextIsolation: true }
        }
      };
    }

    const destino = String((details && details.url) || '');
    const nome = String((details && details.frameName) || '');
    const modulo = nome === 'cds-pdv' || /\/pdv/i.test(destino) || /modulo=pdv/i.test(destino)
      ? 'pdv'
      : 'erp';
    const urlParaAbrir = destino && destino !== 'about:blank'
      ? destino
      : (modulo === 'pdv' ? '/pdv' : '/erp');

    setImmediate(() => {
      abrirJanelaModuloApp({
        url: urlParaAbrir,
        modulo,
        sender: win.webContents
      });
    });
    return { action: 'deny' };
  });

  win.webContents.on('did-create-window', (child, details) => {
    try {
      if (!child || child.isDestroyed()) return;
      if (janelaAbertaEhComprovante(details || {})) {
        child.setAlwaysOnTop(true);
        child.focus();
        return;
      }
      child.setAlwaysOnTop(false);
      aplicarJanelaModuloTelaCheia(child);
      injetarHostnameEstacao(child.webContents);
    } catch (_) { /* ignore */ }
  });
}

function registrarIpcAbrirModulo(ipcMain) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') return;
  try {
    ipcMain.removeHandler('abrir-modulo-app');
  } catch (_) { /* ignore */ }
  ipcMain.handle('abrir-modulo-app', (event, payload = {}) => {
    const win = abrirJanelaModuloApp({
      url: payload.url,
      modulo: payload.modulo,
      sender: event && event.sender
    });
    return { ok: true, id: win && !win.isDestroyed() ? win.id : null };
  });
}

module.exports = {
  aplicarJanelaModuloTelaCheia,
  janelaAbertaEhModuloApp,
  janelaAbertaEhComprovante,
  abrirJanelaModuloApp,
  registrarJanelaPrincipalComoModulo,
  configurarAberturaJanelas,
  registrarIpcAbrirModulo
};
