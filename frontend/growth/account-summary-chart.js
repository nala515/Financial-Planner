// Chart for the Account Summary page.
// Invested accounts: a gray area for what was put in (opening balances + contributions), a green/red band
// for the gain/loss on top of it, and a blue line for the balance. Cash and credit accounts add an orange
// line, and a mixed selection also gets a total line. It only draws what it is given: the backend does
// all of the calculating, and summary.js hands over already-normalized points.
//
// render(target, { points, hasInvested, hasCash }) where each point is
//   { year, month|null, heading, invested, cash, total, moneyIn, gain }   (money in cents, oldest first)

const AccountSummaryChart = (() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const MARGIN = { top: 16, right: 16, bottom: 30, left: 64 };

  let container = null;
  let elTitle, elLegend, elWrap, elSvg, elTooltip, elNote;
  let data = null;
  let hoverIndex = null;
  let geometry = null;      // scales and sizes from the last draw
  let resizeObserver = null;

  //-----------------------------------------------------
  // Number formatting
  //-----------------------------------------------------

  function formatDollars(cents) {
    return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  function formatSignedDollars(cents) {
    return (cents > 0 ? "+" : "") + formatDollars(cents);
  }

  // 1200 -> "$1.2K", 4500000 -> "$4.5M"
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

  //-----------------------------------------------------
  // Scales
  //-----------------------------------------------------

  // Round tick spacing to 1, 2 or 5 times a power of ten.
  function niceStep(rawStep) {
    const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const fraction = rawStep / power;
    const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return nice * power;
  }

  // Always includes zero, and handles negative values (credit cards, losses). The axis only reaches
  // below zero as far as the data does (in fifths of a tick step), so a slightly negative balance
  // doesn't open up a whole empty tick.
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

  //-----------------------------------------------------
  // SVG helpers
  //-----------------------------------------------------

  function svgEl(name, attrs, parent) {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
    if (parent) parent.appendChild(node);
    return node;
  }

  function pathFor(points) {
    return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  }

  function polygonFor(points) {
    return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  }

  function htmlEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;   // labels are data, so never innerHTML
    return node;
  }

  //-----------------------------------------------------
  // What gets drawn for this selection
  //-----------------------------------------------------

  // One entry per line, in legend order. Cash alone is a single series, so it just reads "Balance".
  function lineSeries(hasInvested, hasCash) {
    const series = [];
    if (hasInvested) {
      series.push({ key: "invested", label: hasCash ? "Invested balance" : "Balance", cls: "balance", value: (p) => p.invested });
    }
    if (hasCash) {
      series.push({ key: "cash", label: hasInvested ? "Cash & credit" : "Balance", cls: hasInvested ? "cash" : "balance", value: (p) => p.cash });
    }
    if (hasInvested && hasCash) {
      series.push({ key: "total", label: "Total", cls: "total", value: (p) => p.total });
    }
    return series;
  }

  //-----------------------------------------------------
  // Skeleton (built once) and drawing (rebuilt on every render/resize)
  //-----------------------------------------------------

  function buildSkeleton() {
    container.innerHTML = "";
    container.classList.add("acs-chart");

    elTitle = htmlEl("h2", "acs-chart-title");
    elLegend = htmlEl("div", "acs-legend");
    elWrap = htmlEl("div", "acs-chart-wrap");

    elSvg = document.createElementNS(SVG_NS, "svg");
    elSvg.setAttribute("class", "acs-svg");
    elSvg.setAttribute("tabindex", "0");
    elSvg.setAttribute("role", "img");

    elTooltip = htmlEl("div", "acs-tooltip");
    elTooltip.hidden = true;

    elWrap.append(elSvg, elTooltip);
    elNote = htmlEl("p", "acs-chart-note");
    container.append(elTitle, elLegend, elWrap, elNote);

    elSvg.addEventListener("keydown", onKeyDown);
    elSvg.addEventListener("blur", hideHover);

    // Tapping anywhere outside the chart dismisses the readout on touch screens.
    document.addEventListener("pointerdown", (event) => {
      if (elWrap && !elWrap.contains(event.target)) hideHover();
    });

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        if (data && data.points.length && Math.abs(elWrap.clientWidth - (geometry?.width || 0)) > 1) draw();
      });
      resizeObserver.observe(elWrap);
    }
  }

  function render(target, newData) {
    if (container !== target) {
      container = target;
      buildSkeleton();
    }
    data = newData;
    hoverIndex = null;
    buildLegend();
    draw();
  }

  // Empties the chart (nothing selected, or no data); the next render rebuilds it.
  function clear(target) {
    if (target) target.innerHTML = "";
    if (target) target.classList.remove("acs-chart");
    container = null;
    data = null;
    geometry = null;
  }

  function buildLegend() {
    const lines = lineSeries(data.hasInvested, data.hasCash);
    const hasLoss = data.points.some((p) => p.gain < 0);

    elTitle.textContent = data.hasInvested ? "Contributed vs. grown" : "Balance over time";
    elNote.textContent = data.hasInvested
      ? "Contributed includes each account's opening balance (its first entry). Gain is balance minus contributed."
      : "";
    elNote.hidden = !data.hasInvested;

    elLegend.innerHTML = "";
    const items = [];
    lines.forEach((s) => items.push(["line", `acs-s-${s.cls}`, s.label]));
    if (data.hasInvested) {
      items.push(["box", "acs-box-contrib", "Contributed"]);
      items.push(["box", "acs-box-gain", "Gain"]);
      if (hasLoss) items.push(["box", "acs-box-loss", "Loss"]);
    }

    // A single series needs no legend: the title already says what is plotted.
    elLegend.hidden = items.length < 2;
    items.forEach(([shape, cls, label]) => {
      const item = htmlEl("span", "acs-legend-item");
      item.append(htmlEl("span", shape === "line" ? `acs-key-line ${cls}` : `acs-key-box ${cls}`), htmlEl("span", null, label));
      elLegend.appendChild(item);
    });
  }

  function draw() {
    elSvg.innerHTML = "";
    hideHover();

    const points = data.points;
    const n = points.length;
    const hasData = n > 0;
    elSvg.hidden = !hasData;
    if (!hasData) {
      geometry = null;
      return;
    }

    const width = Math.max(elWrap.clientWidth, 300);
    const height = width < 520 ? 280 : 340;
    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotHeight = height - MARGIN.top - MARGIN.bottom;
    elSvg.setAttribute("width", width);
    elSvg.setAttribute("height", height);
    elSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const lines = lineSeries(data.hasInvested, data.hasCash);
    const dollars = (cents) => cents / 100;

    // Everything that gets plotted decides the y range
    const values = [];
    points.forEach((p) => {
      lines.forEach((s) => values.push(dollars(s.value(p))));
      if (data.hasInvested) values.push(dollars(p.moneyIn));
    });
    const scale = linearScale(Math.min(...values), Math.max(...values), plotHeight);
    const x = (i) => MARGIN.left + (n === 1 ? plotWidth / 2 : (i / (n - 1)) * plotWidth);
    const zeroY = scale.y(0);

    elSvg.setAttribute(
      "aria-label",
      `${elTitle.textContent} from ${points[0].heading} to ${points[n - 1].heading}. ` +
      `Use the arrow keys to move through the data. The table below the chart lists the same figures.`
    );

    // Horizontal gridlines and y labels; zero gets a slightly stronger line when the range goes below it
    scale.ticks.forEach((tick) => {
      const y = scale.y(tick);
      svgEl("line", { class: tick === 0 && scale.reachesBelowZero ? "acs-grid acs-zero" : "acs-grid", x1: MARGIN.left, x2: width - MARGIN.right, y1: y, y2: y }, elSvg);
      svgEl("text", { class: "acs-axis-text", x: MARGIN.left - 8, y: y + 4, "text-anchor": "end" }, elSvg).textContent = formatCompact(tick);
    });

    // X labels: yearly points are labeled by year; monthly ones every January, or every quarter when the history is short
    let labelled;
    let tickText;
    if (points[0].month === null) {
      labelled = points.map((p, i) => [p, i]);
      tickText = (p) => String(p.year);
    } else {
      labelled = points.map((p, i) => [p, i]).filter(([p]) => p.month === 1);
      tickText = (p) => String(p.year);
      if (labelled.length < 3) {
        labelled = points.map((p, i) => [p, i]).filter(([p]) => [1, 4, 7, 10].includes(p.month));
        tickText = (p) => p.heading;
      }
    }
    const minGap = 70;
    let lastX = -Infinity;
    labelled.forEach(([p, i]) => {
      const px = x(i);
      if (px - lastX < minGap || px < MARGIN.left || px > width - MARGIN.right) return;
      lastX = px;
      svgEl("text", { class: "acs-axis-text", x: px, y: height - 8, "text-anchor": "middle" }, elSvg).textContent = tickText(p);
    });

    if (data.hasInvested) {
      drawContributedAndGain(points, n, x, scale, zeroY, dollars);
    }

    // Lines: drawn back to front so the first legend entry sits on top
    [...lines].reverse().forEach((s) => {
      const coords = points.map((p, i) => [x(i), scale.y(dollars(s.value(p)))]);
      if (n === 1) {
        svgEl("circle", { class: `acs-dot acs-dot-${s.cls}`, cx: coords[0][0], cy: coords[0][1], r: 4 }, elSvg);
      } else {
        svgEl("path", { class: `acs-line acs-s-${s.cls}`, d: pathFor(coords) }, elSvg);
      }
    });

    geometry = { width, height, plotWidth, plotHeight, n, x, y: scale.y, lines };

    // Hover layer: guide line, a dot for every line, and a transparent target covering the whole plot
    svgEl("line", { class: "acs-hover-line", x1: 0, x2: 0, y1: MARGIN.top, y2: MARGIN.top + plotHeight, visibility: "hidden" }, elSvg);
    const dotClasses = lines.map((s) => ["line-" + s.key, s.cls]);
    if (data.hasInvested) dotClasses.push(["contrib", "contrib"]);
    dotClasses.forEach(([id, cls]) => {
      svgEl("circle", { class: `acs-hover-dot acs-dot-${cls}`, "data-dot": id, r: 4, cx: 0, cy: 0, visibility: "hidden" }, elSvg);
    });

    const overlay = svgEl("rect", { class: "acs-overlay", x: MARGIN.left, y: MARGIN.top, width: plotWidth, height: plotHeight }, elSvg);
    overlay.addEventListener("pointermove", onPointerMove);
    overlay.addEventListener("pointerdown", onPointerMove);
    // A finger lifting off the screen also fires pointerleave; keep the readout up for touch.
    overlay.addEventListener("pointerleave", (event) => { if (event.pointerType !== "touch") hideHover(); });
  }

  // The gray "contributed" area, and the band between it and the balance (green above it, red below it).
  function drawContributedAndGain(points, n, x, scale, zeroY, dollars) {
    const contributed = points.map((p, i) => [x(i), scale.y(dollars(p.moneyIn))]);

    if (n === 1) {
      svgEl("circle", { class: "acs-dot acs-dot-contrib", cx: contributed[0][0], cy: contributed[0][1], r: 4 }, elSvg);
      return;
    }

    const areaPoints = [[contributed[0][0], zeroY], ...contributed, [contributed[n - 1][0], zeroY]];
    svgEl("polygon", { class: "acs-area-contrib", points: polygonFor(areaPoints) }, elSvg);

    // Walk the months, splitting the band where the balance crosses the contributed line
    const diffs = points.map((p) => p.invested - p.moneyIn);
    const runs = [];
    let run = null;
    let lastKind = "gain";
    const add = (kind, px, yBalance, yContributed) => {
      if (!run || run.kind !== kind) {
        run = { kind, upper: [], lower: [] };
        runs.push(run);
      }
      run.upper.push([px, yBalance]);
      run.lower.push([px, yContributed]);
    };

    for (let i = 0; i < n; i++) {
      const d = diffs[i];
      const kind = d > 0 ? "gain" : d < 0 ? "loss" : lastKind;

      if (i > 0 && kind !== lastKind) {
        const prev = diffs[i - 1];
        const t = prev === 0 ? 0 : prev / (prev - d);
        const crossX = x(i - 1) + t * (x(i) - x(i - 1));
        const crossY = scale.y(dollars(points[i - 1].moneyIn + t * (points[i].moneyIn - points[i - 1].moneyIn)));
        add(lastKind, crossX, crossY, crossY);
        add(kind, crossX, crossY, crossY);
      }

      add(kind, x(i), scale.y(dollars(points[i].invested)), scale.y(dollars(points[i].moneyIn)));
      lastKind = kind;
    }

    runs.forEach((r) => {
      if (r.upper.length < 2) return;
      svgEl("polygon", { class: `acs-area-${r.kind}`, points: polygonFor([...r.upper, ...r.lower.slice().reverse()]) }, elSvg);
    });

    svgEl("path", { class: "acs-line acs-s-contrib", d: pathFor(contributed) }, elSvg);
  }

  //-----------------------------------------------------
  // Hover and keyboard
  //-----------------------------------------------------

  function indexFromEvent(event) {
    if (!geometry) return null;
    const box = elSvg.getBoundingClientRect();
    const share = (event.clientX - box.left - MARGIN.left) / geometry.plotWidth;
    const index = Math.round(share * (geometry.n - 1));
    return Math.min(Math.max(index, 0), geometry.n - 1);
  }

  function onPointerMove(event) {
    const index = indexFromEvent(event);
    if (index !== null) showHover(index);
  }

  function onKeyDown(event) {
    if (!geometry) return;
    const step = event.shiftKey ? 12 : 1;
    let index = hoverIndex === null ? geometry.n - 1 : hoverIndex;

    if (event.key === "ArrowRight") index += step;
    else if (event.key === "ArrowLeft") index -= step;
    else if (event.key === "Home") index = 0;
    else if (event.key === "End") index = geometry.n - 1;
    else if (event.key === "Escape") { hideHover(); return; }
    else return;

    event.preventDefault();
    showHover(Math.min(Math.max(index, 0), geometry.n - 1));
  }

  function hideHover() {
    hoverIndex = null;
    if (elTooltip) elTooltip.hidden = true;
    if (elSvg) {
      elSvg.querySelectorAll(".acs-hover-line, .acs-hover-dot").forEach((node) => node.setAttribute("visibility", "hidden"));
    }
  }

  // Tooltip rows: [key shape, key class, label, text]
  function tooltipRows(point) {
    const rows = [];
    const lines = geometry.lines;
    const byKey = (key) => lines.find((s) => s.key === key);

    if (byKey("total")) rows.push(["line", "acs-s-total", "Total", formatDollars(point.total)]);
    if (byKey("invested")) rows.push(["line", "acs-s-balance", byKey("invested").label, formatDollars(point.invested)]);
    if (byKey("cash")) rows.push(["line", `acs-s-${byKey("cash").cls}`, byKey("cash").label, formatDollars(point.cash)]);
    if (data.hasInvested) {
      rows.push(["box", "acs-box-contrib", "Contributed", formatDollars(point.moneyIn)]);
      rows.push(["box", point.gain < 0 ? "acs-box-loss" : "acs-box-gain", point.gain < 0 ? "Loss" : "Gain", formatSignedDollars(point.gain)]);
    }
    return rows;
  }

  function placeDot(id, px, py) {
    const dot = elSvg.querySelector(`[data-dot="${id}"]`);
    if (!dot) return;
    dot.setAttribute("cx", px);
    dot.setAttribute("cy", py);
    dot.setAttribute("visibility", "visible");
  }

  function showHover(index) {
    hoverIndex = index;
    const point = data.points[index];
    const { x, y, width, lines } = geometry;
    const px = x(index);

    const guide = elSvg.querySelector(".acs-hover-line");
    guide.setAttribute("x1", px);
    guide.setAttribute("x2", px);
    guide.setAttribute("visibility", "visible");

    lines.forEach((s) => placeDot("line-" + s.key, px, y(s.value(point) / 100)));
    if (data.hasInvested) placeDot("contrib", px, y(point.moneyIn / 100));

    // Tooltip: the value leads, the label follows
    elTooltip.innerHTML = "";
    elTooltip.appendChild(htmlEl("div", "acs-tooltip-heading", point.heading));
    tooltipRows(point).forEach(([shape, keyClass, label, text]) => {
      const row = htmlEl("div", "acs-tooltip-row");
      row.append(
        htmlEl("span", shape === "line" ? `acs-key-line ${keyClass}` : `acs-key-box ${keyClass}`),
        htmlEl("strong", null, text),
        htmlEl("span", "acs-tooltip-label", label)
      );
      elTooltip.appendChild(row);
    });

    elTooltip.hidden = false;
    const tipWidth = elTooltip.offsetWidth;
    const flip = px + 14 + tipWidth > width - 4;
    elTooltip.style.left = `${Math.max(4, flip ? px - 14 - tipWidth : px + 14)}px`;
    elTooltip.style.top = `${MARGIN.top + 8}px`;
  }

  return { render, clear };
})();
