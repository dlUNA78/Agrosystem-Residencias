const VIEW_STORAGE_KEY = 'agrosystem:suppliers:view';

const ACTIVE_BTN_CLASSES = ['bg-[#1b4332]', 'text-white', 'shadow-2xs'];
const INACTIVE_BTN_CLASSES = ['text-slate-600', 'hover:text-slate-900'];

const readSavedView = () => {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) || 'grid';
  } catch {
    return 'grid';
  }
};

const writeSavedView = (mode) => {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
};

export const applySupplierSavedView = () => {
  const tableView = document.getElementById('suppliers-table-view');
  const gridView = document.getElementById('suppliers-grid-view');
  const btnTable = document.getElementById('view-table');
  const btnGrid = document.getElementById('view-grid');

  if (!btnTable || !btnGrid || !tableView || !gridView) {
    return;
  }

  const mode = readSavedView();
  if (mode === 'table') {
    gridView.classList.add('hidden');
    tableView.classList.remove('hidden');
    btnTable.classList.add(...ACTIVE_BTN_CLASSES);
    btnTable.classList.remove(...INACTIVE_BTN_CLASSES);
    btnGrid.classList.remove(...ACTIVE_BTN_CLASSES);
    btnGrid.classList.add(...INACTIVE_BTN_CLASSES);
    return;
  }

  tableView.classList.add('hidden');
  gridView.classList.remove('hidden');
  btnGrid.classList.add(...ACTIVE_BTN_CLASSES);
  btnGrid.classList.remove(...INACTIVE_BTN_CLASSES);
  btnTable.classList.remove(...ACTIVE_BTN_CLASSES);
  btnTable.classList.add(...INACTIVE_BTN_CLASSES);
};

export const initializeSupplierViewToggle = () => {
  const tableView = document.getElementById('suppliers-table-view');
  const gridView = document.getElementById('suppliers-grid-view');
  const btnTable = document.getElementById('view-table');
  const btnGrid = document.getElementById('view-grid');

  if (!btnTable || !btnGrid || !tableView || !gridView) {
    return;
  }

  const activateGridView = () => {
    tableView.classList.add('hidden');
    gridView.classList.remove('hidden');
    writeSavedView('grid');
    applySupplierSavedView();
  };

  const activateTableView = () => {
    gridView.classList.add('hidden');
    tableView.classList.remove('hidden');
    writeSavedView('table');
    applySupplierSavedView();
  };

  applySupplierSavedView();

  btnTable.addEventListener('click', activateTableView);
  btnGrid.addEventListener('click', activateGridView);
};
