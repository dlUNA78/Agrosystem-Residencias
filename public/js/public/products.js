/**
 * products.js — Interactividad asíncrona del Catálogo Público de Productos (/products)
 * Gestiona búsqueda con debounce, filtros cruzados (categoría, cultivo, plaga y banda NOM),
 * chips táctiles sincronizados, atajo `/` y paginación sin recarga completa.
 */

const form = document.getElementById('form-filtros-products');
const searchInput = document.getElementById('search-products-input');
const clearSearchBtn = document.getElementById('clear-products-search-btn');
const categorySelect = document.getElementById('category-products-filter');
const cropSelect = document.getElementById('crop-products-filter');
const plagueSelect = document.getElementById('plague-products-filter');
const hazardHidden = document.getElementById('hazard-products-hidden');
const toggleFiltersBtn = document.getElementById('toggle-products-filters-btn');
const collapsibleFilters = document.getElementById(
  'products-collapsible-filters',
);
const secondaryChips = document.getElementById('products-secondary-chips');
const activeFiltersCountBadge = document.getElementById(
  'products-active-filters-count',
);

const FILTER_FIELDS = [
  ['search', searchInput],
  ['category', categorySelect],
  ['crop', cropSelect],
  ['plague', plagueSelect],
  ['hazard', hazardHidden],
];

let activeAbortController = null;
let searchDebounceTimer = null;

const countActiveProductFilters = () =>
  [
    categorySelect?.value,
    cropSelect?.value,
    plagueSelect?.value,
    hazardHidden?.value,
  ].filter(Boolean).length;

const updateActiveFilterCount = () => {
  const count = countActiveProductFilters();

  if (activeFiltersCountBadge) {
    activeFiltersCountBadge.textContent = String(count);
    activeFiltersCountBadge.classList.toggle('hidden', count === 0);
  }
  if (toggleFiltersBtn) {
    toggleFiltersBtn.classList.toggle('bg-emerald-50', count > 0);
    toggleFiltersBtn.classList.toggle('border-emerald-300', count > 0);
    toggleFiltersBtn.classList.toggle('text-[#1b4332]', count > 0);
  }
};

const toggleMobileFilters = () => {
  if (!collapsibleFilters) return;
  const isHidden = collapsibleFilters.classList.contains('hidden');
  collapsibleFilters.classList.toggle('hidden', !isHidden);
  if (secondaryChips) {
    secondaryChips.classList.toggle('hidden', !isHidden);
  }
  if (toggleFiltersBtn) {
    toggleFiltersBtn.setAttribute('aria-expanded', String(isHidden));
  }
};

const toggleChipActive = (chip, isActive) => {
  chip.classList.toggle('bg-[#1b4332]', isActive);
  chip.classList.toggle('text-white', isActive);
  chip.classList.toggle('shadow-2xs', isActive);
  chip.classList.toggle('font-bold', isActive);
  chip.classList.toggle('bg-secondary', !isActive);
  chip.classList.toggle('text-foreground', !isActive);
  chip.classList.toggle('hover:bg-border', !isActive);
};

const syncChipsVisualState = () => {
  const currentCategory = categorySelect ? categorySelect.value : '';
  const currentHazard = hazardHidden ? hazardHidden.value : '';

  document.querySelectorAll('[data-category-chip]').forEach((chip) => {
    toggleChipActive(chip, chip.dataset.categoryChip === currentCategory);
  });
  document.querySelectorAll('[data-hazard-chip]').forEach((chip) => {
    toggleChipActive(chip, chip.dataset.hazardChip === currentHazard);
  });
  if (clearSearchBtn && searchInput) {
    clearSearchBtn.classList.toggle('hidden', !searchInput.value.trim());
  }
  updateActiveFilterCount();
};

const buildFilterUrl = () => {
  const params = new URLSearchParams();
  FILTER_FIELDS.forEach(([param, element]) => {
    const val = element ? element.value.trim() : '';
    if (val) params.set(param, val);
  });
  const qs = params.toString();
  return qs ? `/products?${qs}` : '/products';
};

const bindImageFallbacks = (root = document) => {
  root.querySelectorAll('img[data-fallback-src]').forEach((img) => {
    if (img.dataset.fallbackBound === '1') return;
    img.dataset.fallbackBound = '1';
    img.addEventListener('error', () => {
      const fallback = img.dataset.fallbackSrc;
      if (fallback && !img.src.endsWith(fallback)) {
        img.src = fallback;
      }
    });
  });
};

const swapRegion = (nextDoc, selector) => {
  const current = document.querySelector(selector);
  const incoming = nextDoc.querySelector(selector);
  if (current && incoming) {
    current.replaceWith(incoming);
  }
};

const applyFetchedCatalogHtml = (html, targetUrl, pushHistory) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  swapRegion(doc, '#products-results-region');
  swapRegion(doc, '#products-filter-status');
  swapRegion(doc, '#total-products-count-header');
  if (pushHistory) {
    window.history.pushState({}, '', targetUrl);
  }
  const updatedRegion = document.getElementById('products-results-region');
  bindImageFallbacks(updatedRegion || document);
};

const setResultsDimmed = (isDimmed) => {
  const region = document.getElementById('products-results-region');
  if (!region) return;
  region.classList.toggle('opacity-60', isDimmed);
  region.classList.toggle('pointer-events-none', isDimmed);
  region.classList.add('transition-opacity');
};

const fetchAndRenderCatalog = async (
  targetUrl,
  { pushHistory = true } = {},
) => {
  if (activeAbortController) activeAbortController.abort();
  activeAbortController = new AbortController();
  setResultsDimmed(true);

  try {
    const response = await fetch(targetUrl, {
      signal: activeAbortController.signal,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!response.ok) return;
    applyFetchedCatalogHtml(await response.text(), targetUrl, pushHistory);
  } catch (err) {
    if (err.name !== 'AbortError') {
      window.location.assign(targetUrl);
    }
  } finally {
    setResultsDimmed(false);
  }
};

const syncFormFromUrl = (urlString) => {
  const url = new URL(urlString, window.location.origin);
  FILTER_FIELDS.forEach(([param, element]) => {
    if (element) element.value = url.searchParams.get(param) || '';
  });
  syncChipsVisualState();
};

const triggerFilteredFetch = () => {
  syncChipsVisualState();
  fetchAndRenderCatalog(buildFilterUrl());
};

const handleDelegatedCatalogClick = (event) => {
  const categoryChip = event.target.closest('[data-category-chip]');
  if (categoryChip && categorySelect) {
    categorySelect.value = categoryChip.dataset.categoryChip || '';
    triggerFilteredFetch();
    return;
  }

  const hazardChip = event.target.closest('[data-hazard-chip]');
  if (hazardChip && hazardHidden) {
    hazardHidden.value = hazardChip.dataset.hazardChip || '';
    triggerFilteredFetch();
    return;
  }

  if (event.target.closest('[data-reset-products-filters]')) {
    event.preventDefault();
    syncFormFromUrl('/products');
    fetchAndRenderCatalog('/products');
    return;
  }

  const pageLink = event.target.closest('[data-products-page-link]');
  if (pageLink) {
    event.preventDefault();
    fetchAndRenderCatalog(pageLink.href);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

const initPublicProductsCatalog = () => {
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    triggerFilteredFetch();
  });

  searchInput?.addEventListener('input', () => {
    syncChipsVisualState();
    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(triggerFilteredFetch, 260);
  });

  clearSearchBtn?.addEventListener('click', () => {
    if (!searchInput) return;
    searchInput.value = '';
    searchInput.focus();
    triggerFilteredFetch();
  });

  [categorySelect, cropSelect, plagueSelect].forEach((select) => {
    select?.addEventListener('change', triggerFilteredFetch);
  });

  document.addEventListener('click', handleDelegatedCatalogClick);

  document.addEventListener('keydown', (event) => {
    const tag = document.activeElement?.tagName;
    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
      event.preventDefault();
      searchInput?.focus();
    }
  });

  window.addEventListener('popstate', () => {
    syncFormFromUrl(window.location.href);
    fetchAndRenderCatalog(window.location.href, { pushHistory: false });
  });

  toggleFiltersBtn?.addEventListener('click', toggleMobileFilters);

  bindImageFallbacks();
  syncChipsVisualState();
  updateActiveFilterCount();
};

document.addEventListener('DOMContentLoaded', initPublicProductsCatalog);
