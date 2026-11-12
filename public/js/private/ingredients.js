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

const resolveWorkflowPrompt = (action, name) => {
  if (action === 'approve_archive') {
    return {
      title: `¿Aprobar dictamen de baja para "${name}"?`,
      description:
        'Como segundo evaluador imparcial, confirmas la baja justificada. Se verificará que no existan formulaciones activas.',
      confirmLabel: 'Aprobar baja',
      variant: 'danger',
    };
  }
  if (action === 'reject_archive') {
    return {
      title: `¿Rechazar baja y mantener activo "${name}"?`,
      description:
        'La solicitud de baja será desestimada y la molécula continuará activa.',
      confirmLabel: 'Rechazar baja',
      variant: 'editorial',
    };
  }
  return {
    title: `¿Restaurar a activo "${name}"?`,
    description: 'La molécula volverá al catálogo activo.',
    confirmLabel: 'Restaurar',
    variant: 'editorial',
  };
};

const handleWorkflowIngredientSubmit = async (form) => {
  const name = form.dataset.ingredientName || 'este ingrediente';
  const action = form.dataset.ingredientAction;
  const prompt = resolveWorkflowPrompt(action, name);

  const confirmed = await confirmAsyncAction(prompt);
  if (!confirmed) return;

  const btn = form.querySelector('button[type="submit"]');
  await withButtonLoading(btn, '...', async () => {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'fetch',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(new FormData(form)).toString(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      showAsyncToast(
        data.error || 'No se pudo procesar la acción editorial.',
        'error',
      );
      return;
    }
    showAsyncToast(
      data.message || 'Estado del ingrediente actualizado.',
      'success',
    );
    await refreshIngredientsRegion(
      window.location.pathname + window.location.search,
      false,
    );
  });
};

const openIngredientArchiveModal = (btn) => {
  const modal = document.getElementById('modal-request-archive-ingredient');
  const form = document.getElementById('form-request-archive-ingredient');
  if (!modal || !form) return;
  const id = btn.dataset.id;
  form.action = `/private/ingredients/${encodeURIComponent(id)}/workflow`;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  window.modalScrollLock?.lock?.();
};

const closeIngredientArchiveModal = () => {
  const modal = document.getElementById('modal-request-archive-ingredient');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  window.modalScrollLock?.unlock?.();
};

const handleRequestArchiveFormSubmit = async (form) => {
  if (!form.reportValidity()) return;
  const confirmed = await confirmAsyncAction({
    title: '¿Tramitar solicitud formal de baja?',
    description:
      'La solicitud quedará registrada en el sistema y requerirá el dictamen imparcial de otro especialista (principio de 4 ojos).',
    confirmLabel: 'Tramitar solicitud',
    variant: 'danger',
  });
  if (!confirmed) return;

  const btn = form.querySelector('button[type="submit"]');
  await withButtonLoading(btn, 'Enviando...', async () => {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'fetch',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(new FormData(form)).toString(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      showAsyncToast(data.error || 'Error al tramitar la baja.', 'error');
      return;
    }
    closeIngredientArchiveModal();
    showAsyncToast(
      data.message || 'Solicitud de baja tramitada.',
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

const handleDelegatedClick = (event) => {
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
    return;
  }

  const requestArchiveBtn = event.target.closest(
    '[data-request-archive-ingredient]',
  );
  if (requestArchiveBtn) {
    openIngredientArchiveModal(requestArchiveBtn);
    return;
  }

  if (
    event.target.closest('#btn-cancel-request-archive-ingredient') ||
    event.target.closest('#modal-request-archive-ingredient-backdrop')
  ) {
    closeIngredientArchiveModal();
  }
};

const handleDelegatedSubmit = (event) => {
  const deleteForm = event.target.closest(
    'form[data-delete-ingredient-form]',
  );
  if (deleteForm) {
    event.preventDefault();
    handleDeleteIngredientSubmit(deleteForm);
    return;
  }

  const workflowForm = event.target.closest(
    'form[data-workflow-ingredient-form]',
  );
  if (workflowForm) {
    event.preventDefault();
    handleWorkflowIngredientSubmit(workflowForm);
    return;
  }

  const requestArchiveForm = event.target.closest(
    '#form-request-archive-ingredient',
  );
  if (requestArchiveForm) {
    event.preventDefault();
    handleRequestArchiveFormSubmit(requestArchiveForm);
  }
};

const bindDelegatedIngredientActions = () => {
  document.addEventListener('click', handleDelegatedClick);
  document.addEventListener('submit', handleDelegatedSubmit);
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
