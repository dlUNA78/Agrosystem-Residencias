import {
  buildFormRequest,
  confirmAsyncAction,
  fetchHtmlDocument,
  showAsyncToast,
  withButtonLoading,
} from '../asyncUi.js';
import { initializeCropFormValidation } from '../crop-form-validation.js';
import { observeCropDialog } from '../cropDialog.js';
import { createCropImageEditor } from './cropImageEditor.js';

const setFieldValue = (id, value) => {
  const element = document.getElementById(id);
  if (!element) return;
  element.value = value ?? '';
};

const populateFormFields = (crop) => {
  setFieldValue('crop-name', crop.name || crop.common_name);
  setFieldValue('crop-scientific-name', crop.scientific_name);
  setFieldValue('crop-category', crop.category);
  setFieldValue('crop-family', crop.family || crop.botanical_family);
  setFieldValue('crop-genus', crop.genus);
  setFieldValue('crop-variety', crop.variety);

  setFieldValue('crop-region', crop.region);
  setFieldValue('crop-state', crop.state);
  setFieldValue('crop-min-altitude', crop.min_altitude);
  setFieldValue('crop-max-altitude', crop.max_altitude);

  setFieldValue('crop-climate', crop.climate || crop.optimal_climate);
  setFieldValue('crop-min-temperature', crop.min_temperature);
  setFieldValue('crop-max-temperature', crop.max_temperature);
  setFieldValue('crop-min-rainfall', crop.min_rainfall);
  setFieldValue('crop-max-rainfall', crop.max_rainfall);
  setFieldValue('crop-humidity', crop.humidity);

  setFieldValue('crop-soil', crop.soil_type || crop.soil_requirements);
  setFieldValue('crop-ph', crop.ph_range);
  setFieldValue('crop-drainage', crop.drainage);
  setFieldValue('crop-organic-matter', crop.organic_matter);

  setFieldValue('crop-season', crop.season || crop.planting_season);
  setFieldValue('crop-cycle', crop.cycle || crop.growth_cycle);
  setFieldValue('crop-harvest-days', crop.harvest_days);
  setFieldValue('crop-yield', crop.average_yield);
  setFieldValue('crop-density', crop.planting_density);
  setFieldValue('crop-depth', crop.planting_depth);

  setFieldValue(
    'crop-water',
    crop.water_requirement || crop.water_requirements,
  );
  setFieldValue('crop-irrigation', crop.irrigation_type);
  setFieldValue('crop-sun', crop.sunlight_requirement);

  setFieldValue('crop-nutrients', crop.nutrients);
  setFieldValue('crop-fertilization', crop.fertilization);
  const pruningVal =
    crop.requires_pruning === true
      ? 'true'
      : crop.requires_pruning === false
        ? 'false'
        : '';
  setFieldValue('crop-pruning', pruningVal);
  setFieldValue('crop-pollination', crop.pollination_type);

  setFieldValue('crop-description', crop.description);
  setFieldValue('crop-observations', crop.observations);
};

const confirmCropSave = (isUpdate) =>
  confirmAsyncAction({
    title: isUpdate
      ? '¿Guardar cambios en el cultivo?'
      : '¿Registrar nuevo cultivo?',
    description: isUpdate
      ? 'Se actualizarán los parámetros técnicos y la galería fotográfica de esta ficha agronómica.'
      : 'Se creará el cultivo en estado borrador para su posterior revisión y dictamen técnico.',
    confirmLabel: isUpdate ? 'Guardar cambios' : 'Crear cultivo',
    cancelLabel: 'Cancelar',
    variant: 'editorial',
  });

const confirmDiscardChanges = () =>
  confirmAsyncAction({
    title: '¿Descartar cambios sin guardar?',
    description:
      'Si cierras la ventana se perderá la información capturada en el formulario.',
    confirmLabel: 'Sí, descartar',
    cancelLabel: 'Seguir editando',
    variant: 'warning',
  });

const bindModalCloseListeners = ({ modal, requestClose }) => {
  document
    .getElementById('modal-crop-close')
    ?.addEventListener('click', requestClose);
  document
    .getElementById('modal-crop-cancel')
    ?.addEventListener('click', requestClose);
  document
    .getElementById('modal-crop-backdrop')
    ?.addEventListener('click', requestClose);

  document.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      modal &&
      !modal.classList.contains('hidden')
    ) {
      requestClose();
    }
  });
};

const executeCropFormSubmit = async ({
  form,
  validation,
  submitBtn,
  hideModal,
  onAfterSave,
}) => {
  if (validation && !validation.validateAll()) {
    showAsyncToast(
      'Por favor corrige los campos señalados antes de guardar.',
      'error',
    );
    return;
  }

  const isUpdate = form.action.includes('/private/crops/update/');
  const confirmed = await confirmCropSave(isUpdate);
  if (!confirmed) return;

  await withButtonLoading(
    submitBtn,
    isUpdate ? 'Guardando cambios...' : 'Creando cultivo...',
    async () => {
      const { url, init } = buildFormRequest(form);
      const result = await fetchHtmlDocument(url, init);

      if (!result.ok) {
        showAsyncToast(result.errorMessage, 'error');
        return;
      }

      hideModal();
      const successMsg = isUpdate
        ? 'Cultivo actualizado correctamente.'
        : 'Cultivo registrado en borrador.';
      showAsyncToast(successMsg, 'success');

      if (typeof onAfterSave === 'function') {
        await onAfterSave({ isUpdate, doc: result.doc });
      }
    },
  );
};

export const initializeCropForm = ({ onAfterSave } = {}) => {
  const modal = document.getElementById('modal-crop');
  if (!modal) return;

  observeCropDialog(modal);
  const modalTitle = document.getElementById('modal-crop-title');
  const form = document.getElementById('crop-form');
  const submitBtn = form?.querySelector('button[type="submit"]');

  const validation = form ? initializeCropFormValidation(form) : null;
  const imageEditor = createCropImageEditor();
  let isFormDirty = false;

  form?.addEventListener('input', () => {
    isFormDirty = true;
  });

  const showModal = () => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    isFormDirty = false;
  };

  const hideModal = () => {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
    form?.reset();
    validation?.reset();
    imageEditor.reset();
    isFormDirty = false;
  };

  const requestClose = async () => {
    if (isFormDirty) {
      const discard = await confirmDiscardChanges();
      if (!discard) return;
    }
    hideModal();
  };

  const openCreateModal = () => {
    form.reset();
    validation?.reset();
    imageEditor.reset();
    form.action = '/private/crops/create';
    if (modalTitle) modalTitle.textContent = 'Nuevo Cultivo';
    showModal();
  };

  const openEditModal = async (cropId) => {
    try {
      const response = await fetch(`/private/crops/${cropId}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'No se pudo obtener el cultivo');
      }

      const crop = data.crop;
      form.reset();
      validation?.reset();
      form.action = `/private/crops/update/${crop.id}`;
      if (modalTitle)
        modalTitle.textContent = `Editar ${crop.name || crop.common_name}`;

      populateFormFields(crop);
      imageEditor.loadExistingImages(crop.images);
      showModal();
    } catch (error) {
      console.error('Error al cargar cultivo para edición:', error);
      showAsyncToast(
        'No se pudo abrir el cultivo. Intenta nuevamente.',
        'error',
      );
    }
  };

  document.addEventListener('click', (event) => {
    const editBtn = event.target.closest('.edit-crop-btn');
    if (editBtn?.dataset.id) openEditModal(editBtn.dataset.id);
  });

  document
    .getElementById('btn-add-crop')
    ?.addEventListener('click', openCreateModal);
  document
    .getElementById('btn-add-crop-card')
    ?.addEventListener('click', openCreateModal);
  bindModalCloseListeners({ modal, requestClose });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    executeCropFormSubmit({
      form,
      validation,
      submitBtn,
      hideModal,
      onAfterSave,
    });
  });
};
