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
    const montantReprise = nonNegative(scenario.montantReprise);
    const fraisAchat = nonNegative(scenario.fraisAchat);
    const taxes = nonNegative(scenario.taxeImmatriculation);
    const assietteValeur = Math.max(0, prixVehicule - aidesApplicables);
    const aidesRemisesAppliquees = prixVehicule - assietteValeur;
    // La reprise est un apport distinct : elle réduit le montant payé, pas la valeur du véhicule acheté.
    const coutAcquisitionNet = assietteValeur + fraisAchat + taxes - montantReprise;
    const profile = TCO.depreciation.getProfile(profiles, scenario.depreciationType, scenario.depreciationLevel);
    const rates = profile ? profile.rates : new Array(10).fill(0);
    const annualOverride = scenario.kilometrageAnnuelOverride === undefined
      ? scenario.kilometrageTotalAnnuelOverride : scenario.kilometrageAnnuelOverride;
    const annualKm = nonNegative(settings.forcerKilometrageTotalAnnuel === true
      ? settings.kilometrageTotalAnnuel
      : (annualOverride === null || annualOverride === undefined
      ? settings.kilometrageTotalAnnuel : annualOverride));
    const residualSeries = TCO.depreciation.computeAgeShiftedResidualSeries(
      assietteValeur,
      rates,
      horizon,
      {
        ageAtPurchase: ageAchat,
        annualMileage: annualKm,
        purchaseMileage: kilometrageAchat
      }
    );
    const finalDepreciationPoint = residualSeries[horizon - 1] || { finalResidual: assietteValeur };
    const valeurResiduelle = finalDepreciationPoint.finalResidual;
    const coutDecote = assietteValeur - valeurResiduelle;

    const prixEnergieCommun = isElectric ? settings.prixElectricite : settings.prixEssence;
    const prixEnergie = nonNegative(settings.forcerPrixEnergie === true
      ? prixEnergieCommun
      : (scenario.prixEnergieOverride === null || scenario.prixEnergieOverride === undefined
        ? prixEnergieCommun
        : scenario.prixEnergieOverride));
    const coutEnergieAnnuel = isElectric
      ? annualKm * nonNegative(scenario.consoElectriqueKwh100) / 100 * prixEnergie
      : annualKm * nonNegative(scenario.consoThermiqueL100) / 100 * prixEnergie;
    const entretienAnnuel = nonNegative(scenario.entretienAnnuel);
    const pneusAnnuel = nonNegative(scenario.pneusAnnuel);
    const assuranceAnnuel = nonNegative(scenario.assuranceAnnuelle);
    const ikIndicators = calculateIkIndicators(settings);
    const ikRetenueAnnuelle = settings.forcerIkIndicatives === true
      ? ikIndicators.ikIndicativeAnnuelle + (isElectric ? ikIndicators.bonusIkElectriqueIndicatif : 0)
      : nonNegative(scenario.ikAnnuelleRetenue);

    const coutEnergieCumule = coutEnergieAnnuel * horizon;
    const entretienCumule = entretienAnnuel * horizon;
    const pneusCumule = pneusAnnuel * horizon;
    const assuranceCumule = assuranceAnnuel * horizon;
    const ikRetenueCumulee = ikRetenueAnnuelle * horizon;
    const tcoBrut = coutDecote + fraisAchat + taxes + coutEnergieCumule +
      entretienCumule + pneusCumule + assuranceCumule;
    const tcoNetApresIk = tcoBrut - montantReprise - ikRetenueCumulee;
    const kmTotalHorizon = annualKm * horizon;

    const seriesAnnuelles = residualSeries.map(function (point) {
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
        tauxDecoteEffectif: point.effectiveRate,
        valeurResiduelle: point.finalResidual,
        coutDecote: depreciation,
        tcoBrut: gross,
        tcoNet: gross - montantReprise - year * ikRetenueAnnuelle
      };
    });

    const coutKeys = ['achatVehicule', 'fraisAchat', 'taxes', 'energie', 'entretien', 'pneus', 'assurance'];
    const gainKeys = ['aidesRemises', 'reprise', 'ik', 'valeurResiduelle'];
    const totalCoutsParPoste = {};
    const totalGainsParPoste = {};
    coutKeys.forEach(function (key) { totalCoutsParPoste[key] = 0; });
    gainKeys.forEach(function (key) { totalGainsParPoste[key] = 0; });

    let cumulTresorerie = 0;
    const decompositionAnnees = [];
    for (let year = 0; year <= horizon; year += 1) {
      const isPurchaseYear = year === 0;
      const isFinalYear = year === horizon;
      const couts = {
        achatVehicule: isPurchaseYear ? prixVehicule : 0,
        fraisAchat: isPurchaseYear ? fraisAchat : 0,
        taxes: isPurchaseYear ? taxes : 0,
        energie: isPurchaseYear ? 0 : coutEnergieAnnuel,
        entretien: isPurchaseYear ? 0 : entretienAnnuel,
        pneus: isPurchaseYear ? 0 : pneusAnnuel,
        assurance: isPurchaseYear ? 0 : assuranceAnnuel
      };
      const gains = {
        aidesRemises: isPurchaseYear ? aidesRemisesAppliquees : 0,
        reprise: isPurchaseYear ? montantReprise : 0,
        ik: isPurchaseYear ? 0 : ikRetenueAnnuelle,
        valeurResiduelle: isFinalYear ? valeurResiduelle : 0
      };
      const totalCouts = coutKeys.reduce(function (total, key) { return total + couts[key]; }, 0);
      const totalGains = gainKeys.reduce(function (total, key) { return total + gains[key]; }, 0);
      const soldeNet = isPurchaseYear ? coutAcquisitionNet : totalCouts - totalGains;
      cumulTresorerie += soldeNet;
      coutKeys.forEach(function (key) { totalCoutsParPoste[key] += couts[key]; });
      gainKeys.forEach(function (key) { totalGainsParPoste[key] += gains[key]; });
      decompositionAnnees.push({
        annee: year,
        couts: couts,
        gains: gains,
        totalCouts: totalCouts,
        totalGains: totalGains,
        soldeNet: soldeNet,
        cumulTresorerie: cumulTresorerie,
        valeurVehiculeDeduite: isPurchaseYear
          ? assietteValeur
          : seriesAnnuelles[year - 1].valeurResiduelle,
        tcoEconomique: isPurchaseYear
          ? fraisAchat + taxes - montantReprise
          : seriesAnnuelles[year - 1].tcoNet
      });
    }

    const totalCoutsDecomposition = coutKeys.reduce(function (total, key) {
      return total + totalCoutsParPoste[key];
    }, 0);
    const totalGainsDecomposition = gainKeys.reduce(function (total, key) {
      return total + totalGainsParPoste[key];
    }, 0);
    // Les deux lectures doivent aboutir au même TCO à l’horizon malgré les arrondis flottants.
    decompositionAnnees[decompositionAnnees.length - 1].cumulTresorerie = tcoNetApresIk;
    decompositionAnnees[decompositionAnnees.length - 1].tcoEconomique = tcoNetApresIk;
    const decompositionAnnuelle = {
      annees: decompositionAnnees,
      totaux: {
        couts: totalCoutsParPoste,
        gains: totalGainsParPoste,
        totalCouts: totalCoutsDecomposition,
        totalGains: totalGainsDecomposition,
        soldeNet: tcoNetApresIk
      }
    };

    return {
      scenarioId: scenario.id,
      name: scenario.name,
      energyType: scenario.energyType,
      includeInCharts: scenario.includeInCharts !== false,
      profileFound: Boolean(profile),
      coutAcquisitionNet: coutAcquisitionNet,
      assietteValeur: assietteValeur,
      aidesApplicables: aidesApplicables,
      montantReprise: montantReprise,
      anneeAchat: purchaseYear,
      ageAchat: ageAchat,
      ageHorizon: ageAchat === null ? null : ageAchat + horizon,
      kilometrageAchat: kilometrageAchat,
      kilometrageHorizon: kilometrageAchat + annualKm * horizon,
      kilometrageAnnuelUtilise: annualKm,
      prixEnergieUtilise: prixEnergie,
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
      decompositionAnnuelle: decompositionAnnuelle,
      warnings: scenario.acquisitionStatus === 'used' && ageAchat === null
        ? ["Année de mise en circulation manquante : taux indexés par année de possession."]
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
