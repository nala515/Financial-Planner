// Charts for the Savings page: income vs. spending, and where the increase came from.
// Hand-built SVG like account-summary-chart.js, borrowing that file's acs- classes for the shared look.
// It only draws what it is given: the backend does the calculating (including spending_avg_12m).
//
// render(target, { points, includeGains, granularity }); points are oldest first, money in cents:
//   { heading, year, month|null, cashIncome, totalIncome, spending, cashSavings,
//     investmentGains, totalSavings, spendingAvg12|null }

const SavingsCharts = (() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const MARGIN = { top: 16, right: 16, bottom: 30, left: 64 };
  const BAR_MAX = 24;   // columns never fill their slot
  const BAR_GAP = 2;    // surface-colored gap between touching columns
  const ROUND = 4;      // rounded data end, square at the baseline

  let container = null;
  let panels = [];
  let data = null;

  //-----------------------------------------------------
  // Formatting, scales, small helpers
  //-----------------------------------------------------

  function formatDollars(cents) {
    return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  function formatSigned(cents) {
    return (cents > 0 ? "+" : "") + formatDollars(cents);
  }

  function formatCompact(dollars) {
    const abs = Math.abs(dollars);
    const trim = (n) => n.toFixed(2).replace(/\.?0+$/, "");
    let text;
    if (abs >= 1e9) text = trim(abs / 1e9) + "B";
    else if (abs >= 1e6) text = trim(abs / 1e6) + "M";
    else if (abs >= 1e3) text = trim(abs / 1e3) + "K";
    else text = trim(abs);
    return (dollars < 0 ? "-$" : "$") + text;
  }

  function niceStep(rawStep) {
    const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const fraction = rawStep / power;
    const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return nice * power;
  }

  // Always includes zero; reaches below it only as far as the data does.
  function linearScale(minValue, maxValue, plotHeight) {
    const low = Math.min(minValue, 0);
    const high = Math.max(maxValue, 0);
    const step = niceStep((high - low) / 5 || 1);
    const fifth = step / 5;
    const bottom = low < 0 ? Math.floor(low / fifth) * fifth : 0;
    const top = Math.ceil(high / step) * step || step;
    const ticks = [];
    for (let i = Math.ceil(bottom / step); i * step <= top + step / 2; i++) ticks.push(i * step);
    return {
      ticks,
      reachesBelowZero: bottom < 0,
      y: (v) => MARGIN.top + plotHeight - ((v - bottom) / (top - bottom)) * plotHeight,
    };
  }

  function svgEl(name, attrs, parent) {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
    if (parent) parent.appendChild(node);
    return node;
  }

  function htmlEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;   // labels are data, so never innerHTML
    return node;
  }

  // A column from yStart (its baseline side) to yEnd (its data end); only the data end is rounded, and only if asked.
  function barPath(x, w, yStart, yEnd, roundEnd) {
    const top = Math.min(yStart, yEnd);
    const bottom = Math.max(yStart, yEnd);
    const r = roundEnd ? Math.min(ROUND, bottom - top, w / 2) : 0;
    const right = x + w;
    if (yEnd <= yStart) {
      return `M${x} ${bottom} L${x} ${top + r} Q${x} ${top} ${x + r} ${top} L${right - r} ${top} Q${right} ${top} ${right} ${top + r} L${right} ${bottom} Z`;
    }
    return `M${x} ${top} L${right} ${top} L${right} ${bottom - r} Q${right} ${bottom} ${right - r} ${bottom} L${x + r} ${bottom} Q${x} ${bottom} ${x} ${bottom - r} Z`;
  }

  //-----------------------------------------------------
  // What each panel shows
  //-----------------------------------------------------

  function buildSpecs(d) {
    const includeGains = d.includeGains;
    const yearlyNote = d.granularity === "year" ? " Yearly view shows monthly averages." : "";

    const incomeVsSpending = {
      title: "Income vs. spending",
      note: (includeGains
        ? "Income includes investment gains. Spending comes from income and balance changes, so market moves don't affect it."
        : "Cash income only, without investment gains.") + yearlyNote,
      layout: "grouped",
      series: [
        { label: includeGains ? "Total income" : "Cash income", cls: "svc-c-income", value: (p) => (includeGains ? p.totalIncome : p.cashIncome) },
        { label: "Spending", cls: "svc-c-spending", value: (p) => p.spending },
      ],
      line: d.granularity === "month" ? { label: "12-month avg spending", value: (p) => p.spendingAvg12 } : null,
    };

    const increase = includeGains
      ? {
        title: "Where the increase came from",
        note: "Cash savings plus investment gains make up the total increase." + yearlyNote,
        layout: "stacked",
        series: [
          { label: "Cash savings", cls: "svc-c-cash", signed: true, value: (p) => p.cashSavings },
          { label: "Investment gains", cls: "svc-c-gains", signed: true, value: (p) => p.investmentGains },
        ],
        net: { label: "Total increase", value: (p) => p.totalSavings },
      }
      : {
        title: "Cash savings",
        note: "Cash income minus spending." + yearlyNote,
        layout: "stacked",
        series: [{ label: "Cash savings", cls: "svc-c-cash", signed: true, value: (p) => p.cashSavings }],
      };

    return [incomeVsSpending, increase];
  }

  function lineValue(spec, point) {
    return spec.line ? spec.line.value(point) : null;
  }

  //-----------------------------------------------------
  // Panels
  //-----------------------------------------------------

  function createPanel(parent) {
    const panel = htmlEl("div", "acs-chart");
    const title = htmlEl("h2", "acs-chart-title");
    const legend = htmlEl("div", "acs-legend");
    const wrap = htmlEl("div", "acs-chart-wrap");
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "acs-svg");
    svg.setAttribute("tabindex", "0");
    svg.setAttribute("role", "img");
    const tip = htmlEl("div", "acs-tooltip");
    tip.hidden = true;
    wrap.append(svg, tip);
    const note = htmlEl("p", "acs-chart-note");
    panel.append(title, legend, wrap, note);
    parent.appendChild(panel);

    const p = { title, legend, wrap, svg, tip, note, spec: null, points: [], geometry: null, hover: null };

    svg.addEventListener("keydown", (event) => onKeyDown(p, event));
    svg.addEventListener("blur", () => hideHover(p));
    document.addEventListener("pointerdown", (event) => {
      if (!wrap.contains(event.target)) hideHover(p);
    });
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => {
        if (p.spec && p.points.length && Math.abs(wrap.clientWidth - (p.geometry?.width || 0)) > 1) draw(p);
      }).observe(wrap);
    }
    return p;
  }

  function render(target, newData) {
    if (container !== target) {
      container = target;
      container.innerHTML = "";
      panels = [createPanel(container), createPanel(container)];
    }
    data = newData;
    buildSpecs(data).forEach((spec, i) => {
      const p = panels[i];
      p.spec = spec;
      p.points = data.points;
      p.hover = null;
      buildLegend(p);
      draw(p);
    });
  }

  function clear(target) {
    if (target) target.innerHTML = "";
    container = null;
    panels = [];
    data = null;
  }

  function hasLine(p) {
    return !!p.spec.line && p.points.some((pt) => lineValue(p.spec, pt) != null);
  }

  function buildLegend(p) {
    const { spec } = p;
    p.title.textContent = spec.title;
    p.note.textContent = spec.note;

    const items = spec.series.map((s) => ["acs-key-box " + s.cls, s.label]);
    if (spec.net) items.push(["acs-key-box svc-c-net", spec.net.label]);
    if (hasLine(p)) items.push(["acs-key-line acs-s-total", spec.line.label]);

    // A single series needs no legend: the title already says what is plotted.
    p.legend.hidden = items.length < 2;
    p.legend.innerHTML = "";
    items.forEach(([keyClass, label]) => {
      const item = htmlEl("span", "acs-legend-item");
      item.append(htmlEl("span", keyClass), htmlEl("span", null, label));
      p.legend.appendChild(item);
    });
  }

  //-----------------------------------------------------
  // Drawing
  //-----------------------------------------------------

  function draw(p) {
    const { spec, svg, wrap, points } = p;
    svg.innerHTML = "";
    hideHover(p);

    const n = points.length;
    svg.hidden = n === 0;
    if (n === 0) {
      p.geometry = null;
      return;
    }

    const width = Math.max(wrap.clientWidth, 300);
    const height = width < 520 ? 260 : 300;
    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotHeight = height - MARGIN.top - MARGIN.bottom;
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    // y range: everything that gets drawn (stacks add up per sign)
    const values = [];
    points.forEach((pt) => {
      if (spec.layout === "stacked") {
        let pos = 0;
        let neg = 0;
        spec.series.forEach((s) => {
          const v = s.value(pt) / 100;
          if (v >= 0) pos += v; else neg += v;
        });
        values.push(pos, neg);
      } else {
        spec.series.forEach((s) => values.push(s.value(pt) / 100));
      }
      const lv = lineValue(spec, pt);
      if (lv != null) values.push(lv / 100);
      if (spec.net) values.push(spec.net.value(pt) / 100);
    });
    const scale = linearScale(Math.min(...values), Math.max(...values), plotHeight);
    const slot = plotWidth / n;
    const cx = (i) => MARGIN.left + slot * (i + 0.5);
    const zeroY = scale.y(0);

    svg.setAttribute(
      "aria-label",
      `${spec.title} from ${points[0].heading} to ${points[n - 1].heading}. ` +
      `Use the arrow keys to move through the data. The table below the charts lists the same figures.`
    );

    // Gridlines and y labels
    scale.ticks.forEach((tick) => {
      const y = scale.y(tick);
      svgEl("line", { class: tick === 0 && scale.reachesBelowZero ? "acs-grid acs-zero" : "acs-grid", x1: MARGIN.left, x2: width - MARGIN.right, y1: y, y2: y }, svg);
      svgEl("text", { class: "acs-axis-text", x: MARGIN.left - 8, y: y + 4, "text-anchor": "end" }, svg).textContent = formatCompact(tick);
    });

    // X labels: every point when yearly, every January when monthly (or every quarter for short histories)
    let labelled;
    let tickText = (pt) => String(pt.year);
    if (points[0].month === null) {
      labelled = points.map((pt, i) => [pt, i]);
    } else {
      labelled = points.map((pt, i) => [pt, i]).filter(([pt]) => pt.month === 1);
      if (labelled.length < 3) {
        labelled = points.map((pt, i) => [pt, i]).filter(([pt]) => [1, 4, 7, 10].includes(pt.month));
        tickText = (pt) => pt.heading;
      }
    }
    let lastX = -Infinity;
    labelled.forEach(([pt, i]) => {
      const px = cx(i);
      if (px - lastX < 70 || px < MARGIN.left || px > width - MARGIN.right) return;
      lastX = px;
      svg.appendChild(svgEl("text", { class: "acs-axis-text", x: px, y: height - 8, "text-anchor": "middle" })).textContent = tickText(pt);
    });

    // Hover band sits behind the columns
    svgEl("rect", { class: "svc-hover-band", x: 0, y: MARGIN.top, width: slot, height: plotHeight, visibility: "hidden" }, svg);

    const drawBar = (x, w, yStart, yEnd, roundEnd, cls) => {
      if (Math.abs(yEnd - yStart) < 0.5) return;
      svgEl("path", { class: `svc-bar ${cls}`, d: barPath(x, w, yStart, yEnd, roundEnd) }, svg);
    };

    points.forEach((pt, i) => {
      if (spec.layout === "stacked") {
        const w = Math.max(Math.min(BAR_MAX, slot * 0.7), 2);
        const x = cx(i) - w / 2;
        const segments = spec.series.map((s) => ({ s, v: s.value(pt) / 100 })).filter((e) => e.v !== 0);
        const ups = segments.filter((e) => e.v > 0);
        const downs = segments.filter((e) => e.v < 0);
        let pos = 0;
        let neg = 0;
        ups.forEach((e, k) => {
          const from = scale.y(pos);
          pos += e.v;
          drawBar(x, w, from - (k === 0 ? 0 : BAR_GAP), scale.y(pos), k === ups.length - 1, e.s.cls);
        });
        downs.forEach((e, k) => {
          const from = scale.y(neg);
          neg += e.v;
          drawBar(x, w, from + (k === 0 ? 0 : BAR_GAP), scale.y(neg), k === downs.length - 1, e.s.cls);
        });
      } else {
        const count = spec.series.length;
        const w = Math.max(Math.min(BAR_MAX, (slot * 0.8 - BAR_GAP * (count - 1)) / count), 1.5);
        const start = cx(i) - (count * w + (count - 1) * BAR_GAP) / 2;
        spec.series.forEach((s, j) => {
          drawBar(start + j * (w + BAR_GAP), w, zeroY, scale.y(s.value(pt) / 100), true, s.cls);
        });
      }
    });

    // Average line (skips months without enough history)
    if (spec.line) {
      let d = "";
      let penDown = false;
      points.forEach((pt, i) => {
        const v = lineValue(spec, pt);
        if (v == null) { penDown = false; return; }
        d += `${penDown ? "L" : "M"}${cx(i).toFixed(1)} ${scale.y(v / 100).toFixed(1)} `;
        penDown = true;
      });
      if (d) svgEl("path", { class: "acs-line acs-s-total", d: d.trim() }, svg);
    }

    // Net marker on stacked columns
    if (spec.net) {
      points.forEach((pt, i) => {
        svgEl("circle", { class: "acs-dot acs-dot-total", cx: cx(i), cy: scale.y(spec.net.value(pt) / 100), r: 4 }, svg);
      });
    }

    p.geometry = { width, plotWidth, slot, cx, y: scale.y, n };

    if (spec.line) {
      svgEl("circle", { class: "acs-hover-dot acs-dot-total svc-hover-dot", r: 4, cx: 0, cy: 0, visibility: "hidden" }, svg);
    }

    const overlay = svgEl("rect", { class: "acs-overlay", x: MARGIN.left, y: MARGIN.top, width: plotWidth, height: plotHeight }, svg);
    overlay.addEventListener("pointermove", (event) => onPointer(p, event));
    overlay.addEventListener("pointerdown", (event) => onPointer(p, event));
    overlay.addEventListener("pointerleave", (event) => { if (event.pointerType !== "touch") hideHover(p); });
  }

  //-----------------------------------------------------
  // Hover and keyboard
  //-----------------------------------------------------

  function onPointer(p, event) {
    if (!p.geometry) return;
    const box = p.svg.getBoundingClientRect();
    const index = Math.floor((event.clientX - box.left - MARGIN.left) / p.geometry.slot);
    showHover(p, Math.min(Math.max(index, 0), p.geometry.n - 1));
  }

  function onKeyDown(p, event) {
    if (!p.geometry) return;
    const step = event.shiftKey ? 12 : 1;
    let index = p.hover === null ? p.geometry.n - 1 : p.hover;

    if (event.key === "ArrowRight") index += step;
    else if (event.key === "ArrowLeft") index -= step;
    else if (event.key === "Home") index = 0;
    else if (event.key === "End") index = p.geometry.n - 1;
    else if (event.key === "Escape") { hideHover(p); return; }
    else return;

    event.preventDefault();
    showHover(p, Math.min(Math.max(index, 0), p.geometry.n - 1));
  }

  function hideHover(p) {
    p.hover = null;
    if (p.tip) p.tip.hidden = true;
    if (p.svg) {
      p.svg.querySelectorAll(".svc-hover-band, .svc-hover-dot").forEach((node) => node.setAttribute("visibility", "hidden"));
    }
  }

  function showHover(p, index) {
    p.hover = index;
    const pt = p.points[index];
    const { spec, geometry: g } = p;
    const px = g.cx(index);

    const band = p.svg.querySelector(".svc-hover-band");
    band.setAttribute("x", MARGIN.left + g.slot * index);
    band.setAttribute("visibility", "visible");

    const dot = p.svg.querySelector(".svc-hover-dot");
    if (dot) {
      const lv = lineValue(spec, pt);
      if (lv == null) {
        dot.setAttribute("visibility", "hidden");
      } else {
        dot.setAttribute("cx", px);
        dot.setAttribute("cy", g.y(lv / 100));
        dot.setAttribute("visibility", "visible");
      }
    }

    // Tooltip: the value leads, the label follows
    const rows = spec.series.map((s) => ["acs-key-box " + s.cls, s.label, s.signed ? formatSigned(s.value(pt)) : formatDollars(s.value(pt))]);
    if (spec.net) rows.push(["acs-key-box svc-c-net", spec.net.label, formatSigned(spec.net.value(pt))]);
    const lv = lineValue(spec, pt);
    if (lv != null) rows.push(["acs-key-line acs-s-total", spec.line.label, formatDollars(lv)]);

    p.tip.innerHTML = "";
    p.tip.appendChild(htmlEl("div", "acs-tooltip-heading", pt.heading));
    rows.forEach(([keyClass, label, text]) => {
      const row = htmlEl("div", "acs-tooltip-row");
      row.append(htmlEl("span", keyClass), htmlEl("strong", null, text), htmlEl("span", "acs-tooltip-label", label));
      p.tip.appendChild(row);
    });

    p.tip.hidden = false;
    const tipWidth = p.tip.offsetWidth;
    const flip = px + 14 + tipWidth > g.width - 4;
    p.tip.style.left = `${Math.max(4, flip ? px - 14 - tipWidth : px + 14)}px`;
    p.tip.style.top = `${MARGIN.top + 8}px`;
  }

  return { render, clear };
})();
