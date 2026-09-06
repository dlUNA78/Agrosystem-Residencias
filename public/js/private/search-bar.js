document.querySelectorAll('[data-private-search-bar]').forEach((searchBar) => {
  const searchInput = searchBar.querySelector('input[type="text"]');
  const filterSelects = searchBar.querySelectorAll('.filter-select');

  const applyFilters = () => {
    const params = new URLSearchParams();
    const search = searchInput?.value.trim();

    if (search) params.set('search', search);

    filterSelects.forEach((select) => {
      if (!select.value) return;
      const parameter =
        select.dataset.param || select.id.replace('filter-', '');
      params.set(parameter, select.value);
    });

    const query = params.toString();
    window.location.assign(
      `${window.location.pathname}${query ? `?${query}` : ''}`,
    );
  };

  filterSelects.forEach((select) => {
    select.addEventListener('change', applyFilters);
  });

  searchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') applyFilters();
  });
});
