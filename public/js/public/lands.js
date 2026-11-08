/**
 * Interactividad del catálogo público de Regiones Agrícolas (/lands)
 * - Búsqueda en vivo con debounce (250ms) y AbortController
 * - Interacción con el mapa vectorial SVG de México (hover informativo y clic para filtrar)
 * - Chips rápidos de cobertura y paginación dinámica sin recargar la página
 */

const ACTIVE_CHIP_CLASSES = [
  'bg-[#1b4332]',
  'text-white',
  'border-[#1b4332]',
  'font-bold',
];
const ACTIVE_REGION_CHIP_CLASSES = [
  'bg-emerald-700',
  'text-white',
  'border-emerald-700',
  'font-bold',
];
const INACTIVE_CHIP_CLASSES = [
  'bg-card',
  'text-muted-foreground',
  'border-border',
];

let activeController = null;
let debounceTimer = null;

const setElementClasses = (el, addList, removeList) => {
  removeList.forEach((cls) => el.classList.remove(cls));
  addList.forEach((cls) => el.classList.add(cls));
};

const syncToolbarState = (form) => {
  const searchVal = (form.querySelector('#region-search')?.value || '').trim();
  const coverageVal = form.querySelector('#lands-coverage-hidden')?.value || '';
  const hasFilters = Boolean(searchVal || coverageVal);

  document
    .getElementById('clear-lands-search-btn')
    ?.classList.toggle('hidden', !searchVal);
  document
    .getElementById('public-map-reset-btn')
    ?.classList.toggle('hidden', !hasFilters);

  document.querySelectorAll('[data-coverage-chip]').forEach((chip) => {
    const val = chip.dataset.coverageChip || '';
    const isActive = val === '' ? !hasFilters : coverageVal === val;
    if (isActive) {
      setElementClasses(chip, ACTIVE_CHIP_CLASSES, INACTIVE_CHIP_CLASSES);
    } else {
      setElementClasses(chip, INACTIVE_CHIP_CLASSES, ACTIVE_CHIP_CLASSES);
    }
  });

  document.querySelectorAll('[data-region-quick-chip]').forEach((chip) => {
    const isSelected =
      searchVal.toLowerCase() ===
      (chip.dataset.regionQuickChip || '').toLowerCase();
    if (isSelected) {
      setElementClasses(
        chip,
        ACTIVE_REGION_CHIP_CLASSES,
        INACTIVE_CHIP_CLASSES,
      );
    } else {
      setElementClasses(
        chip,
        INACTIVE_CHIP_CLASSES,
        ACTIVE_REGION_CHIP_CLASSES,
      );
    }
  });
};

const buildFilterUrl = (form, extraPage = null) => {
  const url = new URL('/lands', window.location.origin);
  const search = (form.querySelector('#region-search')?.value || '').trim();
  const coverage = form.querySelector('#lands-coverage-hidden')?.value || '';

  if (search) url.searchParams.set('search', search);
  if (coverage) url.searchParams.set('coverage', coverage);
  if (extraPage) url.searchParams.set('page', String(extraPage));
  return url.pathname + url.search;
};

const applyFetchedLandsDocument = (doc, currentRegion) => {
  const incoming = doc.getElementById('lands-results-region');
  const incomingCount = doc.getElementById('total-lands-count-header');
  const currentCount = document.getElementById('total-lands-count-header');

  if (incoming) currentRegion.replaceWith(incoming);
  if (incomingCount && currentCount) {
    currentCount.textContent = incomingCount.textContent;
  }
};

const fetchAndSwapResults = async (targetUrl, pushHistory = true) => {
  const region = document.getElementById('lands-results-region');
  if (!region) return;

  activeController?.abort();
  activeController = new AbortController();
  region.classList.add('opacity-60', 'transition-opacity');

  try {
    const response = await fetch(targetUrl, {
      signal: activeController.signal,
      headers: { Accept: 'text/html' },
    });
    if (!response.ok) return;

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    applyFetchedLandsDocument(doc, region);
    if (pushHistory) window.history.replaceState({}, '', targetUrl);
  } catch (err) {
    if (err?.name !== 'AbortError') {
      region.classList.remove('opacity-60');
    }
  }
};

const bindNationalMapInteractions = (form, triggerUpdate) => {
  const svg = document.getElementById('national-regions-svg');
  const tooltipLabel = document.getElementById('public-map-tooltip-label');
  const toggleBtn = document.getElementById('toggle-public-lands-map-btn');
  const mapPanel = document.getElementById('public-lands-map-panel');

  toggleBtn?.addEventListener('click', () => {
    if (!mapPanel) return;
    const isHidden = mapPanel.classList.toggle('hidden');
    toggleBtn.setAttribute('aria-expanded', String(!isHidden));
  });

  if (!svg) return;

  svg.addEventListener('mouseover', (event) => {
    const path = event.target.closest('path[data-state-name]');
    if (!path || !tooltipLabel) return;
    const state = path.dataset.stateName;
    const region = path.dataset.regionName;
    const count = Number(path.dataset.plagueCount || 0);
    tooltipLabel.textContent = region
      ? `${state} · Cobertura región ${region} (${count} ficha(s) publicada(s)) — Clic para filtrar`
      : `${state} · Sin región específica vinculada en el filtro rápido`;
  });

  svg.addEventListener('click', (event) => {
    const path = event.target.closest('path[data-region-name]');
    const regionName = path?.dataset.regionName;
    const searchInput = form.querySelector('#region-search');
    if (!regionName || !searchInput) return;

    searchInput.value = regionName;
    syncToolbarState(form);
    triggerUpdate();
  });
};

const bindSearchShortcuts = (searchInput) => {
  document.addEventListener('keydown', (event) => {
    const tag = document.activeElement?.tagName;
    if (event.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
      event.preventDefault();
      searchInput?.focus();
    }
  });
};

const bindBulletinModal = () => {
  const modal = document.getElementById('modal-create-bulletin');
  const openBtn = document.getElementById('open-bulletin-modal-btn');
  if (!modal) return;

  const openModal = () => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };
  const closeModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };

  openBtn?.addEventListener('click', openModal);
  modal.querySelectorAll('[data-close-bulletin-modal]').forEach((btn) => {
    btn.addEventListener('click', closeModal);
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
};

const initPublicLandsCatalog = () => {
  bindBulletinModal();
  const form = document.getElementById('form-filtros-lands');
  if (!form) return;

  const searchInput = form.querySelector('#region-search');
  const coverageHidden = form.querySelector('#lands-coverage-hidden');
  const clearBtn = document.getElementById('clear-lands-search-btn');
  const resetMapBtn = document.getElementById('public-map-reset-btn');

  const triggerUpdate = () => fetchAndSwapResults(buildFilterUrl(form));

  const resetAllFilters = () => {
    if (searchInput) searchInput.value = '';
    if (coverageHidden) coverageHidden.value = '';
    syncToolbarState(form);
    triggerUpdate();
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    syncToolbarState(form);
    triggerUpdate();
  });

  searchInput?.addEventListener('input', () => {
    syncToolbarState(form);
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(triggerUpdate, 250);
  });

  clearBtn?.addEventListener('click', () => {
    if (!searchInput) return;
    searchInput.value = '';
    syncToolbarState(form);
    triggerUpdate();
  });

  resetMapBtn?.addEventListener('click', resetAllFilters);

  form.querySelectorAll('[data-coverage-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.coverageChip || '';
      if (val === '') {
        resetAllFilters();
        return;
      }
      if (coverageHidden) {
        coverageHidden.value = coverageHidden.value === val ? '' : val;
      }
      syncToolbarState(form);
      triggerUpdate();
    });
  });

  form.querySelectorAll('[data-region-quick-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      if (!searchInput) return;
      const targetRegion = chip.dataset.regionQuickChip || '';
      searchInput.value =
        searchInput.value.toLowerCase() === targetRegion.toLowerCase()
          ? ''
          : targetRegion;
      syncToolbarState(form);
      triggerUpdate();
    });
  });

  document.addEventListener('click', (event) => {
    const resetLink = event.target.closest('[data-lands-reset-link]');
    if (resetLink) {
      event.preventDefault();
      resetAllFilters();
      return;
    }
    const pageLink = event.target.closest('[data-lands-page-link]');
    if (pageLink) {
      event.preventDefault();
      fetchAndSwapResults(pageLink.getAttribute('href'));
    }
  });

  bindNationalMapInteractions(form, triggerUpdate);
  bindSearchShortcuts(searchInput);
  syncToolbarState(form);
};

document.addEventListener('DOMContentLoaded', initPublicLandsCatalog);
