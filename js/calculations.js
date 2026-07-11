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
    const purchaseYear = new Date().getFullYear();
    const registrationYear = Number(scenario.anneeMiseEnCirculation);
    const hasRegistrationYear = Number.isFinite(registrationYear) && registrationYear > 0;
    const ageAchat = scenario.acquisitionStatus === 'new'
      ? 0
      : (hasRegistrationYear ? Math.max(0, purchaseYear - Math.trunc(registrationYear)) : null);
    const kilometrageAchat = nonNegative(scenario.kilometrageAchat);
    const prixVehicule = nonNegative(scenario.prixAchatNet);
    const aidesApplicables = nonNegative(scenario.aideAchat) + nonNegative(scenario.remiseComplementaire);
    const fraisAchat = nonNegative(scenario.fraisAchat);
    const taxes = nonNegative(scenario.taxeImmatriculation);
    const assietteValeur = Math.max(0, prixVehicule - aidesApplicables);
    const coutAcquisitionNet = assietteValeur + fraisAchat + taxes;
    const profile = TCO.depreciation.getProfile(profiles, scenario.depreciationType, scenario.depreciationLevel);
    const rates = profile ? profile.rates : new Array(10).fill(0);
    const annualOverride = scenario.kilometrageAnnuelOverride === undefined
      ? scenario.kilometrageTotalAnnuelOverride : scenario.kilometrageAnnuelOverride;
    const annualKm = nonNegative(annualOverride === null || annualOverride === undefined
      ? settings.kilometrageTotalAnnuel : annualOverride);
    const adjustedResidualSeries = TCO.depreciation.computeAdjustedResidualSeries(
      assietteValeur,
      rates,
      horizon,
      {
        ageAtPurchase: ageAchat,
        annualMileage: annualKm,
        purchaseMileage: kilometrageAchat,
        referenceAnnualMileage: profile ? profile.kilometrageReferenceAnnuel : 0,
        mileageSensitivity: profile ? profile.sensibiliteKilometrage : 0,
        ageFactors: profile ? profile.ageFactors : null
      }
    );
    const finalDepreciationPoint = adjustedResidualSeries[horizon - 1] || {
      baseResidual: assietteValeur,
      finalResidual: assietteValeur,
      mileageCorrection: 0,
      mileageFactor: 1,
      mileage: kilometrageAchat
    };
    const valeurResiduelleAvantCorrection = finalDepreciationPoint.baseResidual;
    const correctionKilometrique = finalDepreciationPoint.mileageCorrection;
    const valeurResiduelle = finalDepreciationPoint.finalResidual;
    const coutDecote = assietteValeur - valeurResiduelle;

    const prixEnergie = nonNegative(scenario.prixEnergieOverride === null ||
      scenario.prixEnergieOverride === undefined
      ? (isElectric ? settings.prixElectricite : settings.prixEssence)
      : scenario.prixEnergieOverride);
    const coutEnergieAnnuel = isElectric
      ? annualKm * nonNegative(scenario.consoElectriqueKwh100) / 100 * prixEnergie
      : annualKm * nonNegative(scenario.consoThermiqueL100) / 100 * prixEnergie;
    const entretienAnnuel = nonNegative(scenario.entretienAnnuel);
    const pneusAnnuel = nonNegative(scenario.pneusAnnuel);
    const assuranceAnnuel = nonNegative(scenario.assuranceAnnuelle);
    const ikRetenueAnnuelle = nonNegative(scenario.ikAnnuelleRetenue);

    const coutEnergieCumule = coutEnergieAnnuel * horizon;
    const entretienCumule = entretienAnnuel * horizon;
    const pneusCumule = pneusAnnuel * horizon;
    const assuranceCumule = assuranceAnnuel * horizon;
    const ikRetenueCumulee = ikRetenueAnnuelle * horizon;
    const tcoBrut = coutDecote + fraisAchat + taxes + coutEnergieCumule +
      entretienCumule + pneusCumule + assuranceCumule;
    const tcoNetApresIk = tcoBrut - ikRetenueCumulee;
    const kmTotalHorizon = annualKm * horizon;

    const seriesAnnuelles = adjustedResidualSeries.map(function (point) {
      const year = point.year;
      const depreciation = assietteValeur - point.finalResidual;
      const annualCosts = year * (coutEnergieAnnuel + entretienAnnuel + pneusAnnuel + assuranceAnnuel);
      const gross = depreciation + fraisAchat + taxes + annualCosts;
      return {
        year: year,
        age: point.age,
        kilometrage: point.mileage,
        anneeProfil: point.profileYear,
        tauxProfilRepete: point.profileRateRepeated,
        tauxDecoteBase: point.baseRate,
        coefficientAge: point.ageFactor,
        tauxDecoteEffectif: point.effectiveRate,
        valeurResiduelleAvantCorrection: point.baseResidual,
        facteurKilometrage: point.mileageFactor,
        correctionKilometrique: point.mileageCorrection,
        valeurResiduelle: point.finalResidual,
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
      anneeAchat: purchaseYear,
      ageAchat: ageAchat,
      ageHorizon: ageAchat === null ? null : ageAchat + horizon,
      kilometrageAchat: kilometrageAchat,
      kilometrageHorizon: kilometrageAchat + annualKm * horizon,
      kilometrageAnnuelUtilise: annualKm,
      prixEnergieUtilise: prixEnergie,
      valeurResiduelleAvantCorrection: valeurResiduelleAvantCorrection,
      correctionKilometrique: correctionKilometrique,
      facteurKilometrage: finalDepreciationPoint.mileageFactor,
      anneeProfilHorizon: finalDepreciationPoint.profileYear,
      tauxProfilRepeteHorizon: finalDepreciationPoint.profileRateRepeated,
      tauxDecoteBaseHorizon: finalDepreciationPoint.baseRate,
      tauxDecoteEffectifHorizon: finalDepreciationPoint.effectiveRate,
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
      seriesAnnuelles: seriesAnnuelles,
      warnings: scenario.acquisitionStatus === 'used' && ageAchat === null
        ? ["Année de mise en circulation manquante : coefficient d’âge neutre appliqué."]
        : (hasRegistrationYear && registrationYear > purchaseYear
          ? ["L’année de mise en circulation est postérieure à l’année d’achat retenue."]
          : [])
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
