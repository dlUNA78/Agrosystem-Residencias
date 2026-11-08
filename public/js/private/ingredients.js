import {
  confirmAsyncAction,
  fetchHtmlDocument,
  refreshLucideIcons,
  setRegionLoading,
  showAsyncToast,
  swapFragments,
  withButtonLoading,
} from './asyncUi.js';
import {
  applyStoredIngredientView,
  initializeIngredientViewToggle,
} from './ingredients/ingredientViewToggle.js';
import { initializeIngredientModal } from './ingredients/ingredientModal.js';

let searchDebounceTimer = null;

const buildIngredientsFilterUrl = (extraPage = null) => {
  const form = document.getElementById('form-filter-ingredients');
  const url = new URL('/private/ingredients', window.location.origin);
  if (!form) return url.pathname;

  const formData = new FormData(form);
  for (const [key, rawVal] of formData.entries()) {
    const val = String(rawVal || '').trim();
    if (val) url.searchParams.set(key, val);
  }
  if (extraPage) url.searchParams.set('page', String(extraPage));
  return url.pathname + url.search;
};

const syncQuickTypePills = (selectedType) => {
  document.querySelectorAll('[data-ingredient-type-pill]').forEach((pill) => {
    const isActive = (pill.dataset.ingredientTypePill || '') === selectedType;
    pill.classList.toggle('bg-[#1b4332]', isActive);
    pill.classList.toggle('text-white', isActive);
    pill.classList.toggle('bg-slate-100', !isActive);
    pill.classList.toggle('text-slate-600', !isActive);
  });
};

const refreshIngredientsRegion = async (targetUrl, pushUrl = true) => {
  const region = document.getElementById('ingredients-results-region');
  setRegionLoading(region, true, 'Actualizando catálogo químico...');

  try {
    const doc = await fetchHtmlDocument(targetUrl);
    swapFragments(doc, [
      '#ingredients-results-region',
      '#ingredients-kpi-region',
      '#ingredients-results-counter',
    ]);
    applyStoredIngredientView();
    refreshLucideIcons();
    if (pushUrl) window.history.replaceState({}, '', targetUrl);
  } catch (err) {
    if (err?.name !== 'AbortError') {
      showAsyncToast('No se pudo actualizar el catálogo.', 'error');
    }
  } finally {
    setRegionLoading(
      document.getElementById('ingredients-results-region'),
      false,
    );
  }
};

const handleDeleteIngredientSubmit = async (form) => {
  const name = form.dataset.ingredientName || 'este ingrediente';
  const confirmed = await confirmAsyncAction({
    title: `Eliminar "${name}"`,
    description:
      'El ingrediente activo se eliminará del catálogo normativo y la operación quedará registrada en auditoría.',
    confirmLabel: 'Eliminar molécula',
    variant: 'danger',
  });
  if (!confirmed) return;

  const btn = form.querySelector('button[type="submit"]');
  await withButtonLoading(btn, '...', async () => {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json', 'X-Requested-With': 'fetch' },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      showAsyncToast(data.error || 'No se pudo eliminar el registro.', 'error');
      return;
    }
    showAsyncToast(
      data.message || 'Ingrediente eliminado correctamente.',
      'success',
    );
    await refreshIngredientsRegion(
      window.location.pathname + window.location.search,
      false,
    );
  });
};

const clearIngredientFilters = () => {
  const form = document.getElementById('form-filter-ingredients');
  if (form) {
    form.querySelectorAll('input, select').forEach((el) => {
      el.value = '';
    });
  }
  syncQuickTypePills('');
  refreshIngredientsRegion('/private/ingredients');
};

const bindIngredientsFilterEvents = () => {
  const form = document.getElementById('form-filter-ingredients');
  const searchInput = document.getElementById('ingredient-search');
  const toggleBtn = document.getElementById('btn-toggle-ingredient-filters');
  const advancedPanel = document.getElementById('ingredient-advanced-filters');

  toggleBtn?.addEventListener('click', () => {
    if (!advancedPanel) return;
    const isHidden = advancedPanel.classList.toggle('hidden');
    advancedPanel.classList.toggle('flex', !isHidden);
    toggleBtn.setAttribute('aria-expanded', String(!isHidden));
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    refreshIngredientsRegion(buildIngredientsFilterUrl());
  });

  searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(() => {
      refreshIngredientsRegion(buildIngredientsFilterUrl());
    }, 250);
  });

  form?.querySelectorAll('select').forEach((sel) => {
    sel.addEventListener('change', () => {
      if (sel.id === 'filter-tipo') syncQuickTypePills(sel.value);
      refreshIngredientsRegion(buildIngredientsFilterUrl());
    });
  });
};

const bindDelegatedIngredientActions = () => {
  document.addEventListener('click', (event) => {
    const typePill = event.target.closest('[data-ingredient-type-pill]');
    if (typePill) {
      const value = typePill.dataset.ingredientTypePill || '';
      const select = document.getElementById('filter-tipo');
      if (select) select.value = value;
      syncQuickTypePills(value);
      refreshIngredientsRegion(buildIngredientsFilterUrl());
      return;
    }

    if (event.target.closest('[data-ingredients-clear]')) {
      event.preventDefault();
      clearIngredientFilters();
      return;
    }

    const pageLink = event.target.closest('[data-ingredients-page]');
    if (pageLink) {
      event.preventDefault();
      refreshIngredientsRegion(pageLink.getAttribute('href'));
    }
  });

  document.addEventListener('submit', (event) => {
    const deleteForm = event.target.closest(
      'form[data-delete-ingredient-form]',
    );
    if (!deleteForm) return;
    event.preventDefault();
    handleDeleteIngredientSubmit(deleteForm);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  refreshLucideIcons();
  initializeIngredientViewToggle();
  initializeIngredientModal(() =>
    refreshIngredientsRegion(
      window.location.pathname + window.location.search,
      false,
    ),
  );
  bindIngredientsFilterEvents();
  bindDelegatedIngredientActions();
});
