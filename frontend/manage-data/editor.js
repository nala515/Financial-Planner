//-----------------------------------------------------
// Editor
//-----------------------------------------------------

const startInput = document.getElementById("range-start");
const endInput = document.getElementById("range-end");
const output = document.getElementById("csv-output");

function defaultRange() {
  const now = new Date();
  const end = now.toISOString().slice(0, 7); // "YYYY-MM"

  const startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const start = startDate.toISOString().slice(0, 7);

  return { start, end };
}

async function fetchAndRender() {
  const start = startInput.value;
  const end = endInput.value;

  output.value = "Loading...";

  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);

  try {
    const res = await fetch(`/api/missing-entries?${params}`);
    if (!res.ok) {
      output.value = `Error: ${res.status} ${res.statusText}`;
      return;
    }
    const rows = await res.json();
    output.value = rows.length ? buildCsvText(rows) : "No missing entries in this range.";
  } catch (err) {
    output.value = `Error: ${err.message}`;
  }
}

function buildCsvText(rows) {
  return rows
    .map(r => `${r.account_name},${r.year},${r.month},${r.balance},${r.contribution}`)
    .join("\n");
}

// initialize range inputs and auto-fetch
const { start, end } = defaultRange();
startInput.value = start;
endInput.value = end;
fetchAndRender();

// re-fetch whenever the range changes
startInput.addEventListener("change", fetchAndRender);
endInput.addEventListener("change", fetchAndRender);

document.getElementById("copy-btn").addEventListener("click", async () => {
  await navigator.clipboard.writeText(output.value);
  const status = document.getElementById("copy-status");
  status.textContent = "Copied!";
  setTimeout(() => (status.textContent = ""), 1500);
});
