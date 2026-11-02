const buildSearchBarUrl = (searchInput, filterSelects) => {
  const params = new URLSearchParams();
  const search = searchInput?.value.trim();

  if (search) {
    params.set('search', search);
  }

  filterSelects.forEach((select) => {
    if (!select.value) return;
    const parameter = select.dataset.param || select.id.replace('filter-', '');
    params.set(parameter, select.value);
  });

  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ''}`;
};

const bindSingleSearchBar = (searchBar) => {
  if (searchBar.dataset.searchBarReady === 'true') return;
  searchBar.dataset.searchBarReady = 'true';

  const searchInput = searchBar.querySelector('input[type="text"]');
  const filterSelects = searchBar.querySelectorAll('.filter-select');
  const mobileToggle = searchBar.querySelector('[data-search-filter-toggle]');
  const filterPanel = searchBar.querySelector('[data-search-filter-panel]');

  const applyFilters = () => {
    window.location.assign(buildSearchBarUrl(searchInput, filterSelects));
  };

  filterSelects.forEach((select) => {
    select.addEventListener('change', applyFilters);
  });

  searchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyFilters();
    }
  });

  mobileToggle?.addEventListener('click', () => {
    if (!filterPanel) return;
    const isHidden = filterPanel.classList.contains('hidden');
    filterPanel.classList.toggle('hidden', !isHidden);
    filterPanel.classList.toggle('flex', isHidden);
    mobileToggle.setAttribute('aria-expanded', String(isHidden));
  });
};

export const initializePrivateSearchBars = () => {
  document
    .querySelectorAll('[data-private-search-bar]')
    .forEach(bindSingleSearchBar);
};
