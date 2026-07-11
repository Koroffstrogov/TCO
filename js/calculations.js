(function (TCO) {
  'use strict';

  function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : (fallback || 0);
  }

  function nonNegative(value) {
    return Math.max(0, finite(value));
  }

  function getHorizon(settings) {
    return Math.min(10, Math.max(1, Math.trunc(finite(settings.horizonKpi, 1))));
  }

  function calculateIkIndicators(settings) {
    const indicative = nonNegative(settings.kilometrageProRembourseIk) *
      nonNegative(settings.baremeIkActuel) * nonNegative(settings.coefficientPrudenceIk);
    return {
      ikIndicativeAnnuelle: indicative,
      bonusIkElectriqueIndicatif: indicative * Math.min(1, Math.max(0, finite(settings.majorationVehiculeElectrique)))
    };
  }

  function calculateScenarioTco(settings, scenario, profiles) {
    const horizon = getHorizon(settings);
    const isElectric = scenario.energyType === 'electric';
    const isNewElectric = isElectric && scenario.acquisitionStatus === 'new';
    const prixVehicule = nonNegative(isElectric ? settings.prixNetDepartElec : settings.prixNetDepartThermique);
    const aidesApplicables = isNewElectric
      ? nonNegative(settings.aideVeNeuveEligible) + nonNegative(settings.surbonusRemiseComplementaire)
      : 0;
    let fraisAchat = 0;
    if (isElectric && scenario.acquisitionStatus === 'used') fraisAchat = nonNegative(settings.fraisAchatElectriqueOccasion);
    if (isElectric && scenario.acquisitionStatus === 'new') fraisAchat = nonNegative(settings.fraisAchatElectriqueNeuve);
    if (!isElectric && scenario.acquisitionStatus === 'used') fraisAchat = nonNegative(settings.fraisAchatThermiqueOccasion);

    const taxes = nonNegative(settings.taxeImmatriculation);
    const assietteValeur = Math.max(0, prixVehicule - aidesApplicables);
    const coutAcquisitionNet = assietteValeur + fraisAchat + taxes;
    const profile = TCO.depreciation.getProfile(profiles, scenario.depreciationType, scenario.depreciationLevel);
    const rates = profile ? profile.rates : new Array(10).fill(0);
    const residualSeries = TCO.depreciation.computeAnnualResidualSeries(assietteValeur, rates, horizon);
    const valeurResiduelle = residualSeries[horizon - 1] === undefined ? assietteValeur : residualSeries[horizon - 1];
    const coutDecote = assietteValeur - valeurResiduelle;

    const annualKm = nonNegative(settings.kilometrageTotalAnnuel);
    const coutEnergieAnnuel = isElectric
      ? annualKm * nonNegative(scenario.consoElectriqueKwh100) / 100 * nonNegative(settings.prixElectricite)
      : annualKm * nonNegative(scenario.consoThermiqueL100) / 100 * nonNegative(settings.prixEssence);
    const entretienAnnuel = nonNegative(isElectric ? settings.entretienElectriqueStandard : settings.entretienThermiqueStandard);
    const pneusAnnuel = nonNegative(isElectric ? settings.pneusModelYStandard : settings.pneusThermiqueStandard);
    const assuranceAnnuel = nonNegative(isElectric ? settings.assuranceElectriqueStandard : settings.assuranceThermiqueStandard);
    const ikRetenueAnnuelle = nonNegative(settings.ikActuellesAnnuelles) +
      (isElectric ? nonNegative(settings.bonusIkElectriqueRetenu) : 0);

    const coutEnergieCumule = coutEnergieAnnuel * horizon;
    const entretienCumule = entretienAnnuel * horizon;
    const pneusCumule = pneusAnnuel * horizon;
    const assuranceCumule = assuranceAnnuel * horizon;
    const ikRetenueCumulee = ikRetenueAnnuelle * horizon;
    const tcoBrut = coutDecote + fraisAchat + taxes + coutEnergieCumule +
      entretienCumule + pneusCumule + assuranceCumule;
    const tcoNetApresIk = tcoBrut - ikRetenueCumulee;
    const kmTotalHorizon = annualKm * horizon;

    const seriesAnnuelles = residualSeries.map(function (residual, index) {
      const year = index + 1;
      const depreciation = assietteValeur - residual;
      const annualCosts = year * (coutEnergieAnnuel + entretienAnnuel + pneusAnnuel + assuranceAnnuel);
      const gross = depreciation + fraisAchat + taxes + annualCosts;
      return {
        year: year,
        valeurResiduelle: residual,
        coutDecote: depreciation,
        tcoBrut: gross,
        tcoNet: gross - year * ikRetenueAnnuelle
      };
    });

    return {
      scenarioId: scenario.id,
      name: scenario.name,
      energyType: scenario.energyType,
      includeInCharts: scenario.includeInCharts !== false,
      profileFound: Boolean(profile),
      coutAcquisitionNet: coutAcquisitionNet,
      assietteValeur: assietteValeur,
      aidesApplicables: aidesApplicables,
      valeurResiduelle: valeurResiduelle,
      coutDecote: coutDecote,
      fraisAchat: fraisAchat,
      taxes: taxes,
      coutEnergieAnnuel: coutEnergieAnnuel,
      coutEnergieCumule: coutEnergieCumule,
      entretienCumule: entretienCumule,
      pneusCumule: pneusCumule,
      assuranceCumule: assuranceCumule,
      ikRetenueAnnuelle: ikRetenueAnnuelle,
      ikRetenueCumulee: ikRetenueCumulee,
      tcoBrut: tcoBrut,
      tcoNetApresIk: tcoNetApresIk,
      coutAnnuelMoyen: tcoNetApresIk / horizon,
      coutParKm: kmTotalHorizon > 0 ? tcoNetApresIk / kmTotalHorizon : null,
      ecartVsReference: 0,
      seriesAnnuelles: seriesAnnuelles
    };
  }

  function getReferenceScenarioResult(results) {
    const included = (results || []).filter(function (result) { return result.includeInCharts; });
    return included.find(function (result) { return result.energyType === 'thermal'; }) || included[0] || null;
  }

  function calculateAllScenarios(settings, scenarios, profiles) {
    const results = (scenarios || []).map(function (scenario) {
      return calculateScenarioTco(settings, scenario, profiles);
    });
    const reference = getReferenceScenarioResult(results);
    results.forEach(function (result) {
      result.ecartVsReference = reference ? result.tcoNetApresIk - reference.tcoNetApresIk : 0;
    });
    return results;
  }

  TCO.calculations = {
    calculateIkIndicators: calculateIkIndicators,
    calculateScenarioTco: calculateScenarioTco,
    calculateAllScenarios: calculateAllScenarios,
    getReferenceScenarioResult: getReferenceScenarioResult,
    getHorizon: getHorizon
  };
}(window.TCO = window.TCO || {}));
