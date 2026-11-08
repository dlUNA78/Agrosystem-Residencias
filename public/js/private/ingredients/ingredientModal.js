import { showAsyncToast, withButtonLoading } from '../asyncUi.js';

const setDialogOpen = (modal, isOpen) => {
  if (!modal) return;
  modal.classList.toggle('hidden', !isOpen);
  modal.classList.toggle('flex', isOpen);
  document.body.classList.toggle('overflow-hidden', isOpen);
};

const setElementValue = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
};

const setElementText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '';
};

const clearIngredientFormError = () => {
  const errorBox = document.getElementById('ingredient-form-error');
  if (!errorBox) return;
  errorBox.textContent = '';
  errorBox.classList.add('hidden');
};

const populateFormModal = (config) => {
  const form = document.getElementById('form-ingredient');
  clearIngredientFormError();
  if (form) form.action = config.action;
  setElementText('modal-ingredient-title', config.title);
  setElementText('btn-submit-ingredient-label', config.submitLabel);
  setElementValue('ingredient-nombre', config.name);
  setElementValue('ingredient-grupo', config.group);
  setElementValue('ingredient-tipo', config.actionType);
  setElementValue('ingredient-toxicidad', config.toxicity);
};

const populateDetailModal = (dataset) => {
  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '--';
  };
  setText('detail-ingredient-code', dataset.code);
  setText('detail-ingredient-title', dataset.name);
  setText('detail-ingredient-action', dataset.action);
  setText('detail-ingredient-group', dataset.group);
  setText('detail-ingredient-toxicity', dataset.toxicity);
  setText('detail-ingredient-regulatory', dataset.regulatory);
};

const submitIngredientFormAsync = async (form, closeModal, onSuccess) => {
  const submitBtn = document.getElementById('btn-submit-ingredient');
  const errorBox = document.getElementById('ingredient-form-error');
  const body = new URLSearchParams(new FormData(form));

  await withButtonLoading(submitBtn, 'Guardando...', async () => {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Accept: 'application/json',
        'X-Requested-With': 'fetch',
      },
      body: body.toString(),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      const msg =
        data.error || 'Verifica los datos capturados e intenta de nuevo.';
      if (errorBox) {
        errorBox.textContent = msg;
        errorBox.classList.remove('hidden');
      }
      return;
    }

    closeModal();
    showAsyncToast(data.message || 'Ingrediente guardado.', 'success');
    await onSuccess?.();
  });
};

const openCreateIngredientDialog = (modal) => {
  populateFormModal({
    action: '/private/ingredients/create',
    title: 'Nuevo Ingrediente Activo',
    submitLabel: 'Guardar Ingrediente',
  });
  setDialogOpen(modal, true);
  document.getElementById('ingredient-nombre')?.focus();
};

const openEditIngredientDialog = (modal, editBtn) => {
  populateFormModal({
    action: `/private/ingredients/update/${editBtn.dataset.id}`,
    title: 'Editar Ingrediente Activo',
    submitLabel: 'Guardar cambios',
    name: editBtn.dataset.name,
    group: editBtn.dataset.group,
    actionType: editBtn.dataset.action,
    toxicity: editBtn.dataset.toxicity,
  });
  setDialogOpen(modal, true);
  document.getElementById('ingredient-nombre')?.focus();
};

const bindDelegatedModalTriggers = (modal, detailModal, closeDetail) => {
  document.addEventListener('click', (event) => {
    if (event.target.closest('#btn-add-ingredient-card')) {
      openCreateIngredientDialog(modal);
      return;
    }

    const editBtn = event.target.closest('[data-edit-ingredient]');
    if (editBtn) {
      openEditIngredientDialog(modal, editBtn);
      return;
    }

    const viewBtn = event.target.closest('[data-view-ingredient]');
    if (viewBtn && detailModal) {
      populateDetailModal(viewBtn.dataset);
      setDialogOpen(detailModal, true);
      return;
    }

    if (event.target.closest('[data-close-ingredient-detail]')) {
      closeDetail();
    }
  });
};

export const initializeIngredientModal = (onMutated = null) => {
  const modal = document.getElementById('modal-ingredient');
  const detailModal = document.getElementById('modal-ingredient-detail');
  if (!modal) return;

  const closeFormModal = () => setDialogOpen(modal, false);
  const closeDetailModal = () => setDialogOpen(detailModal, false);

  document
    .getElementById('btn-add-ingredient')
    ?.addEventListener('click', () => openCreateIngredientDialog(modal));
  document
    .getElementById('btn-close-modal-ingredient')
    ?.addEventListener('click', closeFormModal);
  document
    .getElementById('btn-cancel-modal-ingredient')
    ?.addEventListener('click', closeFormModal);

  modal.addEventListener('click', (evt) => {
    if (evt.target === modal) closeFormModal();
  });
  detailModal?.addEventListener('click', (evt) => {
    if (evt.target === detailModal) closeDetailModal();
  });

  bindDelegatedModalTriggers(modal, detailModal, closeDetailModal);

  const form = document.getElementById('form-ingredient');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitIngredientFormAsync(form, closeFormModal, onMutated);
  });
};
