/**
 * Sprint 15.7 — Device Profile SDK
 *
 * Plataforma extensível para novos fabricantes sem alterar o núcleo.
 */

'use strict';

const DeviceProfile = require('./DeviceProfile');
const DriverCapabilities = require('./DriverCapabilities');
const DriverManifest = require('./DriverManifest');
const DriverCompatibility = require('./DriverCompatibility');
const DriverValidator = require('./DriverValidator');
const registry = require('./DriverRegistry');
const loader = require('./DriverLoader');
const DriverTemplateGenerator = require('./DriverTemplateGenerator');

function ensureLoaded(opcoes = {}) {
  if (!loader.estaCarregado() || opcoes.forcar) {
    return loader.carregarTodos(opcoes);
  }
  return loader.obterRelatorio();
}

function reload() {
  return loader.reload();
}

function listarDrivers(filtros = {}) {
  ensureLoaded();
  return registry.listar(filtros);
}

function obterDriver(id) {
  ensureLoaded();
  return registry.buscar(id);
}

module.exports = {
  DeviceProfile,
  DriverCapabilities,
  DriverManifest,
  DriverCompatibility,
  DriverValidator,
  registry,
  loader,
  DriverTemplateGenerator,
  get DriverSdkRoutes() {
    return require('./DriverSdkRoutes');
  },
  get DriverSdkController() {
    return require('./DriverSdkController');
  },
  ensureLoaded,
  reload,
  listarDrivers,
  obterDriver
};
