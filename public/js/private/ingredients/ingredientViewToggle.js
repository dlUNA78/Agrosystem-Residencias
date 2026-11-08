const VIEW_STORAGE_KEY = 'agrosystem:ingredients:view';

const readSavedView = () => {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'table'
      ? 'table'
      : 'grid';
  } catch {
    return 'grid';
  }
};

const writeSavedView = (mode) => {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
  } catch {
    // Ignorar si almacenamiento privado está restringido
  }
};

const updateViewButtons = (btnGrid, btnTable, isTable) => {
  if (!btnGrid || !btnTable) return;
  btnGrid.classList.toggle('bg-[#1b4332]', !isTable);
  btnGrid.classList.toggle('text-white', !isTable);
  btnGrid.classList.toggle('text-slate-600', isTable);

  btnTable.classList.toggle('bg-[#1b4332]', isTable);
  btnTable.classList.toggle('text-white', isTable);
  btnTable.classList.toggle('text-slate-600', !isTable);
};

export const applyStoredIngredientView = (explicitMode = null) => {
  const mode = explicitMode || readSavedView();
  const isTable = mode === 'table';
  const tableView = document.getElementById('ingredients-table-view');
  const gridView = document.getElementById('ingredients-grid-view');
  const btnTable = document.getElementById('view-table');
  const btnGrid = document.getElementById('view-grid');

  if (tableView && gridView) {
    tableView.classList.toggle('hidden', !isTable);
    gridView.classList.toggle('hidden', isTable);
  }
  updateViewButtons(btnGrid, btnTable, isTable);
  if (explicitMode) writeSavedView(explicitMode);
};

export const initializeIngredientViewToggle = () => {
  const btnTable = document.getElementById('view-table');
  const btnGrid = document.getElementById('view-grid');
  if (!btnTable || !btnGrid) return;

  applyStoredIngredientView();

  btnTable.addEventListener('click', () => applyStoredIngredientView('table'));
  btnGrid.addEventListener('click', () => applyStoredIngredientView('grid'));
};
