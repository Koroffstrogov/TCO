(function (TCO) {
  'use strict';

  const SETTINGS_GROUPS = [
    { title: 'Cadre utilisé dans le calcul', fields: [
      ['horizonKpi', 'Horizon KPI', 'années', 'integer', 'used'],
      ['kilometrageTotalAnnuel', 'Kilométrage total annuel', 'km/an', 'number', 'up', {
        key: 'forcerKilometrageTotalAnnuel',
        label: 'Forcer ce kilométrage dans tous les scénarios',
        help: 'Les kilométrages annuels propres aux scénarios sont alors désactivés.'
      }]
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
    ], indicators: true, toggles: [{
      key: 'forcerIkIndicatives',
      label: 'Appliquer les IK indicatives aux scénarios',
      help: 'Thermique : IK indicative. Électrique : IK indicative + bonus électrique.'
    }]}
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
    'remiseComplementaire', 'montantReprise', 'entretienAnnuel', 'pneusAnnuel',
    'assuranceAnnuelle', 'ikAnnuelleRetenue', 'consoThermiqueL100',
    'consoElectriqueKwh100', 'anneeMiseEnCirculation', 'kilometrageAchat',
    'kilometrageAnnuelOverride'
  ]);
  const SCENARIO_NULLABLE_FIELDS = new Set(['anneeMiseEnCirculation', 'kilometrageAnnuelOverride']);
  const ANNUAL_DETAIL_COST_ROWS = [
    ['achatVehicule', 'Prix du véhicule'],
    ['fraisAchat', "Frais d’achat"],
    ['taxes', "Taxe d’immatriculation"],
    ['energie', 'Énergie'],
    ['entretien', 'Entretien'],
    ['pneus', 'Pneus'],
    ['assurance', 'Assurance']
  ];
  const ANNUAL_DETAIL_DEDUCTION_ROWS = [
    ['aidesRemises', 'Aides et remises appliquées'],
    ['reprise', 'Reprise du véhicule'],
    ['ik', 'IK encaissées'],
    ['valeurResiduelle', 'Revente simulée']
  ];

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

  function isZeroAmount(value) {
    return Math.abs(Number(value) || 0) < 1e-9;
  }

  function annualAmount(value, tone) {
    const amount = Number(value) || 0;
    if (isZeroAmount(amount)) return '<span class="neutral annual-zero">—</span>';
    return '<span class="' + (tone || 'neutral') + '">' + formatCurrency(Math.abs(amount)) + '</span>';
  }

  function annualSignedAmount(value) {
    const amount = Number(value) || 0;
    if (isZeroAmount(amount)) return '<span class="neutral annual-zero">—</span>';
    const isSurplus = amount < 0;
    return '<span class="' + (isSurplus ? 'surplus' : 'cost') + '"><span class="visually-hidden">' +
      (isSurplus ? 'Excédent ' : 'Dépense ') + '</span>' + (isSurplus ? '− ' : '') +
      formatCurrency(Math.abs(amount)) + '</span>';
  }

  function getAnnualResultPresentation(value) {
    const amount = Number(value) || 0;
    const isSurplus = amount < 0;
    return {
      label: isSurplus ? 'Excédent théorique après IK' : 'Coût net après IK',
      amount: Math.abs(amount),
      className: isSurplus ? 'surplus' : 'cost'
    };
  }

  function renderAnnualMetric(label, value, tone, detail) {
    return '<div class="annual-horizon-metric ' + tone + '"><dt>' + escapeHtml(label) + '</dt><dd>' +
      formatCurrency(Math.abs(Number(value) || 0)) + '</dd><dd class="annual-metric-detail">' + escapeHtml(detail) + '</dd></div>';
  }

  function renderAnnualHorizonSummary(result, sectionId) {
    const horizon = result.decompositionAnnuelle.annees.length - 1;
    const netBeforeIk = result.tcoBrut - result.montantReprise;
    const finalResult = getAnnualResultPresentation(result.tcoNetApresIk);
    const netBeforeTone = netBeforeIk < 0 ? 'surplus' : 'cost';
    const netBeforeDetail = netBeforeIk < 0 ? 'Excédent théorique avant IK' : 'Après déduction de la reprise';
    return '<section class="annual-reading annual-horizon-summary" aria-labelledby="' + sectionId + '-summary-title">' +
      '<div class="annual-reading-heading"><h3 id="' + sectionId + '-summary-title">Synthèse à ' + horizon + ' an' +
      (horizon > 1 ? 's' : '') + '</h3><p>Lecture économique à l’horizon sélectionné</p></div>' +
      '<dl class="annual-horizon-grid">' +
      renderAnnualMetric('TCO brut du véhicule', result.tcoBrut, 'cost', 'Avant reprise et IK') +
      renderAnnualMetric('Reprise déduite', result.montantReprise, 'saving', 'Déduite une seule fois') +
      renderAnnualMetric('Coût net avant IK', netBeforeIk, netBeforeTone, netBeforeDetail) +
      renderAnnualMetric('IK cumulées', result.ikRetenueCumulee, 'saving', 'Encaissées sur ' + horizon + ' an' + (horizon > 1 ? 's' : '')) +
      renderAnnualMetric(finalResult.label, finalResult.amount, finalResult.className, 'Résultat économique final') +
      '</dl></section>';
  }

  function renderCompositionItem(label, value, tone, nature) {
    return '<div class="composition-item ' + tone + '"><dt>' + escapeHtml(label) + '<span>' + escapeHtml(nature) +
      '</span></dt><dd>' + formatCurrency(Math.abs(Number(value) || 0)) + '</dd></div>';
  }

  function renderTcoComposition(result, sectionId) {
    const finalResult = getAnnualResultPresentation(result.tcoNetApresIk);
    const compositionItems = [
      renderCompositionItem('Décote', result.coutDecote, 'cost', 'Coût économique'),
      renderCompositionItem('Énergie', result.coutEnergieCumule, 'cost', 'Coût économique'),
      renderCompositionItem('Entretien', result.entretienCumule, 'cost', 'Coût économique'),
      renderCompositionItem('Pneus', result.pneusCumule, 'cost', 'Coût économique'),
      renderCompositionItem('Assurance', result.assuranceCumule, 'cost', 'Coût économique'),
      renderCompositionItem('Frais d’achat et immatriculation', result.fraisAchat + result.taxes, 'cost', 'Coût économique'),
      renderCompositionItem('Reprise', result.montantReprise, 'saving', 'Déduction'),
      renderCompositionItem('IK', result.ikRetenueCumulee, 'saving', 'Déduction'),
      renderCompositionItem(finalResult.label, finalResult.amount, finalResult.className, 'Résultat')
    ].join('');
    return '<section class="annual-reading annual-composition" aria-labelledby="' + sectionId + '-composition-title">' +
      '<div class="annual-reading-heading"><h3 id="' + sectionId + '-composition-title">Composition du TCO</h3>' +
      '<p>Coûts économiques et déductions sur l’horizon</p></div><dl class="composition-list">' + compositionItems + '</dl>' +
      '<p class="composition-formula neutral" aria-label="' + escapeHtml('TCO brut moins reprise moins IK égale ' + finalResult.label + ' ' +
      formatCurrency(finalResult.amount)) + '"><span>' + formatCurrency(result.tcoBrut) + ' de TCO brut</span>' +
      '<span aria-hidden="true"> − </span><span>' + formatCurrency(result.montantReprise) + ' de reprise</span>' +
      '<span aria-hidden="true"> − </span><span>' + formatCurrency(result.ikRetenueCumulee) + ' d’IK</span>' +
      '<span aria-hidden="true"> = </span><strong class="' + finalResult.className + '">' + escapeHtml(finalResult.label) +
      ' : ' + formatCurrency(finalResult.amount) + '</strong></p>' +
      '<p class="annual-reading-note">La valeur résiduelle est déjà intégrée dans la décote. Elle n’est pas déduite une seconde fois dans cette composition.</p></section>';
  }

  function renderCashFlowRow(label, help, values, total, tone, signed) {
    const cells = values.map(function (value) {
      return '<td>' + (signed ? annualSignedAmount(value) : annualAmount(value, tone)) + '</td>';
    }).join('');
    return '<tr class="cashflow-row ' + tone + '"><th scope="row">' + escapeHtml(label) +
      (help ? '<span class="profile-meta">' + escapeHtml(help) + '</span>' : '') + '</th>' + cells +
      '<td class="annual-horizon-total">' + (signed ? annualSignedAmount(total) : annualAmount(total, tone)) + '</td></tr>';
  }

  function renderAnnualCashFlow(result, sectionId) {
    const breakdown = result.decompositionAnnuelle;
    const years = breakdown.annees;
    const horizon = years.length - 1;
    const headerYears = years.map(function (point) {
      return '<th scope="col">Année ' + point.annee + '</th>';
    }).join('');
    const acquisition = years.map(function (point) { return point.annee === 0 ? point.soldeNet : 0; });
    const usage = years.map(function (point) {
      return point.couts.energie + point.couts.entretien + point.couts.pneus + point.couts.assurance;
    });
    const ik = years.map(function (point) { return point.gains.ik; });
    const resale = years.map(function (point) { return point.gains.valeurResiduelle; });
    const annualNet = years.map(function (point) { return point.soldeNet; });
    const cumulative = years.map(function (point) { return point.cumulTresorerie; });
    const usageTotal = usage.reduce(function (total, value) { return total + value; }, 0);
    const totalColumns = years.length + 2;
    return '<section class="annual-reading annual-cashflow" aria-labelledby="' + sectionId + '-cashflow-title">' +
      '<div class="annual-reading-heading"><h3 id="' + sectionId + '-cashflow-title">Trésorerie annuelle</h3>' +
      '<p>Décaissements, encaissements et dépense cumulée</p></div>' +
      '<div class="table-wrap annual-table-wrap"><table class="annual-table cashflow-table"><caption class="visually-hidden">Trésorerie annuelle du scénario ' +
      escapeHtml(result.name) + '</caption><thead><tr><th scope="col">Flux</th>' + headerYears +
      '<th scope="col">Cumul sur ' + horizon + ' an' + (horizon > 1 ? 's' : '') + '</th></tr></thead><tbody>' +
      '<tr class="annual-group-row"><th scope="rowgroup" colspan="' + totalColumns + '">Décaissements</th></tr>' +
      renderCashFlowRow('Acquisition nette', 'Prix après aides/remises, frais, taxe et reprise', acquisition, result.coutAcquisitionNet, 'neutral', true) +
      renderCashFlowRow('Coûts d’utilisation', 'Énergie, entretien, pneus et assurance', usage, usageTotal, 'cost', false) +
      '<tr class="annual-group-row"><th scope="rowgroup" colspan="' + totalColumns + '">Déductions et recettes</th></tr>' +
      renderCashFlowRow('IK encaissées', 'Recette annuelle retenue dans le scénario', ik, result.ikRetenueCumulee, 'saving', false) +
      renderCashFlowRow('Revente simulée', 'Recette théorique uniquement à l’horizon final', resale, result.valeurResiduelle, 'saving', false) +
      '<tr class="annual-group-row"><th scope="rowgroup" colspan="' + totalColumns + '">Solde de trésorerie</th></tr>' +
      renderCashFlowRow('Flux net de l’année', 'Décaissements moins encaissements', annualNet, result.tcoNetApresIk, 'neutral', true) +
      renderCashFlowRow('Dépense nette cumulée', 'Après revente simulée dans la dernière colonne', cumulative, result.tcoNetApresIk, 'neutral cashflow-total', true) +
      '</tbody></table></div><p class="annual-reading-note">Acquisition nette + coûts d’utilisation − IK encaissées − revente simulée = résultat économique final.</p></section>';
  }

  function renderVehicleValue(result, sectionId) {
    const years = result.decompositionAnnuelle.annees;
    const horizon = years.length - 1;
    const headers = years.map(function (point) {
      if (point.annee === 0) return '<th scope="col">À l’achat</th>';
      return '<th scope="col">Année ' + point.annee + (point.annee === horizon ? ' · horizon' : '') + '</th>';
    }).join('');
    const values = years.map(function (point) {
      return '<td>' + annualAmount(point.valeurVehiculeDeduite, 'neutral') + '</td>';
    }).join('');
    return '<section class="annual-reading annual-vehicle-value" aria-labelledby="' + sectionId + '-value-title">' +
      '<div class="annual-reading-heading"><h3 id="' + sectionId + '-value-title">Valeur estimée du véhicule</h3>' +
      '<p>Valeur de l’actif, non encaissée avant une revente</p></div>' +
      '<div class="table-wrap annual-table-wrap"><table class="annual-table asset-value-table"><caption class="visually-hidden">Valeur estimée du véhicule ' +
      escapeHtml(result.name) + '</caption><thead><tr><th scope="col">Repère</th>' + headers + '</tr></thead><tbody><tr>' +
      '<th scope="row">Valeur estimée</th>' + values + '</tr></tbody></table></div>' +
      '<p class="annual-reading-note">La valeur à l’achat correspond à l’assiette du véhicule après aides et remises. Ces montants sont affichés positivement car ils représentent un actif estimé.</p></section>';
  }

  function renderFullAnnualDetail(result, sectionId, isOpen) {
    const breakdown = result.decompositionAnnuelle;
    const years = breakdown.annees;
    const horizon = years.length - 1;
    const totalColumns = years.length + 2;
    const headerYears = years.map(function (point) { return '<th scope="col">Année ' + point.annee + '</th>'; }).join('');
    const costLines = ANNUAL_DETAIL_COST_ROWS.map(function (row) {
      const cells = years.map(function (point) { return '<td>' + annualAmount(point.couts[row[0]], 'cost') + '</td>'; }).join('');
      return '<tr class="annual-cost-row cost"><th scope="row">' + row[1] + '</th>' + cells +
        '<td class="annual-horizon-total">' + annualAmount(breakdown.totaux.couts[row[0]], 'cost') + '</td></tr>';
    }).join('');
    const deductionLines = ANNUAL_DETAIL_DEDUCTION_ROWS.map(function (row) {
      const cells = years.map(function (point) { return '<td>' + annualAmount(point.gains[row[0]], 'saving') + '</td>'; }).join('');
      return '<tr class="annual-deduction-row saving"><th scope="row">' + row[1] + '</th>' + cells +
        '<td class="annual-horizon-total">' + annualAmount(breakdown.totaux.gains[row[0]], 'saving') + '</td></tr>';
    }).join('');
    return '<details class="annual-full-detail" data-annual-full-detail-id="' + escapeHtml(String(result.scenarioId)) + '"' +
      (isOpen ? ' open' : '') + '><summary><span>Détail complet par poste</span><span class="profile-meta">Prix, frais, aides, usages et recettes</span></summary>' +
      '<div class="table-wrap annual-table-wrap"><table class="annual-table"><caption class="visually-hidden">Détail complet par poste du scénario ' +
      escapeHtml(result.name) + '</caption><thead><tr><th scope="col">Poste</th>' + headerYears + '<th scope="col">Cumul sur ' + horizon +
      ' an' + (horizon > 1 ? 's' : '') + '</th></tr></thead>' +
      '<tbody class="annual-costs"><tr class="annual-group-row"><th scope="rowgroup" colspan="' + totalColumns + '">Coûts</th></tr>' + costLines +
      '<tr class="annual-subtotal-row cost"><th scope="row">Total des coûts</th>' + years.map(function (point) {
        return '<td>' + annualAmount(point.totalCouts, 'cost') + '</td>';
      }).join('') + '<td class="annual-horizon-total">' + annualAmount(breakdown.totaux.totalCouts, 'cost') + '</td></tr></tbody>' +
      '<tbody class="annual-deductions"><tr class="annual-group-row"><th scope="rowgroup" colspan="' + totalColumns + '">Déductions et recettes</th></tr>' + deductionLines +
      '<tr class="annual-subtotal-row saving"><th scope="row">Total des déductions et recettes</th>' + years.map(function (point) {
        return '<td>' + annualAmount(point.totalGains, 'saving') + '</td>';
      }).join('') + '<td class="annual-horizon-total">' + annualAmount(breakdown.totaux.totalGains, 'saving') + '</td></tr></tbody></table></div></details>';
  }

  function renderAnnualScenario(result, isOpen, isFullDetailOpen, index) {
    const scenarioId = String(result.scenarioId);
    const sectionId = 'annual-scenario-' + index;
    const excluded = result.includeInCharts ? '' : '<span class="annual-excluded">Exclu des graphiques</span>';
    const finalResult = getAnnualResultPresentation(result.tcoNetApresIk);
    return '<details class="annual-scenario-detail" data-annual-scenario-id="' + escapeHtml(scenarioId) + '"' +
      (isOpen ? ' open' : '') + '><summary><span class="annual-summary-content"><span class="annual-summary-name">' +
      escapeHtml(result.name) + '</span>' + excluded + '<strong class="' + finalResult.className + '"><span>' +
      escapeHtml(finalResult.label) + ' :</span> ' + formatCurrency(finalResult.amount) + '</strong></span></summary>' +
      '<div class="annual-scenario-body">' + renderAnnualHorizonSummary(result, sectionId) +
      renderTcoComposition(result, sectionId) + renderAnnualCashFlow(result, sectionId) +
      renderVehicleValue(result, sectionId) + renderFullAnnualDetail(result, sectionId, isFullDetailOpen) + '</div></details>';
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
    const automaticDepreciationForm = document.getElementById('automatic-depreciation-form');
    const automaticProfileTarget = document.getElementById('automatic-profile-target');
    const automaticShapeProfile = document.getElementById('automatic-shape-profile');
    const automaticStartPrice = document.getElementById('automatic-start-price');
    const automaticEstimatedPrice = document.getElementById('automatic-estimated-price');
    const automaticYears = document.getElementById('automatic-years');
    const automaticDepreciationError = document.getElementById('automatic-depreciation-error');
    const automaticDepreciationPreview = document.getElementById('automatic-depreciation-preview');
    const annualBreakdowns = document.getElementById('annual-breakdowns');
    const defaultProfileKeys = new Set(TCO.defaults.DEFAULT_DEPRECIATION_PROFILES.map(function (profile) { return profile.key; }));
    let annualBreakdownsRendered = false;

    function setState(nextState) {
      state = nextState;
      annualBreakdownsRendered = false;
    }

    function showMessage(text, type) {
      const message = document.getElementById('app-message');
      message.textContent = text;
      message.className = 'message ' + (type || '');
      message.hidden = false;
      window.clearTimeout(showMessage.timer);
      showMessage.timer = window.setTimeout(function () { message.hidden = true; }, 5000);
    }

    function renderSettingToggle(toggle) {
      return '<label class="settings-toggle"><input type="checkbox" data-setting-toggle="' + escapeHtml(toggle.key) + '"' +
        (state.settings[toggle.key] === true ? ' checked' : '') + '><span>' + escapeHtml(toggle.label) +
        '<small>' + escapeHtml(toggle.help) + '</small></span></label>';
    }

    function renderSettings() {
      settingsForm.innerHTML = SETTINGS_GROUPS.map(function (group, groupIndex) {
        const fields = group.fields.map(function (field) {
          const key = field[0];
          const label = field[1];
          const unit = field[2];
          const type = field[3] || 'number';
          const effect = field[4] || 'used';
          const toggle = field[5];
          const id = 'setting-' + key;
          return '<div class="field effect-field effect-' + effect + '">' +
            '<label for="' + id + '"><span>' + escapeHtml(label) + '</span>' + effectBadge(effect) + '</label>' +
            '<div class="input-wrap"><input id="' + id + '" type="text" inputmode="decimal" ' +
              'data-setting="' + key + '" data-value-type="' + type + '" value="' +
              escapeHtml(initialInputValue(state.settings[key], type)) + '" aria-describedby="error-' + key + '">' +
              '<span class="unit">' + escapeHtml(unit) + '</span></div>' +
            '<p id="error-' + key + '" class="field-error" aria-live="polite"></p>' +
            (toggle ? renderSettingToggle(toggle) : '') + '</div>';
        }).join('');
        const indicators = group.indicators
          ? '<div id="ik-indicators" class="indicator-strip" aria-live="polite"></div>'
          : '';
        const toggles = (group.toggles || []).map(renderSettingToggle).join('');
        return '<fieldset class="settings-group"><legend>' + escapeHtml(group.title) +
          '</legend><div class="form-grid" data-group="' + groupIndex + '">' + fields + '</div>' + indicators + toggles + '</fieldset>';
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
      if ((state.settings.forcerKilometrageTotalAnnuel === true && input.dataset.setting === 'kilometrageTotalAnnuel') ||
        (state.settings.forcerIkIndicatives === true && [
          'kilometrageProRembourseIk', 'baremeIkActuel', 'coefficientPrudenceIk', 'majorationVehiculeElectrique'
        ].indexOf(input.dataset.setting) >= 0)) {
        renderScenarios();
      }
      onChange();
    });

    settingsForm.addEventListener('change', function (event) {
      const toggle = event.target.closest('[data-setting-toggle]');
      if (!toggle) return;
      state.settings[toggle.dataset.settingToggle] = toggle.checked;
      renderScenarios();
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

    function scenarioNumberField(scenario, field, label, unit, effect, help, options) {
      const safeId = escapeHtml(scenario.id);
      const inputId = field + '-' + safeId;
      const errorId = 'scenario-error-' + safeId + '-' + field;
      const config = options || {};
      const sourceValue = Object.prototype.hasOwnProperty.call(config, 'value') ? config.value : scenario[field];
      const value = sourceValue === null || sourceValue === undefined ? '' : String(sourceValue).replace('.', ',');
      return scenarioField(inputId, field, label,
        '<div class="input-wrap"><input id="' + inputId + '" type="text" inputmode="decimal" ' +
        'aria-describedby="' + errorId + '" data-scenario-id="' + safeId + '" data-scenario-field="' + field +
        '" data-scenario-number="true" value="' + escapeHtml(value) + '"' + (config.disabled ? ' disabled aria-disabled="true"' : '') + '><span class="unit">' +
        escapeHtml(unit) + '</span></div><p id="' + errorId + '" class="field-error' + (help ? ' field-help' : '') + '" aria-live="polite">' +
        escapeHtml(help || '') + '</p>', effect);
    }

    function isForcedMileageEnabled() {
      return state.settings.forcerKilometrageTotalAnnuel === true;
    }

    function isForcedIkEnabled() {
      return state.settings.forcerIkIndicatives === true;
    }

    function forcedIkForScenario(scenario) {
      const ik = TCO.calculations.calculateIkIndicators(state.settings);
      return ik.ikIndicativeAnnuelle + (scenario.energyType === 'electric' ? ik.bonusIkElectriqueIndicatif : 0);
    }

    function renderScenarios() {
      const types = getProfileTypes();
      scenariosList.innerHTML = state.scenarios.map(function (scenario) {
        const id = escapeHtml(scenario.id);
        const isElectric = scenario.energyType === 'electric';
        const mileageForced = isForcedMileageEnabled();
        const ikForced = isForcedIkEnabled();
        const forcedIk = ikForced ? forcedIkForScenario(scenario) : null;
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
          scenarioNumberField(scenario, 'kilometrageAnnuelOverride', 'Kilométrage annuel du scénario', 'km/an', 'used',
            mileageForced ? 'Forcé par le kilométrage total annuel.' : 'Vide : utilise l’hypothèse commune.',
            mileageForced ? { value: state.settings.kilometrageTotalAnnuel, disabled: true } : null) +
          scenarioNumberField(scenario, 'prixAchatNet', "Prix d'achat net", '€', 'up') +
          scenarioNumberField(scenario, 'taxeImmatriculation', "Taxe d'immatriculation", '€', 'up') +
          scenarioNumberField(scenario, 'fraisAchat', "Frais d'achat", '€', 'up') +
          scenarioNumberField(scenario, 'aideAchat', "Aide à l'achat", '€', 'down') +
          scenarioNumberField(scenario, 'remiseComplementaire', 'Remise complémentaire', '€', 'down') +
          scenarioNumberField(scenario, 'montantReprise', 'Montant de reprise du véhicule', '€', 'down',
            'Déduit du coût d’acquisition et du TCO, sans modifier l’assiette de décote.') +
          scenarioNumberField(scenario, 'entretienAnnuel', 'Entretien annuel', '€/an', 'up') +
          scenarioNumberField(scenario, 'pneusAnnuel', 'Pneus annuels', '€/an', 'up') +
          scenarioNumberField(scenario, 'assuranceAnnuelle', 'Assurance annuelle', '€/an', 'up') +
          scenarioNumberField(scenario, 'ikAnnuelleRetenue', 'IK annuelle retenue', '€/an', 'down',
            ikForced ? (isElectric ? 'Forcée : IK indicative + bonus électrique.' : 'Forcée : IK indicative.') : '',
            ikForced ? { value: forcedIk, disabled: true } : null) +
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

    function renderAutomaticProfileTargets() {
      const selectedKey = automaticProfileTarget.value;
      automaticProfileTarget.innerHTML = state.depreciationProfiles.map(function (profile) {
        return '<option value="' + escapeHtml(profile.key) + '">' + escapeHtml(profile.key) + '</option>';
      }).join('');
      if (TCO.depreciation.getProfileByKey(state.depreciationProfiles, selectedKey)) {
        automaticProfileTarget.value = selectedKey;
      }
    }

    function renderProfiles() {
      renderAutomaticProfileTargets();
      automaticDepreciationPreview.hidden = true;
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

    function renderAutomaticDepreciationPreview(generated, profile) {
      const rows = generated.profil.map(function (point) {
        const isTarget = point.annee === generated.nombreAnnees;
        const annualRate = point.annee === 0 ? '—' : TCO.depreciation.formatRate(point.tauxDecoteAnnuelReel);
        return '<tr' + (isTarget ? ' class="automatic-target-row"' : '') + '><th scope="row">Année ' + point.annee +
          (isTarget ? ' · cible' : '') + '</th><td>' + formatCurrency(point.prix) + '</td><td>' + annualRate + '</td><td>' +
          TCO.depreciation.formatRate(point.decoteDepuisDepart) + '</td></tr>';
      }).join('');
      automaticDepreciationPreview.innerHTML = '<div class="automatic-rate-summary"><span>Taux annuel moyen équivalent</span><strong>' +
        TCO.depreciation.formatRate(generated.tauxAnnuelMoyenEquivalent) + '</strong><small>' +
        escapeHtml(generated.libelleProfilForme) + ' · coefficient ' + generated.coefficientForme +
        '</small><small>Dix taux appliqués à « ' + escapeHtml(profile.key) + ' ».</small></div><div class="table-wrap"><table><caption class="visually-hidden">Profil de décote automatique généré</caption>' +
        '<thead><tr><th scope="col">Année</th><th scope="col">Valeur estimée</th><th scope="col">Taux annuel réel</th><th scope="col">Décote depuis le départ</th></tr></thead><tbody>' +
        rows + '</tbody></table></div>';
      automaticDepreciationPreview.hidden = false;
    }

    automaticDepreciationForm.addEventListener('input', function () {
      automaticDepreciationError.textContent = '';
      [automaticStartPrice, automaticEstimatedPrice, automaticYears].forEach(function (input) {
        input.setAttribute('aria-invalid', 'false');
      });
    });

    automaticProfileTarget.addEventListener('change', function () {
      automaticDepreciationPreview.hidden = true;
    });

    automaticShapeProfile.addEventListener('change', function () {
      automaticDepreciationPreview.hidden = true;
    });

    automaticDepreciationForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const profile = TCO.depreciation.getProfileByKey(state.depreciationProfiles, automaticProfileTarget.value);
      if (!profile) {
        automaticDepreciationError.textContent = 'Sélectionnez un profil de décote valide.';
        return;
      }
      try {
        const generated = TCO.depreciation.calculerProfilDecote(
          automaticStartPrice.value,
          automaticEstimatedPrice.value,
          automaticYears.value,
          automaticShapeProfile.value,
          10
        );
        profile.rates = generated.profil.slice(1, 11).map(function (point) {
          return point.tauxDecoteAnnuelReel;
        });
        renderProfiles();
        automaticProfileTarget.value = profile.key;
        renderAutomaticDepreciationPreview(generated, profile);
        automaticDepreciationError.textContent = '';
        showMessage(generated.libelleProfilForme + ' appliqué à « ' + profile.key + ' ».', 'success');
        onChange();
      } catch (error) {
        const message = error.message || 'Impossible de générer ce profil.';
        automaticDepreciationError.textContent = message;
        if (/prix de départ/i.test(message)) automaticStartPrice.setAttribute('aria-invalid', 'true');
        if (/prix estimé/i.test(message)) automaticEstimatedPrice.setAttribute('aria-invalid', 'true');
        if (/nombre d’années/i.test(message)) automaticYears.setAttribute('aria-invalid', 'true');
      }
    });

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
      automaticDepreciationPreview.hidden = true;
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
      const forced = state.settings.forcerIkIndicatives === true;
      document.getElementById('ik-indicators').innerHTML =
        '<p class="indicator-intro"><span class="effect-badge effect-' + (forced ? 'used' : 'indicative') + '">' +
        (forced ? 'Appliqué aux scénarios' : 'Indicatif uniquement') + '</span> ' +
        (forced
          ? 'Les scénarios thermiques reçoivent l’IK indicative ; les scénarios électriques reçoivent l’IK indicative majorée du bonus électrique.'
          : 'Ces deux montants aident à renseigner les scénarios, mais ne modifient jamais le TCO automatiquement.') + '</p>' +
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
        (best ? formatCurrency(best.tcoNetApresIk) + ' net après reprise et IK' : 'Activez un scénario pour comparer') + '</p></article>');
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
          '<td>− ' + formatCurrency(result.montantReprise) + '</td>' +
          '<td>− ' + formatCurrency(result.ikRetenueCumulee) + '</td><td>' + formatCurrency(result.coutAnnuelMoyen) + '</td>' +
          '<td>' + (result.coutParKm === null ? '—' : formatNumber(result.coutParKm, 3) + ' €/km') + '</td></tr>';
      }).join('');
      document.getElementById('results-table').innerHTML = '<table><thead><tr><th scope="col">Scénario</th><th scope="col">TCO net</th><th scope="col">TCO brut</th><th scope="col">Acquisition nette</th><th scope="col">Âge achat</th><th scope="col">Âge horizon</th><th scope="col">Taux de profil à l’horizon</th><th scope="col">Km achat</th><th scope="col">Km horizon</th><th scope="col">Valeur résiduelle</th><th scope="col">Décote</th><th scope="col">Énergie</th><th scope="col">Entretien</th><th scope="col">Pneus</th><th scope="col">Assurance</th><th scope="col">Frais + taxes</th><th scope="col">Reprise</th><th scope="col">IK retenues</th><th scope="col">Moyenne/an</th><th scope="col">Coût/km</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function renderAnnualBreakdowns(results) {
      const openIds = new Set();
      const openFullDetailIds = new Set();
      if (annualBreakdownsRendered) {
        annualBreakdowns.querySelectorAll('details[open][data-annual-scenario-id]').forEach(function (detail) {
          openIds.add(detail.dataset.annualScenarioId);
        });
        annualBreakdowns.querySelectorAll('details[open][data-annual-full-detail-id]').forEach(function (detail) {
          openFullDetailIds.add(detail.dataset.annualFullDetailId);
        });
      } else if (results.length) {
        openIds.add(String(results[0].scenarioId));
      }

      annualBreakdowns.innerHTML = results.map(function (result, index) {
        const scenarioId = String(result.scenarioId);
        return renderAnnualScenario(
          result,
          openIds.has(scenarioId),
          openFullDetailIds.has(scenarioId),
          index
        );
      }).join('');
      annualBreakdownsRendered = true;
    }

    function renderDynamic(results) {
      renderIndicators();
      renderSummary(results);
      renderResultsTable(results);
      renderAnnualBreakdowns(results);
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
    formatNumber: formatNumber,
    getAnnualResultPresentation: getAnnualResultPresentation,
    renderAnnualScenario: renderAnnualScenario
  };
}(window.TCO = window.TCO || {}));
