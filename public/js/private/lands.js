import {
  confirmAsyncAction,
  fetchHtmlDocument,
  refreshLucideIcons,
  setRegionLoading,
  showAsyncToast,
  swapFragments,
  withButtonLoading,
} from './asyncUi.js';

const VIEW_STORAGE_KEY = 'agrosystem:lands:view';
const DEFAULT_CENTER = [23.634501, -102.552784];

let landsMap = null;
let markersLayer = null;
let farmModalMap = null;
let farmModalMarker = null;
let filterDebounceTimer = null;

const createPinIcon = () =>
  L.divIcon({
    html: `<div class="w-7 h-7 bg-[#1b4332] border-2 border-white rounded-full flex items-center justify-center shadow-md">
      <svg width="13" height="13" fill="white" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      </svg>
    </div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });

const escapePopupText = (text) =>
  String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const syncLandsMapMarkers = (autoFit = false) => {
  if (!landsMap || typeof L === 'undefined') return;
  if (!markersLayer) {
    markersLayer = L.featureGroup().addTo(landsMap);
  }
  markersLayer.clearLayers();

  const icon = createPinIcon();
  document.querySelectorAll('#lands-grid article[data-lat]').forEach((card) => {
    const lat = Number.parseFloat(card.dataset.lat);
    const lng = Number.parseFloat(card.dataset.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    const name = escapePopupText(
      card.dataset.farmName || card.querySelector('h2')?.textContent?.trim(),
    );
    const url = card.dataset.farmUrl || '#';
    const marker = L.marker([lat, lng], { icon }).bindPopup(
      `<div class="font-sans text-xs">
        <strong class="block text-sm text-[#1b4332] mb-1">${name}</strong>
        <a href="${url}" class="font-bold text-[#2d6a4f] hover:underline">Abrir Expediente →</a>
      </div>`,
    );
    markersLayer.addLayer(marker);
  });

  if (autoFit && markersLayer.getLayers().length > 0) {
    landsMap.fitBounds(markersLayer.getBounds().pad(0.25));
  }
};

const initLandsOverviewMap = () => {
  const mapEl = document.getElementById('lands-map');
  if (!mapEl || typeof L === 'undefined') return;

  landsMap = L.map('lands-map', { zoomControl: true }).setView(
    DEFAULT_CENTER,
    5,
  );

  const osmLayer = L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      referrerPolicy: 'strict-origin-when-cross-origin',
    },
  );
  const satLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19,
    },
  );

  osmLayer.addTo(landsMap);
  L.control
    .layers({ 'Mapa base': osmLayer, Satélite: satLayer }, null, {
      position: 'topright',
    })
    .addTo(landsMap);

  window.setTimeout(() => landsMap.invalidateSize(), 200);
  syncLandsMapMarkers(true);

  document.getElementById('map-zoom-fit')?.addEventListener('click', () => {
    if (markersLayer && markersLayer.getLayers().length > 0) {
      landsMap.fitBounds(markersLayer.getBounds().pad(0.25));
    } else {
      landsMap.setView(DEFAULT_CENTER, 5);
    }
  });

  const toggleMapBtn = document.getElementById('btn-toggle-lands-map');
  const mapWrapper = document.getElementById('lands-map-wrapper');
  toggleMapBtn?.addEventListener('click', () => {
    if (!mapWrapper) return;
    const isHidden = mapWrapper.classList.toggle('hidden');
    toggleMapBtn.setAttribute('aria-expanded', String(!isHidden));
    const label = toggleMapBtn.querySelector('[data-map-toggle-label]');
    if (label) label.textContent = isHidden ? 'Mostrar mapa' : 'Ocultar mapa';
    if (!isHidden) window.setTimeout(() => landsMap?.invalidateSize(), 120);
  });
};

const getPreferredView = () => {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'table'
      ? 'table'
      : 'grid';
  } catch {
    return 'grid';
  }
};

const applyLandsView = (mode) => {
  const grid = document.getElementById('lands-grid');
  const table = document.getElementById('lands-table-view');
  const btnGrid = document.getElementById('lands-view-grid');
  const btnTable = document.getElementById('lands-view-table');
  const isTable = mode === 'table';

  grid?.classList.toggle('hidden', isTable);
  table?.classList.toggle('hidden', !isTable);

  if (btnGrid && btnTable) {
    btnGrid.setAttribute('aria-pressed', String(!isTable));
    btnTable.setAttribute('aria-pressed', String(isTable));
    btnGrid.className = !isTable
      ? 'p-1.5 rounded-lg bg-[#1b4332] text-white transition-all cursor-pointer'
      : 'p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all cursor-pointer';
    btnTable.className = isTable
      ? 'p-1.5 rounded-lg bg-[#1b4332] text-white transition-all cursor-pointer'
      : 'p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all cursor-pointer';
  }
};

const initViewToggle = () => {
  applyLandsView(getPreferredView());
  document.getElementById('lands-view-grid')?.addEventListener('click', () => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, 'grid');
    } catch {
      /* ignore */
    }
    applyLandsView('grid');
  });
  document.getElementById('lands-view-table')?.addEventListener('click', () => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, 'table');
    } catch {
      /* ignore */
    }
    applyLandsView('table');
  });
};

const updateActiveFilterBadge = () => {
  const badge = document.getElementById('private-lands-active-filters-count');
  if (!badge) return;
  const region = document.getElementById('lands-filter-region')?.value || '';
  const type = document.getElementById('lands-filter-type')?.value || '';
  const count = Number(Boolean(region)) + Number(Boolean(type));
  badge.textContent = String(count);
  badge.classList.toggle('hidden', count === 0);
};

const buildFilterUrlFromForm = () => {
  const form = document.getElementById('lands-filter-form');
  if (!form) return window.location.pathname + window.location.search;
  const url = new URL('/private/lands', window.location.origin);
  new FormData(form).forEach((val, key) => {
    const clean = String(val || '').trim();
    if (clean) url.searchParams.set(key, clean);
  });
  return url.pathname + url.search;
};

const refreshLandsFromUrl = async (targetUrl, pushState = true) => {
  const resultsRegion = document.getElementById('lands-results-region');
  setRegionLoading(resultsRegion, true, 'Actualizando predios...');

  const response = await fetchHtmlDocument(targetUrl);
  setRegionLoading(resultsRegion, false);
  if (!response.ok || response.aborted) return;

  swapFragments(response.doc, [
    '#lands-kpi-region',
    '#lands-status-pills',
    '#lands-results-region',
  ]);
  applyLandsView(getPreferredView());
  syncLandsMapMarkers(false);
  updateActiveFilterBadge();

  if (pushState) window.history.replaceState({}, '', targetUrl);
};

const initFilterControls = () => {
  const form = document.getElementById('lands-filter-form');
  const searchInput = document.getElementById('lands-search');
  const toggleBtn = document.getElementById('toggle-private-lands-filters-btn');
  const panel = document.getElementById('private-lands-collapsible-filters');

  toggleBtn?.addEventListener('click', () => {
    if (!panel) return;
    const isOpen = !panel.classList.contains('hidden');
    panel.classList.toggle('hidden', isOpen);
    panel.classList.toggle('flex', !isOpen);
    toggleBtn.setAttribute('aria-expanded', String(!isOpen));
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    refreshLandsFromUrl(buildFilterUrlFromForm());
  });

  searchInput?.addEventListener('input', () => {
    clearTimeout(filterDebounceTimer);
    filterDebounceTimer = window.setTimeout(() => {
      refreshLandsFromUrl(buildFilterUrlFromForm());
    }, 250);
  });

  document.querySelectorAll('.lands-filter-select').forEach((sel) => {
    sel.addEventListener('change', () => {
      updateActiveFilterBadge();
      refreshLandsFromUrl(buildFilterUrlFromForm());
    });
  });

  document.addEventListener('keydown', (event) => {
    const tag = document.activeElement?.tagName;
    if (event.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
      event.preventDefault();
      searchInput?.focus();
    }
  });

  updateActiveFilterBadge();
};

const handleDelegatedStatusForm = async (form) => {
  const mode = form.dataset.landStatusForm;
  const name = form.dataset.landName || 'este predio';
  const isArchive = mode === 'archive';

  const confirmed = await confirmAsyncAction({
    title: isArchive ? '¿Archivar predio?' : '¿Restaurar predio?',
    description: isArchive
      ? `El predio "${name}" pasará a la bandeja de archivados conservando íntegro su expediente histórico.`
      : `El predio "${name}" volverá a estar activo para el registro operativo de ciclos y aplicaciones.`,
    confirmLabel: isArchive ? 'Sí, archivar' : 'Sí, restaurar',
    variant: isArchive ? 'warning' : 'editorial',
  });
  if (!confirmed) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  await withButtonLoading(submitBtn, 'Procesando...', async () => {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json', 'X-Requested-With': 'fetch' },
    });
    if (!response.ok) {
      showAsyncToast('No se pudo actualizar el estado del predio.', 'error');
      return;
    }
    showAsyncToast(
      isArchive
        ? 'Predio archivado correctamente.'
        : 'Predio restaurado correctamente.',
      'success',
    );
    await refreshLandsFromUrl(
      window.location.pathname + window.location.search,
      false,
    );
  });
};

const handleStatusPillClick = (statusPill) => {
  const statusInput = document.getElementById('lands-filter-status');
  if (statusInput) {
    statusInput.value = statusPill.dataset.landsStatusPill || 'active';
  }
  refreshLandsFromUrl(buildFilterUrlFromForm());
};

const handleAsyncLinkClick = (asyncLink) => {
  ['lands-search', 'lands-filter-region', 'lands-filter-type'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  refreshLandsFromUrl(asyncLink.getAttribute('href'));
};

const focusFarmOnMap = (focusBtn) => {
  if (!landsMap) return;
  const lat = Number.parseFloat(focusBtn.dataset.lat);
  const lng = Number.parseFloat(focusBtn.dataset.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return;

  document.getElementById('lands-map-wrapper')?.classList.remove('hidden');
  landsMap.invalidateSize();
  landsMap.setView([lat, lng], 14, { animate: true });
  document
    .getElementById('lands-map')
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const handleLandsDocumentClick = (event) => {
  const statusPill = event.target.closest('[data-lands-status-pill]');
  if (statusPill) {
    event.preventDefault();
    handleStatusPillClick(statusPill);
    return;
  }

  const asyncLink = event.target.closest('[data-lands-async-link]');
  if (asyncLink) {
    event.preventDefault();
    handleAsyncLinkClick(asyncLink);
    return;
  }

  const focusBtn = event.target.closest('[data-focus-farm-map]');
  if (focusBtn) {
    focusFarmOnMap(focusBtn);
    return;
  }

  if (event.target.closest('#btn-open-new-land-card')) {
    document.getElementById('btn-open-new-land')?.click();
  }
};

const initDelegatedClicksAndForms = () => {
  document.addEventListener('click', handleLandsDocumentClick);

  document.addEventListener('submit', (event) => {
    const statusForm = event.target.closest('form[data-land-status-form]');
    if (!statusForm) return;
    event.preventDefault();
    handleDelegatedStatusForm(statusForm);
  });
};

const ensureModalPickerMap = () => {
  if (farmModalMap || typeof L === 'undefined') return;
  const container = document.getElementById('farm-map');
  if (!container) return;

  farmModalMap = L.map('farm-map', {
    zoomControl: true,
    fadeAnimation: true,
  }).setView([19.432608, -99.133209], 5);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    referrerPolicy: 'strict-origin-when-cross-origin',
  }).addTo(farmModalMap);

  farmModalMap.on('click', (e) => {
    const { lat, lng } = e.latlng;
    const latInput = document.getElementById('lat');
    const lngInput = document.getElementById('lng');
    const latDisplay = document.getElementById('lat-display');
    const lngDisplay = document.getElementById('lng-display');

    if (latInput) latInput.value = lat.toFixed(7);
    if (lngInput) lngInput.value = lng.toFixed(7);
    if (latDisplay) latDisplay.textContent = lat.toFixed(6);
    if (lngDisplay) lngDisplay.textContent = lng.toFixed(6);

    if (farmModalMarker) {
      farmModalMarker.setLatLng([lat, lng]);
    } else {
      farmModalMarker = L.marker([lat, lng]).addTo(farmModalMap);
    }
  });
};

const resetModalFormState = (form) => {
  form?.reset();
  const errBox = document.getElementById('form-new-land-errors');
  if (errBox) {
    errBox.textContent = '';
    errBox.classList.add('hidden');
  }
  const latInput = document.getElementById('lat');
  const lngInput = document.getElementById('lng');
  const latDisplay = document.getElementById('lat-display');
  const lngDisplay = document.getElementById('lng-display');
  if (latInput) latInput.value = '';
  if (lngInput) lngInput.value = '';
  if (latDisplay) latDisplay.textContent = '—';
  if (lngDisplay) lngDisplay.textContent = '—';
  if (farmModalMarker && farmModalMap) {
    farmModalMap.removeLayer(farmModalMarker);
    farmModalMarker = null;
  }
};

const submitNewLandAsync = async (form, closeModal) => {
  const submitBtn = document.getElementById('btn-submit-farm');
  const errBox = document.getElementById('form-new-land-errors');

  await withButtonLoading(submitBtn, 'Guardando...', async () => {
    const body = new URLSearchParams(new FormData(form));
    const response = await fetch(form.action, {
      method: 'POST',
      body,
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const msg =
        payload?.errors?.join(' ') ||
        'Revisa los datos capturados e inténtalo nuevamente.';
      if (errBox) {
        errBox.textContent = msg;
        errBox.classList.remove('hidden');
      }
      showAsyncToast(msg, 'error');
      return;
    }

    resetModalFormState(form);
    closeModal();
    showAsyncToast('Predio registrado exitosamente.', 'success');
    await refreshLandsFromUrl(
      window.location.pathname + window.location.search,
      false,
    );
  });
};

const initNewLandModal = () => {
  const modal = document.getElementById('modal-new-land');
  const form = document.getElementById('form-new-land');
  if (!modal) return;

  const openModal = () => {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    ensureModalPickerMap();
    window.requestAnimationFrame(() => farmModalMap?.invalidateSize());
    document.getElementById('farm-name')?.focus();
  };

  const closeModal = () => {
    if (modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  };

  document
    .getElementById('btn-open-new-land')
    ?.addEventListener('click', openModal);
  document
    .getElementById('btn-close-new-land')
    ?.addEventListener('click', closeModal);
  document
    .getElementById('btn-cancel-new-land')
    ?.addEventListener('click', closeModal);
  document
    .getElementById('modal-new-land-backdrop')
    ?.addEventListener('click', closeModal);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitNewLandAsync(form, closeModal);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  refreshLucideIcons();
  initLandsOverviewMap();
  initViewToggle();
  initFilterControls();
  initDelegatedClicksAndForms();
  initNewLandModal();
});
