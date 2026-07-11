(function (TCO) {
  'use strict';

  const KEYS = {
    settings: 'tcoApp.v3.settings',
    scenarios: 'tcoApp.v3.scenarios',
    profiles: 'tcoApp.v3.depreciationProfiles'
  };
  const V2_KEYS = {
    settings: 'tcoApp.v2.settings',
    scenarios: 'tcoApp.v2.scenarios',
    profiles: 'tcoApp.v2.depreciationProfiles'
  };
  const LEGACY_KEYS = {
    settings: 'tcoApp.v1.settings',
    scenarios: 'tcoApp.v1.scenarios',
    profiles: 'tcoApp.v1.depreciationProfiles'
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function normalizeState(candidate) {
    const defaults = TCO.defaults.createDefaultState();
    const source = candidate && typeof candidate === 'object' ? candidate : {};
    const settings = source.settings && typeof source.settings === 'object' ? source.settings : {};
    const normalizedSettings = {};
    Object.keys(defaults.settings).forEach(function (key) {
      const number = Number(settings[key]);
      normalizedSettings[key] = Number.isFinite(number) ? number : defaults.settings[key];
    });
    const hasSourceScenarios = Array.isArray(source.scenarios) && source.scenarios.length > 0;
    const scenarios = hasSourceScenarios
      ? source.scenarios.filter(function (item) { return item && typeof item === 'object'; })
      : defaults.scenarios;
    const profiles = Array.isArray(source.depreciationProfiles) && source.depreciationProfiles.length
      ? source.depreciationProfiles.filter(function (profile) {
        return profile && typeof profile.type === 'string' && typeof profile.level === 'string' &&
          Array.isArray(profile.rates) && profile.rates.length === 10;
      }).map(function (profile) {
        const copy = Object.assign({}, profile);
        copy.key = copy.type + '|' + copy.level;
        copy.rates = copy.rates.map(function (rate) {
          const number = Number(rate);
          return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
        });
        const reference = Number(copy.kilometrageReferenceAnnuel);
        const sensitivity = Number(copy.sensibiliteKilometrage);
        copy.kilometrageReferenceAnnuel = Number.isFinite(reference) ? Math.max(0, reference) : 0;
        copy.sensibiliteKilometrage = Number.isFinite(sensitivity) ? Math.max(0, sensitivity) : 0;
        copy.ageFactors = new Array(11).fill(1).map(function (_, index) {
          const factor = Number(Array.isArray(profile.ageFactors) ? profile.ageFactors[index] : 1);
          return Number.isFinite(factor) && factor >= 0 ? factor : 1;
        });
        return copy;
      })
      : defaults.depreciationProfiles;

    return {
      version: 3,
      settings: normalizedSettings,
      scenarios: scenarios.map(function (scenario, index) {
        const base = defaults.scenarios[index] || defaults.scenarios[0];
        const merged = Object.assign({}, base, scenario);
        const isElectric = merged.energyType === 'electric';
        const isNew = merged.acquisitionStatus === 'new';
        const hasOwn = function (key) { return Object.prototype.hasOwnProperty.call(scenario, key); };
        const oldNumber = function (key) {
          const number = Number(settings[key]);
          return Number.isFinite(number) ? number : 0;
        };
        const scenarioNumber = function (key, legacyValue) {
          const number = Number(hasSourceScenarios && hasOwn(key) ? scenario[key] : legacyValue);
          return Number.isFinite(number) ? number : 0;
        };
        const nullableNumber = function (key) {
          const value = scenario[key];
          if (value === null || value === undefined || value === '') return null;
          const number = Number(value);
          return Number.isFinite(number) ? number : null;
        };
        const thermalConsumption = Number(merged.consoThermiqueL100);
        const electricConsumption = Number(merged.consoElectriqueKwh100);
        const yearValue = Number(scenario.anneeMiseEnCirculation);
        const purchaseMileage = Number(scenario.kilometrageAchat);
        const legacyPrice = isElectric ? oldNumber('prixNetDepartElec') : oldNumber('prixNetDepartThermique');
        const legacyFees = isElectric
          ? (isNew ? oldNumber('fraisAchatElectriqueNeuve') : oldNumber('fraisAchatElectriqueOccasion'))
          : oldNumber('fraisAchatThermiqueOccasion');
        const legacyMaintenance = isElectric ? oldNumber('entretienElectriqueStandard') : oldNumber('entretienThermiqueStandard');
        const legacyTyres = isElectric ? oldNumber('pneusModelYStandard') : oldNumber('pneusThermiqueStandard');
        const legacyInsurance = isElectric ? oldNumber('assuranceElectriqueStandard') : oldNumber('assuranceThermiqueStandard');
        const legacyIk = oldNumber('ikActuellesAnnuelles') + (isElectric ? oldNumber('bonusIkElectriqueRetenu') : 0);
        const normalizedScenario = Object.assign({}, merged, {
          id: String(scenario.id || ('scenario_' + Date.now() + '_' + index)),
          name: String(scenario.name || ('Scénario ' + (index + 1))),
          energyType: merged.energyType === 'electric' ? 'electric' : 'thermal',
          acquisitionStatus: merged.acquisitionStatus === 'new' ? 'new' : 'used',
          depreciationType: String(merged.depreciationType || base.depreciationType),
          depreciationLevel: String(merged.depreciationLevel || base.depreciationLevel),
          prixAchatNet: scenarioNumber('prixAchatNet', legacyPrice),
          taxeImmatriculation: scenarioNumber('taxeImmatriculation', oldNumber('taxeImmatriculation')),
          fraisAchat: scenarioNumber('fraisAchat', legacyFees),
          aideAchat: scenarioNumber('aideAchat', isElectric && isNew ? oldNumber('aideVeNeuveEligible') : 0),
          remiseComplementaire: scenarioNumber('remiseComplementaire', isElectric && isNew ? oldNumber('surbonusRemiseComplementaire') : 0),
          entretienAnnuel: scenarioNumber('entretienAnnuel', legacyMaintenance),
          pneusAnnuel: scenarioNumber('pneusAnnuel', legacyTyres),
          assuranceAnnuelle: scenarioNumber('assuranceAnnuelle', legacyInsurance),
          ikAnnuelleRetenue: scenarioNumber('ikAnnuelleRetenue', legacyIk),
          consoThermiqueL100: Number.isFinite(thermalConsumption) ? thermalConsumption : 0,
          consoElectriqueKwh100: Number.isFinite(electricConsumption) ? electricConsumption : 0,
          anneeMiseEnCirculation: hasSourceScenarios && Object.prototype.hasOwnProperty.call(scenario, 'anneeMiseEnCirculation')
            ? (Number.isFinite(yearValue) && yearValue > 0 ? Math.trunc(yearValue) : null)
            : (isNew ? new Date().getFullYear() : null),
          kilometrageAchat: Number.isFinite(purchaseMileage) ? Math.max(0, purchaseMileage) : 0,
          kilometrageAnnuelOverride: Object.prototype.hasOwnProperty.call(scenario, 'kilometrageAnnuelOverride')
            ? nullableNumber('kilometrageAnnuelOverride')
            : nullableNumber('kilometrageTotalAnnuelOverride'),
          kilometrageProRembourseIkOverride: nullableNumber('kilometrageProRembourseIkOverride'),
          prixEnergieOverride: nullableNumber('prixEnergieOverride'),
          includeInCharts: scenario.includeInCharts !== false
        });
        delete normalizedScenario.kilometrageTotalAnnuelOverride;
        return normalizedScenario;
      }),
      depreciationProfiles: profiles.length ? profiles : defaults.depreciationProfiles
    };
  }

  function loadState() {
    const current = {
      version: 3,
      settings: read(KEYS.settings, null),
      scenarios: read(KEYS.scenarios, null),
      depreciationProfiles: read(KEYS.profiles, null)
    };
    if (current.settings || current.scenarios || current.depreciationProfiles) return normalizeState(current);
    const v2 = {
      version: 2,
      settings: read(V2_KEYS.settings, null),
      scenarios: read(V2_KEYS.scenarios, null),
      depreciationProfiles: read(V2_KEYS.profiles, null)
    };
    const source = v2.settings || v2.scenarios || v2.depreciationProfiles ? v2 : {
      version: 1,
      settings: read(LEGACY_KEYS.settings, null),
      scenarios: read(LEGACY_KEYS.scenarios, null),
      depreciationProfiles: read(LEGACY_KEYS.profiles, null)
    };
    const migrated = normalizeState(source);
    // Écrit une copie V3 dès la première lecture pour ne pas répéter les migrations.
    saveState(migrated);
    return migrated;
  }

  function saveState(state) {
    const normalized = normalizeState(state);
    try {
      localStorage.setItem(KEYS.settings, JSON.stringify(normalized.settings));
      localStorage.setItem(KEYS.scenarios, JSON.stringify(normalized.scenarios));
      localStorage.setItem(KEYS.profiles, JSON.stringify(normalized.depreciationProfiles));
      return true;
    } catch (error) {
      return false;
    }
  }

  function resetState() {
    try {
      [KEYS, V2_KEYS, LEGACY_KEYS].forEach(function (keySet) {
        Object.keys(keySet).forEach(function (name) { localStorage.removeItem(keySet[name]); });
      });
    } catch (error) {
      // Le mode privé peut interdire localStorage ; l’état en mémoire reste utilisable.
    }
    return TCO.defaults.createDefaultState();
  }

  function exportState(state) {
    const normalized = normalizeState(state);
    return JSON.stringify({
      version: 3,
      exportedAt: new Date().toISOString(),
      settings: normalized.settings,
      scenarios: normalized.scenarios,
      depreciationProfiles: normalized.depreciationProfiles
    }, null, 2);
  }

  function importState(jsonText) {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      throw new Error('Le fichier ne contient pas un JSON valide.');
    }
    if (!parsed || typeof parsed.settings !== 'object' || !Array.isArray(parsed.scenarios) ||
        !Array.isArray(parsed.depreciationProfiles)) {
      throw new Error('Le JSON doit contenir settings, scenarios et depreciationProfiles.');
    }
    if (!parsed.scenarios.length || !parsed.depreciationProfiles.length) {
      throw new Error('Le JSON doit contenir au moins un scénario et un profil de décote.');
    }
    const invalidProfile = parsed.depreciationProfiles.some(function (profile) {
      return !profile || typeof profile.type !== 'string' || !profile.type.trim() ||
        typeof profile.level !== 'string' || !profile.level.trim() ||
        !Array.isArray(profile.rates) || profile.rates.length !== 10 ||
        profile.rates.some(function (rate) {
          const number = Number(rate);
          return !Number.isFinite(number) || number < 0 || number > 1;
        });
    });
    if (invalidProfile) throw new Error('Chaque profil importé doit contenir un type, un niveau et 10 taux entre 0 et 1.');
    const normalized = normalizeState(parsed);
    if (!normalized.depreciationProfiles.length) {
      throw new Error('Aucun profil de décote valide (10 taux requis).');
    }
    return normalized;
  }

  TCO.storage = {
    KEYS: KEYS,
    V2_KEYS: V2_KEYS,
    LEGACY_KEYS: LEGACY_KEYS,
    loadState: loadState,
    saveState: saveState,
    resetState: resetState,
    exportState: exportState,
    importState: importState,
    normalizeState: normalizeState
  };
}(window.TCO = window.TCO || {}));
