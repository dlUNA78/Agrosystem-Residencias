export const initializeSupplierSearch = () => {
  const searchInput = document.getElementById('supplier-search');

  if (!searchInput) {
    return;
  }

  searchInput.addEventListener('input', () => {
    const search = searchInput.value.toLowerCase().trim();

    const rows = document.querySelectorAll('#suppliers-table-view tbody tr');
    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.classList.toggle('hidden', !text.includes(search));
    });

    const cards = document.querySelectorAll(
      '#suppliers-grid-view > div:not(#btn-add-supplier-card)',
    );
    cards.forEach((card) => {
      const text = card.textContent.toLowerCase();
      card.classList.toggle('hidden', !text.includes(search));
    });
  });
};
