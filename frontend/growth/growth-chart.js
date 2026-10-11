// Line chart for the growth projection page.
// Draws history (solid), the projected base case (dashed) and a low-high band as SVG,
// with a vertical hover line that snaps to the nearest month and a tooltip.
// It only draws what it is given: the backend does all of the calculating.

const GrowthChart = (() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const MARGIN = { top: 16, right: 16, bottom: 30, left: 64 };

  let container = null;
  let elLegend, elWrap, elSvg, elTooltip, elEmpty;
  let data = null;
  let options = { log: false, inflation: false };
  let hoverIndex = null;
  let geometry = null;      // scales and sizes from the last draw
  let resizeObserver = null;

  //-----------------------------------------------------
  // Number formatting
  //-----------------------------------------------------

  function formatDollars(cents) {
    return (cents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
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

  function formatMonth(month) {
    return formatMonthYearLabel(month);   // from app.js; "2031-10" -> "Oct 2031"
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

  function linearScale(maxValue, plotHeight) {
    const step = niceStep(maxValue / 5 || 1);
    const top = Math.ceil(maxValue / step) * step || step;
    const ticks = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
    return {
      ticks,
      y: (v) => MARGIN.top + plotHeight - (Math.max(v, 0) / top) * plotHeight,
    };
  }

  function logScale(minValue, maxValue, plotHeight) {
    const lowExp = Math.floor(Math.log10(minValue));
    const highExp = Math.max(Math.ceil(Math.log10(maxValue)), lowExp + 1);
    const ticks = [];
    for (let e = lowExp; e <= highExp; e++) ticks.push(Math.pow(10, e));
    return {
      ticks,
      y: (v) => {
        const clamped = Math.max(v, Math.pow(10, lowExp));
        const share = (Math.log10(clamped) - lowExp) / (highExp - lowExp);
        return MARGIN.top + plotHeight - share * plotHeight;
      },
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

  //-----------------------------------------------------
  // Skeleton (built once) and drawing (rebuilt on every render/resize)
  //-----------------------------------------------------

  function buildSkeleton() {
    container.innerHTML = "";
    container.classList.add("gp-chart");

    elLegend = document.createElement("div");
    elLegend.className = "gp-legend";
    [
      ["gp-key gp-key-actual", "Actual"],
      ["gp-key gp-key-base", "Projected"],
      ["gp-key gp-key-range", "Low / high"],
    ].forEach(([keyClass, label]) => {
      const item = document.createElement("span");
      item.className = "gp-legend-item";
      const key = document.createElement("span");
      key.className = keyClass;
      const text = document.createElement("span");
      text.textContent = label;
      item.append(key, text);
      elLegend.appendChild(item);
    });

    elWrap = document.createElement("div");
    elWrap.className = "gp-chart-wrap";

    elSvg = document.createElementNS(SVG_NS, "svg");
    elSvg.setAttribute("class", "gp-svg");
    elSvg.setAttribute("tabindex", "0");
    elSvg.setAttribute("role", "img");

    elTooltip = document.createElement("div");
    elTooltip.className = "gp-tooltip";
    elTooltip.hidden = true;

    elEmpty = document.createElement("p");
    elEmpty.className = "gp-empty";
    elEmpty.hidden = true;

    elWrap.append(elSvg, elTooltip, elEmpty);
    container.append(elLegend, elWrap);

    elSvg.addEventListener("keydown", onKeyDown);
    elSvg.addEventListener("blur", hideHover);

    // Tapping anywhere outside the chart dismisses the readout on touch screens.
    document.addEventListener("pointerdown", (event) => {
      if (!elWrap.contains(event.target)) hideHover();
    });

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        if (data && data.dates.length && Math.abs(elWrap.clientWidth - (geometry?.width || 0)) > 1) draw();
      });
      resizeObserver.observe(elWrap);
    }
  }

  function render(target, newData, newOptions) {
    if (container !== target) {
      container = target;
      buildSkeleton();
    }
    data = newData;
    options = Object.assign({ log: false, inflation: false }, newOptions);
    hoverIndex = null;
    draw();
  }

  function startIndex() {
    return data.dates.indexOf(data.projection_start);
  }

  function draw() {
    elSvg.innerHTML = "";
    hideHover();

    const hasData = data && data.dates.length > 0;
    elLegend.hidden = !hasData;
    elSvg.hidden = !hasData;
    elEmpty.hidden = hasData;

    if (!hasData) {
      elEmpty.textContent = "Select at least one invested account to see a projection.";
      geometry = null;
      return;
    }

    const width = Math.max(elWrap.clientWidth, 300);
    const height = width < 520 ? 300 : 380;
    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotHeight = height - MARGIN.top - MARGIN.bottom;

    elSvg.setAttribute("width", width);
    elSvg.setAttribute("height", height);
    elSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const n = data.dates.length;
    const start = startIndex();
    const toDollars = (series) => series.map((v) => (v === null ? null : v / 100));
    const actual = toDollars(data.actual);
    const low = toDollars(data.low);
    const base = toDollars(data.base);
    const high = toDollars(data.high);

    const allValues = [...actual, ...low, ...base, ...high].filter((v) => v !== null);
    const maxValue = Math.max(...allValues, 1);
    const positives = allValues.filter((v) => v > 0);
    const minPositive = positives.length ? Math.min(...positives) : 1;

    const scale = options.log ? logScale(minPositive, maxValue, plotHeight) : linearScale(maxValue, plotHeight);
    const x = (i) => MARGIN.left + (n === 1 ? plotWidth / 2 : (i / (n - 1)) * plotWidth);

    elSvg.setAttribute(
      "aria-label",
      `Value of the selected accounts from ${formatMonth(data.dates[0])} to ${formatMonth(data.dates[n - 1])}, ` +
      `history up to ${formatMonth(data.projection_start)} and a projection after it. ` +
      `Use the arrow keys to move through months. A data table is available below the chart.`
    );

    // Horizontal gridlines and y labels
    scale.ticks.forEach((tick) => {
      const y = scale.y(tick);
      svgEl("line", { class: "gp-grid", x1: MARGIN.left, x2: width - MARGIN.right, y1: y, y2: y }, elSvg);
      const label = svgEl("text", { class: "gp-axis-text", x: MARGIN.left - 8, y: y + 4, "text-anchor": "end" }, elSvg);
      label.textContent = formatCompact(tick);
    });

    // X labels: every January when there are enough, otherwise every quarter
    const years = data.dates.map((d, i) => [d, i]).filter(([d]) => d.endsWith("-01"));
    let labelled = years;
    let formatTick = (d) => d.slice(0, 4);
    if (years.length < 3) {
      labelled = data.dates.map((d, i) => [d, i]).filter(([d]) => ["01", "04", "07", "10"].includes(d.slice(5, 7)));
      formatTick = formatMonth;
    }
    const minGap = 70;
    let lastX = -Infinity;
    labelled.forEach(([d, i]) => {
      const px = x(i);
      if (px - lastX < minGap || px < MARGIN.left || px > width - MARGIN.right) return;
      lastX = px;
      const label = svgEl("text", { class: "gp-axis-text", x: px, y: height - 8, "text-anchor": "middle" }, elSvg);
      label.textContent = formatTick(d);
    });

    // Where history ends and the projection begins
    const startX = x(start);
    svgEl("line", { class: "gp-start-line", x1: startX, x2: startX, y1: MARGIN.top, y2: MARGIN.top + plotHeight }, elSvg);
    if (start < n - 1) {
      const labelOnLeft = startX > width - 130;
      const marker = svgEl("text", {
        class: "gp-axis-text", x: startX + (labelOnLeft ? -6 : 6), y: MARGIN.top + 12,
        "text-anchor": labelOnLeft ? "end" : "start",
      }, elSvg);
      marker.textContent = "Latest entry";
    }

    // Low-high band, then the lines on top
    if (start < n - 1) {
      const upper = [];
      const lower = [];
      for (let i = start; i < n; i++) {
        upper.push([x(i), scale.y(high[i])]);
        lower.push([x(i), scale.y(low[i])]);
      }
      const bandPoints = [...upper, ...lower.reverse()].map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
      svgEl("polygon", { class: "gp-band", points: bandPoints }, elSvg);

      const projected = (series) => {
        const points = [];
        for (let i = start; i < n; i++) points.push([x(i), scale.y(series[i])]);
        return pathFor(points);
      };
      svgEl("path", { class: "gp-line gp-line-range", d: projected(high) }, elSvg);
      svgEl("path", { class: "gp-line gp-line-range", d: projected(low) }, elSvg);
      svgEl("path", { class: "gp-line gp-line-base", d: projected(base) }, elSvg);
    }

    const history = [];
    for (let i = 0; i <= start; i++) history.push([x(i), scale.y(actual[i])]);
    if (history.length === 1) {
      svgEl("circle", { class: "gp-dot-actual", cx: history[0][0], cy: history[0][1], r: 4 }, elSvg);
    } else {
      svgEl("path", { class: "gp-line gp-line-actual", d: pathFor(history) }, elSvg);
    }

    // Hover layer: guide line, dots, and a transparent target covering the whole plot
    svgEl("line", { class: "gp-hover-line", x1: 0, x2: 0, y1: MARGIN.top, y2: MARGIN.top + plotHeight, visibility: "hidden" }, elSvg);
    ["actual", "high", "base", "low"].forEach((name) => {
      svgEl("circle", { class: `gp-hover-dot gp-hover-dot-${name}`, r: 4, cx: 0, cy: 0, visibility: "hidden" }, elSvg);
    });

    const overlay = svgEl("rect", {
      class: "gp-overlay", x: MARGIN.left, y: MARGIN.top, width: plotWidth, height: plotHeight,
    }, elSvg);
    overlay.addEventListener("pointermove", onPointerMove);
    overlay.addEventListener("pointerdown", onPointerMove);
    // A finger lifting off the screen also fires pointerleave; keep the readout up for touch.
    overlay.addEventListener("pointerleave", (event) => { if (event.pointerType !== "touch") hideHover(); });

    geometry = { width, height, plotWidth, plotHeight, n, start, x, y: scale.y, series: { actual, low, base, high } };
  }

  //-----------------------------------------------------
  // Hover and keyboard
  //-----------------------------------------------------

  function onPointerMove(event) {
    if (!geometry) return;
    const box = elSvg.getBoundingClientRect();
    const share = (event.clientX - box.left - MARGIN.left) / geometry.plotWidth;
    const index = Math.round(share * (geometry.n - 1));
    showHover(Math.min(Math.max(index, 0), geometry.n - 1));
  }

  function onKeyDown(event) {
    if (!geometry) return;
    const step = event.shiftKey ? 12 : 1;
    let index = hoverIndex === null ? geometry.start : hoverIndex;

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
      elSvg.querySelectorAll(".gp-hover-line, .gp-hover-dot").forEach((node) => node.setAttribute("visibility", "hidden"));
    }
  }

  function tooltipRows(index) {
    const { series, start } = geometry;
    if (index <= start) {
      return { tag: index === start ? "Latest entry" : "Actual", rows: [["actual", "Actual", series.actual[index]]] };
    }
    return {
      tag: options.inflation ? "Projected, today's dollars" : "Projected",
      rows: [
        ["range", "High", series.high[index]],
        ["base", "Base", series.base[index]],
        ["range", "Low", series.low[index]],
      ],
    };
  }

  function showHover(index) {
    hoverIndex = index;
    const { x, y, width } = geometry;
    const px = x(index);
    const { tag, rows } = tooltipRows(index);

    const line = elSvg.querySelector(".gp-hover-line");
    line.setAttribute("x1", px);
    line.setAttribute("x2", px);
    line.setAttribute("visibility", "visible");

    elSvg.querySelectorAll(".gp-hover-dot").forEach((dot) => dot.setAttribute("visibility", "hidden"));
    if (index <= geometry.start) {
      placeDot("actual", px, y(geometry.series.actual[index]));
    } else {
      placeDot("high", px, y(geometry.series.high[index]));
      placeDot("base", px, y(geometry.series.base[index]));
      placeDot("low", px, y(geometry.series.low[index]));
    }

    // Tooltip: the value leads, the label follows
    elTooltip.innerHTML = "";
    const heading = document.createElement("div");
    heading.className = "gp-tooltip-heading";
    heading.textContent = formatMonth(data.dates[index]);
    const sub = document.createElement("div");
    sub.className = "gp-tooltip-tag";
    sub.textContent = tag;
    elTooltip.append(heading, sub);

    rows.forEach(([kind, label, valueDollars]) => {
      const row = document.createElement("div");
      row.className = "gp-tooltip-row";
      const key = document.createElement("span");
      key.className = `gp-key gp-key-${kind}`;
      const value = document.createElement("strong");
      value.textContent = formatDollars(valueDollars * 100);
      const name = document.createElement("span");
      name.className = "gp-tooltip-label";
      name.textContent = label;
      row.append(key, value, name);
      elTooltip.appendChild(row);
    });

    elTooltip.hidden = false;
    const tipWidth = elTooltip.offsetWidth;
    const flip = px + 14 + tipWidth > width - 4;
    elTooltip.style.left = `${Math.max(4, flip ? px - 14 - tipWidth : px + 14)}px`;
    elTooltip.style.top = `${MARGIN.top + 8}px`;
  }

  function placeDot(name, px, py) {
    const dot = elSvg.querySelector(`.gp-hover-dot-${name}`);
    dot.setAttribute("cx", px);
    dot.setAttribute("cy", py);
    dot.setAttribute("visibility", "visible");
  }

  //-----------------------------------------------------
  // Data table (the non-visual twin of the chart)
  //-----------------------------------------------------

  // One row per January, plus the first month, the latest entry and the last month.
  function buildTable(tableData) {
    const table = document.createElement("table");
    table.className = "gp-table";

    const head = table.createTHead().insertRow();
    ["Month", "Actual", "Base", "Low", "High"].forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      head.appendChild(th);
    });

    const body = table.createTBody();
    const last = tableData.dates.length - 1;
    const start = tableData.dates.indexOf(tableData.projection_start);

    tableData.dates.forEach((month, i) => {
      if (!(i === 0 || i === start || i === last || month.endsWith("-01"))) return;
      const row = body.insertRow();
      if (i === start) row.className = "gp-table-start";

      const monthCell = row.insertCell();
      monthCell.textContent = formatMonth(month);
      [tableData.actual[i], tableData.base[i], tableData.low[i], tableData.high[i]].forEach((cents) => {
        const cell = row.insertCell();
        cell.textContent = cents === null ? "-" : formatDollars(cents);
      });
    });

    return table;
  }

  return { render, buildTable, formatDollars, formatCompact, formatMonth };
})();