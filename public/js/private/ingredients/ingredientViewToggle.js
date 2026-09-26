export const initializeIngredientViewToggle = () => {
  const tableView = document.getElementById('ingredients-table-view');
  const gridView = document.getElementById('ingredients-grid-view');
  const btnTable = document.getElementById('view-table');
  const btnGrid = document.getElementById('view-grid');

  if (!btnTable || !btnGrid || !tableView || !gridView) {
    return;
  }

  const activateGridView = () => {
    tableView.classList.add('hidden');
    gridView.classList.remove('hidden');

    btnGrid.classList.add('bg-[#43655c]', 'text-white');
    btnGrid.classList.remove('text-on-surface-variant');
    btnTable.classList.remove('bg-[#43655c]', 'text-white');
    btnTable.classList.add('text-on-surface-variant');
  };

  const activateTableView = () => {
    gridView.classList.add('hidden');
    tableView.classList.remove('hidden');

    btnTable.classList.add('bg-[#43655c]', 'text-white');
    btnTable.classList.remove('text-on-surface-variant');
    btnGrid.classList.remove('bg-[#43655c]', 'text-white');
    btnGrid.classList.add('text-on-surface-variant');
  };

  activateGridView();

  btnTable.addEventListener('click', activateTableView);
  btnGrid.addEventListener('click', activateGridView);
};
