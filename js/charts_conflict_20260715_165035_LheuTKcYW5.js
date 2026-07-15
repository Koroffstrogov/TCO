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

  function resultTitle(result) {
    return String(result.displayTitle || result.name || 'Sans nom');
  }

  function calculateSeriesChartLayout(resultCount) {
    const legendRows = Math.max(0, Math.floor(Number(resultCount) || 0));
    const top = 30;
    const plotHeight = 300;
    const legendRowHeight = 24;
    const plotBottom = top + plotHeight;
    const legendStartY = plotBottom + 78;
    const height = legendStartY + legendRows * legendRowHeight - 8;
    return {
      top: top,
      plotHeight: plotHeight,
      plotBottom: plotBottom,
      bottom: height - plotBottom,
      height: height,
      legendRowHeight: legendRowHeight,
      legendStartY: legendStartY
    };
  }

  function renderTcoBarChart(container, allResults) {
    const results = (allResults || []).filter(function (result) { return result.includeInCharts; });
    const width = 760;
    const height = Math.max(280, 105 + results.length * 62);
    const svg = setup(container, width, height, results.length ? '' : 'Aucun scénario inclus');
    if (!results.length) return;

    const left = 250;
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
      const scenarioLabel = svgElement('text', {
        x: left - 12, y: y + 16, 'text-anchor': 'end', class: 'chart-label'
      }, shortName(resultTitle(result), 38));
      scenarioLabel.appendChild(svgElement('title', {}, resultTitle(result)));
      svg.appendChild(scenarioLabel);
      const rect = svgElement('rect', {
        x: startX, y: y, width: barWidth, height: 26, rx: 5,
        fill: COLORS[index % COLORS.length], class: 'chart-bar'
      });
      rect.appendChild(svgElement('title', {}, resultTitle(result) + ' : ' + money(result.tcoNetApresIk)));
      svg.appendChild(rect);
      svg.appendChild(svgElement('text', {
        x: valueX + (result.tcoNetApresIk < 0 ? -8 : 8), y: y + 18,
        'text-anchor': result.tcoNetApresIk < 0 ? 'end' : 'start', class: 'chart-value'
      }, money(result.tcoNetApresIk)));
    });
    svg.appendChild(svgElement('text', { x: left, y: height - 12, class: 'chart-note' }, 'Valeurs négatives possibles lorsque la reprise et les IK dépassent les coûts.'));
    container.setAttribute('aria-label', 'TCO net après reprise et IK : ' + results.map(function (r) {
      return resultTitle(r) + ', ' + money(r.tcoNetApresIk);
    }).join(' ; '));
  }

  function renderCumulativeTcoChart(container, allResults) {
    const results = (allResults || []).filter(function (result) { return result.includeInCharts; });
    const width = 900;
    const layout = calculateSeriesChartLayout(results.length);
    const height = layout.height;
    const svg = setup(container, width, height, results.length ? '' : 'Aucun scénario inclus');
    if (!results.length) return;
    const left = 74;
    const right = 25;
    const top = layout.top;
    const bottom = layout.bottom;
    const values = [0];
    results.forEach(function (result) {
      values.push(result.fraisAchat + result.taxes - result.montantReprise);
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
      svg.appendChild(svgElement('text', { x: x(year), y: layout.plotBottom + 24, 'text-anchor': 'middle', class: 'chart-tick' }, String(year)));
    }
    svg.appendChild(svgElement('text', { x: (left + width - right) / 2, y: layout.plotBottom + 48, 'text-anchor': 'middle', class: 'chart-note' }, 'Année'));

    results.forEach(function (result, index) {
      const points = [{ year: 0, tcoNet: result.fraisAchat + result.taxes - result.montantReprise }].concat(result.seriesAnnuelles);
      const path = points.map(function (point, pointIndex) {
        return (pointIndex ? 'L' : 'M') + x(point.year) + ' ' + y(point.tcoNet);
      }).join(' ');
      svg.appendChild(svgElement('path', {
        d: path, fill: 'none', stroke: COLORS[index % COLORS.length],
        'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
      }));
      points.forEach(function (point) {
        const circle = svgElement('circle', { cx: x(point.year), cy: y(point.tcoNet), r: 4, fill: COLORS[index % COLORS.length] });
        circle.appendChild(svgElement('title', {}, resultTitle(result) + ' · an ' + point.year + ' : ' + money(point.tcoNet)));
        svg.appendChild(circle);
      });
      const legendX = left;
      const legendY = layout.legendStartY + index * layout.legendRowHeight;
      svg.appendChild(svgElement('line', { x1: legendX, y1: legendY - 4, x2: legendX + 22, y2: legendY - 4, stroke: COLORS[index % COLORS.length], 'stroke-width': 4 }));
      const legend = svgElement('text', { x: legendX + 28, y: legendY, class: 'chart-label' }, resultTitle(result));
      legend.appendChild(svgElement('title', {}, resultTitle(result)));
      svg.appendChild(legend);
    });
    container.setAttribute('aria-label', 'Évolution annuelle du TCO net pour ' + results.map(function (r) { return resultTitle(r); }).join(', '));
  }

  function renderResidualValueChart(container, allResults) {
    const results = (allResults || []).filter(function (result) { return result.includeInCharts; });
    const width = 900;
    const layout = calculateSeriesChartLayout(results.length);
    const height = layout.height;
    const svg = setup(container, width, height, results.length ? '' : 'Aucun scénario inclus');
    if (!results.length) return;
    const left = 74;
    const right = 25;
    const top = layout.top;
    const bottom = layout.bottom;
    const values = [];
    results.forEach(function (result) {
      values.push(result.assietteValeur);
      result.seriesAnnuelles.forEach(function (point) { values.push(point.valeurResiduelle); });
    });
    const domainMax = Math.max(1, Math.max.apply(null, values)) * 1.08;
    const maxYears = Math.max.apply(null, results.map(function (result) { return result.seriesAnnuelles.length; }));
    const x = function (year) { return left + (year / Math.max(1, maxYears)) * (width - left - right); };
    const y = function (value) { return top + ((domainMax - Math.max(0, value)) / domainMax) * (height - top - bottom); };

    for (let tick = 0; tick <= 4; tick += 1) {
      const value = domainMax * tick / 4;
      const tickY = y(value);
      svg.appendChild(svgElement('line', { x1: left, y1: tickY, x2: width - right, y2: tickY, class: 'chart-grid' }));
      svg.appendChild(svgElement('text', { x: left - 10, y: tickY + 4, 'text-anchor': 'end', class: 'chart-tick' }, money(value)));
    }
    for (let year = 0; year <= maxYears; year += 1) {
      svg.appendChild(svgElement('text', { x: x(year), y: layout.plotBottom + 24, 'text-anchor': 'middle', class: 'chart-tick' }, String(year)));
    }
    svg.appendChild(svgElement('text', { x: (left + width - right) / 2, y: layout.plotBottom + 48, 'text-anchor': 'middle', class: 'chart-note' }, 'Année de possession'));

    results.forEach(function (result, index) {
      const points = [{ year: 0, valeurResiduelle: result.assietteValeur, age: result.ageAchat }].concat(result.seriesAnnuelles);
      const path = points.map(function (point, pointIndex) {
        return (pointIndex ? 'L' : 'M') + x(point.year) + ' ' + y(point.valeurResiduelle);
      }).join(' ');
      svg.appendChild(svgElement('path', {
        d: path, fill: 'none', stroke: COLORS[index % COLORS.length],
        'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
      }));
      points.forEach(function (point) {
        const circle = svgElement('circle', {
          cx: x(point.year), cy: y(point.valeurResiduelle), r: 4,
          fill: COLORS[index % COLORS.length]
        });
        const ageLabel = point.age === null || point.age === undefined ? '' : ' · âge ' + point.age + ' ans';
        circle.appendChild(svgElement('title', {}, resultTitle(result) + ' · an ' + point.year + ageLabel + ' : ' + money(point.valeurResiduelle)));
        svg.appendChild(circle);
      });
      const legendX = left;
      const legendY = layout.legendStartY + index * layout.legendRowHeight;
      svg.appendChild(svgElement('line', { x1: legendX, y1: legendY - 4, x2: legendX + 22, y2: legendY - 4, stroke: COLORS[index % COLORS.length], 'stroke-width': 4 }));
      const legend = svgElement('text', { x: legendX + 28, y: legendY, class: 'chart-label' }, resultTitle(result));
      legend.appendChild(svgElement('title', {}, resultTitle(result)));
      svg.appendChild(legend);
    });
    container.setAttribute('aria-label', 'Valeur résiduelle à l’horizon : ' + results.map(function (result) {
      return resultTitle(result) + ', ' + money(result.valeurResiduelle);
    }).join(' ; '));
  }

  function calculateCostBreakdownGeometry(results, width) {
    const labelWidth = 250;
    const plotLeft = labelWidth + 10;
    const plotRight = width - 30;
    const plotWidth = plotRight - plotLeft;
    const maxGross = Math.max(0, Math.max.apply(null, results.map(function (result) {
      return Number(result.tcoBrut) || 0;
    })));
    const maxDeductions = Math.max(0, Math.max.apply(null, results.map(function (result) {
      return (Number(result.montantReprise) || 0) + (Number(result.ikRetenueCumulee) || 0);
    })));
    const scale = plotWidth / (maxGross + maxDeductions || 1);
    return {
      labelWidth: labelWidth,
      plotLeft: plotLeft,
      plotRight: plotRight,
      plotWidth: plotWidth,
      maxGross: maxGross,
      maxDeductions: maxDeductions,
      scale: scale,
      zeroX: plotLeft + maxDeductions * scale
    };
  }

  function renderCostBreakdownChart(container, allResults) {
    const results = (allResults || []).filter(function (result) { return result.includeInCharts; });
    const width = 900;
    const height = Math.max(350, 172 + results.length * 62);
    const svg = setup(container, width, height, results.length ? '' : 'Aucun scénario inclus');
    if (!results.length) return;
    const components = [
      ['Décote', 'coutDecote', '#176b87'], ['Frais + taxes', 'fees', '#64748b'],
      ['Énergie', 'coutEnergieCumule', '#d97736'], ['Entretien annuel & CT hors pneus', 'entretienCumule', '#2f855a'],
      ['Pneus', 'pneusCumule', '#6d5cae'], ['Assurance', 'assuranceCumule', '#be4b5e']
    ];
    const geometry = calculateCostBreakdownGeometry(results, width);

    svg.appendChild(svgElement('line', {
      x1: geometry.zeroX, y1: 30, x2: geometry.zeroX,
      y2: 48 + results.length * 62 - 30, class: 'chart-axis'
    }));
    svg.appendChild(svgElement('text', {
      x: geometry.zeroX, y: 17, 'text-anchor': 'middle', class: 'chart-tick'
    }, '0 €'));
    if (geometry.zeroX - geometry.plotLeft > 90) {
      svg.appendChild(svgElement('text', {
        x: geometry.plotLeft, y: 17, 'text-anchor': 'start', class: 'chart-tick'
      }, money(-geometry.maxDeductions)));
    }
    if (geometry.plotRight - geometry.zeroX > 90) {
      svg.appendChild(svgElement('text', {
        x: geometry.plotRight, y: 17, 'text-anchor': 'end', class: 'chart-tick'
      }, money(geometry.maxGross)));
    }
    svg.appendChild(svgElement('text', { x: geometry.zeroX - 8, y: 34, 'text-anchor': 'end', class: 'chart-note' }, 'Reprise + IK déduites ←'));
    svg.appendChild(svgElement('text', { x: geometry.zeroX + 8, y: 34, class: 'chart-note' }, 'Coûts bruts →'));

    results.forEach(function (result, row) {
      const y = 48 + row * 62;
      const scenarioLabel = svgElement('text', {
        x: geometry.labelWidth - 10, y: y + 17, 'text-anchor': 'end', class: 'chart-label'
      }, shortName(resultTitle(result), 38));
      scenarioLabel.appendChild(svgElement('title', {}, resultTitle(result)));
      svg.appendChild(scenarioLabel);
      let deductionCursor = geometry.zeroX;
      [
        ['Reprise', result.montantReprise, '#0f766e'],
        ['IK', result.ikRetenueCumulee, '#334155']
      ].forEach(function (deduction) {
        const segmentWidth = Math.max(0, Number(deduction[1]) || 0) * geometry.scale;
        deductionCursor -= segmentWidth;
        if (segmentWidth > 0) {
          const rect = svgElement('rect', { x: deductionCursor, y: y, width: segmentWidth, height: 24, fill: deduction[2], opacity: 0.82 });
          rect.appendChild(svgElement('title', {}, resultTitle(result) + ' · ' + deduction[0] + ' déduite : ' + money(deduction[1])));
          svg.appendChild(rect);
        }
      });
      let cursor = geometry.zeroX;
      components.forEach(function (component) {
        const value = component[1] === 'fees' ? result.fraisAchat + result.taxes : result[component[1]];
        const segmentWidth = Math.max(0, Number(value) || 0) * geometry.scale;
        if (segmentWidth > 0) {
          const rect = svgElement('rect', { x: cursor, y: y, width: segmentWidth, height: 24, fill: component[2] });
          rect.appendChild(svgElement('title', {}, resultTitle(result) + ' · ' + component[0] + ' : ' + money(value)));
          svg.appendChild(rect);
        }
        cursor += segmentWidth;
      });
      const netX = geometry.zeroX + (Number(result.tcoNetApresIk) || 0) * geometry.scale;
      svg.appendChild(svgElement('line', {
        x1: netX, y1: y - 4, x2: netX, y2: y + 30, class: 'chart-net-marker'
      }));
      const netPoint = svgElement('circle', {
        cx: netX, cy: y + 12, r: 4, class: 'chart-net-point'
      });
      netPoint.appendChild(svgElement('title', {}, resultTitle(result) + ' · Résultat net : ' + money(result.tcoNetApresIk)));
      svg.appendChild(netPoint);
      const nearLeft = netX < geometry.plotLeft + 75;
      const nearRight = netX > geometry.plotRight - 75;
      svg.appendChild(svgElement('text', {
        x: netX + (nearLeft ? 5 : (nearRight ? -5 : 0)), y: y + 43,
        'text-anchor': nearLeft ? 'start' : (nearRight ? 'end' : 'middle'), class: 'chart-value chart-net-value'
      }, money(result.tcoNetApresIk) + ' net'));
    });
    const legendItems = [['Reprise', '', '#0f766e'], ['IK', '', '#334155']].concat(components)
      .concat([['Résultat net', '', '#17242b', 'net']]);
    legendItems.forEach(function (component, index) {
      const legendX = 20 + (index % 3) * 285;
      const legendY = height - 54 + Math.floor(index / 3) * 22;
      if (component[3] === 'net') {
        svg.appendChild(svgElement('line', {
          x1: legendX + 6, y1: legendY - 12, x2: legendX + 6, y2: legendY + 2, class: 'chart-net-marker'
        }));
        svg.appendChild(svgElement('circle', {
          cx: legendX + 6, cy: legendY - 5, r: 3, class: 'chart-net-point'
        }));
      } else {
        svg.appendChild(svgElement('rect', { x: legendX, y: legendY - 10, width: 12, height: 12, rx: 2, fill: component[2] }));
      }
      svg.appendChild(svgElement('text', { x: legendX + 18, y: legendY, class: 'chart-label' }, component[0]));
    });
    container.setAttribute('aria-label', 'Décomposition à échelle commune des coûts bruts, reprises et IK déduites, avec position du résultat net pour ' +
      results.map(function (result) { return resultTitle(result); }).join(' ; '));
  }

  TCO.charts = {
    renderTcoBarChart: renderTcoBarChart,
    renderCumulativeTcoChart: renderCumulativeTcoChart,
    renderResidualValueChart: renderResidualValueChart,
    renderCostBreakdownChart: renderCostBreakdownChart,
    calculateCostBreakdownGeometry: calculateCostBreakdownGeometry,
    calculateSeriesChartLayout: calculateSeriesChartLayout
  };
}(window.TCO = window.TCO || {}));
