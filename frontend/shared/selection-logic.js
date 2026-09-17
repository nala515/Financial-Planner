(function () {
  let isSelecting = false;
  let anchorCell = null;
  const selectedCells = new Set();
  let box;

  function initSelectableTable(table) {
    table.querySelectorAll('td[data-numeric]').forEach(cell => {
      cell.addEventListener('mousedown', onMouseDown);
      cell.addEventListener('mouseenter', onMouseEnter);
    });
  }

  function onMouseDown(e) {
    e.preventDefault();
    clearSelection();
    isSelecting = true;
    anchorCell = e.currentTarget;
    toggleCell(anchorCell, true);
    updateBox();
  }

  function onMouseEnter(e) {
    if (!isSelecting) return;
    selectRange(anchorCell, e.currentTarget);
    updateBox();
  }

  function selectRange(start, end) {
    clearSelection(false);
    const table = start.closest('table');
    const rows = Array.from(table.rows);
    const [r1, r2] = [start.parentElement.rowIndex, end.parentElement.rowIndex].sort((a, b) => a - b);
    const [c1, c2] = [start.cellIndex, end.cellIndex].sort((a, b) => a - b);
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const cell = rows[r]?.cells[c];
        if (cell?.hasAttribute('data-numeric')) toggleCell(cell, true);
      }
    }
  }

  function toggleCell(cell, on) {
    cell.classList.toggle('cell-selected', on);
    on ? selectedCells.add(cell) : selectedCells.delete(cell);
  }

  function clearSelection(hideBoxToo = true) {
    selectedCells.forEach(c => c.classList.remove('cell-selected'));
    selectedCells.clear();
    if (hideBoxToo && box) box.style.display = 'none';
  }

  function getValues() {
    return Array.from(selectedCells)
      .map(c => parseFloat(c.dataset.value))
      .filter(v => !isNaN(v));
  }

  function ensureBox() {
    if (!box) {
      box = document.createElement('div');
      box.className = 'selection-summary-box';
      document.body.appendChild(box);
    }
    return box;
  }

  function updateBox() {
    const values = getValues();
    if (!values.length) { if (box) box.style.display = 'none'; return; }
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const b = ensureBox();
    b.textContent = `Count: ${values.length}   Sum: ${sum.toFixed(2)}   Avg: ${avg.toFixed(2)}`;
    const rect = Array.from(selectedCells).pop().getBoundingClientRect();
    b.style.left = `${window.scrollX + rect.right + 8}px`;
    b.style.top = `${window.scrollY + rect.top}px`;
    b.style.display = 'block';
  }

  document.addEventListener('mouseup', () => { isSelecting = false; });
  document.addEventListener('click', e => { if (!e.target.closest('table')) clearSelection(); });

  window.initSelectableTable = initSelectableTable;
})();
