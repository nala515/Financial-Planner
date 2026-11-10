//-----------------------------------------------------
// Utilities
//-----------------------------------------------------

const DASHBOARD_BLURBS = {
    net_worth: "All assets minus all debts.",
    retirement: "Retirement and HSA accounts only.",
    non_retirement: "Cash and investments, includes 529 but not HSA.",
    cash: "Checking and savings balances only.",
    spendable: "Cash and investments you could spend."
};

function renderDashboardCard(key, data, { heading = "h3", mainClass = "main-balance" } = {}) {
    const d = data || { current: 0, "1m": 0, "1y": 0 };
    const blurb = DASHBOARD_BLURBS[key];
    const href = `/balances?filter=${encodeURIComponent(key)}`;
    return `
        <div class="dashboard-card">
            <${heading}>${formatTypeLabel(key)}</${heading}>
            ${blurb ? `<p class="dashboard-blurb">${blurb}</p>` : ""}
            <p class="${mainClass}">${formatCurrency(d.current)}</p>
            <div class="growth-stats">
                <small><span>1M: ${renderGrowth(d.current, d["1m"])}</span></small>
                <small><span>1Y: ${renderGrowth(d.current, d["1y"])}</span></small>
            </div>
            <small class="dashboard-card-link"><a href="${href}">View balances</a></small>
        </div>
    `;
}

function renderGrowth(currentCents, pastCents) {
    if (pastCents === undefined || pastCents === null) return `<span class="growth-neutral">--</span>`;
    
    const diff = currentCents - pastCents;
    const isPositive = diff >= 0;
    const arrow = isPositive ? '▲' : '▼';
    const colorClass = isPositive ? 'growth-positive' : 'growth-negative';

    return `
        <span class="${colorClass}">
            ${arrow} ${formatCurrency(Math.abs(diff))}
        </span>
    `;
}

//-----------------------------------------------------
// Monthly change + breakdown popups
//-----------------------------------------------------

let monthlyChangeRows = {};     // key -> { label, node }, read by the popup
let breakdownTip = null;
let breakdownTarget = null;

function canHover() {
    return window.matchMedia("(hover: hover)").matches;
}

function renderMonthlyChange(data) {
    const rows = [
        { key: "previous_net_worth", label: "Previous month's net worth" },
        { key: "contributions", label: "Contributions" },
        { key: "investment_gains", label: "Investment gains", signed: true },
        { key: "spending", label: "Spending" },
        { key: "current_net_worth", label: "This month's net worth", bold: true },
    ];

    monthlyChangeRows = {};

    const items = rows.map(row => {
        const node = data[row.key] || { value: null, parts: [] };
        monthlyChangeRows[row.key] = { label: row.label, node };

        let valueHtml;
        if (node.value === null || node.value === undefined) {
            valueHtml = `<span class="growth-neutral">--</span>`;
        } else if (row.signed) {
            valueHtml = `<span ${getGrowthFormatting(node.value)}>${formatCurrency(node.value)}</span>`;
        } else {
            valueHtml = formatCurrency(node.value);
        }

        const hasParts = node.parts && node.parts.length > 0;
        const valueClass = `monthly-change-value${row.bold ? " monthly-change-total" : ""}${hasParts ? " has-breakdown" : ""}`;
        const valueAttrs = hasParts ? ` data-breakdown="${row.key}" tabindex="0"` : "";

        return `
            <div class="monthly-change-item">
                <div class="monthly-change-label">${row.label}</div>
                <div class="${valueClass}"${valueAttrs}>${valueHtml}</div>
            </div>`;
    }).join("");

    const period = `${formatMonthYearLabel(data.previous_month)} to ${formatMonthYearLabel(data.current_month)}`;
    return `
        <div class="dashboard-card monthly-change">
            <h2>Monthly Change</h2>
            <p class="dashboard-blurb">${period}</p>
            ${items}
        </div>`;
}

// Adds one row per part to the popup, indenting nested parts under their parent.
function appendBreakdownRows(parent, parts, depth) {
    parts.forEach(part => {
        const row = document.createElement("div");
        row.className = "breakdown-row";
        row.style.paddingLeft = `${depth * 0.9}rem`;

        const label = document.createElement("span");
        label.className = "breakdown-label";
        label.textContent = part.label;

        const value = document.createElement("strong");
        value.textContent = formatCurrency(part.value);

        row.append(label, value);
        parent.appendChild(row);

        if (part.parts && part.parts.length) {
            appendBreakdownRows(parent, part.parts, depth + 1);
        }
    });
}

function showBreakdown(target) {
    const entry = monthlyChangeRows[target.dataset.breakdown];
    if (!entry) {
        return;
    }

    if (!breakdownTip) {
        breakdownTip = document.createElement("div");
        breakdownTip.className = "breakdown-tip";
        document.body.appendChild(breakdownTip);
    }

    breakdownTip.innerHTML = "";
    const heading = document.createElement("div");
    heading.className = "breakdown-heading";
    heading.textContent = entry.label;
    breakdownTip.appendChild(heading);
    appendBreakdownRows(breakdownTip, entry.node.parts, 0);

    breakdownTip.style.display = "block";
    breakdownTarget = target;

    // Sit just below the value, kept inside the screen; flip above it if there is no room below
    const rect = target.getBoundingClientRect();
    const tipWidth = breakdownTip.offsetWidth;
    const tipHeight = breakdownTip.offsetHeight;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - tipWidth - 8));
    let top = rect.bottom + 6;
    if (top + tipHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - tipHeight - 6);
    }
    breakdownTip.style.left = `${left}px`;
    breakdownTip.style.top = `${top}px`;
}

function hideBreakdown() {
    if (breakdownTip) {
        breakdownTip.style.display = "none";
    }
    breakdownTarget = null;
}

// Mouse: hover. Keyboard: focus. Touch screens (no hover): tap to open, tap elsewhere to close.
function initBreakdownTips(container) {
    container.addEventListener("mouseover", (event) => {
        const target = event.target.closest(".has-breakdown");
        if (target && canHover()) {
            showBreakdown(target);
        }
    });

    container.addEventListener("mouseout", (event) => {
        const target = event.target.closest(".has-breakdown");
        if (target && canHover() && !target.contains(event.relatedTarget)) {
            hideBreakdown();
        }
    });

    container.addEventListener("focusin", (event) => {
        const target = event.target.closest(".has-breakdown");
        if (target) {
            showBreakdown(target);
        }
    });

    container.addEventListener("focusout", (event) => {
        if (event.target.closest(".has-breakdown")) {
            hideBreakdown();
        }
    });

    container.addEventListener("click", (event) => {
        const target = event.target.closest(".has-breakdown");
        if (!target || canHover()) {
            return;
        }
        if (breakdownTarget === target) {
            hideBreakdown();
        } else {
            showBreakdown(target);
        }
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".has-breakdown")) {
            hideBreakdown();
        }
    });
}

async function loadMonthlyChange(container) {
    try {
        const response = await fetch(`/api/dashboard/monthly-change`);
        if (!response.ok) {
            throw new Error("Unable to load monthly change");
        }
        const data = await response.json();
        if (!data) {
            return;
        }
        const section = document.createElement("div");
        section.innerHTML = renderMonthlyChange(data);
        container.appendChild(section);
        initBreakdownTips(section);
    } catch (error) {
        const message = document.createElement("p");
        message.textContent = error.message;
        container.appendChild(message);
    }
}

//-----------------------------------------------------
// Dashboard
//-----------------------------------------------------

async function loadDashboard() {
    const container = document.getElementById("dashboard");

    if (!container) {
        return;
    }

    try {
        const response = await fetch(`/api/dashboard`);
        if (!response.ok) {
            throw new Error("Unable to load dashboard");
        }
        const dashboard = await response.json();
        container.innerHTML = renderDashboardCard("net_worth", dashboard.net_worth, { heading: "h2", mainClass: "" });
        
        const keys = Object.keys(dashboard.categories)
        const grid = document.createElement("div");
        grid.className = "dashboard-grid";
        grid.innerHTML = keys.map(key => renderDashboardCard(key, dashboard.categories[key])).join("");
        container.appendChild(grid);
        await loadMonthlyChange(container);
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    loadDashboard();
});
