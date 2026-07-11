/* Tests sans dépendance : lancer avec `node tests/calculations.test.js`. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const stored = new Map();
const context = {
  window: {},
  localStorage: {
    getItem: (key) => stored.has(key) ? stored.get(key) : null,
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: (key) => stored.delete(key)
  }
};
context.window.window = context.window;
vm.createContext(context);
['js/defaults.js', 'js/depreciation.js', 'js/storage.js', 'js/calculations.js'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
});
const TCO = context.window.TCO;

function state() { return TCO.defaults.createDefaultState(); }
function close(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} !== ${expected}`);
}

{
  const data = state();
  Object.assign(data.settings, { horizonKpi: 2, prixNetDepartThermique: 10000 });
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  close(result.valeurResiduelle, 7920, 'valeur résiduelle thermique');
  close(result.coutDecote, 2080, 'décote thermique');
  close(result.tcoBrut, 2080, 'TCO thermique');
}

{
  const data = state();
  Object.assign(data.settings, {
    horizonKpi: 1, prixNetDepartElec: 30000, aideVeNeuveEligible: 2000,
    surbonusRemiseComplementaire: 1000, fraisAchatElectriqueNeuve: 500,
    taxeImmatriculation: 100
  });
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[2], data.depreciationProfiles);
  close(result.assietteValeur, 27000, 'assiette électrique neuve');
  close(result.valeurResiduelle, 21060, 'valeur résiduelle électrique neuve');
  close(result.tcoBrut, 6540, 'TCO électrique neuf');
}

{
  const data = state();
  Object.assign(data.settings, { horizonKpi: 3, kilometrageTotalAnnuel: 15000, prixEssence: 2 });
  data.scenarios[0].consoThermiqueL100 = 6;
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  close(result.coutEnergieAnnuel, 1800, 'énergie thermique annuelle');
  close(result.coutEnergieCumule, 5400, 'énergie thermique cumulée');
}

{
  const data = state();
  Object.assign(data.settings, { horizonKpi: 3, kilometrageTotalAnnuel: 15000, prixElectricite: 0.25 });
  data.scenarios[1].consoElectriqueKwh100 = 16;
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[1], data.depreciationProfiles);
  close(result.coutEnergieAnnuel, 600, 'énergie électrique annuelle');
  close(result.coutEnergieCumule, 1800, 'énergie électrique cumulée');
}

{
  const data = state();
  Object.assign(data.settings, {
    horizonKpi: 5, kilometrageProRembourseIk: 10000, baremeIkActuel: 0.5,
    coefficientPrudenceIk: 0.9, majorationVehiculeElectrique: 0.2,
    ikActuellesAnnuelles: 3000, bonusIkElectriqueRetenu: 400
  });
  const ik = TCO.calculations.calculateIkIndicators(data.settings);
  close(ik.ikIndicativeAnnuelle, 4500, 'IK indicative');
  close(ik.bonusIkElectriqueIndicatif, 900, 'bonus IK indicatif');
  const thermal = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  const electric = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[1], data.depreciationProfiles);
  close(thermal.ikRetenueCumulee, 15000, 'IK thermique retenue');
  close(electric.ikRetenueCumulee, 17000, 'IK électrique retenue');
}

['12', '12%', '12,0%', '0,12', '0.12'].forEach((value) => {
  close(TCO.depreciation.normalizeRate(value), 0.12, `normalisation de ${value}`);
});
assert.equal(TCO.defaults.DEFAULT_DEPRECIATION_PROFILES.length, 12);
TCO.defaults.DEFAULT_DEPRECIATION_PROFILES.forEach((profile) => assert.equal(profile.rates.length, 10));

{
  const data = state();
  data.settings.prixEssence = 1.97;
  data.scenarios[0].name = 'Référence libre';
  assert.equal(TCO.storage.saveState(data), true);
  assert.equal(stored.size, 3, 'trois clés localStorage versionnées');
  const loaded = TCO.storage.loadState();
  close(loaded.settings.prixEssence, 1.97, 'rechargement localStorage');
  assert.equal(loaded.scenarios[0].name, 'Référence libre');
  const json = TCO.storage.exportState(loaded);
  const imported = TCO.storage.importState(json);
  assert.equal(JSON.stringify(imported.settings), JSON.stringify(loaded.settings));
  assert.equal(JSON.stringify(imported.scenarios), JSON.stringify(loaded.scenarios));
  assert.equal(JSON.stringify(imported.depreciationProfiles), JSON.stringify(loaded.depreciationProfiles));
  assert.throws(() => TCO.storage.importState('{invalide'), /JSON valide/);
  assert.throws(() => TCO.storage.importState('{}'), /settings, scenarios/);
}

console.log('Tous les tests automatisés sont passés.');
