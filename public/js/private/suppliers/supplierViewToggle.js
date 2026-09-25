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
    tableView.style.display = 'none';
    gridView.classList.remove('hidden');
    gridView.style.display = 'grid';

    btnGrid.classList.add('bg-[#43655c]', 'text-white');
    btnGrid.classList.remove('text-on-surface-variant');
    btnTable.classList.remove('bg-[#43655c]', 'text-white');
    btnTable.classList.add('text-on-surface-variant');
  };

  const activateTableView = () => {
    gridView.classList.add('hidden');
    gridView.style.display = 'none';
    tableView.classList.remove('hidden');
    tableView.style.display = '';

    btnTable.classList.add('bg-[#43655c]', 'text-white');
    btnTable.classList.remove('text-on-surface-variant');
    btnGrid.classList.remove('bg-[#43655c]', 'text-white');
    btnGrid.classList.add('text-on-surface-variant');
  };

  activateGridView();

  btnTable.addEventListener('click', activateTableView);
  btnGrid.addEventListener('click', activateGridView);
};
