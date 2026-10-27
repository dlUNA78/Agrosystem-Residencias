import {
  buildFormRequest,
  confirmAsyncAction,
  fetchHtmlDocument,
  showAsyncToast,
  withButtonLoading,
} from '../asyncUi.js';
import { createPlagueCycleEditor } from './plagueCycleEditor.js';
import { createPlagueImageEditor } from './plagueImageEditor.js';

const setInputValue = (form, name, value) => {
  const input = form.querySelector(`[name="${name}"]`);
  if (input) input.value = value || '';
};

const normalizeCategoryForSelect = (rawCategory) => {
  const map = {
    Insectos: 'Insecto',
    Hongos: 'Hongo',
    Ácaros: 'Ácaro',
  };
  return map[rawCategory] || rawCategory || '';
};

const setServerFormError = (message) => {
  const errorBox = document.getElementById('plague-form-server-error');
  if (!errorBox) return;
  if (!message) {
    errorBox.textContent = '';
    errorBox.classList.add('hidden');
    return;
  }
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
  document
    .getElementById('plague-form-scroll')
    ?.scrollTo({ top: 0, behavior: 'smooth' });
};

const initModalSectionNav = (modal) => {
  const scrollContainer = document.getElementById('plague-form-scroll');
  const buttons = Array.from(
    modal.querySelectorAll('[data-modal-section-target]'),
  );
  if (!scrollContainer || buttons.length === 0) return () => {};

  const highlightButton = (activeTargetId) => {
    buttons.forEach((btn) => {
      const isActive =
        btn.getAttribute('data-modal-section-target') === activeTargetId;
      btn.classList.toggle('bg-[#e6f0e6]', isActive);
      btn.classList.toggle('text-[#1b4332]', isActive);
      btn.classList.toggle('bg-muted/60', !isActive);
      btn.classList.toggle('text-muted-foreground', !isActive);
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-modal-section-target');
      const section = targetId ? document.getElementById(targetId) : null;
      if (!section) return;
      scrollContainer.scrollTo({
        top: Math.max(0, section.offsetTop - 16),
        behavior: 'smooth',
      });
      highlightButton(targetId);
    });
  });

  return () => {
    scrollContainer.scrollTop = 0;
    highlightButton('form-sec-identidad');
  };
};

const confirmPlagueSave = (isUpdate) => {
  if (isUpdate) {
    return confirmAsyncAction({
      title: '¿Guardar cambios en el expediente?',
      description:
        'Se actualizarán los datos técnicos, etapas del ciclo biológico y galería fotográfica de esta plaga.',
      confirmLabel: 'Guardar cambios',
      variant: 'editorial',
    });
  }
  return confirmAsyncAction({
    title: '¿Registrar nuevo borrador de plaga?',
    description:
      'Se creará el expediente en estado borrador para vincular cultivos, productos y regiones antes de enviarlo a revisión.',
    confirmLabel: 'Crear borrador',
    variant: 'editorial',
  });
};

const submitPlagueModalForm = async ({
  form,
  saveButton,
  forceHideModal,
  onAfterSave,
}) => {
  if (!form.reportValidity()) return;
  const isUpdate = form.action.includes('/private/plagues/update/');
  const confirmed = await confirmPlagueSave(isUpdate);
  if (!confirmed) return;

  const loadingLabel = isUpdate
    ? 'Guardando cambios...'
    : 'Creando borrador...';

  await withButtonLoading(saveButton, loadingLabel, async () => {
    setServerFormError('');
    const { url, init } = buildFormRequest(form);
    const result = await fetchHtmlDocument(url, init);

    if (!result.ok) {
      setServerFormError(result.errorMessage);
      showAsyncToast(result.errorMessage, 'error');
      return;
    }

    forceHideModal();
    if (onAfterSave) {
      await onAfterSave({ isUpdate, doc: result.doc });
    }
    showAsyncToast(
      isUpdate
        ? 'Expediente actualizado correctamente.'
        : 'Borrador registrado correctamente.',
      'success',
    );
  });
};

export const initializePlagueForm = ({ onAfterSave } = {}) => {
  const modal = document.getElementById('modal-plague');
  const form = document.getElementById('plague-form');
  if (!modal || !form) return;

  const title = document.getElementById('modal-plague-title');
  const saveButton = document.getElementById('btn-save-plague');
  const saveButtonText = document.getElementById('btn-save-plague-text');
  const imageEditor = createPlagueImageEditor();
  const cycleEditor = createPlagueCycleEditor();
  const resetModalScroll = initModalSectionNav(modal);
  let isDirty = false;

  const markClean = () => {
    isDirty = false;
  };
  form.addEventListener('input', () => {
    isDirty = true;
  });
  form.addEventListener('change', () => {
    isDirty = true;
  });

  const showModal = () => {
    setServerFormError('');
    markClean();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
    resetModalScroll();
  };

  const forceHideModal = () => {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
    markClean();
    setServerFormError('');
    imageEditor.releasePreviewUrls();
    document.body.classList.remove('overflow-hidden');
  };

  const requestCloseModal = async () => {
    if (isDirty) {
      const discard = await confirmAsyncAction({
        title: '¿Descartar cambios sin guardar?',
        description:
          'Tienes modificaciones pendientes en el formulario que se perderán si cierras esta ventana.',
        confirmLabel: 'Descartar cambios',
        cancelLabel: 'Seguir editando',
        variant: 'danger',
      });
      if (!discard) return;
    }
    forceHideModal();
  };

  const setSaveButtonLabel = (label) => {
    if (saveButtonText) saveButtonText.textContent = label;
  };

  const openCreateModal = () => {
    form.reset();
    form.action = '/private/plagues/create';
    if (title) title.textContent = 'Nueva Plaga';
    setSaveButtonLabel('Guardar borrador');
    imageEditor.reset();
    cycleEditor.reset();
    showModal();
  };

  const openEditModal = (button) => {
    const data = button?.dataset;
    const id = data?.id || '';
    if (!id) return;

    setInputValue(form, 'name', data.name);
    setInputValue(form, 'scientific_name', data.scientificName);
    setInputValue(form, 'category', normalizeCategoryForSelect(data.category));
    setInputValue(form, 'region', data.region);
    setInputValue(form, 'risk_level', data.riskLevel || 'Bajo');
    setInputValue(form, 'description', data.description);
    setInputValue(form, 'symptoms', data.symptoms);
    setInputValue(form, 'control_methods', data.controlMethods);
    setInputValue(form, 'biological_control', data.biologicalControl);
    cycleEditor.reset(data.biologicalCycle || []);
    form.action = `/private/plagues/update/${id}`;
    if (title) title.textContent = `Editar: ${data.name || 'Plaga'}`;
    setSaveButtonLabel('Guardar cambios');
    imageEditor.load(data);
    showModal();
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest('#btn-add-plague, #btn-add-plague-card')) {
      openCreateModal();
      return;
    }
    const editBtn = event.target.closest('.btn-edit-plague');
    if (editBtn) openEditModal(editBtn);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitPlagueModalForm({ form, saveButton, forceHideModal, onAfterSave });
  });

  document
    .getElementById('modal-plague-close')
    ?.addEventListener('click', requestCloseModal);
  document
    .getElementById('modal-plague-cancel')
    ?.addEventListener('click', requestCloseModal);
  document
    .getElementById('modal-plague-backdrop')
    ?.addEventListener('click', requestCloseModal);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      event.preventDefault();
      requestCloseModal();
    }
  });
};
