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

assert.equal(state().version, 2);
assert.equal(Object.keys(state().settings).length, 9, 'neuf hypothèses communes');
['prixAchatNet', 'fraisAchat', 'taxeImmatriculation', 'aideAchat',
  'remiseComplementaire', 'entretienAnnuel', 'pneusAnnuel',
  'assuranceAnnuelle', 'ikAnnuelleRetenue'].forEach((field) => {
  assert.equal(Object.prototype.hasOwnProperty.call(state().scenarios[0], field), true, `champ scénario ${field}`);
});

{
  const data = state();
  data.settings.horizonKpi = 2;
  data.scenarios[0].prixAchatNet = 10000;
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  close(result.valeurResiduelle, 7920, 'valeur résiduelle thermique');
  close(result.coutDecote, 2080, 'décote thermique');
  close(result.tcoBrut, 2080, 'TCO thermique');
}

{
  const data = state();
  data.settings.horizonKpi = 1;
  Object.assign(data.scenarios[2], {
    prixAchatNet: 30000, aideAchat: 2000, remiseComplementaire: 1000,
    fraisAchat: 500, taxeImmatriculation: 100
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
    coefficientPrudenceIk: 0.9, majorationVehiculeElectrique: 0.2
  });
  data.scenarios[0].ikAnnuelleRetenue = 3000;
  data.scenarios[1].ikAnnuelleRetenue = 3400;
  const ik = TCO.calculations.calculateIkIndicators(data.settings);
  close(ik.ikIndicativeAnnuelle, 4500, 'IK indicative');
  close(ik.bonusIkElectriqueIndicatif, 900, 'bonus IK indicatif');
  const thermal = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  const electric = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[1], data.depreciationProfiles);
  close(thermal.ikRetenueCumulee, 15000, 'IK thermique retenue');
  close(electric.ikRetenueCumulee, 17000, 'IK électrique retenue');
}

{
  const data = state();
  Object.assign(data.settings, { horizonKpi: 2, kilometrageTotalAnnuel: 15000, prixElectricite: 0.25 });
  Object.assign(data.scenarios[1], {
    prixAchatNet: 21000, assuranceAnnuelle: 700, pneusAnnuel: 350,
    aideAchat: 500, ikAnnuelleRetenue: 1200, consoElectriqueKwh100: 16
  });
  Object.assign(data.scenarios[2], {
    prixAchatNet: 34000, assuranceAnnuelle: 1100, pneusAnnuel: 600,
    aideAchat: 2500, ikAnnuelleRetenue: 1800, consoElectriqueKwh100: 19
  });
  const first = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[1], data.depreciationProfiles);
  const second = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[2], data.depreciationProfiles);
  assert.notEqual(first.tcoNetApresIk, second.tcoNetApresIk, 'deux VE conservent leurs hypothèses propres');
  close(first.assuranceCumule, 1400, 'assurance propre au premier VE');
  close(second.assuranceCumule, 2200, 'assurance propre au second VE');
}

{
  const data = state();
  Object.assign(data.settings, { horizonKpi: 1, kilometrageTotalAnnuel: 15000, prixElectricite: 0.25 });
  Object.assign(data.scenarios[1], {
    consoElectriqueKwh100: 16,
    kilometrageTotalAnnuelOverride: 12000,
    prixEnergieOverride: 0.30
  });
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[1], data.depreciationProfiles);
  close(result.coutEnergieAnnuel, 576, 'overrides kilométrage et prix énergie');
  close(result.kilometrageAnnuelUtilise, 12000, 'kilométrage scénario utilisé');
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
  assert.ok(stored.has('tcoApp.v2.settings'));
  const loaded = TCO.storage.loadState();
  close(loaded.settings.prixEssence, 1.97, 'rechargement localStorage');
  assert.equal(loaded.scenarios[0].name, 'Référence libre');
  const json = TCO.storage.exportState(loaded);
  assert.equal(JSON.parse(json).version, 2);
  const imported = TCO.storage.importState(json);
  assert.equal(JSON.stringify(imported.settings), JSON.stringify(loaded.settings));
  assert.equal(JSON.stringify(imported.scenarios), JSON.stringify(loaded.scenarios));
  assert.equal(JSON.stringify(imported.depreciationProfiles), JSON.stringify(loaded.depreciationProfiles));
  assert.throws(() => TCO.storage.importState('{invalide'), /JSON valide/);
  assert.throws(() => TCO.storage.importState('{}'), /settings, scenarios/);
}

{
  const oldSettings = {
    horizonKpi: 4, horizonAnalyseRecommande: 5, kilometrageTotalAnnuel: 14000,
    kilometrageProRembourseIk: 8000, prixEssence: 1.9, prixElectricite: 0.24,
    baremeIkActuel: 0.5, majorationVehiculeElectrique: 0.2, coefficientPrudenceIk: 0.9,
    prixNetDepartThermique: 12000, prixNetDepartElec: 30000,
    taxeImmatriculation: 250, fraisAchatThermiqueOccasion: 300,
    fraisAchatElectriqueOccasion: 450, fraisAchatElectriqueNeuve: 600,
    entretienThermiqueStandard: 900, entretienElectriqueStandard: 400,
    pneusThermiqueStandard: 450, pneusModelYStandard: 650,
    assuranceThermiqueStandard: 750, assuranceElectriqueStandard: 1050,
    aideVeNeuveEligible: 2000, surbonusRemiseComplementaire: 1000,
    ikActuellesAnnuelles: 3000, bonusIkElectriqueRetenu: 400
  };
  const oldScenarios = [
    { id: 'old_thermal', name: 'Ancien thermique', energyType: 'thermal', acquisitionStatus: 'used', depreciationType: 'Thermique occasion', depreciationLevel: 'Central', consoThermiqueL100: 6, consoElectriqueKwh100: 0, includeInCharts: true },
    { id: 'old_electric', name: 'Ancien VE neuf', energyType: 'electric', acquisitionStatus: 'new', depreciationType: 'Électrique neuve', depreciationLevel: 'Central', consoThermiqueL100: 0, consoElectriqueKwh100: 17, includeInCharts: true }
  ];
  const legacyExport = JSON.stringify({
    version: 1, settings: oldSettings, scenarios: oldScenarios,
    depreciationProfiles: TCO.defaults.clone(TCO.defaults.DEFAULT_DEPRECIATION_PROFILES)
  });
  const migrated = TCO.storage.importState(legacyExport);
  assert.equal(migrated.version, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(migrated.settings, 'prixNetDepartElec'), false);
  assert.equal(migrated.scenarios[0].prixAchatNet, 12000);
  assert.equal(migrated.scenarios[0].fraisAchat, 300);
  assert.equal(migrated.scenarios[0].ikAnnuelleRetenue, 3000);
  assert.equal(migrated.scenarios[1].prixAchatNet, 30000);
  assert.equal(migrated.scenarios[1].fraisAchat, 600);
  assert.equal(migrated.scenarios[1].aideAchat, 2000);
  assert.equal(migrated.scenarios[1].remiseComplementaire, 1000);
  assert.equal(migrated.scenarios[1].pneusAnnuel, 650);
  assert.equal(migrated.scenarios[1].ikAnnuelleRetenue, 3400);

  stored.clear();
  stored.set('tcoApp.v1.settings', JSON.stringify(oldSettings));
  stored.set('tcoApp.v1.scenarios', JSON.stringify(oldScenarios));
  stored.set('tcoApp.v1.depreciationProfiles', JSON.stringify(TCO.defaults.DEFAULT_DEPRECIATION_PROFILES));
  const loadedLegacy = TCO.storage.loadState();
  assert.equal(loadedLegacy.scenarios[1].prixAchatNet, 30000, 'migration des clés localStorage V1');
  assert.ok(stored.has('tcoApp.v2.settings'), 'création automatique des clés V2');
  assert.ok(stored.has('tcoApp.v2.scenarios'), 'scénarios V2 sauvegardés après migration');
}

console.log('Tous les tests automatisés sont passés.');
