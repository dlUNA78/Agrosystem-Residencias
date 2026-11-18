import {
  confirmAsyncAction,
  showAsyncToast,
  withButtonLoading,
} from '../asyncUi.js';
import { observeCropDialog } from '../cropDialog.js';
import { createProductImageEditor } from './productImageEditor.js';

const normalizeSearchText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const updateRelationCounter = (container) => {
  const targetId = container?.dataset?.counterTarget;
  if (!targetId) return;
  const badge = document.getElementById(targetId);
  if (!badge) return;
  const checkedCount = container.querySelectorAll(
    'input[type="checkbox"]:checked',
  ).length;
  badge.textContent =
    checkedCount === 1 ? '1 seleccionado' : `${checkedCount} seleccionados`;
};

const setupRelationCheckboxes = (form) => {
  const searches = Array.from(
    form?.querySelectorAll('[data-relation-search]') || [],
  );
  const containers = searches
    .map((input) => document.getElementById(input.dataset.relationSearch))
    .filter(Boolean);

  searches.forEach((search) => {
    search.addEventListener('input', () => {
      const query = normalizeSearchText(search.value.trim());
      const container = document.getElementById(search.dataset.relationSearch);
      container?.querySelectorAll('.relation-option').forEach((option) => {
        option.classList.toggle(
          'hidden',
          !normalizeSearchText(option.dataset.searchText).includes(query),
        );
      });
    });
  });

  containers.forEach((container) => {
    container.addEventListener('change', () =>
      updateRelationCounter(container),
    );
  });

  return {
    reset() {
      searches.forEach((search) => {
        search.value = '';
        search.dispatchEvent(new Event('input'));
      });
      containers.forEach(updateRelationCounter);
    },
    select(name, records = []) {
      const selectedIds = new Set(records.map((item) => String(item.id)));
      form?.querySelectorAll(`input[name="${name}"]`).forEach((checkbox) => {
        checkbox.checked = selectedIds.has(checkbox.value);
      });
      containers.forEach(updateRelationCounter);
    },
  };
};

const getFieldLabel = (field) =>
  field
    .closest('div')
    ?.querySelector('label')
    ?.textContent?.replace('*', '')
    .trim() || field.name;

const getOrCreateErrorEl = (field) => {
  const id = `${field.id || field.name}-error`;
  let element = document.getElementById(id);
  if (element) return element;
  element = document.createElement('p');
  element.id = id;
  element.className = 'mt-1 text-[11px] font-semibold text-rose-700';
  field.insertAdjacentElement('afterend', element);
  return element;
};

const VALIDITY_RULES = [
  [(v) => v.valueMissing, (label) => `${label} es obligatorio.`],
  [
    (v) => v.tooShort,
    (label, f) => `${label} debe tener al menos ${f.minLength} caracteres.`,
  ],
  [
    (v) => v.rangeUnderflow,
    (label, f) => `${label} debe ser al menos ${f.min}.`,
  ],
  [(v) => v.rangeOverflow, (label, f) => `${label} no puede exceder ${f.max}.`],
  [(v) => v.stepMismatch, (label) => `${label} debe ser un número entero.`],
  [
    (v) => v.tooLong,
    (label, f) => `${label} excede ${f.maxLength} caracteres.`,
  ],
  [(v) => v.typeMismatch, (label) => `${label} debe ser una URL válida.`],
];

const buildNativeErrorMessage = (field) => {
  const label = getFieldLabel(field);
  const match = VALIDITY_RULES.find(([predicate]) => predicate(field.validity));
  return match ? match[1](label, field) : '';
};

const renderFieldError = (field, message) => {
  if (!field || field.type === 'hidden' || field.type === 'checkbox') return;
  const element = getOrCreateErrorEl(field);
  element.textContent = message;
  element.hidden = !message;
  field.setAttribute('aria-invalid', String(Boolean(message)));
  field.classList.toggle('ring-2', Boolean(message));
  field.classList.toggle('ring-rose-300', Boolean(message));
  field.classList.toggle('border-rose-400', Boolean(message));
};

const validateSingleControl = (field) => {
  field.setCustomValidity('');
  if (field.disabled) {
    renderFieldError(field, '');
    return '';
  }
  const message = buildNativeErrorMessage(field);
  field.setCustomValidity(message);
  renderFieldError(field, message);
  return message;
};

const renderValidationSummary = (summaryEl, messages) => {
  if (!summaryEl) return;
  const list = summaryEl.querySelector('ul');
  if (!list) return;
  list.replaceChildren();
  [...new Set(messages)].slice(0, 6).forEach((msg) => {
    const item = document.createElement('li');
    item.textContent = msg;
    list.appendChild(item);
  });
  summaryEl.classList.toggle('hidden', messages.length === 0);
  if (messages.length > 0) summaryEl.focus();
};

const applyServerFieldErrors = (form, fieldErrors = {}) => {
  Object.entries(fieldErrors).forEach(([name, messages]) => {
    const field = form?.elements?.namedItem(name);
    if (!(field instanceof HTMLElement)) return;
    const message = Array.isArray(messages) ? messages[0] : String(messages);
    field.setCustomValidity(message);
    renderFieldError(field, message);
  });
};

const LOCKED_PRODUCT_IDENTITY_FIELDS = [
  'name',
  'registration_code',
  'active_ingredient',
  'category',
];

const toggleProductEditControlMode = (form, isEdit) => {
  LOCKED_PRODUCT_IDENTITY_FIELDS.forEach((fieldName) => {
    const field = form.elements.namedItem(fieldName);
    if (!(field instanceof HTMLElement)) return;
    if (field.tagName === 'SELECT') {
      field.classList.toggle('pointer-events-none', isEdit);
      field.tabIndex = isEdit ? -1 : 0;
    } else {
      field.readOnly = isEdit;
    }
    field.setAttribute('aria-readonly', String(isEdit));
    field.classList.toggle('bg-muted/60', isEdit);
    field.classList.toggle('cursor-not-allowed', isEdit);
  });

  form.querySelectorAll('[data-identity-lock-badge]').forEach((badge) => {
    badge.classList.toggle('hidden', !isEdit);
    badge.classList.toggle('inline-flex', isEdit);
  });

  const banner = document.getElementById('product-edit-control-banner');
  banner?.classList.toggle('hidden', !isEdit);

  const controlledInput = document.getElementById('product-controlled-edit');
  if (controlledInput) controlledInput.value = isEdit ? '1' : '0';

  const reasonField = document.getElementById('product-edit-reason');
  if (reasonField) {
    reasonField.disabled = !isEdit;
    reasonField.required = isEdit;
    if (!isEdit) reasonField.value = '';
  }
};

const populateProductFields = (form, product) => {
  const fieldNames = [
    'name',
    'category',
    'manufacturer',
    'active_ingredient',
    'registration_code',
    'formulation_type',
    'hazard_category',
    'mode_of_action',
    'suggested_dosage',
    'safety_interval_days',
    'target_crops',
    'safety_sheet_url',
    'description',
  ];
  fieldNames.forEach((name) => {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLElement) {
      field.value = product[name] ?? '';
    }
  });
  const expField = form.elements.namedItem('expiration_date');
  if (expField instanceof HTMLElement) {
    expField.value =
      product.expirationDateFormatted ||
      product.expiration_date?.substring?.(0, 10) ||
      '';
  }
};

const confirmProductSave = (isUpdate) =>
  confirmAsyncAction({
    title: isUpdate
      ? '¿Guardar cambios en la ficha técnica?'
      : '¿Registrar nuevo producto agroquímico?',
    description: isUpdate
      ? 'Se actualizarán los datos sanitarios, parámetros de aplicación, galería y vinculaciones del producto.'
      : 'La ficha se registrará en estado borrador privado hasta su dictamen técnico y publicación.',
    confirmLabel: isUpdate ? 'Guardar cambios' : 'Registrar borrador',
    cancelLabel: 'Cancelar',
    variant: 'editorial',
  });

const confirmDiscardChanges = () =>
  confirmAsyncAction({
    title: '¿Descartar cambios sin guardar?',
    description:
      'Si cierras el formulario se perderán los datos capturados que aún no han sido guardados.',
    confirmLabel: 'Descartar cambios',
    cancelLabel: 'Seguir editando',
    variant: 'warning',
  });

const setSaveButtonLabel = (saveBtn, text) => {
  const span = saveBtn?.querySelector('span');
  if (span) span.textContent = text;
  else if (saveBtn) saveBtn.textContent = text;
};

export const initializeProductForm = ({ onAfterSave } = {}) => {
  const modal = document.getElementById('modal-product');
  const form = document.getElementById('product-form');
  if (!modal || !form) return;

  observeCropDialog(modal);
  const titleEl = document.getElementById('modal-title');
  const saveBtn = document.getElementById('btn-save-product');
  const summaryEl = document.getElementById('product-form-validation-summary');
  const relationControls = setupRelationCheckboxes(form);
  const imageEditor = createProductImageEditor();

  const validatableControls = Array.from(form.elements).filter(
    (el) =>
      el.name &&
      ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) &&
      !['hidden', 'file', 'checkbox'].includes(el.type),
  );

  let isFormDirty = false;
  form.addEventListener('input', () => {
    isFormDirty = true;
  });
  form.addEventListener('change', () => {
    isFormDirty = true;
  });

  validatableControls.forEach((field) => {
    field.addEventListener('blur', () => validateSingleControl(field));
    field.addEventListener('input', () => {
      if (field.getAttribute('aria-invalid') === 'true') {
        validateSingleControl(field);
      }
    });
  });

  const resetAll = () => {
    form.reset();
    form.action = '/private/products/create';
    if (titleEl) titleEl.textContent = 'Nuevo Producto Agroquímico';
    setSaveButtonLabel(saveBtn, 'Guardar producto');
    toggleProductEditControlMode(form, false);
    validatableControls.forEach((field) => {
      field.setCustomValidity('');
      renderFieldError(field, '');
    });
    renderValidationSummary(summaryEl, []);
    relationControls.reset();
    imageEditor.reset();
    isFormDirty = false;
  };

  const showModal = () => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.documentElement.classList.add('overflow-hidden');
    isFormDirty = false;
  };

  const hideModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.documentElement.classList.remove('overflow-hidden');
    resetAll();
  };

  const requestClose = async () => {
    if (isFormDirty && !(await confirmDiscardChanges())) return;
    hideModal();
  };

  const openCreateModal = () => {
    resetAll();
    showModal();
  };

  const openEditModal = async (productId) => {
    try {
      const response = await fetch(`/private/products/${productId}`, {
        headers: { Accept: 'application/json' },
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'No se pudo cargar el producto.');
      }

      resetAll();
      toggleProductEditControlMode(form, true);
      populateProductFields(form, result.product);
      relationControls.select('crop_ids', result.product.crops);
      relationControls.select('plague_ids', result.product.plagues);
      imageEditor.loadExistingImages(result.product.images);

      form.action = `/private/products/update/${result.product.id}`;
      if (titleEl) titleEl.textContent = `Editar ${result.product.name}`;
      setSaveButtonLabel(saveBtn, 'Guardar cambios');

      const expiringModal = document.getElementById('expiring-products-modal');
      expiringModal?.classList.add('hidden');
      expiringModal?.classList.remove('flex');
      showModal();
    } catch (error) {
      console.error('Error al cargar producto para edición:', error);
      showAsyncToast(
        error.message || 'No se pudo abrir el producto para edición.',
        'error',
      );
    }
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest('#btn-add-product, #btn-add-product-card')) {
      openCreateModal();
      return;
    }
    const editBtn = event.target.closest('.btn-edit-product');
    if (editBtn?.dataset.id) {
      openEditModal(editBtn.dataset.id);
    }
  });

  [
    'modal-product-close',
    'modal-product-cancel',
    'modal-product-backdrop',
  ].forEach((id) =>
    document.getElementById(id)?.addEventListener('click', requestClose),
  );

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      requestClose();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errors = validatableControls
      .map(validateSingleControl)
      .filter(Boolean);
    renderValidationSummary(summaryEl, errors);
    if (errors.length > 0) {
      showAsyncToast(
        `Revisa ${errors.length} campo(s) antes de guardar la ficha.`,
        'error',
      );
      return;
    }

    const isUpdate = form.action.includes('/private/products/update/');
    if (!(await confirmProductSave(isUpdate))) return;

    await withButtonLoading(
      saveBtn,
      isUpdate ? 'Guardando cambios...' : 'Registrando ficha...',
      async () => {
        const response = await fetch(form.action, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: imageEditor.buildFormData(form),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          applyServerFieldErrors(form, result.fieldErrors);
          renderValidationSummary(
            summaryEl,
            result.errors || [result.message || 'Error al guardar.'],
          );
          showAsyncToast(
            result.message || 'No se pudo guardar el producto.',
            'error',
          );
          return;
        }

        hideModal();
        showAsyncToast(
          result.message || 'Producto guardado correctamente.',
          'success',
        );
        if (typeof onAfterSave === 'function') {
          await onAfterSave({ isUpdate, redirect: result.redirect });
        }
      },
    );
  });
};
