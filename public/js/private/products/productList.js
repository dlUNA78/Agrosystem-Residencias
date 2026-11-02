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
  '#products-kpi-region',
  '#product-clear-filters-slot',
  '#products-toolbar-pills',
  '#products-results-region',
];

let activeCatalogController = null;
let searchDebounceTimer = null;

const getPreferredView = () => {
  const saved = window.localStorage.getItem('private-products-view');
  return saved === 'table' ? 'table' : 'grid';
};

const applyProductView = (view) => {
  const showTable = view === 'table';
  const tableEl = document.getElementById('products-table-view');
  const gridEl = document.getElementById('products-grid-view');
  tableEl?.classList.toggle('hidden', !showTable);
  gridEl?.classList.toggle('hidden', showTable);
  gridEl?.classList.toggle('grid', !showTable);

  const tableButton = document.getElementById('view-table');
  const gridButton = document.getElementById('view-grid');
  if (!tableButton || !gridButton) return;

  tableButton.classList.toggle('bg-[#1b4332]', showTable);
  tableButton.classList.toggle('text-white', showTable);
  tableButton.classList.toggle('text-muted-foreground', !showTable);
  tableButton.setAttribute('aria-pressed', String(showTable));

  gridButton.classList.toggle('bg-[#1b4332]', !showTable);
  gridButton.classList.toggle('text-white', !showTable);
  gridButton.classList.toggle('text-muted-foreground', showTable);
  gridButton.setAttribute('aria-pressed', String(!showTable));
};

const syncFilterInputsFromUrl = (urlString) => {
  const params = new URL(urlString, window.location.origin).searchParams;
  const searchInput = document.getElementById('product-search');
  const categorySelect = document.getElementById('filter-category');
  const hazardSelect = document.getElementById('filter-hazard');
  const workflowInput = document.getElementById('filter-workflow');

  if (searchInput) searchInput.value = params.get('search') || '';
  if (categorySelect) categorySelect.value = params.get('category') || '';
  if (hazardSelect) hazardSelect.value = params.get('hazard') || '';
  if (workflowInput) workflowInput.value = params.get('workflow') || '';
  updatePrivateProductActiveCount();
};

const updatePrivateProductActiveCount = () => {
  const badge = document.getElementById(
    'private-products-active-filters-count',
  );
  const toggleBtn = document.getElementById(
    'toggle-private-products-filters-btn',
  );
  if (!badge && !toggleBtn) return;

  const count = Array.from(
    document.querySelectorAll('#product-filter-form .filter-select'),
  ).filter((select) => Boolean(select.value)).length;

  if (badge) {
    badge.textContent = String(count);
    badge.classList.toggle('hidden', count === 0);
  }
  if (toggleBtn) {
    toggleBtn.classList.toggle('bg-emerald-50', count > 0);
    toggleBtn.classList.toggle('border-emerald-300', count > 0);
    toggleBtn.classList.toggle('text-[#1b4332]', count > 0);
  }
};

export const applyProductCatalogDocument = (
  doc,
  targetUrl,
  { pushHistory = false, syncInputs = false } = {},
) => {
  swapFragments(doc, CATALOG_SELECTORS);
  applyProductView(getPreferredView());

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

export const refreshProductCatalogView = async (
  targetUrl,
  { pushHistory = true, syncInputs = false, scrollToResults = false } = {},
) => {
  activeCatalogController?.abort();
  const controller = new AbortController();
  activeCatalogController = controller;

  const resultsRegion = document.getElementById('products-results-region');
  setRegionLoading(resultsRegion, true, 'Cargando productos...');

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

  applyProductCatalogDocument(result.doc, targetUrl, {
    pushHistory,
    syncInputs,
  });

  if (scrollToResults) {
    const updated = document.getElementById('products-results-region');
    if (updated) {
      const top = updated.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }
  return true;
};

const submitFilterFormAsync = () => {
  const form = document.getElementById('product-filter-form');
  if (!form) return;
  clearTimeout(searchDebounceTimer);
  const { url } = buildFormRequest(form);
  refreshProductCatalogView(url, { pushHistory: true, syncInputs: false });
};

const isPlainLeftClick = (event) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

const resolveCatalogLink = (target) => {
  const link = target.closest(
    '#products-kpi-region a[href^="/private/products"], [data-async-filter-link], #products-results-region nav a[href]',
  );
  if (!link) return null;
  const isPagination = Boolean(link.closest('#products-results-region nav'));
  return { href: link.getAttribute('href'), isPagination };
};

const handleCatalogLinkClick = (event) => {
  const pill = event.target.closest('[data-workflow-pill]');
  if (pill) {
    const workflowInput = document.getElementById('filter-workflow');
    if (workflowInput) {
      workflowInput.value = pill.getAttribute('data-workflow-pill') || '';
      submitFilterFormAsync();
      return;
    }
  }

  if (!isPlainLeftClick(event)) return;
  const match = resolveCatalogLink(event.target);
  if (!match?.href) return;

  event.preventDefault();
  refreshProductCatalogView(match.href, {
    pushHistory: true,
    syncInputs: true,
    scrollToResults: match.isPagination,
  });
};

const isEditableElementFocused = () => {
  const active = document.activeElement;
  if (!active) return false;
  return (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) ||
    active.isContentEditable
  );
};

const initializeAsyncFilters = () => {
  const form = document.getElementById('product-filter-form');
  const searchInput = document.getElementById('product-search');
  const toggleBtn = document.getElementById(
    'toggle-private-products-filters-btn',
  );
  const collapsibleFilters = document.getElementById(
    'private-products-collapsible-filters',
  );

  toggleBtn?.addEventListener('click', () => {
    if (!collapsibleFilters) return;
    const isHidden = collapsibleFilters.classList.contains('hidden');
    collapsibleFilters.classList.toggle('hidden', !isHidden);
    toggleBtn.setAttribute('aria-expanded', String(isHidden));
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitFilterFormAsync();
  });

  document.querySelectorAll('.filter-select').forEach((select) => {
    select.addEventListener('change', () => {
      updatePrivateProductActiveCount();
      submitFilterFormAsync();
    });
  });

  searchInput?.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(submitFilterFormAsync, 320);
  });

  updatePrivateProductActiveCount();

  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || isEditableElementFocused()) return;
    if (document.querySelector('[role="dialog"]:not(.hidden)')) return;
    event.preventDefault();
    searchInput?.focus();
    searchInput?.select();
  });

  document.addEventListener('click', handleCatalogLinkClick);

  window.addEventListener('popstate', () => {
    refreshProductCatalogView(
      window.location.pathname + window.location.search,
      { pushHistory: false, syncInputs: true },
    );
  });
};

const initializeViewToggle = () => {
  const tableButton = document.getElementById('view-table');
  const gridButton = document.getElementById('view-grid');
  if (!tableButton || !gridButton) return;

  applyProductView(getPreferredView());
  tableButton.addEventListener('click', () => {
    applyProductView('table');
    window.localStorage.setItem('private-products-view', 'table');
  });
  gridButton.addEventListener('click', () => {
    applyProductView('grid');
    window.localStorage.setItem('private-products-view', 'grid');
  });
};

const initializeExpiringModal = () => {
  const modal = document.getElementById('expiring-products-modal');
  if (!modal) return;
  observeCropDialog(modal);

  const open = () => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.documentElement.classList.add('overflow-hidden');
  };
  const close = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.documentElement.classList.remove('overflow-hidden');
  };

  document
    .getElementById('btn-expiring-products')
    ?.addEventListener('click', open);
  [
    'close-expiring-modal',
    'cancel-expiring-modal',
    'expiring-products-backdrop',
  ].forEach((id) =>
    document.getElementById(id)?.addEventListener('click', close),
  );

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      close();
    }
  });
};

const executeProductDeletion = async ({ form, confirmBtn, close, name }) => {
  const confirmed = await confirmAsyncAction({
    title: `¿Eliminar "${name}" permanentemente?`,
    description:
      'Se eliminará la ficha técnica junto con su galería de envases y vinculaciones. Esta acción es irreversible.',
    confirmLabel: 'Sí, eliminar producto',
    cancelLabel: 'Cancelar',
    variant: 'danger',
  });
  if (!confirmed) return;

  await withButtonLoading(confirmBtn, 'Eliminando...', async () => {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      showAsyncToast(
        result.message || 'No se pudo eliminar el producto.',
        'error',
      );
      return;
    }
    close();
    await refreshProductCatalogView(
      window.location.pathname + window.location.search,
      { pushHistory: false, syncInputs: false },
    );
    showAsyncToast(
      result.message || 'Producto eliminado correctamente.',
      'success',
    );
  });
};

const initializeDeleteModal = () => {
  const modal = document.getElementById('delete-modal');
  if (!modal) return;
  observeCropDialog(modal);

  const form = document.getElementById('product-delete-form');
  const nameEl = document.getElementById('delete-product-name');
  const confirmBtn = document.getElementById('confirm-delete');

  const close = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.documentElement.classList.remove('overflow-hidden');
  };

  const open = (id, name) => {
    if (form) form.action = `/private/products/delete/${id}`;
    if (nameEl) nameEl.textContent = name;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.documentElement.classList.add('overflow-hidden');
  };

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-delete-btn]');
    if (!btn?.dataset.id) return;
    open(btn.dataset.id, btn.dataset.name || 'este producto');
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    executeProductDeletion({
      form,
      confirmBtn,
      close,
      name: nameEl?.textContent || 'este producto',
    });
  });

  ['cancel-delete', 'delete-modal-backdrop'].forEach((id) =>
    document.getElementById(id)?.addEventListener('click', close),
  );

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      close();
    }
  });
};

export const initializeProductList = () => {
  initializeAsyncFilters();
  initializeViewToggle();
  initializeExpiringModal();
  initializeDeleteModal();
};
