async function populateSettings() {
    const container = document.getElementById("settings-list-container");
    if (!container) return;

    if (!settings || Object.keys(settings).length === 0) {
        await loadSettings();
    }

    container.innerHTML = `
        <div class="editor-row">
            <span>Hide Disabled Accounts</span>
            <input type="checkbox" id="setting-hide-disabled" ${settings.hide_disabled_accounts ? 'checked' : ''}>
        </div>
        <div class="form-actions">
            <button type="submit" class="primary-button">Save Settings</button>
            <p id="settings-form-status" class="form-status"></p>
        </div>
    `;
}

async function handleSettingsUpdate(event) {
    event.preventDefault();
    const status = document.getElementById("settings-form-status");

    const updatedSettings = {
        group_cash_accounts: document.getElementById("setting-group-cash").checked,
        hide_disabled_accounts: document.getElementById("setting-hide-disabled").checked,
        show_retirement_accounts: document.getElementById("setting-show-retirement").checked
    };

    try {
        const response = await fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedSettings)
        });

        if (response.ok) {
            settings = await response.json();

            status.textContent = "Settings saved successfully!";
            status.className = "form-status success";
            setTimeout(() => status.textContent = "", 3000);
        } else {
            throw new Error("Failed to save settings.");
        }
    } catch (error) {
        status.textContent = "Error: " + error.message;
        status.className = "form-status error";
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    await populateSettings();

    const settingsForm = document.getElementById("settings-update-form");
    if (settingsForm) {
        settingsForm.addEventListener("submit", handleSettingsUpdate);
    }
});
