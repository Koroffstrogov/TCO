(function (TCO) {
  'use strict';

  const CURRENT_YEAR = new Date().getFullYear();

  const DEFAULT_SETTINGS = Object.freeze({
    horizonKpi: 5,
    horizonAnalyseRecommande: 5,
    kilometrageTotalAnnuel: 0,
    forcerKilometrageTotalAnnuel: false,
    kilometrageProRembourseIk: 0,
    prixEssence: 0,
    prixElectricite: 0,
    baremeIkActuel: 0,
    majorationVehiculeElectrique: 0,
    coefficientPrudenceIk: 1,
    forcerIkIndicatives: false
  });

  const DEFAULT_SCENARIOS = Object.freeze([
    {
      id: 'thermal_used', name: 'Thermique occasion', energyType: 'thermal',
      acquisitionStatus: 'used', prixAchatNet: 0, taxeImmatriculation: 0,
      fraisAchat: 0, aideAchat: 0, remiseComplementaire: 0, montantReprise: 0,
      entretienAnnuel: 0, pneusAnnuel: 0, assuranceAnnuelle: 0,
      ikAnnuelleRetenue: 0, depreciationType: 'Thermique occasion',
      depreciationLevel: 'Central', consoThermiqueL100: 0,
      consoElectriqueKwh100: 0, includeInCharts: true,
      anneeMiseEnCirculation: null, kilometrageAchat: 0,
      kilometrageAnnuelOverride: null,
      kilometrageProRembourseIkOverride: null,
      prixEnergieOverride: null
    },
    {
      id: 'electric_used', name: 'Électrique occasion', energyType: 'electric',
      acquisitionStatus: 'used', prixAchatNet: 0, taxeImmatriculation: 0,
      fraisAchat: 0, aideAchat: 0, remiseComplementaire: 0, montantReprise: 0,
      entretienAnnuel: 0, pneusAnnuel: 0, assuranceAnnuelle: 0,
      ikAnnuelleRetenue: 0, depreciationType: 'Tesla occasion',
      depreciationLevel: 'Central', consoThermiqueL100: 0,
      consoElectriqueKwh100: 0, includeInCharts: true,
      anneeMiseEnCirculation: null, kilometrageAchat: 0,
      kilometrageAnnuelOverride: null,
      kilometrageProRembourseIkOverride: null,
      prixEnergieOverride: null
    },
    {
      id: 'electric_new', name: 'Électrique neuve', energyType: 'electric',
      acquisitionStatus: 'new', prixAchatNet: 0, taxeImmatriculation: 0,
      fraisAchat: 0, aideAchat: 0, remiseComplementaire: 0, montantReprise: 0,
      entretienAnnuel: 0, pneusAnnuel: 0, assuranceAnnuelle: 0,
      ikAnnuelleRetenue: 0, depreciationType: 'Électrique neuve',
      depreciationLevel: 'Central', consoThermiqueL100: 0,
      consoElectriqueKwh100: 0, includeInCharts: true,
      anneeMiseEnCirculation: CURRENT_YEAR, kilometrageAchat: 0,
      kilometrageAnnuelOverride: null,
      kilometrageProRembourseIkOverride: null,
      prixEnergieOverride: null
    }
  ]);

  const rows = [
    ['Thermique occasion', 'Optimiste', [9, 8, 7, 6, 5, 4, 4, 3, 3, 3]],
    ['Thermique occasion', 'Central', [12, 10, 8, 7, 6, 5, 5, 4, 4, 4]],
    ['Thermique occasion', 'Pessimiste', [16, 13, 11, 9, 8, 7, 6, 5, 5, 5]],
    ['Tesla occasion', 'Optimiste', [10, 9, 8, 7, 6, 5, 4, 4, 3, 3]],
    ['Tesla occasion', 'Central', [12, 10, 9, 8, 7, 6, 5, 5, 4, 4]],
    ['Tesla occasion', 'Pessimiste', [18, 15, 12, 10, 9, 8, 7, 6, 6, 5]],
    ['Électrique neuve', 'Optimiste', [17, 12, 10, 8, 7, 6, 5, 4, 4, 3]],
    ['Électrique neuve', 'Central', [22, 15, 12, 10, 8, 7, 6, 5, 5, 4]],
    ['Électrique neuve', 'Pessimiste', [30, 20, 16, 12, 10, 9, 8, 7, 6, 6]],
    ['Tesla neuve', 'Optimiste', [18, 12, 10, 8, 7, 6, 5, 4, 4, 3]],
    ['Tesla neuve', 'Central', [24, 16, 13, 10, 8, 7, 6, 5, 5, 4]],
    ['Tesla neuve', 'Pessimiste', [32, 22, 16, 12, 10, 9, 8, 7, 6, 6]]
  ];

  const DEFAULT_DEPRECIATION_PROFILES = Object.freeze(rows.map(function (row) {
    return Object.freeze({
      key: row[0] + '|' + row[1],
      type: row[0],
      level: row[1],
      rates: Object.freeze(row[2].map(function (rate) { return rate / 100; }))
    });
  }));

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createDefaultState() {
    return {
      version: 3,
      settings: clone(DEFAULT_SETTINGS),
      scenarios: clone(DEFAULT_SCENARIOS),
      depreciationProfiles: clone(DEFAULT_DEPRECIATION_PROFILES)
    };
  }

  TCO.defaults = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    DEFAULT_SCENARIOS: DEFAULT_SCENARIOS,
    DEFAULT_DEPRECIATION_PROFILES: DEFAULT_DEPRECIATION_PROFILES,
    createDefaultState: createDefaultState,
    clone: clone
  };
}(window.TCO = window.TCO || {}));
