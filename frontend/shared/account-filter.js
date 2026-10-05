const AccountFilter = (() => {
  let accounts = [];
  let categories = {};
  let descriptorKeys = [];
  let selectedIds = new Set();
  let onChange = () => {};

  let elRoot, elTrigger, elLabel, elPanel, elPresets, elList;
  let outsideClickHandler = null;

  const TEMPLATE = `
    <button type="button" id="account-filter-trigger" class="account-filter-trigger">
      <span id="account-filter-label" class="account-filter-label"></span>
      <span class="account-filter-caret" aria-hidden="true">&#9662;</span>
    </button>
    <div id="account-filter-panel" class="account-filter-panel" hidden>
      <div id="account-filter-presets" class="account-filter-presets"></div>
      <div class="account-filter-actions">
        <button type="button" data-action="select-all">Select all</button>
        <button type="button" data-action="clear">Clear</button>
      </div>
      <div id="account-filter-list" class="account-filter-list"></div>
    </div>
  `;

  function init({ container, accounts: accts, categories: cats, defaultType = "net_worth", onChange: cb }) {
    elRoot = typeof container === "string" ? document.querySelector(container) : container;
    if (!elRoot) throw new Error("AccountFilter.init: container element not found");

    accounts = accts;
    categories = cats;
    onChange = cb || (() => {});

    const firstCategory = Object.values(categories)[0];
    descriptorKeys = Object.keys(firstCategory || {});

    // Inject markup (replaces any previous render, so re-init is safe)
    if (!elRoot.id) elRoot.id = "account-filter";
    elRoot.classList.add("account-filter");
    elRoot.innerHTML = TEMPLATE;

    elTrigger = elRoot.querySelector("#account-filter-trigger");
    elLabel = elRoot.querySelector("#account-filter-label");
    elPanel = elRoot.querySelector("#account-filter-panel");
    elPresets = elRoot.querySelector("#account-filter-presets");
    elList = elRoot.querySelector("#account-filter-list");

    buildPresets();
    buildAccountList();
    applyPreset(defaultType);

    elTrigger.addEventListener("click", togglePanel);

    if (outsideClickHandler) document.removeEventListener("click", outsideClickHandler);
    outsideClickHandler = (e) => {
      if (!elRoot.contains(e.target)) closePanel();
    };
    document.addEventListener("click", outsideClickHandler);

    elPanel.querySelector('[data-action="select-all"]').addEventListener("click", selectAll);
    elPanel.querySelector('[data-action="clear"]').addEventListener("click", clearAll);
  }

  // filter accounts by type to only show the ones requested
  function filterAccountsByType(accounts, categories, type) {
      return accounts.filter(acc => {
          const categoryInfo = categories[acc.category];
          // If an account's category isn't in the mapping for some reason,
          // exclude it rather than crash or silently include it.
          return categoryInfo ? categoryInfo[type] === true : false;
      });
  }

  function buildPresets() {
    elPresets.innerHTML = "";
    descriptorKeys.forEach(key => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "account-filter-preset";
      btn.dataset.type = key;
      btn.textContent = formatTypeLabel(key);
      btn.addEventListener("click", () => applyPreset(key));
      elPresets.appendChild(btn);
    });
  }

  function buildAccountList() {
    elList.innerHTML = "";
    accounts.forEach(account => {
      const row = document.createElement("label");
      row.className = "account-filter-row";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = account.id;
      checkbox.addEventListener("change", () => toggleAccount(account.id, checkbox.checked));

      const span = document.createElement("span");
      span.textContent = account.name;

      row.appendChild(checkbox);
      row.appendChild(span);
      elList.appendChild(row);
    });
  }

  function idsForType(typeKey) {
    return new Set(filterAccountsByType(accounts, categories, typeKey).map(a => a.id));
  }

  function applyPreset(typeKey) {
    selectedIds = idsForType(typeKey);
    syncCheckboxes();
    updateLabelAndActivePreset();
    onChange(getSelectedAccounts());
  }

  function toggleAccount(id, checked) {
    checked ? selectedIds.add(id) : selectedIds.delete(id);
    updateLabelAndActivePreset();
    onChange(getSelectedAccounts());
  }

  function selectAll() {
    selectedIds = new Set(accounts.map(a => a.id));
    syncCheckboxes();
    updateLabelAndActivePreset();
    onChange(getSelectedAccounts());
  }

  function clearAll() {
    selectedIds = new Set();
    syncCheckboxes();
    updateLabelAndActivePreset();
    onChange(getSelectedAccounts());
  }

  function syncCheckboxes() {
    elList.querySelectorAll("input[type=checkbox]").forEach(cb => {
      cb.checked = selectedIds.has(Number(cb.value));
    });
  }

  function setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
  }

  function updateLabelAndActivePreset() {
    let matchedKey = null;
    for (const key of descriptorKeys) {
      if (setsEqual(selectedIds, idsForType(key))) { matchedKey = key; break; }
    }
    elLabel.textContent = matchedKey ? formatTypeLabel(matchedKey) : "Custom";
    elPresets.querySelectorAll(".account-filter-preset").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.type === matchedKey);
    });
  }

  function togglePanel() { elPanel.hidden ? openPanel() : closePanel(); }
  function openPanel() { elPanel.hidden = false; elTrigger.classList.add("open"); }
  function closePanel() { elPanel.hidden = true; elTrigger.classList.remove("open"); }

  function getSelectedAccounts() {
    return accounts.filter(a => selectedIds.has(a.id));
  }

  return { init, getSelectedAccounts };
})();
