// Growth projection page: builds its own controls, sends them to the backend,
// and hands the result to GrowthChart. All financial calculations happen in the backend.

(() => {
  const STORAGE_KEY = "growthPrefs";
  const ENDPOINT = "/api/growth/projection";
  const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

  const YEAR_CHOICES = [1, 5, 10, 15, 20, 25, 30, 40, 50, 60];
  const WINDOW_CHOICES = [[12, "1 year"], [24, "2 years"], [36, "3 years"]];

  const GROUPS = [
    { key: "non_retirement", title: "Non-retirement contributions", short: "Non-retirement" },
    { key: "retirement", title: "Retirement contributions", short: "Retirement" },
  ];

  const SOURCE_LABELS = {
    own: "Own history",
    group_fallback: "Borrowed from its group",
    all_fallback: "Borrowed from all accounts",
    manual: "Manual rate",
  };

  let prefs = loadPrefs();
  let accounts = [];
  let categories = {};
  let lastResponse = null;
  let requestSeq = 0;
  let refreshTimer = null;

  //-----------------------------------------------------
  // Saved preferences (localStorage, per browser)
  //-----------------------------------------------------

  function defaultPrefs() {
    return {
      years: 30,
      historyFrom: "",
      returnMode: "historical",
      manualPct: 7,
      spreadPct: 2,
      windowMonths: 36,
      inflation: false,
      inflationPct: 3,
      logScale: false,
      selectedIds: null,
      pinnedMonths: [],
      plans: {
        non_retirement: { schedule: null, targetId: null },
        retirement: { schedule: null, targetId: null },
      },
    };
  }

  function sanitizePlan(plan) {
    const clean = { schedule: null, targetId: null };
    if (!plan || typeof plan !== "object") return clean;

    if (Number.isInteger(plan.targetId)) clean.targetId = plan.targetId;

    if (Array.isArray(plan.schedule) && plan.schedule.length > 0) {
      clean.schedule = plan.schedule.slice(0, 24).map((step) => ({
        month: typeof step?.month === "string" && MONTH_RE.test(step.month) ? step.month : "",
        dollars: Number.isFinite(step?.dollars) && step.dollars >= 0 ? step.dollars : 0,
      }));
      clean.schedule[0].month = "";   // the first step always means "now"
    }
    return clean;
  }

  function sanitizePinnedMonths(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((month) => typeof month === "string" && MONTH_RE.test(month)))];
  }

  function loadPrefs() {
    const defaults = defaultPrefs();
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!raw || typeof raw !== "object") return defaults;

      const number = (value, fallback) => (Number.isFinite(value) ? value : fallback);
      return {
        years: YEAR_CHOICES.includes(raw.years) ? raw.years : defaults.years,
        historyFrom: typeof raw.historyFrom === "string" && MONTH_RE.test(raw.historyFrom) ? raw.historyFrom : "",
        returnMode: raw.returnMode === "manual" ? "manual" : "historical",
        manualPct: number(raw.manualPct, defaults.manualPct),
        spreadPct: Math.min(Math.max(number(raw.spreadPct, defaults.spreadPct), 0), 10),
        windowMonths: WINDOW_CHOICES.some(([months]) => months === raw.windowMonths) ? raw.windowMonths : defaults.windowMonths,
        inflation: raw.inflation === true,
        inflationPct: Math.min(Math.max(number(raw.inflationPct, defaults.inflationPct), 0), 20),
        logScale: raw.logScale === true,
        selectedIds: Array.isArray(raw.selectedIds) ? raw.selectedIds.filter(Number.isInteger) : null,
        pinnedMonths: sanitizePinnedMonths(raw.pinnedMonths),
        plans: {
          non_retirement: sanitizePlan(raw.plans?.non_retirement),
          retirement: sanitizePlan(raw.plans?.retirement),
        },
      };
    } catch (error) {
      return defaults;
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (error) {
      // Private windows and blocked storage just mean nothing is remembered.
    }
  }

  //-----------------------------------------------------
  // Small helpers
  //-----------------------------------------------------

  function byId(id) {
    return document.getElementById(id);
  }

  function readNumber(element, fallback) {
    const value = parseFloat(element.value);
    return Number.isFinite(value) ? value : fallback;
  }

  // "2026-10" + 12 -> "2027-10" (string slicing, no Date parsing)
  function addMonths(month, count) {
    const total = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + count;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
  }

  function groupOf(account) {
    return categories[account.category]?.retirement ? "retirement" : "non_retirement";
  }

  function selectedAccountsInGroup(group) {
    return AccountFilter.getSelectedAccounts().filter((account) => groupOf(account) === group);
  }

  function trailingAverageDollars(group) {
    const info = lastResponse ? lastResponse[group] : null;
    return info ? Math.round(info.trailing_avg_cents / 100) : null;
  }

  //-----------------------------------------------------
  // Controls
  //-----------------------------------------------------

  function option(value, label, selected) {
    return `<option value="${value}"${selected ? " selected" : ""}>${label}</option>`;
  }

  function buildControls() {
    const yearOptions = YEAR_CHOICES.map((years) =>
      option(years, years === 1 ? "1 year" : `${years} years`, years === prefs.years)).join("");
    const windowOptions = WINDOW_CHOICES.map(([months, label]) =>
      option(months, label, months === prefs.windowMonths)).join("");

    byId("growth-controls").innerHTML = `
      <div class="gp-controls">
        <div class="gp-field">
          <label>Accounts</label>
          <div id="growth-account-filter"></div>
        </div>
        <div class="gp-field">
          <label for="growth-years">Project forward</label>
          <select id="growth-years" class="gp-select">${yearOptions}</select>
        </div>
        <div class="gp-field">
          <label for="growth-history-from">Show history from</label>
          <input type="month" id="growth-history-from" class="gp-input" value="${prefs.historyFrom}">
        </div>
        <div class="gp-field">
          <label for="growth-return-mode">Expected return</label>
          <select id="growth-return-mode" class="gp-select">
            ${option("historical", "Each account's history", prefs.returnMode === "historical")}
            ${option("manual", "One rate for all", prefs.returnMode === "manual")}
          </select>
        </div>
        <div class="gp-field">
          <label for="growth-manual-pct">Manual rate (% a year)</label>
          <input type="number" id="growth-manual-pct" class="gp-input gp-input-narrow" step="0.5" value="${prefs.manualPct}"
                 title="Used in manual mode, and when an account has no usable history to borrow from">
        </div>
        <div class="gp-field">
          <label for="growth-window">History used for rates</label>
          <select id="growth-window" class="gp-select">${windowOptions}</select>
        </div>
        <div class="gp-field">
          <label for="growth-spread">Low / high band (± points)</label>
          <input type="number" id="growth-spread" class="gp-input gp-input-narrow" min="0" max="10" step="0.5" value="${prefs.spreadPct}">
        </div>
        <div class="gp-field">
          <label class="checkbox-row"><input type="checkbox" id="growth-inflation"${prefs.inflation ? " checked" : ""}> Adjust for inflation</label>
          <input type="number" id="growth-inflation-pct" class="gp-input gp-input-narrow" min="0" max="20" step="0.5" value="${prefs.inflationPct}"
                 title="Inflation rate (% a year)">
        </div>
      </div>
    `;

    byId("growth-years").addEventListener("change", onControlChange);
    byId("growth-history-from").addEventListener("change", onControlChange);
    byId("growth-return-mode").addEventListener("change", onControlChange);
    byId("growth-window").addEventListener("change", onControlChange);
    byId("growth-inflation").addEventListener("change", onControlChange);
    byId("growth-manual-pct").addEventListener("input", onControlChange);
    byId("growth-spread").addEventListener("input", onControlChange);
    byId("growth-inflation-pct").addEventListener("input", onControlChange);
    byId("growth-log").checked = prefs.logScale;
    byId("growth-log").addEventListener("change", () => {
      prefs.logScale = byId("growth-log").checked;
      savePrefs();
      if (lastResponse) renderChart();
    });

    syncControlStates();
  }

  function onControlChange() {
    prefs.years = Number(byId("growth-years").value);
    prefs.historyFrom = byId("growth-history-from").value;
    prefs.returnMode = byId("growth-return-mode").value;
    prefs.manualPct = readNumber(byId("growth-manual-pct"), prefs.manualPct);
    prefs.windowMonths = Number(byId("growth-window").value);
    prefs.spreadPct = Math.min(Math.max(readNumber(byId("growth-spread"), prefs.spreadPct), 0), 10);
    prefs.inflation = byId("growth-inflation").checked;
    prefs.inflationPct = Math.min(Math.max(readNumber(byId("growth-inflation-pct"), prefs.inflationPct), 0), 20);

    savePrefs();
    syncControlStates();
    scheduleRefresh();
  }

  // Controls that don't apply right now are greyed out, not hidden.
  function syncControlStates() {
    byId("growth-window").disabled = prefs.returnMode === "manual";
    byId("growth-inflation-pct").disabled = !prefs.inflation;
  }

  function syncPinnedControls() {
    const clearPins = byId("growth-clear-pins");
    if (!clearPins) return;
    clearPins.hidden = !prefs.pinnedMonths.length;
  }

  //-----------------------------------------------------
  // Contribution plans
  //-----------------------------------------------------

  function buildPlans() {
    byId("growth-plans").innerHTML = `<div class="gp-plans">${GROUPS.map((group) => `
      <section class="gp-card" id="plan-${group.key}" data-group="${group.key}">
        <h2>${group.title}</h2>
        <p class="gp-hint" data-role="hint"></p>
        <table class="gp-steps"><tbody data-role="steps"></tbody></table>
        <div class="gp-plan-actions">
          <button type="button" class="gp-link-button" data-action="add-step">+ Add a change</button>
          <button type="button" class="gp-link-button" data-action="use-average" hidden>Use trailing average</button>
        </div>
        <label class="gp-target-label">Apply to
          <select class="gp-select" data-role="target"></select>
        </label>
      </section>`).join("")}</div>`;

    const plans = byId("growth-plans");
    plans.addEventListener("input", onPlanInput);
    plans.addEventListener("change", onPlanChange);
    plans.addEventListener("click", onPlanClick);

    GROUPS.forEach((group) => renderSteps(group.key));
  }

  function renderSteps(group) {
    const plan = prefs.plans[group];
    const tbody = byId(`plan-${group}`).querySelector('[data-role="steps"]');
    const average = trailingAverageDollars(group);

    const steps = plan.schedule || [{ month: "", dollars: average === null ? "" : average }];

    tbody.innerHTML = steps.map((step, i) => `
      <tr>
        <td class="gp-steps-when">${i === 0
          ? "From now"
          : `<input type="month" class="gp-input" data-role="month" data-index="${i}" value="${step.month}" aria-label="Change takes effect in">`}</td>
        <td>
          <span class="gp-money"><span aria-hidden="true">$</span>
            <input type="number" class="gp-input gp-input-money" data-role="amount" data-index="${i}" min="0" step="50"
                   value="${step.dollars}" aria-label="Monthly amount">
          </span> <span class="gp-per-month">a month</span>
        </td>
        <td>${i === 0 ? "" : `<button type="button" class="gp-icon-button" data-action="remove-step" data-index="${i}" aria-label="Remove this change">✕</button>`}</td>
      </tr>`).join("");

    refreshPlanChrome(group);
  }

  // Everything on a plan card that depends on the latest response or the current selection.
  function refreshPlanChrome(group) {
    const card = byId(`plan-${group}`);
    const plan = prefs.plans[group];
    const info = lastResponse ? lastResponse[group] : null;
    const hint = card.querySelector('[data-role="hint"]');

    if (lastResponse && !info) {
      hint.textContent = "None of the selected accounts are in this group, so this plan has no effect.";
    } else if (info) {
      hint.textContent = `Trailing 12-month average of deposits: ${GrowthChart.formatDollars(info.trailing_avg_cents)} a month.`;
    } else {
      hint.textContent = "";
    }

    card.querySelector('[data-action="use-average"]').hidden = plan.schedule === null;

    // With no custom schedule the first row just shows the average.
    if (plan.schedule === null && info) {
      const firstAmount = card.querySelector('[data-role="amount"][data-index="0"]');
      if (firstAmount) firstAmount.value = Math.round(info.trailing_avg_cents / 100);
    }

    renderTargetOptions(group);
  }

  function renderTargetOptions(group) {
    const select = byId(`plan-${group}`).querySelector('[data-role="target"]');
    const plan = prefs.plans[group];

    let candidates = selectedAccountsInGroup(group);
    if (lastResponse) {
      // The backend leaves out accounts with a zero balance; they can't receive contributions.
      const usable = new Set(lastResponse.accounts.map((account) => account.id));
      candidates = candidates.filter((account) => usable.has(account.id));
    }

    select.innerHTML = "";
    const split = document.createElement("option");
    split.value = "";
    split.textContent = "Split across accounts";
    select.appendChild(split);

    candidates.forEach((account) => {
      const item = document.createElement("option");
      item.value = account.id;
      item.textContent = `All to ${account.name}`;
      select.appendChild(item);
    });

    select.value = plan.targetId !== null && candidates.some((a) => a.id === plan.targetId) ? String(plan.targetId) : "";
  }

  function ensureSchedule(group) {
    const plan = prefs.plans[group];
    if (plan.schedule === null) {
      const average = trailingAverageDollars(group);
      plan.schedule = [{ month: "", dollars: average === null ? 0 : average }];
    }
    return plan.schedule;
  }

  function onPlanInput(event) {
    const field = event.target;
    if (field.dataset.role !== "amount") return;

    const group = field.closest("[data-group]").dataset.group;
    const schedule = ensureSchedule(group);
    schedule[Number(field.dataset.index)].dollars = Math.max(readNumber(field, 0), 0);

    byId(`plan-${group}`).querySelector('[data-action="use-average"]').hidden = false;
    savePrefs();
    scheduleRefresh();
  }

  function onPlanChange(event) {
    const field = event.target;
    const group = field.closest("[data-group]")?.dataset.group;
    if (!group) return;

    if (field.dataset.role === "month") {
      prefs.plans[group].schedule[Number(field.dataset.index)].month = field.value;
    } else if (field.dataset.role === "target") {
      prefs.plans[group].targetId = field.value === "" ? null : Number(field.value);
    } else {
      return;
    }

    savePrefs();
    scheduleRefresh();
  }

  function onPlanClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const group = button.closest("[data-group]").dataset.group;
    const plan = prefs.plans[group];

    if (button.dataset.action === "add-step") {
      const schedule = ensureSchedule(group);
      const previous = schedule[schedule.length - 1];
      const anchor = previous.month || (lastResponse ? lastResponse.projection_start : null);
      schedule.push({ month: anchor ? addMonths(anchor, 12) : "", dollars: previous.dollars });
    } else if (button.dataset.action === "remove-step") {
      plan.schedule.splice(Number(button.dataset.index), 1);
    } else if (button.dataset.action === "use-average") {
      plan.schedule = null;
    }

    renderSteps(group);
    savePrefs();
    scheduleRefresh();
  }

  function buildPlanRequest(group) {
    const plan = prefs.plans[group];
    let schedule = null;

    if (plan.schedule) {
      const steps = plan.schedule.map((step, i) => ({
        from_month: i === 0 ? null : step.month,
        monthly_cents: Math.round(step.dollars * 100),
      }));
      const later = steps.slice(1).filter((step) => step.from_month).sort((a, b) => a.from_month.localeCompare(b.from_month));
      schedule = [steps[0], ...later];
    }

    const targetStillSelected = plan.targetId !== null && selectedAccountsInGroup(group).some((a) => a.id === plan.targetId);
    return { schedule, target_account_id: targetStillSelected ? plan.targetId : null };
  }

  //-----------------------------------------------------
  // Talking to the backend
  //-----------------------------------------------------

  function buildRequest() {
    return {
      account_ids: AccountFilter.getSelectedAccounts().map((account) => account.id),
      years: prefs.years,
      return_mode: prefs.returnMode,
      manual_return_pct: prefs.manualPct,
      spread_pct: prefs.spreadPct,
      history_window_months: prefs.windowMonths,
      history_from: prefs.historyFrom || null,
      inflation: prefs.inflation,
      inflation_pct: prefs.inflationPct,
      non_retirement: buildPlanRequest("non_retirement"),
      retirement: buildPlanRequest("retirement"),
    };
  }

  function formatApiError(body) {
    if (body && typeof body.detail === "string") return body.detail;
    if (body && Array.isArray(body.detail) && body.detail.length) {
      const first = body.detail[0];
      const field = Array.isArray(first.loc) ? first.loc.slice(1).join(" > ") : "";
      return field ? `${field}: ${first.msg}` : first.msg;
    }
    return "The projection could not be calculated.";
  }

  function scheduleRefresh(delay = 250) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, delay);
  }

  function setBusy(busy) {
    byId("growth-chart-card").classList.toggle("gp-loading", busy);
  }

  function showStatus(message) {
    const status = byId("growth-status");
    status.textContent = message;
    status.hidden = !message;
  }

  async function refresh() {
    const sequence = ++requestSeq;
    setBusy(true);

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequest()),
      });
      const body = await response.json();
      if (sequence !== requestSeq) return;   // a newer request has been sent since

      if (!response.ok) {
        showStatus(formatApiError(body));   // the previous chart stays on screen
        return;
      }

      showStatus("");
      lastResponse = body;
      renderResults();
    } catch (error) {
      if (sequence !== requestSeq) return;
      showStatus("Unable to reach the server.");
    } finally {
      if (sequence === requestSeq) setBusy(false);
    }
  }

  //-----------------------------------------------------
  // Rendering results
  //-----------------------------------------------------

  function renderResults() {
    renderSummary();
    renderChart();
    renderRates();
    renderDataTable();
    GROUPS.forEach((group) => refreshPlanChrome(group.key));
  }

  function renderChart() {
    GrowthChart.render(byId("growth-chart"), lastResponse, {
      log: prefs.logScale,
      inflation: prefs.inflation,
      pins: prefs.pinnedMonths,
      onPinsChange: (nextPins) => {
        prefs.pinnedMonths = nextPins;
        savePrefs();
        syncPinnedControls();
        if (lastResponse) renderResults();
      },
    });
  }

  function statTile(label, value, note) {
    const tile = document.createElement("div");
    tile.className = "gp-stat";
    const labelEl = document.createElement("div");
    labelEl.className = "gp-stat-label";
    labelEl.textContent = label;
    const valueEl = document.createElement("div");
    valueEl.className = "gp-stat-value";
    valueEl.textContent = value;
    tile.append(labelEl, valueEl);
    if (note) {
      const noteEl = document.createElement("div");
      noteEl.className = "gp-stat-note";
      noteEl.textContent = note;
      tile.appendChild(noteEl);
    }
    return tile;
  }

  function renderSummary() {
    const container = byId("growth-summary");
    container.innerHTML = "";
    if (!lastResponse.dates.length) return;

    const start = lastResponse.dates.indexOf(lastResponse.projection_start);
    const last = lastResponse.dates.length - 1;
    const dollars = (cents) => GrowthChart.formatCompact(cents / 100);
    const unit = prefs.inflation ? " (today's dollars)" : "";

    container.append(
      statTile("Latest value", dollars(lastResponse.actual[start]), GrowthChart.formatMonth(lastResponse.projection_start)),
      statTile(`Projected in ${prefs.years === 1 ? "1 year" : prefs.years + " years"}`, dollars(lastResponse.base[last]),
        GrowthChart.formatMonth(lastResponse.dates[last]) + unit),
      statTile("Low to high", `${dollars(lastResponse.low[last])} to ${dollars(lastResponse.high[last])}`,
        `Base rate ± ${prefs.spreadPct} points`),
    );
  }

  function makeTable(headers, rows) {
    const table = document.createElement("table");
    table.className = "gp-table";

    const headRow = table.createTHead().insertRow();
    headers.forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      headRow.appendChild(th);
    });

    const body = table.createTBody();
    rows.forEach((cells) => {
      const row = body.insertRow();
      cells.forEach((text) => { row.insertCell().textContent = text; });
    });
    return table;
  }

  function renderRates() {
    const container = byId("growth-rates");
    container.innerHTML = "";
    if (!lastResponse.accounts.length) return;

    const heading = document.createElement("h2");
    heading.textContent = "Rates used for each account";
    const rows = lastResponse.accounts.map((account) => [
      account.name,
      account.group === "retirement" ? "Retirement" : "Non-retirement",
      `${account.rate_pct.toFixed(2)}%`,
      SOURCE_LABELS[account.source] || account.source,
      account.source === "manual" ? "-" : String(account.months_used),
    ]);

    const wrapper = document.createElement("div");
    wrapper.className = "gp-card";
    const scroller = document.createElement("div");
    scroller.className = "gp-table-scroll";
    scroller.appendChild(makeTable(["Account", "Group", "Annual rate", "Based on", "Months of data"], rows));
    wrapper.append(heading, scroller);

    if (lastResponse.ignored_ids.length) {
      const note = document.createElement("p");
      note.className = "gp-hint";
      note.textContent = `${lastResponse.ignored_ids.length} selected account(s) left out: no balance entries, or not an invested account.`;
      wrapper.appendChild(note);
    }
    container.appendChild(wrapper);
  }

  function renderDataTable() {
    const holder = byId("growth-data-table");
    holder.innerHTML = "";
    if (!lastResponse.dates.length || byId("growth-table-toggle").getAttribute("aria-expanded") !== "true") return;
    holder.appendChild(GrowthChart.buildTable(lastResponse, prefs.pinnedMonths));
  }

  function buildTableToggle() {
    const toggle = byId("growth-table-toggle");
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Hide data table" : "Show data table";
      if (lastResponse) renderDataTable();
    });
  }

  //-----------------------------------------------------
  // Start-up
  //-----------------------------------------------------

  function onSelectionChange(selected) {
    prefs.selectedIds = selected.map((account) => account.id);
    savePrefs();
    GROUPS.forEach((group) => renderTargetOptions(group.key));
    scheduleRefresh(0);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();

    byId("growth-clear-pins").addEventListener("click", (event) => {
      event.preventDefault();
      prefs.pinnedMonths = [];
      savePrefs();
      syncPinnedControls();
      if (lastResponse) renderResults();
    });

    buildControls();
    buildPlans();
    buildTableToggle();
    syncPinnedControls();

    let views;
    try {
      [accounts, categories, views] = await Promise.all([
        fetch("/api/accounts").then((r) => r.json()),
        getAccountCategories(),
        getAccountViews(),
      ]);
    } catch (error) {
      showStatus("Unable to load accounts.");
      return;
    }

    // Only invested accounts belong on this page; the backend's flags decide which those are.
    const invested = accounts.filter((account) => categories[account.category]?.invested === true);
    if (!invested.length) {
      showStatus("There are no invested accounts to project.");
      return;
    }

    const growthViews = { all_invested: { invested: true } };
    ["non_retirement", "retirement"].forEach((key) => { if (views[key]) growthViews[key] = views[key]; });

    AccountFilter.init({
      container: "#growth-account-filter",
      accounts: invested,
      categories,
      views: growthViews,
      defaultView: "all_invested",
      initialSelectedIds: prefs.selectedIds,
      onChange: onSelectionChange,
    });
  });
})();