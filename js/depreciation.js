(function (TCO) {
  'use strict';

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

  function computeAgeShiftedResidualSeries(baseValue, rates, horizon, options) {
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
      baseResidual *= 1 - baseRate;
      series.push({
        year: year,
        age: age,
        mileage: purchaseMileage + annualMileage * year,
        profileYear: profileYear,
        profileRateRepeated: profileYear > (rates || []).length,
        baseRate: baseRate,
        effectiveRate: baseRate,
        finalResidual: baseResidual
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
    computeAgeShiftedResidualSeries: computeAgeShiftedResidualSeries,
    clamp: clamp
  };
}(window.TCO = window.TCO || {}));
