import { showAppNotification } from '../shared/notifications.js';

const form = document.getElementById('product-form');
const modal = document.getElementById('modal-product');
const preview = document.getElementById('image-preview');
const imageInput = document.getElementById('image');
const title = document.getElementById('modal-title');
const saveButton = document.getElementById('btn-save-product');
const summary = document.getElementById('product-form-validation-summary');
const validImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const openModal = () => {
  modal?.classList.remove('hidden');
  modal?.classList.add('flex');
};
const closeModal = () => {
  modal?.classList.add('hidden');
  modal?.classList.remove('flex');
};
const fieldLabel = (field) =>
  field
    .closest('div')
    ?.querySelector('label')
    ?.textContent?.replace('*', '')
    .trim() || field.name;
const errorElement = (field) => {
  const id = `${field.id}-error`;
  let element = document.getElementById(id);
  if (element) return element;
  element = document.createElement('p');
  element.id = id;
  element.className = 'mt-1 text-xs font-medium text-red-700';
  field.insertAdjacentElement('afterend', element);
  return element;
};
const nativeMessage = (field) => {
  const label = fieldLabel(field);
  if (field.validity.valueMissing) return `${label} es obligatorio.`;
  if (field.validity.rangeUnderflow)
    return `${label} debe ser al menos ${field.min}.`;
  if (field.validity.rangeOverflow)
    return `${label} no puede exceder ${field.max}.`;
  if (field.validity.stepMismatch) return `${label} debe ser un número entero.`;
  if (field.validity.tooLong)
    return `${label} excede ${field.maxLength} caracteres.`;
  if (field.validity.typeMismatch) return `${label} debe ser una URL válida.`;
  return '';
};
const imageMessage = (field) => {
  const files = Array.from(field.files || []);
  if (files.length > 10) return 'Puedes seleccionar como máximo 10 imágenes.';
  if (files.some((file) => file.size > 5 * 1024 * 1024)) {
    return 'Cada imagen debe pesar como máximo 5 MB.';
  }
  if (files.some((file) => !validImageTypes.has(file.type))) {
    return 'Sólo se permiten imágenes JPG, PNG o WEBP.';
  }
  return '';
};
const renderFieldError = (field, message) => {
  const element = errorElement(field);
  element.textContent = message;
  element.hidden = !message;
  field.setAttribute('aria-invalid', String(Boolean(message)));
  field.classList.toggle('ring-2', Boolean(message));
  field.classList.toggle('ring-red-300', Boolean(message));
};
const validateField = (field) => {
  field.setCustomValidity('');
  const message =
    nativeMessage(field) || (field.type === 'file' ? imageMessage(field) : '');
  field.setCustomValidity(message);
  renderFieldError(field, message);
  return message;
};
const controls = form
  ? Array.from(form.elements).filter(
      (field) =>
        field.name && ['INPUT', 'SELECT', 'TEXTAREA'].includes(field.tagName),
    )
  : [];
const renderSummary = (messages) => {
  if (!summary) return;
  const list = summary.querySelector('ul');
  list.replaceChildren();
  [...new Set(messages)].slice(0, 6).forEach((message) => {
    const item = document.createElement('li');
    item.textContent = message;
    list.appendChild(item);
  });
  summary.classList.toggle('hidden', messages.length === 0);
};
const resetForm = () => {
  form?.reset();
  if (form) form.action = '/private/products/create';
  if (title) title.textContent = 'Nuevo Producto Agroquímico';
  if (saveButton) saveButton.textContent = 'Guardar Producto';
  controls.forEach((field) => {
    field.setCustomValidity('');
    renderFieldError(field, '');
  });
  renderSummary([]);
  if (preview) {
    preview.src = '';
    preview.classList.add('hidden');
  }
};
const showCreateModal = () => {
  resetForm();
  openModal();
};

document
  .getElementById('btn-add-product')
  ?.addEventListener('click', showCreateModal);
document
  .getElementById('btn-add-product-card')
  ?.addEventListener('click', showCreateModal);
[
  'modal-product-close',
  'modal-product-cancel',
  'modal-product-backdrop',
].forEach((id) =>
  document.getElementById(id)?.addEventListener('click', () => {
    resetForm();
    closeModal();
  }),
);

imageInput?.addEventListener('change', () => {
  validateField(imageInput);
  const file = imageInput.files?.[0];
  if (!file || !preview || !imageInput.validity.valid) return;
  preview.src = URL.createObjectURL(file);
  preview.classList.remove('hidden');
});

const setValue = (name, value) => {
  const field = form?.elements.namedItem(name);
  if (field) field.value = value ?? '';
};
document.querySelectorAll('.btn-edit-product').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      const response = await fetch(`/private/products/${button.dataset.id}`, {
        headers: { Accept: 'application/json' },
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message);
      resetForm();
      Object.entries(result.product).forEach(([name, value]) =>
        setValue(name, value),
      );
      setValue(
        'expiration_date',
        result.product.expiration_date?.substring?.(0, 10),
      );
      form.action = `/private/products/update/${result.product.id}`;
      title.textContent = 'Editar Producto';
      saveButton.textContent = 'Actualizar Producto';
      if (preview && result.product.image_url) {
        preview.src = result.product.image_url;
        preview.classList.remove('hidden');
      }
      openModal();
    } catch (error) {
      console.error('No se pudo cargar el producto:', error);
      showAppNotification({
        type: 'error',
        title: 'No se pudo abrir el producto',
        message: 'Recarga la página e intenta nuevamente.',
      });
    }
  });
});

controls.forEach((field) => {
  field.addEventListener('blur', () => validateField(field));
  field.addEventListener('input', () => {
    if (field.value) validateField(field);
  });
});

const applyServerErrors = (fieldErrors = {}) => {
  Object.entries(fieldErrors).forEach(([name, messages]) => {
    const field = form.elements.namedItem(name);
    if (!field) return;
    const message = Array.isArray(messages) ? messages[0] : messages;
    field.setCustomValidity(message);
    renderFieldError(field, message);
  });
};
form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const messages = controls.map(validateField).filter(Boolean);
  renderSummary(messages);
  if (messages.length) {
    showAppNotification({
      type: 'warning',
      title: 'Revisa el formulario',
      message: `Hay ${messages.length} campo(s) por corregir.`,
    });
    return;
  }

  saveButton.disabled = true;
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      applyServerErrors(result.fieldErrors);
      renderSummary(result.errors || [result.message]);
      throw new Error(result.message);
    }
    showAppNotification({
      type: 'success',
      title: 'Producto guardado',
      message: result.message,
    });
    window.setTimeout(
      () => window.location.assign(result.redirect || '/private/products'),
      500,
    );
  } catch (error) {
    console.error('No se pudo guardar el producto:', error);
    showAppNotification({
      type: 'error',
      title: 'No se guardó el producto',
      message: error.message || 'Revisa los datos e intenta nuevamente.',
    });
    saveButton.disabled = false;
  }
});

const deleteModal = document.getElementById('delete-modal');
let deleteForm;
document.querySelectorAll('[data-delete-btn]').forEach((button) => {
  button.addEventListener('click', () => {
    deleteForm = document.getElementById(`delete-form-${button.dataset.id}`);
    const name = document.getElementById('delete-product-name');
    if (name) name.textContent = button.dataset.name;
    deleteModal?.classList.remove('hidden');
    deleteModal?.classList.add('flex');
  });
});
document.getElementById('cancel-delete')?.addEventListener('click', () => {
  deleteModal?.classList.add('hidden');
  deleteModal?.classList.remove('flex');
});
document
  .getElementById('confirm-delete')
  ?.addEventListener('click', () => deleteForm?.submit());

const expiringModal = document.getElementById('expiring-products-modal');
document
  .getElementById('btn-expiring-products')
  ?.addEventListener('click', () => {
    expiringModal?.classList.remove('hidden');
    expiringModal?.classList.add('flex');
  });
['close-expiring-modal', 'cancel-expiring-modal'].forEach((id) =>
  document.getElementById(id)?.addEventListener('click', () => {
    expiringModal?.classList.add('hidden');
    expiringModal?.classList.remove('flex');
  }),
);

const tableView = document.getElementById('products-table-view');
const gridView = document.getElementById('products-grid-view');
document.getElementById('view-table')?.addEventListener('click', () => {
  if (tableView) tableView.style.display = '';
  if (gridView) gridView.style.display = 'none';
});
document.getElementById('view-grid')?.addEventListener('click', () => {
  if (tableView) tableView.style.display = 'none';
  if (gridView) gridView.style.display = 'grid';
});
