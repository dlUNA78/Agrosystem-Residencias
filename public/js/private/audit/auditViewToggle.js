const VIEW_STORAGE_KEY = 'agrosystem:audit:view';

const ACTIVE_BTN_CLASSES = ['bg-[#1b4332]', 'text-white', 'shadow-2xs'];
const INACTIVE_BTN_CLASSES = ['text-slate-600', 'hover:text-slate-900'];

const readSavedView = () => {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) || 'table';
  } catch {
    return 'table';
  }
};

const writeSavedView = (mode) => {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
};

export const applyAuditSavedView = () => {
  const tableView = document.getElementById('audit-table-view');
  const gridView = document.getElementById('audit-grid-view');
  const btnTable = document.getElementById('view-table');
  const btnGrid = document.getElementById('view-grid');

  if (!btnTable || !btnGrid || !tableView || !gridView) {
    return;
  }

  const mode = readSavedView();
  if (mode === 'grid') {
    tableView.classList.add('hidden');
    gridView.classList.remove('hidden');
    btnGrid.classList.add(...ACTIVE_BTN_CLASSES);
    btnGrid.classList.remove(...INACTIVE_BTN_CLASSES);
    btnTable.classList.remove(...ACTIVE_BTN_CLASSES);
    btnTable.classList.add(...INACTIVE_BTN_CLASSES);
    return;
  }

  gridView.classList.add('hidden');
  tableView.classList.remove('hidden');
  btnTable.classList.add(...ACTIVE_BTN_CLASSES);
  btnTable.classList.remove(...INACTIVE_BTN_CLASSES);
  btnGrid.classList.remove(...ACTIVE_BTN_CLASSES);
  btnGrid.classList.add(...INACTIVE_BTN_CLASSES);
};

export const initializeAuditViewToggle = () => {
  const tableView = document.getElementById('audit-table-view');
  const gridView = document.getElementById('audit-grid-view');
  const btnTable = document.getElementById('view-table');
  const btnGrid = document.getElementById('view-grid');

  if (!btnTable || !btnGrid || !tableView || !gridView) {
    return;
  }

  btnGrid.addEventListener('click', () => {
    writeSavedView('grid');
    applyAuditSavedView();
  });

  btnTable.addEventListener('click', () => {
    writeSavedView('table');
    applyAuditSavedView();
  });

  applyAuditSavedView();
};
