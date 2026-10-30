import {
  buildFormRequest,
  confirmAsyncAction,
  fetchHtmlDocument,
  setRegionLoading,
  showAsyncToast,
  swapFragments,
  withButtonLoading,
} from '../asyncUi.js';
import { observeCropDialog } from '../cropDialog.js';

const CATALOG_SELECTORS = [
  '#crops-kpi-region',
  '#crop-clear-filters-slot',
  '#crops-toolbar-pills',
  '#crops-results-region',
];

let activeCatalogController = null;
let searchDebounceTimer = null;

const getPreferredView = () => {
  const saved = window.localStorage.getItem('crops-private-view');
  return saved === 'table' ? 'table' : 'grid';
};

const applyCropView = (view) => {
  const showTable = view === 'table';
  document
    .getElementById('crops-table-view')
    ?.classList.toggle('hidden', !showTable);
  document
    .getElementById('crops-grid-view')
    ?.classList.toggle('hidden', showTable);

  const tableButton = document.getElementById('view-table');
  const gridButton = document.getElementById('view-grid');
  if (!tableButton || !gridButton) return;

  tableButton.classList.toggle('bg-primary', showTable);
  tableButton.classList.toggle('text-white', showTable);
  tableButton.classList.toggle('text-muted-foreground', !showTable);
  tableButton.setAttribute('aria-pressed', String(showTable));

  gridButton.classList.toggle('bg-primary', !showTable);
  gridButton.classList.toggle('text-white', !showTable);
  gridButton.classList.toggle('text-muted-foreground', showTable);
  gridButton.setAttribute('aria-pressed', String(!showTable));
};

const syncFilterInputsFromUrl = (urlString) => {
  const params = new URL(urlString, window.location.origin).searchParams;
  const searchInput = document.getElementById('crop-search');
  const categorySelect = document.getElementById('filter-type');
  const workflowSelect = document.getElementById('filter-workflow');

  if (searchInput) searchInput.value = params.get('search') || '';
  if (categorySelect) categorySelect.value = params.get('category') || '';
  if (workflowSelect) workflowSelect.value = params.get('workflow') || '';
};

export const applyCropCatalogDocument = (
  doc,
  targetUrl,
  { pushHistory = false, syncInputs = false } = {},
) => {
  swapFragments(doc, CATALOG_SELECTORS);
  applyCropView(getPreferredView());

  if (syncInputs && targetUrl) {
    syncFilterInputsFromUrl(targetUrl);
  }
  if (pushHistory && targetUrl) {
    const normalized = new URL(targetUrl, window.location.origin);
    const nextHref = normalized.pathname + normalized.search;
    if (nextHref !== window.location.pathname + window.location.search) {
      window.history.pushState({}, '', nextHref);
    }
  }
};

export const refreshCropCatalogView = async (
  targetUrl,
  { pushHistory = true, syncInputs = false, scrollToResults = false } = {},
) => {
  activeCatalogController?.abort();
  const controller = new AbortController();
  activeCatalogController = controller;

  const resultsRegion = document.getElementById('crops-results-region');
  setRegionLoading(resultsRegion, true, 'Cargando cultivos...');

  const result = await fetchHtmlDocument(targetUrl, {
    method: 'GET',
    signal: controller.signal,
  });

  if (result.aborted) return false;
  setRegionLoading(resultsRegion, false);

  if (!result.ok) {
    showAsyncToast(result.errorMessage, 'error');
    return false;
  }

  applyCropCatalogDocument(result.doc, targetUrl, { pushHistory, syncInputs });

  if (scrollToResults) {
    const updated = document.getElementById('crops-results-region');
    if (updated) {
      const top = updated.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }
  return true;
};

const submitFilterFormAsync = () => {
  const form = document.getElementById('crop-filter-form');
  if (!form) return;
  clearTimeout(searchDebounceTimer);
  const { url } = buildFormRequest(form);
  refreshCropCatalogView(url, { pushHistory: true, syncInputs: false });
};

const isPlainLeftClick = (event) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

const resolveCatalogLink = (target) => {
  const link = target.closest(
    '#crops-kpi-region a[href^="/private/crops"], [data-async-filter-link], #crops-results-region nav a[href]',
  );
  if (!link) return null;
  const isPagination = Boolean(link.closest('#crops-results-region nav'));
  return { href: link.getAttribute('href'), isPagination };
};

const handleCatalogLinkClick = (event) => {
  const pill = event.target.closest('[data-workflow-pill]');
  if (pill) {
    const workflowSelect = document.getElementById('filter-workflow');
    if (workflowSelect) {
      workflowSelect.value = pill.getAttribute('data-workflow-pill') || '';
      submitFilterFormAsync();
      return;
    }
  }

  if (!isPlainLeftClick(event)) return;
  const match = resolveCatalogLink(event.target);
  if (!match?.href) return;

  event.preventDefault();
  refreshCropCatalogView(match.href, {
    pushHistory: true,
    syncInputs: true,
    scrollToResults: match.isPagination,
  });
};

const initializeAsyncFilters = () => {
  const form = document.getElementById('crop-filter-form');
  const searchInput = document.getElementById('crop-search');

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitFilterFormAsync();
  });

  document.querySelectorAll('.filter-select').forEach((select) => {
    select.addEventListener('change', submitFilterFormAsync);
  });

  searchInput?.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(submitFilterFormAsync, 320);
  });

  document.addEventListener('click', handleCatalogLinkClick);

  window.addEventListener('popstate', () => {
    refreshCropCatalogView(window.location.pathname + window.location.search, {
      pushHistory: false,
      syncInputs: true,
    });
  });
};

const initializeViewToggle = () => {
  const tableButton = document.getElementById('view-table');
  const gridButton = document.getElementById('view-grid');
  if (!tableButton || !gridButton) return;

  applyCropView(getPreferredView());
  tableButton.addEventListener('click', () => {
    applyCropView('table');
    window.localStorage.setItem('crops-private-view', 'table');
  });
  gridButton.addEventListener('click', () => {
    applyCropView('grid');
    window.localStorage.setItem('crops-private-view', 'grid');
  });
};

const executeCropDeletion = async ({ form, confirmBtn, close, name }) => {
  const confirmed = await confirmAsyncAction({
    title: `¿Eliminar "${name}" permanentemente?`,
    description:
      'Se eliminará la ficha agronómica junto con su galería fotográfica y relaciones asociadas. Esta acción no se puede deshacer.',
    confirmLabel: 'Sí, eliminar cultivo',
    cancelLabel: 'Cancelar',
    variant: 'danger',
  });
  if (!confirmed) return;

  await withButtonLoading(confirmBtn, 'Eliminando...', async () => {
    const { url, init } = buildFormRequest(form);
    const result = await fetchHtmlDocument(url, init);
    if (!result.ok) {
      showAsyncToast(result.errorMessage, 'error');
      return;
    }
    close();
    await refreshCropCatalogView(
      window.location.pathname + window.location.search,
      { pushHistory: false, syncInputs: false },
    );
    showAsyncToast('Cultivo eliminado correctamente.', 'success');
  });
};

const initializeDeleteModal = () => {
  const modal = document.getElementById('modal-delete-crop');
  if (!modal) return;
  observeCropDialog(modal);

  const form = document.getElementById('delete-crop-form');
  const nameEl = document.getElementById('delete-crop-name');
  const cancelBtn = document.getElementById('modal-delete-crop-cancel');
  const backdrop = document.getElementById('modal-delete-crop-backdrop');
  const confirmBtn = form?.querySelector('button[type="submit"]');

  const close = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };

  const open = (cropId, cropName) => {
    if (nameEl) nameEl.textContent = cropName;
    if (form) form.action = `/private/crops/delete/${cropId}`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('.delete-crop-btn');
    if (!btn) return;
    const { id, name } = btn.dataset;
    if (id) open(id, name || 'este cultivo');
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameEl?.textContent || 'este cultivo';
    executeCropDeletion({ form, confirmBtn, close, name });
  });

  cancelBtn?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      close();
    }
  });
};

export const initializeCropList = () => {
  initializeAsyncFilters();
  initializeViewToggle();
  initializeDeleteModal();
};
