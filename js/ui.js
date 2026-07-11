(function (TCO) {
  'use strict';

  const SETTINGS_GROUPS = [
    { title: 'Cadre utilisé dans le calcul', fields: [
      ['horizonKpi', 'Horizon KPI', 'années', 'integer', 'used'],
      ['kilometrageTotalAnnuel', 'Kilométrage total annuel', 'km/an', 'number', 'up']
    ]},
    { title: 'Prix d’énergie utilisés dans le calcul', fields: [
      ['prixEssence', 'Prix essence', '€/L', 'number', 'up'],
      ['prixElectricite', 'Prix électricité', '€/kWh', 'number', 'up']
    ]},
    { title: 'Repères indicatifs — sans effet automatique sur le TCO', fields: [
      ['horizonAnalyseRecommande', "Horizon d'analyse recommandé", 'années', 'integer', 'indicative'],
      ['kilometrageProRembourseIk', 'Kilométrage pro remboursé IK', 'km/an', 'number', 'indicative'],
      ['baremeIkActuel', 'Barème IK actuel', '€/km', 'number', 'indicative'],
      ['majorationVehiculeElectrique', 'Majoration véhicule électrique', '%', 'percent', 'indicative'],
      ['coefficientPrudenceIk', 'Coefficient de prudence IK', 'coefficient', 'number', 'indicative']
    ]}
  ];

  const EFFECT_LABELS = {
    up: '↑ TCO',
    down: '↓ TCO',
    used: 'Calcul',
    indicative: 'Indicatif',
    projection: 'Projection',
    display: 'Hors TCO'
  };

  const SCENARIO_NUMERIC_FIELDS = new Set([
    'prixAchatNet', 'taxeImmatriculation', 'fraisAchat', 'aideAchat',
    'remiseComplementaire', 'entretienAnnuel', 'pneusAnnuel',
    'assuranceAnnuelle', 'ikAnnuelleRetenue', 'consoThermiqueL100',
    'consoElectriqueKwh100', 'anneeMiseEnCirculation', 'kilometrageAchat',
    'kilometrageAnnuelOverride'
  ]);
  const SCENARIO_NULLABLE_FIELDS = new Set(['anneeMiseEnCirculation', 'kilometrageAnnuelOverride']);

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function uid(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return prefix + '_' + window.crypto.randomUUID();
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function formatCurrency(value, digits) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: digits === undefined ? 0 : digits
    }).format(Number(value) || 0);
  }

  function formatNumber(value, digits) {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits === undefined ? 2 : digits }).format(Number(value) || 0);
  }

  function initialInputValue(value, type) {
    if (type === 'percent') return TCO.depreciation.formatRate(Number(value) || 0);
    return String(value === undefined || value === null ? 0 : value).replace('.', ',');
  }

  function effectBadge(effect) {
    return effect && EFFECT_LABELS[effect]
      ? '<span class="effect-badge effect-' + effect + '">' + EFFECT_LABELS[effect] + '</span>'
      : '';
  }

  function initUi(options) {
    let state = options.state;
    const onChange = options.onChange;
    const settingsForm = document.getElementById('settings-form');
    const scenariosList = document.getElementById('scenarios-list');
    const editor = document.getElementById('depreciation-editor');
    const defaultProfileKeys = new Set(TCO.defaults.DEFAULT_DEPRECIATION_PROFILES.map(function (profile) { return profile.key; }));

    function setState(nextState) { state = nextState; }

    function showMessage(text, type) {
      const message = document.getElementById('app-message');
      message.textContent = text;
      message.className = 'message ' + (type || '');
      message.hidden = false;
      window.clearTimeout(showMessage.timer);
      showMessage.timer = window.setTimeout(function () { message.hidden = true; }, 5000);
    }

    function renderSettings() {
      settingsForm.innerHTML = SETTINGS_GROUPS.map(function (group, groupIndex) {
        const fields = group.fields.map(function (field) {
          const key = field[0];
          const label = field[1];
          const unit = field[2];
          const type = field[3] || 'number';
          const effect = field[4] || 'used';
          const id = 'setting-' + key;
          return '<div class="field effect-field effect-' + effect + '">' +
            '<label for="' + id + '"><span>' + escapeHtml(label) + '</span>' + effectBadge(effect) + '</label>' +
            '<div class="input-wrap"><input id="' + id + '" type="text" inputmode="decimal" ' +
              'data-setting="' + key + '" data-value-type="' + type + '" value="' +
              escapeHtml(initialInputValue(state.settings[key], type)) + '" aria-describedby="error-' + key + '">' +
              '<span class="unit">' + escapeHtml(unit) + '</span></div>' +
            '<p id="error-' + key + '" class="field-error" aria-live="polite"></p></div>';
        }).join('');
        return '<fieldset class="settings-group"><legend>' + escapeHtml(group.title) +
          '</legend><div class="form-grid" data-group="' + groupIndex + '">' + fields + '</div></fieldset>';
      }).join('');
    }

    function validateSetting(input, parsed, type) {
      const error = document.getElementById('error-' + input.dataset.setting);
      let message = '';
      if (!Number.isFinite(parsed)) message = 'Saisissez un nombre valide.';
      else if (parsed < 0) message = 'La valeur doit être positive ou nulle.';
      else if (type === 'percent' && parsed > 1) message = 'Le pourcentage doit être compris entre 0 et 100 %.';
      else if (input.dataset.setting === 'horizonKpi' && (parsed < 1 || parsed > 10 || !Number.isInteger(parsed))) {
        message = "L'horizon KPI doit être un entier de 1 à 10 ans.";
      } else if (type === 'integer' && !Number.isInteger(parsed)) message = 'Saisissez un nombre entier.';
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      error.textContent = message;
      return !message;
    }

    settingsForm.addEventListener('input', function (event) {
      const input = event.target.closest('[data-setting]');
      if (!input) return;
      const type = input.dataset.valueType;
      const parsed = input.value.trim() === '' ? 0 :
        (type === 'percent' ? TCO.depreciation.normalizeRate(input.value) : TCO.depreciation.parseFrenchNumber(input.value));
      validateSetting(input, parsed, type);
      state.settings[input.dataset.setting] = Number.isFinite(parsed) ? parsed : 0;
      onChange();
    });

    settingsForm.addEventListener('blur', function (event) {
      const input = event.target.closest('[data-setting]');
      if (!input || input.getAttribute('aria-invalid') === 'true') return;
      if (input.dataset.valueType === 'percent') input.value = TCO.depreciation.formatRate(state.settings[input.dataset.setting]);
    }, true);

    function getProfileTypes() {
      return Array.from(new Set(state.depreciationProfiles.map(function (profile) { return profile.type; })));
    }

    function levelsFor(type) {
      return state.depreciationProfiles.filter(function (profile) { return profile.type === type; })
        .map(function (profile) { return profile.level; });
    }

    function optionList(values, selected) {
      const list = values.slice();
      if (selected && list.indexOf(selected) < 0) list.unshift(selected);
      return list.map(function (value) {
        return '<option value="' + escapeHtml(value) + '"' + (value === selected ? ' selected' : '') + '>' + escapeHtml(value) + '</option>';
      }).join('');
    }

    function scenarioField(id, field, label, content, effect) {
      const classification = effect || 'used';
      return '<div class="field effect-field effect-' + classification + '"><label for="' + id + '"><span>' +
        label + '</span>' + effectBadge(classification) + '</label>' + content + '</div>';
    }

    function scenarioNumberField(scenario, field, label, unit, effect, help) {
      const safeId = escapeHtml(scenario.id);
      const inputId = field + '-' + safeId;
      const errorId = 'scenario-error-' + safeId + '-' + field;
      const value = scenario[field] === null || scenario[field] === undefined ? '' : String(scenario[field]).replace('.', ',');
      return scenarioField(inputId, field, label,
        '<div class="input-wrap"><input id="' + inputId + '" type="text" inputmode="decimal" ' +
        'aria-describedby="' + errorId + '" data-scenario-id="' + safeId + '" data-scenario-field="' + field +
        '" data-scenario-number="true" value="' + escapeHtml(value) + '"><span class="unit">' +
        escapeHtml(unit) + '</span></div><p id="' + errorId + '" class="field-error' + (help ? ' field-help' : '') + '" aria-live="polite">' +
        escapeHtml(help || '') + '</p>', effect);
    }

    function renderScenarios() {
      const types = getProfileTypes();
      scenariosList.innerHTML = state.scenarios.map(function (scenario) {
        const id = escapeHtml(scenario.id);
        const isElectric = scenario.energyType === 'electric';
        const levels = levelsFor(scenario.depreciationType);
        const consumptionField = isElectric ? 'consoElectriqueKwh100' : 'consoThermiqueL100';
        const consumptionLabel = isElectric ? 'Consommation électrique' : 'Consommation thermique';
        const consumptionUnit = isElectric ? 'kWh/100 km' : 'L/100 km';
        return '<article class="scenario-card ' + (isElectric ? 'electric' : 'thermal') + '" data-scenario-card="' + id + '">' +
          '<div class="scenario-card-header"><strong>' + escapeHtml(scenario.name || 'Sans nom') + '</strong>' +
          '<div class="scenario-actions"><button class="button icon" type="button" data-scenario-action="duplicate" data-scenario-id="' + id + '">Dupliquer</button>' +
          '<button class="button icon danger-ghost" type="button" data-scenario-action="delete" data-scenario-id="' + id + '"' + (state.scenarios.length === 1 ? ' disabled' : '') + '>Supprimer</button></div></div>' +
          '<div class="scenario-fields">' +
          scenarioField('name-' + id, 'name', 'Nom du scénario', '<input id="name-' + id + '" type="text" data-scenario-id="' + id + '" data-scenario-field="name" value="' + escapeHtml(scenario.name) + '">', 'display') +
          scenarioField('energy-' + id, 'energyType', "Type d'énergie", '<select id="energy-' + id + '" data-scenario-id="' + id + '" data-scenario-field="energyType"><option value="thermal"' + (scenario.energyType === 'thermal' ? ' selected' : '') + '>Thermique</option><option value="electric"' + (isElectric ? ' selected' : '') + '>Électrique</option></select>', 'used') +
          scenarioField('status-' + id, 'acquisitionStatus', 'Statut', '<select id="status-' + id + '" data-scenario-id="' + id + '" data-scenario-field="acquisitionStatus"><option value="used"' + (scenario.acquisitionStatus === 'used' ? ' selected' : '') + '>Occasion</option><option value="new"' + (scenario.acquisitionStatus === 'new' ? ' selected' : '') + '>Neuf</option></select>', 'display') +
          scenarioNumberField(scenario, 'anneeMiseEnCirculation', 'Année de mise en circulation', 'année', 'used',
            scenario.acquisitionStatus === 'used' && scenario.anneeMiseEnCirculation === null
              ? 'Année manquante : repli sur les années de possession.' : '') +
          scenarioNumberField(scenario, 'kilometrageAchat', 'Kilométrage à l’achat', 'km', 'projection', 'Déjà intégré au prix : aucune pénalité initiale.') +
          scenarioNumberField(scenario, 'kilometrageAnnuelOverride', 'Kilométrage annuel du scénario', 'km/an', 'used', 'Vide : utilise l’hypothèse commune.') +
          scenarioNumberField(scenario, 'prixAchatNet', "Prix d'achat net", '€', 'up') +
          scenarioNumberField(scenario, 'taxeImmatriculation', "Taxe d'immatriculation", '€', 'up') +
          scenarioNumberField(scenario, 'fraisAchat', "Frais d'achat", '€', 'up') +
          scenarioNumberField(scenario, 'aideAchat', "Aide à l'achat", '€', 'down') +
          scenarioNumberField(scenario, 'remiseComplementaire', 'Remise complémentaire', '€', 'down') +
          scenarioNumberField(scenario, 'entretienAnnuel', 'Entretien annuel', '€/an', 'up') +
          scenarioNumberField(scenario, 'pneusAnnuel', 'Pneus annuels', '€/an', 'up') +
          scenarioNumberField(scenario, 'assuranceAnnuelle', 'Assurance annuelle', '€/an', 'up') +
          scenarioNumberField(scenario, 'ikAnnuelleRetenue', 'IK annuelle retenue', '€/an', 'down') +
          scenarioNumberField(scenario, consumptionField, consumptionLabel, consumptionUnit, 'up') +
          scenarioField('type-' + id, 'depreciationType', 'Profil de décote', '<select id="type-' + id + '" data-scenario-id="' + id + '" data-scenario-field="depreciationType">' + optionList(types, scenario.depreciationType) + '</select>', 'used') +
          scenarioField('level-' + id, 'depreciationLevel', 'Niveau de décote', '<select id="level-' + id + '" data-scenario-id="' + id + '" data-scenario-field="depreciationLevel">' + optionList(levels, scenario.depreciationLevel) + '</select>', 'used') +
          '<label class="check-field"><input type="checkbox" data-scenario-id="' + id + '" data-scenario-field="includeInCharts"' + (scenario.includeInCharts !== false ? ' checked' : '') + '> Inclure dans les graphiques ' + effectBadge('display') + '</label>' +
          '</div></article>';
      }).join('');
    }

    scenariosList.addEventListener('input', handleScenarioField);
    scenariosList.addEventListener('change', handleScenarioField);
    function handleScenarioField(event) {
      const input = event.target.closest('[data-scenario-field]');
      if (!input) return;
      const scenario = state.scenarios.find(function (item) { return item.id === input.dataset.scenarioId; });
      if (!scenario) return;
      const field = input.dataset.scenarioField;
      if (field === 'includeInCharts') scenario[field] = input.checked;
      else if (SCENARIO_NUMERIC_FIELDS.has(field)) {
        const isEmpty = input.value.trim() === '';
        const parsed = isEmpty && SCENARIO_NULLABLE_FIELDS.has(field)
          ? null : (isEmpty ? 0 : TCO.depreciation.parseFrenchNumber(input.value));
        const valid = parsed === null || (Number.isFinite(parsed) && parsed >= 0 &&
          (field !== 'anneeMiseEnCirculation' || Number.isInteger(parsed)));
        input.setAttribute('aria-invalid', valid ? 'false' : 'true');
        const error = document.getElementById('scenario-error-' + input.dataset.scenarioId + '-' + field);
        if (error) {
          error.classList.toggle('field-help', valid);
          if (!valid) error.textContent = field === 'anneeMiseEnCirculation' ? 'Saisissez une année entière.' : 'Saisissez un nombre positif ou nul.';
          else if (field === 'anneeMiseEnCirculation' && parsed === null && scenario.acquisitionStatus === 'used') error.textContent = 'Année manquante : repli sur les années de possession.';
          else if (field === 'kilometrageAchat') error.textContent = 'Déjà intégré au prix : aucune pénalité initiale.';
          else if (field === 'kilometrageAnnuelOverride' && parsed === null) error.textContent = 'Vide : utilise l’hypothèse commune.';
          else error.textContent = '';
        }
        scenario[field] = valid ? parsed : (SCENARIO_NULLABLE_FIELDS.has(field) ? null : 0);
      } else scenario[field] = input.value;

      if (field === 'depreciationType') {
        const levels = levelsFor(scenario.depreciationType);
        if (levels.indexOf(scenario.depreciationLevel) < 0) scenario.depreciationLevel = levels[0] || '';
      }
      if (field === 'acquisitionStatus' && scenario.acquisitionStatus === 'new') {
        if (scenario.anneeMiseEnCirculation === null) scenario.anneeMiseEnCirculation = new Date().getFullYear();
        scenario.kilometrageAchat = Number(scenario.kilometrageAchat) || 0;
      }
      if (event.type === 'change' && ['energyType', 'acquisitionStatus', 'depreciationType'].indexOf(field) >= 0) renderScenarios();
      onChange();
    }

    scenariosList.addEventListener('click', function (event) {
      const button = event.target.closest('[data-scenario-action]');
      if (!button) return;
      const index = state.scenarios.findIndex(function (item) { return item.id === button.dataset.scenarioId; });
      if (index < 0) return;
      if (button.dataset.scenarioAction === 'duplicate') {
        const copy = TCO.defaults.clone(state.scenarios[index]);
        copy.id = uid('scenario');
        copy.name += ' — copie';
        state.scenarios.splice(index + 1, 0, copy);
      } else if (button.dataset.scenarioAction === 'delete' && state.scenarios.length > 1) {
        state.scenarios.splice(index, 1);
      }
      renderScenarios();
      onChange();
    });

    document.getElementById('add-scenario-button').addEventListener('click', function () {
      const firstProfile = state.depreciationProfiles[0] || { type: '', level: '' };
      const scenario = TCO.defaults.clone(TCO.defaults.DEFAULT_SCENARIOS[1]);
      Object.assign(scenario, {
        id: uid('scenario'), name: 'Nouveau scénario',
        depreciationType: firstProfile.type, depreciationLevel: firstProfile.level
      });
      state.scenarios.push(scenario);
      renderScenarios();
      onChange();
    });

    function renderProfiles() {
      const headerYears = new Array(10).fill(0).map(function (_, index) { return '<th scope="col">Âge ' + (index + 1) + '</th>'; }).join('');
      const rows = state.depreciationProfiles.map(function (profile) {
        const isDefault = defaultProfileKeys.has(profile.key);
        const rates = profile.rates.map(function (rate, index) {
          return '<td><input type="text" inputmode="decimal" aria-label="' + escapeHtml(profile.key) + ', année ' + (index + 1) + '" data-profile-key="' + escapeHtml(profile.key) + '" data-rate-index="' + index + '" value="' + escapeHtml(TCO.depreciation.formatRate(rate)) + '"><span class="rate-error" aria-live="polite"></span></td>';
        }).join('');
        return '<tr><td><strong>' + escapeHtml(profile.key) + '</strong><span class="profile-meta">' + (isDefault ? 'Profil par défaut modifiable' : 'Profil utilisateur') + '</span></td>' +
          '<td>' + escapeHtml(profile.type) + '</td><td>' + escapeHtml(profile.level) + '</td>' + rates +
          '<td><div class="profile-actions"><button type="button" class="button icon" data-profile-action="duplicate" data-profile-key="' + escapeHtml(profile.key) + '">Dupliquer</button>' +
          '<button type="button" class="button icon danger-ghost" data-profile-action="delete" data-profile-key="' + escapeHtml(profile.key) + '"' + (isDefault ? ' disabled title="Dupliquez ce profil pour créer une version supprimable."' : '') + '>Supprimer</button></div></td></tr>';
      }).join('');
      editor.innerHTML = '<div class="table-wrap"><table><thead><tr><th scope="col">Clé</th><th scope="col">Type de décote</th><th scope="col">Niveau</th>' + headerYears + '<th scope="col">Actions</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    editor.addEventListener('input', function (event) {
      const input = event.target.closest('[data-rate-index]');
      if (!input) return;
      const profile = state.depreciationProfiles.find(function (item) { return item.key === input.dataset.profileKey; });
      if (!profile) return;
      const value = input.value.trim() === '' ? 0 : TCO.depreciation.normalizeRate(input.value);
      const valid = Number.isFinite(value) && value >= 0 && value <= 1;
      input.setAttribute('aria-invalid', valid ? 'false' : 'true');
      const error = input.nextElementSibling;
      if (error) error.textContent = valid ? '' : '0 à 100 %';
      if (valid) profile.rates[Number(input.dataset.rateIndex)] = value;
      onChange();
    });
    editor.addEventListener('blur', function (event) {
      const input = event.target.closest('[data-rate-index]');
      if (!input || input.getAttribute('aria-invalid') === 'true') return;
      const profile = state.depreciationProfiles.find(function (item) { return item.key === input.dataset.profileKey; });
      input.value = TCO.depreciation.formatRate(profile.rates[Number(input.dataset.rateIndex)]);
    }, true);

    function uniqueProfile(type, level, ignoredKey) {
      return !state.depreciationProfiles.some(function (profile) {
        return profile.key !== ignoredKey && profile.type === type && profile.level === level;
      });
    }

    function askProfile(seed) {
      const type = window.prompt('Nom du type de décote :', seed ? seed.type : 'Mon profil');
      if (type === null || !type.trim()) return null;
      const level = window.prompt('Nom du niveau :', seed ? seed.level + ' copie' : 'Central');
      if (level === null || !level.trim()) return null;
      const cleanType = type.trim();
      const cleanLevel = level.trim();
      if (!uniqueProfile(cleanType, cleanLevel)) {
        showMessage('Un profil avec ce type et ce niveau existe déjà.', 'error');
        return null;
      }
      return {
        key: cleanType + '|' + cleanLevel, type: cleanType, level: cleanLevel,
        rates: seed ? seed.rates.slice() : new Array(10).fill(0)
      };
    }

    document.getElementById('add-profile-button').addEventListener('click', function () {
      const profile = askProfile(null);
      if (!profile) return;
      state.depreciationProfiles.push(profile);
      renderProfiles();
      renderScenarios();
      onChange();
    });

    editor.addEventListener('click', function (event) {
      const button = event.target.closest('[data-profile-action]');
      if (!button) return;
      const index = state.depreciationProfiles.findIndex(function (profile) { return profile.key === button.dataset.profileKey; });
      if (index < 0) return;
      if (button.dataset.profileAction === 'duplicate') {
        const copy = askProfile(state.depreciationProfiles[index]);
        if (!copy) return;
        state.depreciationProfiles.splice(index + 1, 0, copy);
      } else if (button.dataset.profileAction === 'delete' && !defaultProfileKeys.has(button.dataset.profileKey)) {
        const removed = state.depreciationProfiles[index];
        state.depreciationProfiles.splice(index, 1);
        const replacement = state.depreciationProfiles[0];
        state.scenarios.forEach(function (scenario) {
          if (scenario.depreciationType === removed.type && scenario.depreciationLevel === removed.level && replacement) {
            scenario.depreciationType = replacement.type;
            scenario.depreciationLevel = replacement.level;
          }
        });
      }
      renderProfiles();
      renderScenarios();
      onChange();
    });

    document.getElementById('restore-profiles-button').addEventListener('click', function () {
      if (!window.confirm('Restaurer les 12 profils et leurs taux par défaut ? Les profils utilisateur seront supprimés.')) return;
      state.depreciationProfiles = TCO.defaults.clone(TCO.defaults.DEFAULT_DEPRECIATION_PROFILES);
      state.scenarios.forEach(function (scenario) {
        if (!TCO.depreciation.getProfile(state.depreciationProfiles, scenario.depreciationType, scenario.depreciationLevel)) {
          const fallback = state.depreciationProfiles[0];
          scenario.depreciationType = fallback.type;
          scenario.depreciationLevel = fallback.level;
        }
      });
      renderProfiles();
      renderScenarios();
      showMessage('Profils de décote restaurés.', 'success');
      onChange();
    });

    function renderIndicators() {
      const ik = TCO.calculations.calculateIkIndicators(state.settings);
      document.getElementById('ik-indicators').innerHTML =
        '<p class="indicator-intro"><span class="effect-badge effect-indicative">Indicatif uniquement</span> Ces deux montants aident à renseigner les scénarios, mais ne modifient jamais le TCO automatiquement.</p>' +
        '<div class="indicator"><span>IK indicative annuelle</span><strong>' + formatCurrency(ik.ikIndicativeAnnuelle, 2) + '</strong></div>' +
        '<div class="indicator"><span>Bonus électrique indicatif</span><strong>' + formatCurrency(ik.bonusIkElectriqueIndicatif, 2) + '</strong></div>';
    }

    function renderSummary(results) {
      const included = results.filter(function (result) { return result.includeInCharts; });
      const best = included.length ? included.reduce(function (lowest, current) {
        return current.tcoNetApresIk < lowest.tcoNetApresIk ? current : lowest;
      }) : null;
      const cards = [];
      cards.push('<article class="summary-card best"><p class="summary-label">Scénario le moins coûteux</p><p class="summary-value">' +
        escapeHtml(best ? best.name : 'Aucun scénario inclus') + '</p><p class="summary-detail">' +
        (best ? formatCurrency(best.tcoNetApresIk) + ' net après IK' : 'Activez un scénario pour comparer') + '</p></article>');
      results.forEach(function (result) {
        const deltaClass = result.ecartVsReference < 0 ? 'negative' : (result.ecartVsReference > 0 ? 'positive' : '');
        cards.push('<article class="summary-card"><p class="summary-label">' + escapeHtml(result.name) + (result.includeInCharts ? '' : ' · exclu') +
          '</p><p class="summary-value">' + formatCurrency(result.tcoNetApresIk) + '</p><p class="summary-detail ' + deltaClass + '">' +
          (result.ecartVsReference === 0 ? 'Scénario de référence' : ((result.ecartVsReference > 0 ? '+' : '') + formatCurrency(result.ecartVsReference) + ' vs référence')) +
          ' · ' + formatCurrency(result.coutAnnuelMoyen) + '/an · ' +
          (result.coutParKm === null ? '— €/km' : formatCurrency(result.coutParKm, 2) + '/km') + '</p></article>');
      });
      document.getElementById('summary-cards').innerHTML = cards.join('');
      document.getElementById('horizon-note').textContent = 'Horizon KPI : ' + TCO.calculations.getHorizon(state.settings) + ' an(s) · repère recommandé : ' + Math.max(0, Math.trunc(Number(state.settings.horizonAnalyseRecommande) || 0)) + ' an(s)';
    }

    function renderResultsTable(results) {
      const rows = results.map(function (result) {
        const warnings = (result.warnings || []).concat(result.profileFound ? [] : ['Profil de décote absent.']);
        return '<tr><td>' + escapeHtml(result.name) + (warnings.length ? '<span class="result-warning">⚠ ' + escapeHtml(warnings.join(' ')) + '</span>' : '') + '</td>' +
          '<td>' + formatCurrency(result.tcoNetApresIk) + '</td><td>' + formatCurrency(result.tcoBrut) + '</td>' +
          '<td>' + formatCurrency(result.coutAcquisitionNet) + '</td>' +
          '<td>' + (result.ageAchat === null ? '—' : formatNumber(result.ageAchat, 0) + ' ans') + '</td>' +
          '<td>' + (result.ageHorizon === null ? '—' : formatNumber(result.ageHorizon, 0) + ' ans') + '</td>' +
          '<td>' + (result.ageAchat === null ? 'Possession ' : 'Âge ') + formatNumber(result.anneeProfilHorizon, 0) +
            (result.tauxProfilRepeteHorizon ? ' (taux âge 10 répété)' : '') + ' · ' + TCO.depreciation.formatRate(result.tauxDecoteBaseHorizon) + '</td>' +
          '<td>' + formatNumber(result.kilometrageAchat, 0) + ' km</td>' +
          '<td>' + formatNumber(result.kilometrageHorizon, 0) + ' km</td>' +
          '<td>' + formatCurrency(result.valeurResiduelle) + '</td>' +
          '<td>' + formatCurrency(result.coutDecote) + '</td><td>' + formatCurrency(result.coutEnergieCumule) + '</td>' +
          '<td>' + formatCurrency(result.entretienCumule) + '</td><td>' + formatCurrency(result.pneusCumule) + '</td>' +
          '<td>' + formatCurrency(result.assuranceCumule) + '</td><td>' + formatCurrency(result.fraisAchat + result.taxes) + '</td>' +
          '<td>− ' + formatCurrency(result.ikRetenueCumulee) + '</td><td>' + formatCurrency(result.coutAnnuelMoyen) + '</td>' +
          '<td>' + (result.coutParKm === null ? '—' : formatNumber(result.coutParKm, 3) + ' €/km') + '</td></tr>';
      }).join('');
      document.getElementById('results-table').innerHTML = '<table><thead><tr><th scope="col">Scénario</th><th scope="col">TCO net</th><th scope="col">TCO brut</th><th scope="col">Acquisition nette</th><th scope="col">Âge achat</th><th scope="col">Âge horizon</th><th scope="col">Taux de profil à l’horizon</th><th scope="col">Km achat</th><th scope="col">Km horizon</th><th scope="col">Valeur résiduelle</th><th scope="col">Décote</th><th scope="col">Énergie</th><th scope="col">Entretien</th><th scope="col">Pneus</th><th scope="col">Assurance</th><th scope="col">Frais + taxes</th><th scope="col">IK retenues</th><th scope="col">Moyenne/an</th><th scope="col">Coût/km</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function renderDynamic(results) {
      renderIndicators();
      renderSummary(results);
      renderResultsTable(results);
      TCO.charts.renderTcoBarChart(document.getElementById('tco-bar-chart'), results);
      TCO.charts.renderCumulativeTcoChart(document.getElementById('cumulative-chart'), results);
      TCO.charts.renderResidualValueChart(document.getElementById('residual-value-chart'), results);
      TCO.charts.renderCostBreakdownChart(document.getElementById('breakdown-chart'), results);
    }

    function renderAll(results) {
      renderSettings();
      renderScenarios();
      renderProfiles();
      renderDynamic(results);
    }

    return {
      setState: setState,
      renderAll: renderAll,
      renderDynamic: renderDynamic,
      renderScenarios: renderScenarios,
      renderProfiles: renderProfiles,
      showMessage: showMessage
    };
  }

  TCO.ui = {
    initUi: initUi,
    formatCurrency: formatCurrency,
    formatNumber: formatNumber
  };
}(window.TCO = window.TCO || {}));
