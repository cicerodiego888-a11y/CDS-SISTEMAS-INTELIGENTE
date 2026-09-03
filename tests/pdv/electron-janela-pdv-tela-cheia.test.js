/**
 * PDV aberto a partir do ERP Electron deve ser tela cheia, não comprovante 420x720.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('Electron — PDV em tela cheia', () => {
  it('electron.js (npm start) não força toda janela filha em 420x720', () => {
    const src = read('electron.js');
    assert.doesNotMatch(src, /setWindowOpenHandler\(\(\) => \{/);
    assert.match(src, /configurarAberturaJanelas\(mainWindow\)/);
    assert.match(src, /registrarIpcAbrirModulo/);
    assert.doesNotMatch(src, /childWindow\.setAlwaysOnTop\(true\)/);
  });

  it('comprovante só com data: ou largura de cupom; about:blank do PDV não é cupom', () => {
    const src = read('electron-janelas-modulo.js');
    assert.match(src, /nome === 'cds-pdv'/);
    assert.match(src, /action: 'deny'/);
    assert.match(src, /abrir-modulo-app/);
    assert.match(src, /win\.maximize\(\)/);
    assert.doesNotMatch(src, /if \(!destino \|\| destino === 'about:blank'\) return true;/);
  });

  it('preload e core usam IPC abrirModuloApp', () => {
    assert.match(read('preload.js'), /abrir-modulo-app/);
    assert.match(read('frontend/shared/js/core.js'), /electronAPI\.abrirModuloApp/);
  });
});
