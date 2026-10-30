import {
  buildFormRequest,
  fetchHtmlDocument,
  setRegionLoading,
  showAsyncToast,
  startProgressBar,
  swapFragments,
  withButtonLoading,
} from '../asyncUi.js';

const CATALOG_SELECTORS = [
  '#plagues-kpi-region',
  '#plague-clear-filters-slot',
  '#plagues-toolbar-pills',
  '#plagues-results-region',
];

let activeCatalogController = null;
let searchDebounceTimer = null;

const initializeImageFallbacks = (root = document) => {
  root.querySelectorAll('.plague-list-image').forEach((image) => {
    if (image.dataset.fallbackBound === 'true') return;
    image.dataset.fallbackBound = 'true';
    image.addEventListener(
      'error',
      () => {
        image.classList.add('hidden');
        const fallback = image.nextElementSibling;
        if (fallback?.classList.contains('plague-image-fallback')) {
          fallback.classList.remove('hidden');
          fallback.classList.add('flex');
        }
      },
      { once: true },
    );
  });
};

const getPreferredView = () => {
  const saved = window.localStorage.getItem('plagues-private-view');
  return saved === 'table' ? 'table' : 'grid';
};

const applyPlagueView = (view) => {
  const showTable = view === 'table';
  document
    .getElementById('plagues-table-view')
    ?.classList.toggle('hidden', !showTable);
  document
    .getElementById('plagues-grid-view')
    ?.classList.toggle('hidden', showTable);

  const tableButton = document.getElementById('view-table');
  const gridButton = document.getElementById('view-grid');
  if (!tableButton || !gridButton) return;

  tableButton.classList.toggle('bg-[#1b4332]', showTable);
  tableButton.classList.toggle('text-white', showTable);
  tableButton.classList.toggle('text-muted-foreground', !showTable);
  gridButton.classList.toggle('bg-[#1b4332]', !showTable);
  gridButton.classList.toggle('text-white', !showTable);
  gridButton.classList.toggle('text-muted-foreground', showTable);
};

const syncFilterInputsFromUrl = (urlString) => {
  const form = document.getElementById('plague-filter-form');
  if (!form) return;

  const params = new URL(urlString, window.location.origin).searchParams;
  const searchInput = document.getElementById('plague-search');
  const categorySelect = document.getElementById('filter-category');
  const workflowSelect = document.getElementById('filter-workflow');

  if (searchInput) searchInput.value = params.get('search') || '';
  if (categorySelect) categorySelect.value = params.get('category') || '';
  if (workflowSelect) workflowSelect.value = params.get('workflow') || '';
};

export const applyCatalogDocument = (
  doc,
  targetUrl,
  { pushHistory = false, syncInputs = false } = {},
) => {
  swapFragments(doc, CATALOG_SELECTORS);
  applyPlagueView(getPreferredView());
  initializeImageFallbacks();

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

export const refreshPlagueCatalogView = async (
  targetUrl,
  { pushHistory = true, syncInputs = false, scrollToResults = false } = {},
) => {
  activeCatalogController?.abort();
  const controller = new AbortController();
  activeCatalogController = controller;

  const resultsRegion = document.getElementById('plagues-results-region');
  setRegionLoading(resultsRegion, true, 'Cargando expedientes...');

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

  applyCatalogDocument(result.doc, targetUrl, { pushHistory, syncInputs });

  if (scrollToResults) {
    const updatedRegion = document.getElementById('plagues-results-region');
    if (updatedRegion) {
      const top =
        updatedRegion.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }
  return true;
};

const submitFilterFormAsync = () => {
  const form = document.getElementById('plague-filter-form');
  if (!form) return;
  clearTimeout(searchDebounceTimer);
  const { url } = buildFormRequest(form);
  refreshPlagueCatalogView(url, { pushHistory: true, syncInputs: false });
};

const isPlainLeftClick = (event) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

const resolveCatalogLink = (target) => {
  const link = target.closest(
    '#plagues-kpi-region a[href^="/private/plagues"], [data-async-filter-link], #plagues-results-region nav a[href]',
  );
  if (!link) return null;
  const isPagination = Boolean(link.closest('#plagues-results-region nav'));
  return { href: link.getAttribute('href'), isPagination };
};

const initializeAsyncFiltersAndLinks = () => {
  const form = document.getElementById('plague-filter-form');
  const searchInput = document.getElementById('plague-search');
  const workflowSelect = document.getElementById('filter-workflow');

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

  document.addEventListener('click', (event) => {
    const pill = event.target.closest('[data-workflow-pill]');
    if (pill && workflowSelect) {
      workflowSelect.value = pill.getAttribute('data-workflow-pill') || '';
      submitFilterFormAsync();
      return;
    }

    if (!isPlainLeftClick(event)) return;
    const match = resolveCatalogLink(event.target);
    if (!match?.href) return;

    event.preventDefault();
    refreshPlagueCatalogView(match.href, {
      pushHistory: true,
      syncInputs: true,
      scrollToResults: match.isPagination,
    });
  });

  window.addEventListener('popstate', () => {
    refreshPlagueCatalogView(
      window.location.pathname + window.location.search,
      { pushHistory: false, syncInputs: true },
    );
  });
};

const isTypingTarget = (element) => {
  if (!element) return false;
  const tag = element.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    element.isContentEditable
  );
};

const initializeSearchShortcut = () => {
  const searchInput = document.getElementById('plague-search');
  if (!searchInput) return;

  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || isTypingTarget(event.target)) return;
    const modalOpen = !document
      .getElementById('modal-plague')
      ?.classList.contains('hidden');
    if (modalOpen) return;

    event.preventDefault();
    searchInput.focus();
    searchInput.select();
  });
};

const initializeViewToggle = () => {
  const tableButton = document.getElementById('view-table');
  const gridButton = document.getElementById('view-grid');
  if (!tableButton || !gridButton) return;

  applyPlagueView(getPreferredView());
  tableButton.addEventListener('click', () => {
    applyPlagueView('table');
    window.localStorage.setItem('plagues-private-view', 'table');
  });
  gridButton.addEventListener('click', () => {
    applyPlagueView('grid');
    window.localStorage.setItem('plagues-private-view', 'grid');
  });
};

const initializeDeleteModal = () => {
  const modal = document.getElementById('modal-delete-plague');
  const backdrop = document.getElementById('modal-delete-plague-backdrop');
  const form = document.getElementById('delete-plague-form');
  const name = document.getElementById('delete-plague-name');
  const cancelButton = document.getElementById('btn-cancel-delete-plague');
  const confirmButton = document.getElementById('btn-confirm-delete-plague');

  const close = () => {
    if (!modal) return;
    modal.classList.remove('flex');
    modal.classList.add('hidden');
  };

  const open = (button) => {
    if (!modal || !form || !button) return;
    const id = button.dataset.id || '';
    if (!id) return;
    if (name) name.textContent = button.dataset.name || 'esta plaga';
    form.action = `/private/plagues/delete/${id}`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  document.addEventListener('click', (event) => {
    const deleteBtn = event.target.closest('.btn-delete-plague');
    if (deleteBtn) open(deleteBtn);
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    withButtonLoading(confirmButton, 'Eliminando...', async () => {
      const { url, init } = buildFormRequest(form);
      const result = await fetchHtmlDocument(url, init);
      if (!result.ok) {
        showAsyncToast(result.errorMessage, 'error');
        return;
      }
      close();
      await refreshPlagueCatalogView(
        window.location.pathname + window.location.search,
        { pushHistory: false, syncInputs: false },
      );
      showAsyncToast('Plaga eliminada del padrón.', 'success');
    });
  });

  cancelButton?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal?.classList.contains('hidden')) close();
  });
};

const initializeDetailLinks = () => {
  document.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('.btn-view-plague');
    if (!viewBtn) return;
    const { id } = viewBtn.dataset;
    if (!id) return;
    startProgressBar();
    window.location.href = `/private/plagues/${id}`;
  });
};

export const initializePlagueList = () => {
  initializeImageFallbacks();
  initializeAsyncFiltersAndLinks();
  initializeSearchShortcut();
  initializeViewToggle();
  initializeDeleteModal();
  initializeDetailLinks();
};
