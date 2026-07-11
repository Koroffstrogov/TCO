(function (TCO) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const COLORS = ['#176b87', '#d97736', '#6d5cae', '#2f855a', '#be4b5e', '#5b6b7a'];

  function svgElement(name, attributes, text) {
    const element = document.createElementNS(NS, name);
    Object.keys(attributes || {}).forEach(function (key) { element.setAttribute(key, attributes[key]); });
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function setup(container, width, height, emptyMessage) {
    container.replaceChildren();
    const svg = svgElement('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      preserveAspectRatio: 'xMidYMid meet',
      'aria-hidden': 'true',
      focusable: 'false'
    });
    container.appendChild(svg);
    if (emptyMessage) {
      svg.appendChild(svgElement('text', {
        x: width / 2, y: height / 2, class: 'chart-empty', 'text-anchor': 'middle'
      }, emptyMessage));
    }
    return svg;
  }

  function money(value) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function shortName(name, length) {
    const text = String(name || 'Sans nom');
    return text.length > length ? text.slice(0, length - 1) + '…' : text;
  }

  function renderTcoBarChart(container, allResults) {
    const results = (allResults || []).filter(function (result) { return result.includeInCharts; });
    const width = 760;
    const height = Math.max(280, 105 + results.length * 62);
    const svg = setup(container, width, height, results.length ? '' : 'Aucun scénario inclus');
    if (!results.length) return;

    const left = 175;
    const right = 35;
    const top = 30;
    const bottom = 45;
    const values = results.map(function (result) { return result.tcoNetApresIk; });
    const min = Math.min(0, Math.min.apply(null, values));
    const max = Math.max(0, Math.max.apply(null, values));
    const span = max - min || 1;
    const x = function (value) { return left + ((value - min) / span) * (width - left - right); };
    const zeroX = x(0);

    svg.appendChild(svgElement('line', { x1: zeroX, y1: top, x2: zeroX, y2: height - bottom, class: 'chart-axis' }));
    results.forEach(function (result, index) {
      const y = top + index * 62 + 12;
      const valueX = x(result.tcoNetApresIk);
      const startX = Math.min(zeroX, valueX);
      const barWidth = Math.max(2, Math.abs(valueX - zeroX));
      svg.appendChild(svgElement('text', { x: left - 12, y: y + 16, 'text-anchor': 'end', class: 'chart-label' }, shortName(result.name, 22)));
      const rect = svgElement('rect', {
        x: startX, y: y, width: barWidth, height: 26, rx: 5,
        fill: COLORS[index % COLORS.length], class: 'chart-bar'
      });
      rect.appendChild(svgElement('title', {}, result.name + ' : ' + money(result.tcoNetApresIk)));
      svg.appendChild(rect);
      svg.appendChild(svgElement('text', {
        x: valueX + (result.tcoNetApresIk < 0 ? -8 : 8), y: y + 18,
        'text-anchor': result.tcoNetApresIk < 0 ? 'end' : 'start', class: 'chart-value'
      }, money(result.tcoNetApresIk)));
    });
    svg.appendChild(svgElement('text', { x: left, y: height - 12, class: 'chart-note' }, 'Valeurs négatives possibles lorsque les IK dépassent les coûts.'));
    container.setAttribute('aria-label', 'TCO net après IK : ' + results.map(function (r) {
      return r.name + ', ' + money(r.tcoNetApresIk);
    }).join(' ; '));
  }

  function renderCumulativeTcoChart(container, allResults) {
    const results = (allResults || []).filter(function (result) { return result.includeInCharts; });
    const width = 900;
    const height = 410;
    const svg = setup(container, width, height, results.length ? '' : 'Aucun scénario inclus');
    if (!results.length) return;
    const left = 74;
    const right = 25;
    const top = 30;
    const bottom = 80;
    const values = [0];
    results.forEach(function (result) {
      result.seriesAnnuelles.forEach(function (point) { values.push(point.tcoNet); });
    });
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    const padding = Math.max(1, (max - min) * 0.08);
    const domainMin = min - padding;
    const domainMax = max + padding;
    const maxYears = Math.max.apply(null, results.map(function (result) { return result.seriesAnnuelles.length; }));
    const x = function (year) { return left + (year / Math.max(1, maxYears)) * (width - left - right); };
    const y = function (value) { return top + ((domainMax - value) / (domainMax - domainMin || 1)) * (height - top - bottom); };

    for (let tick = 0; tick <= 4; tick += 1) {
      const value = domainMin + (domainMax - domainMin) * tick / 4;
      const tickY = y(value);
      svg.appendChild(svgElement('line', { x1: left, y1: tickY, x2: width - right, y2: tickY, class: 'chart-grid' }));
      svg.appendChild(svgElement('text', { x: left - 10, y: tickY + 4, 'text-anchor': 'end', class: 'chart-tick' }, money(value)));
    }
    for (let year = 0; year <= maxYears; year += 1) {
      svg.appendChild(svgElement('text', { x: x(year), y: height - bottom + 24, 'text-anchor': 'middle', class: 'chart-tick' }, String(year)));
    }
    svg.appendChild(svgElement('text', { x: (left + width - right) / 2, y: height - 30, 'text-anchor': 'middle', class: 'chart-note' }, 'Année'));

    results.forEach(function (result, index) {
      const points = [{ year: 0, tcoNet: result.fraisAchat + result.taxes }].concat(result.seriesAnnuelles);
      const path = points.map(function (point, pointIndex) {
        return (pointIndex ? 'L' : 'M') + x(point.year) + ' ' + y(point.tcoNet);
      }).join(' ');
      svg.appendChild(svgElement('path', {
        d: path, fill: 'none', stroke: COLORS[index % COLORS.length],
        'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
      }));
      points.forEach(function (point) {
        const circle = svgElement('circle', { cx: x(point.year), cy: y(point.tcoNet), r: 4, fill: COLORS[index % COLORS.length] });
        circle.appendChild(svgElement('title', {}, result.name + ' · an ' + point.year + ' : ' + money(point.tcoNet)));
        svg.appendChild(circle);
      });
      const legendX = left + index * Math.min(220, (width - left - right) / Math.max(1, results.length));
      svg.appendChild(svgElement('line', { x1: legendX, y1: height - 8, x2: legendX + 22, y2: height - 8, stroke: COLORS[index % COLORS.length], 'stroke-width': 4 }));
      svg.appendChild(svgElement('text', { x: legendX + 28, y: height - 4, class: 'chart-label' }, shortName(result.name, 24)));
    });
    container.setAttribute('aria-label', 'Évolution annuelle du TCO net pour ' + results.map(function (r) { return r.name; }).join(', '));
  }

  function renderCostBreakdownChart(container, allResults) {
    const results = (allResults || []).filter(function (result) { return result.includeInCharts; });
    const width = 900;
    const height = Math.max(300, 130 + results.length * 62);
    const svg = setup(container, width, height, results.length ? '' : 'Aucun scénario inclus');
    if (!results.length) return;
    const components = [
      ['Décote', 'coutDecote', '#176b87'], ['Frais + taxes', 'fees', '#64748b'],
      ['Énergie', 'coutEnergieCumule', '#d97736'], ['Entretien', 'entretienCumule', '#2f855a'],
      ['Pneus', 'pneusCumule', '#6d5cae'], ['Assurance', 'assuranceCumule', '#be4b5e']
    ];
    const labelWidth = 165;
    const ikWidth = 120;
    const positiveStart = labelWidth + ikWidth + 25;
    const positiveWidth = width - positiveStart - 30;
    const maxGross = Math.max(1, Math.max.apply(null, results.map(function (r) { return r.tcoBrut; })));
    const maxIk = Math.max(1, Math.max.apply(null, results.map(function (r) { return r.ikRetenueCumulee; })));

    results.forEach(function (result, row) {
      const y = 34 + row * 62;
      svg.appendChild(svgElement('text', { x: labelWidth - 10, y: y + 18, 'text-anchor': 'end', class: 'chart-label' }, shortName(result.name, 22)));
      const ikBarWidth = result.ikRetenueCumulee / maxIk * ikWidth;
      const ikRect = svgElement('rect', { x: positiveStart - ikBarWidth, y: y, width: ikBarWidth, height: 26, rx: 4, fill: '#334155', opacity: 0.75 });
      ikRect.appendChild(svgElement('title', {}, 'IK déduites : ' + money(result.ikRetenueCumulee)));
      svg.appendChild(ikRect);
      let cursor = positiveStart;
      components.forEach(function (component) {
        const value = component[1] === 'fees' ? result.fraisAchat + result.taxes : result[component[1]];
        const segmentWidth = Math.max(0, value / maxGross * positiveWidth);
        if (segmentWidth > 0) {
          const rect = svgElement('rect', { x: cursor, y: y, width: segmentWidth, height: 26, fill: component[2] });
          rect.appendChild(svgElement('title', {}, component[0] + ' : ' + money(value)));
          svg.appendChild(rect);
        }
        cursor += segmentWidth;
      });
      svg.appendChild(svgElement('text', { x: Math.min(width - 5, cursor + 7), y: y + 18, class: 'chart-value' }, money(result.tcoNetApresIk) + ' net'));
    });
    svg.appendChild(svgElement('line', { x1: positiveStart, y1: 20, x2: positiveStart, y2: 34 + results.length * 62 - 25, class: 'chart-axis' }));
    svg.appendChild(svgElement('text', { x: positiveStart - 8, y: 20, 'text-anchor': 'end', class: 'chart-note' }, 'IK déduites ←'));
    svg.appendChild(svgElement('text', { x: positiveStart + 8, y: 20, class: 'chart-note' }, 'Coûts bruts →'));
    components.forEach(function (component, index) {
      const legendX = 20 + (index % 3) * 190;
      const legendY = height - 43 + Math.floor(index / 3) * 22;
      svg.appendChild(svgElement('rect', { x: legendX, y: legendY - 10, width: 12, height: 12, rx: 2, fill: component[2] }));
      svg.appendChild(svgElement('text', { x: legendX + 18, y: legendY, class: 'chart-label' }, component[0]));
    });
    container.setAttribute('aria-label', 'Décomposition des coûts bruts et IK déduites par scénario');
  }

  TCO.charts = {
    renderTcoBarChart: renderTcoBarChart,
    renderCumulativeTcoChart: renderCumulativeTcoChart,
    renderCostBreakdownChart: renderCostBreakdownChart
  };
}(window.TCO = window.TCO || {}));
