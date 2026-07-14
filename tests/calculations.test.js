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
function assertAnnualReconciliation(result, label) {
  const detail = result.decompositionAnnuelle;
  const first = detail.annees[0];
  const last = detail.annees[detail.annees.length - 1];
  assert.equal(first.soldeNet, result.coutAcquisitionNet, `${label} : acquisition année 0`);
  assert.equal(last.cumulTresorerie, result.tcoNetApresIk, `${label} : cumul final`);
  assert.equal(last.tcoEconomique, result.tcoNetApresIk, `${label} : TCO économique final`);
  close(detail.totaux.totalCouts - detail.totaux.totalGains, result.tcoNetApresIk, `${label} : coûts moins gains`);
  assert.equal(detail.totaux.soldeNet, result.tcoNetApresIk, `${label} : solde total`);
}

assert.equal(state().version, 3);
assert.equal(Object.keys(state().settings).length, 9, 'neuf hypothèses communes');
['prixAchatNet', 'fraisAchat', 'taxeImmatriculation', 'aideAchat',
  'remiseComplementaire', 'montantReprise', 'entretienAnnuel', 'pneusAnnuel',
  'assuranceAnnuelle', 'ikAnnuelleRetenue', 'anneeMiseEnCirculation',
  'kilometrageAchat', 'kilometrageAnnuelOverride'].forEach((field) => {
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

// La reprise réduit l’acquisition et le TCO, sans réduire la valeur décotée du véhicule acheté.
{
  const data = state();
  data.settings.horizonKpi = 1;
  Object.assign(data.scenarios[0], { prixAchatNet: 10000, montantReprise: 3000 });
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  close(result.assietteValeur, 10000, 'assiette indépendante de la reprise');
  close(result.coutAcquisitionNet, 7000, 'acquisition nette après reprise');
  close(result.valeurResiduelle, 8800, 'valeur résiduelle indépendante de la reprise');
  close(result.tcoBrut, 1200, 'TCO brut avant reprise');
  close(result.tcoNetApresIk, -1800, 'TCO net après reprise');
  close(result.seriesAnnuelles[0].tcoNet, -1800, 'reprise appliquée dès la première année');
}

// Échéancier complet : acquisition, coûts annuels, gains et valeur résiduelle finale.
{
  const data = state();
  Object.assign(data.settings, { horizonKpi: 2, kilometrageTotalAnnuel: 10000, prixEssence: 2 });
  Object.assign(data.scenarios[0], {
    prixAchatNet: 20000, aideAchat: 1000, remiseComplementaire: 500,
    montantReprise: 3000, fraisAchat: 400, taxeImmatriculation: 100,
    consoThermiqueL100: 6, entretienAnnuel: 600, pneusAnnuel: 300,
    assuranceAnnuelle: 800, ikAnnuelleRetenue: 1000
  });
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  const detail = result.decompositionAnnuelle;
  assert.equal(detail.annees.length, 3, 'année 0 plus deux années de détention');
  close(detail.annees[0].couts.achatVehicule, 20000, 'prix en année 0');
  close(detail.annees[0].couts.fraisAchat, 400, 'frais en année 0');
  close(detail.annees[0].couts.taxes, 100, 'taxe en année 0');
  close(detail.annees[0].gains.aidesRemises, 1500, 'aides et remises appliquées');
  close(detail.annees[0].gains.reprise, 3000, 'reprise en année 0');
  close(detail.annees[0].totalCouts, 20500, 'total coûts année 0');
  close(detail.annees[0].totalGains, 4500, 'total gains année 0');
  close(detail.annees[0].soldeNet, 16000, 'acquisition nette année 0');
  close(detail.annees[0].valeurVehiculeDeduite, 18500, 'assiette déduite en année 0');
  close(detail.annees[1].couts.energie, 1200, 'énergie annuelle');
  close(detail.annees[1].couts.entretien, 600, 'entretien annuel');
  close(detail.annees[1].couts.pneus, 300, 'pneus annuels');
  close(detail.annees[1].couts.assurance, 800, 'assurance annuelle');
  close(detail.annees[1].gains.ik, 1000, 'IK annuelle');
  close(detail.annees[1].gains.valeurResiduelle, 0, 'pas de revente avant l’horizon');
  close(detail.annees[1].soldeNet, 1900, 'solde année 1');
  close(detail.annees[1].cumulTresorerie, 17900, 'cumul année 1');
  close(detail.annees[1].valeurVehiculeDeduite, 16280, 'valeur du véhicule déduite en année 1');
  close(detail.annees[1].tcoEconomique, 1620, 'TCO économique année 1');
  close(detail.annees[2].gains.valeurResiduelle, 14652, 'valeur résiduelle à l’horizon');
  close(detail.annees[2].valeurVehiculeDeduite, 14652, 'valeur du véhicule déduite à l’horizon');
  close(detail.annees[2].soldeNet, -12752, 'solde final avec revente');
  close(detail.totaux.totalCouts, 26300, 'total des coûts horizon');
  close(detail.totaux.totalGains, 21152, 'total des gains horizon');
  assert.equal(Object.prototype.hasOwnProperty.call(detail.totaux.gains, 'valeurVehiculeDeduite'), false, 'valeur déduite non cumulée dans les gains');
  assertAnnualReconciliation(result, 'échéancier complet');
}

// Les aides/remises sont plafonnées au prix, tandis qu’une reprise élevée reste un gain distinct.
{
  const data = state();
  data.settings.horizonKpi = 1;
  Object.assign(data.scenarios[0], {
    prixAchatNet: 1000, aideAchat: 800, remiseComplementaire: 500,
    montantReprise: 1500, fraisAchat: 100
  });
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  const detail = result.decompositionAnnuelle;
  close(detail.annees[0].gains.aidesRemises, 1000, 'aides appliquées plafonnées au prix');
  close(detail.annees[0].gains.reprise, 1500, 'reprise non confondue avec les aides');
  close(detail.annees[0].soldeNet, -1400, 'acquisition négative autorisée');
  close(detail.totaux.totalCouts, 1100, 'coûts avec aides supérieures au prix');
  close(detail.totaux.totalGains, 2500, 'gains avec reprise élevée');
  assertAnnualReconciliation(result, 'plafond des aides et reprise élevée');
}

// Horizon 1 : la valeur résiduelle n’apparaît que dans la dernière colonne.
{
  const data = state();
  data.settings.horizonKpi = 1;
  data.scenarios[0].prixAchatNet = 10000;
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  assert.equal(result.decompositionAnnuelle.annees.length, 2);
  close(result.decompositionAnnuelle.annees[0].gains.valeurResiduelle, 0, 'aucune valeur résiduelle en année 0');
  close(result.decompositionAnnuelle.annees[1].gains.valeurResiduelle, 8800, 'valeur résiduelle en année 1');
  assertAnnualReconciliation(result, 'horizon un an');
}

// Horizon 10 : les postes annuels sont répétés dix fois et la revente reste unique.
{
  const data = state();
  data.settings.horizonKpi = 10;
  Object.assign(data.scenarios[0], { prixAchatNet: 10000, entretienAnnuel: 100, ikAnnuelleRetenue: 50 });
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  const detail = result.decompositionAnnuelle;
  assert.equal(detail.annees.length, 11);
  detail.annees.slice(1, -1).forEach((point) => close(point.gains.valeurResiduelle, 0, 'revente absente avant année 10'));
  close(detail.totaux.couts.entretien, 1000, 'entretien répété dix ans');
  close(detail.totaux.gains.ik, 500, 'IK répétées dix ans');
  close(detail.totaux.gains.valeurResiduelle, result.valeurResiduelle, 'une seule valeur résiduelle');
  assertAnnualReconciliation(result, 'horizon dix ans');
}

// Les montants nuls produisent un échéancier neutre mais complet.
{
  const data = state();
  data.settings.horizonKpi = 3;
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  assert.equal(result.decompositionAnnuelle.annees.length, 4);
  close(result.decompositionAnnuelle.totaux.totalCouts, 0, 'coûts nuls');
  close(result.decompositionAnnuelle.totaux.totalGains, 0, 'gains nuls');
  assertAnnualReconciliation(result, 'échéancier nul');
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
    kilometrageAnnuelOverride: 12000,
    prixEnergieOverride: 0.30
  });
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[1], data.depreciationProfiles);
  close(result.coutEnergieAnnuel, 576, 'overrides kilométrage et prix énergie');
  close(result.kilometrageAnnuelUtilise, 12000, 'kilométrage scénario utilisé');
}

// Une occasion âgée de 5 ans commence au taux âge 6.
{
  const data = state();
  data.settings.horizonKpi = 1;
  Object.assign(data.scenarios[0], {
    prixAchatNet: 10000,
    anneeMiseEnCirculation: new Date().getFullYear() - 5
  });
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  close(result.valeurResiduelle, 9500, 'occasion âgée démarrant au taux âge 6');
  assert.equal(result.ageAchat, 5);
  assert.equal(result.ageHorizon, 6);
  assert.equal(result.seriesAnnuelles[0].anneeProfil, 6);
  close(result.seriesAnnuelles[0].tauxDecoteBase, 0.05, 'taux âge 6 sélectionné');
}

// Le kilométrage initial ne modifie pas la décote, mais reste projeté à l’horizon.
{
  const data = state();
  Object.assign(data.settings, { horizonKpi: 3, kilometrageTotalAnnuel: 20000 });
  data.scenarios[0].prixAchatNet = 10000;
  data.scenarios[0].kilometrageAchat = 0;
  const withoutInitialMileage = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  data.scenarios[0].kilometrageAchat = 200000;
  const withInitialMileage = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  close(withInitialMileage.valeurResiduelle, withoutInitialMileage.valeurResiduelle, 'absence de double correction du kilométrage initial');
  close(withInitialMileage.kilometrageHorizon, 260000, 'projection incluant le kilométrage initial');
}

// Âge et kilométrage projetés à l’horizon.
{
  const data = state();
  Object.assign(data.settings, { horizonKpi: 3, kilometrageTotalAnnuel: 12000 });
  Object.assign(data.scenarios[0], {
    anneeMiseEnCirculation: new Date().getFullYear() - 5,
    kilometrageAchat: 80000
  });
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  assert.equal(result.ageAchat, 5);
  assert.equal(result.ageHorizon, 8);
  close(result.kilometrageHorizon, 116000, 'kilométrage à horizon');
}

// Au-delà de l’âge 10, le dernier taux du profil est répété.
{
  const data = state();
  data.settings.horizonKpi = 2;
  Object.assign(data.scenarios[0], {
    prixAchatNet: 10000,
    anneeMiseEnCirculation: new Date().getFullYear() - 12
  });
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  close(result.valeurResiduelle, 9216, 'taux âge 10 répété deux fois');
  assert.equal(result.seriesAnnuelles[0].anneeProfil, 13);
  assert.equal(result.seriesAnnuelles[0].tauxProfilRepete, true);
  close(result.seriesAnnuelles[0].tauxDecoteBase, 0.04, 'dernier taux répété');
  close(result.seriesAnnuelles[1].tauxDecoteBase, 0.04, 'dernier taux répété à nouveau');
}

// Une occasion sans année utilise les taux par année de possession.
{
  const data = state();
  data.settings.horizonKpi = 1;
  Object.assign(data.scenarios[0], { prixAchatNet: 10000, anneeMiseEnCirculation: null });
  const result = TCO.calculations.calculateScenarioTco(data.settings, data.scenarios[0], data.depreciationProfiles);
  assert.equal(result.ageAchat, null);
  close(result.valeurResiduelle, 8800, 'premier taux utilisé sans année connue');
  assert.equal(result.warnings.length, 1);
}

['12', '12%', '12,0%', '0,12', '0.12'].forEach((value) => {
  close(TCO.depreciation.normalizeRate(value), 0.12, `normalisation de ${value}`);
});

// Profil de décote automatique par interpolation exponentielle.
{
  const generated = TCO.depreciation.calculerProfilDecote(45000, 25000, 5);
  close(generated.tauxDecoteAnnuel, 1 - Math.pow(25000 / 45000, 1 / 5), 'taux composé automatique');
  assert.ok(Math.abs(generated.tauxDecoteAnnuel - 0.111) < 0.001, 'taux automatique proche de 11,1 %');
  assert.equal(generated.profil.length, 6);
  assert.equal(generated.profil[0].annee, 0);
  assert.equal(generated.profil[0].prix, 45000, 'prix initial exact');
  assert.equal(generated.profil[5].prix, 25000, 'prix final exact');
  assert.equal(generated.profil[2].prix, Math.round(45000 * Math.pow(25000 / 45000, 2 / 5)), 'interpolation composée année 2');
  close(generated.profil[3].decoteDepuisDepart, 1 - Math.pow(25000 / 45000, 3 / 5), 'décote cumulée année 3');
}

[
  [0, 25000, 5, /prix de départ/],
  [-1, 25000, 5, /prix de départ/],
  [45000, 0, 5, /prix estimé/],
  [45000, -1, 5, /prix estimé/],
  [45000, 25000, 0, /nombre d’années/],
  [45000, 25000, -1, /nombre d’années/],
  [45000, 25000, 2.5, /entier compris entre 1 et 10/],
  [45000, 25000, 11, /entier compris entre 1 et 10/],
  [25000, 45000, 5, /inférieur ou égal/]
].forEach((testCase) => {
  assert.throws(() => TCO.depreciation.calculerProfilDecote(testCase[0], testCase[1], testCase[2]), testCase[3]);
});

assert.equal(TCO.defaults.DEFAULT_DEPRECIATION_PROFILES.length, 12);
TCO.defaults.DEFAULT_DEPRECIATION_PROFILES.forEach((profile) => {
  assert.equal(profile.rates.length, 10);
});

{
  const data = state();
  data.settings.prixEssence = 1.97;
  data.scenarios[0].name = 'Référence libre';
  assert.equal(TCO.storage.saveState(data), true);
  assert.equal(stored.size, 3, 'trois clés localStorage versionnées');
  assert.ok(stored.has('tcoApp.v3.settings'));
  const loaded = TCO.storage.loadState();
  close(loaded.settings.prixEssence, 1.97, 'rechargement localStorage');
  assert.equal(loaded.scenarios[0].name, 'Référence libre');
  const json = TCO.storage.exportState(loaded);
  assert.equal(JSON.parse(json).version, 3);
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
  assert.equal(migrated.version, 3);
  assert.equal(Object.prototype.hasOwnProperty.call(migrated.settings, 'prixNetDepartElec'), false);
  assert.equal(migrated.scenarios[0].prixAchatNet, 12000);
  assert.equal(migrated.scenarios[0].montantReprise, 0, 'reprise absente migrée à zéro');
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
  assert.ok(stored.has('tcoApp.v3.settings'), 'création automatique des clés V3');
  assert.ok(stored.has('tcoApp.v3.scenarios'), 'scénarios V3 sauvegardés après migration');
}

// Migration d’un état V2 et suppression d’anciens réglages avancés.
{
  const v2 = state();
  v2.version = 2;
  v2.scenarios.forEach((scenario) => {
    delete scenario.anneeMiseEnCirculation;
    delete scenario.kilometrageAchat;
    delete scenario.kilometrageAnnuelOverride;
    delete scenario.montantReprise;
    scenario.kilometrageTotalAnnuelOverride = null;
  });
  v2.depreciationProfiles.forEach((profile) => {
    profile.kilometrageReferenceAnnuel = 15000;
    profile.sensibiliteKilometrage = 0.05;
    profile.ageFactors = new Array(11).fill(1.2);
  });
  const migrated = TCO.storage.importState(JSON.stringify(v2));
  assert.equal(migrated.version, 3);
  assert.equal(migrated.scenarios[0].anneeMiseEnCirculation, null, 'occasion sans année conservée nulle');
  assert.equal(migrated.scenarios[0].kilometrageAchat, 0);
  assert.equal(migrated.scenarios[0].kilometrageAnnuelOverride, null);
  assert.equal(migrated.scenarios[0].montantReprise, 0, 'reprise V2 absente migrée à zéro');
  assert.equal(migrated.scenarios[2].anneeMiseEnCirculation, new Date().getFullYear(), 'année courante pour un véhicule neuf');
  assert.equal(Object.prototype.hasOwnProperty.call(migrated.depreciationProfiles[0], 'sensibiliteKilometrage'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(migrated.depreciationProfiles[0], 'kilometrageReferenceAnnuel'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(migrated.depreciationProfiles[0], 'ageFactors'), false);

  stored.clear();
  stored.set('tcoApp.v2.settings', JSON.stringify(v2.settings));
  stored.set('tcoApp.v2.scenarios', JSON.stringify(v2.scenarios));
  stored.set('tcoApp.v2.depreciationProfiles', JSON.stringify(v2.depreciationProfiles));
  const loadedV2 = TCO.storage.loadState();
  assert.equal(loadedV2.version, 3);
  assert.equal(loadedV2.scenarios[0].anneeMiseEnCirculation, null);
  assert.ok(stored.has('tcoApp.v3.settings'), 'création automatique des clés V3 depuis V2');
  assert.ok(stored.has('tcoApp.v3.scenarios'), 'scénarios V2 migrés dans le stockage V3');
}

console.log('Tous les tests automatisés sont passés.');
