//-----------------------------------------------------
// Utilities
//-----------------------------------------------------

let settings = {};

async function loadSettings() {
    settings = await fetch("/api/settings")
        .then(r => r.json());
}

function getSelectedAccountId() {
    return localStorage.getItem("selectedAccount");
}

function setSelectedAccountId(accountId) {
    localStorage.setItem("selectedAccount", accountId);
}

function formatCurrency(cents) {
    return (cents / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD"
    });
}

function formatMonthLabel(snapshotDate) {
    const date = new Date(snapshotDate);
    return date.toLocaleDateString("en-US", { month: "long" });
}

function formatYearLabel(snapshotDate) {
    const date = new Date(snapshotDate);
    return date.getFullYear().toString();
}

async function loadNav() {
    const placeholder = document.getElementById("nav-placeholder");
    if (!placeholder) {
        return;
    }
    const response = await fetch("/static/html/nav.html");
    if (!response.ok) {
        placeholder.innerHTML = `<p style="color:red">Nav failed to load: ${response.status}</p>`;
        return;
    }
    placeholder.innerHTML = await response.text();
}

async function sendDebugMsg(msg) {
    try {
        await fetch("/api/debug", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ msg: msg })
        });
    } catch (error) {
        console.error("Failed to send debug log to Uvicorn:", error);
    }
}
