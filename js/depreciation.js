(function (TCO) {
  'use strict';

  const MIN_MILEAGE_FACTOR = 0.70;
  const MAX_MILEAGE_FACTOR = 1.15;
  const AGE_FACTOR_BANDS = Object.freeze([
    { min: 0, max: 1, label: '0–1 an' },
    { min: 2, max: 3, label: '2–3 ans' },
    { min: 4, max: 5, label: '4–5 ans' },
    { min: 6, max: 7, label: '6–7 ans' },
    { min: 8, max: 9, label: '8–9 ans' },
    { min: 10, max: 11, label: '10–11 ans' },
    { min: 12, max: 13, label: '12–13 ans' },
    { min: 14, max: 15, label: '14–15 ans' },
    { min: 16, max: 17, label: '16–17 ans' },
    { min: 18, max: 19, label: '18–19 ans' },
    { min: 20, max: Infinity, label: '20 ans et +' }
  ]);

  function parseFrenchNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    if (value === null || value === undefined) return NaN;
    const cleaned = String(value)
      .trim()
      .replace(/[\s\u00a0\u202f]/g, '')
      .replace(/€/g, '')
      .replace(',', '.')
      .replace(/[^0-9+\-.eE]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '+') return NaN;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function normalizeRate(value) {
    const parsed = parseFrenchNumber(value);
    if (!Number.isFinite(parsed)) return NaN;
    return Math.abs(parsed) > 1 ? parsed / 100 : parsed;
  }

  function formatRate(value) {
    const rate = Number.isFinite(Number(value)) ? Number(value) : 0;
    return new Intl.NumberFormat('fr-FR', {
      style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2
    }).format(rate);
  }

  function getProfile(profiles, type, level) {
    return (profiles || []).find(function (profile) {
      return profile.type === type && profile.level === level;
    }) || null;
  }

  function getProfileByKey(profiles, key) {
    return (profiles || []).find(function (profile) { return profile.key === key; }) || null;
  }

  function safeRate(value) {
    const rate = Number(value);
    return Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 0;
  }

  function computeAnnualResidualSeries(baseValue, rates, horizon) {
    const base = Math.max(0, Number(baseValue) || 0);
    const years = Math.max(0, Math.min(10, Math.trunc(Number(horizon) || 0)));
    let residual = base;
    const series = [];
    for (let year = 0; year < years; year += 1) {
      residual *= 1 - safeRate((rates || [])[year]);
      series.push(residual);
    }
    return series;
  }

  function computeResidualValue(baseValue, rates, horizon) {
    const series = computeAnnualResidualSeries(baseValue, rates, horizon);
    return series.length ? series[series.length - 1] : Math.max(0, Number(baseValue) || 0);
  }

  function getAgeFactor(ageFactors, age) {
    if (age === null || age === undefined || !Number.isFinite(Number(age))) return 1;
    const normalizedAge = Math.max(0, Number(age));
    const index = AGE_FACTOR_BANDS.findIndex(function (band) {
      return normalizedAge >= band.min && normalizedAge <= band.max;
    });
    const factor = Number((ageFactors || [])[index < 0 ? AGE_FACTOR_BANDS.length - 1 : index]);
    return Number.isFinite(factor) && factor >= 0 ? factor : 1;
  }

  function computeMileageFactor(annualMileage, referenceAnnualMileage, sensitivity, year) {
    const annual = Math.max(0, Number(annualMileage) || 0);
    const reference = Math.max(0, Number(referenceAnnualMileage) || 0);
    const ratio = Math.max(0, Number(sensitivity) || 0);
    const years = Math.max(0, Number(year) || 0);
    const futureDelta = (annual - reference) * years;
    return clamp(1 - (futureDelta / 10000) * ratio, MIN_MILEAGE_FACTOR, MAX_MILEAGE_FACTOR);
  }

  function computeAdjustedResidualSeries(baseValue, rates, horizon, options) {
    const base = Math.max(0, Number(baseValue) || 0);
    const years = Math.max(0, Math.min(10, Math.trunc(Number(horizon) || 0)));
    const config = options || {};
    const annualMileage = Math.max(0, Number(config.annualMileage) || 0);
    const purchaseMileage = Math.max(0, Number(config.purchaseMileage) || 0);
    const hasKnownAge = config.ageAtPurchase !== null && config.ageAtPurchase !== undefined &&
      Number.isFinite(Number(config.ageAtPurchase));
    let baseResidual = base;
    const series = [];
    for (let index = 0; index < years; index += 1) {
      const year = index + 1;
      const age = hasKnownAge ? Math.max(0, Number(config.ageAtPurchase)) + year : null;
      const profileYear = hasKnownAge ? Math.max(1, Math.floor(age)) : year;
      const rateIndex = Math.min(Math.max(0, (rates || []).length - 1), profileYear - 1);
      const baseRate = safeRate((rates || [])[rateIndex]);
      const ageFactor = getAgeFactor(config.ageFactors, age);
      const effectiveRate = clamp(baseRate * ageFactor, 0, 1);
      baseResidual *= 1 - effectiveRate;
      const mileageFactor = computeMileageFactor(
        annualMileage,
        config.referenceAnnualMileage,
        config.mileageSensitivity,
        year
      );
      const finalResidual = baseResidual * mileageFactor;
      series.push({
        year: year,
        age: age,
        mileage: purchaseMileage + annualMileage * year,
        profileYear: profileYear,
        profileRateRepeated: profileYear > (rates || []).length,
        baseRate: baseRate,
        ageFactor: ageFactor,
        effectiveRate: effectiveRate,
        baseResidual: baseResidual,
        mileageFactor: mileageFactor,
        mileageCorrection: finalResidual - baseResidual,
        finalResidual: finalResidual
      });
    }
    return series;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  TCO.depreciation = {
    parseFrenchNumber: parseFrenchNumber,
    normalizeRate: normalizeRate,
    formatRate: formatRate,
    getProfile: getProfile,
    getProfileByKey: getProfileByKey,
    computeResidualValue: computeResidualValue,
    computeAnnualResidualSeries: computeAnnualResidualSeries,
    computeAdjustedResidualSeries: computeAdjustedResidualSeries,
    computeMileageFactor: computeMileageFactor,
    getAgeFactor: getAgeFactor,
    MIN_MILEAGE_FACTOR: MIN_MILEAGE_FACTOR,
    MAX_MILEAGE_FACTOR: MAX_MILEAGE_FACTOR,
    AGE_FACTOR_BANDS: AGE_FACTOR_BANDS,
    clamp: clamp
  };
}(window.TCO = window.TCO || {}));
