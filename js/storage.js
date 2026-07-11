(function (TCO) {
  'use strict';

  const KEYS = {
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
    const scenarios = Array.isArray(source.scenarios) && source.scenarios.length
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
        return copy;
      })
      : defaults.depreciationProfiles;

    return {
      version: 1,
      settings: normalizedSettings,
      scenarios: scenarios.map(function (scenario, index) {
        const base = defaults.scenarios[index] || defaults.scenarios[0];
        const merged = Object.assign({}, base, scenario);
        const thermalConsumption = Number(merged.consoThermiqueL100);
        const electricConsumption = Number(merged.consoElectriqueKwh100);
        return Object.assign({}, merged, {
          id: String(scenario.id || ('scenario_' + Date.now() + '_' + index)),
          name: String(scenario.name || ('Scénario ' + (index + 1))),
          energyType: merged.energyType === 'electric' ? 'electric' : 'thermal',
          acquisitionStatus: merged.acquisitionStatus === 'new' ? 'new' : 'used',
          depreciationType: String(merged.depreciationType || base.depreciationType),
          depreciationLevel: String(merged.depreciationLevel || base.depreciationLevel),
          consoThermiqueL100: Number.isFinite(thermalConsumption) ? thermalConsumption : 0,
          consoElectriqueKwh100: Number.isFinite(electricConsumption) ? electricConsumption : 0,
          includeInCharts: scenario.includeInCharts !== false
        });
      }),
      depreciationProfiles: profiles.length ? profiles : defaults.depreciationProfiles
    };
  }

  function loadState() {
    return normalizeState({
      settings: read(KEYS.settings, null),
      scenarios: read(KEYS.scenarios, null),
      depreciationProfiles: read(KEYS.profiles, null)
    });
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
      Object.keys(KEYS).forEach(function (name) { localStorage.removeItem(KEYS[name]); });
    } catch (error) {
      // Le mode privé peut interdire localStorage ; l’état en mémoire reste utilisable.
    }
    return TCO.defaults.createDefaultState();
  }

  function exportState(state) {
    const normalized = normalizeState(state);
    return JSON.stringify({
      version: 1,
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
    loadState: loadState,
    saveState: saveState,
    resetState: resetState,
    exportState: exportState,
    importState: importState,
    normalizeState: normalizeState
  };
}(window.TCO = window.TCO || {}));
