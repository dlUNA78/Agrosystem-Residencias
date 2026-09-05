import { showAppNotification } from '../shared/notifications.js';

const rangePairs = Object.freeze([
  ['min_altitude', 'max_altitude', 'altitud'],
  ['min_temperature', 'max_temperature', 'temperatura'],
  ['min_rainfall', 'max_rainfall', 'precipitación'],
]);
const validImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const scientificNamePattern = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’()×-]*$/u;
const quantityPattern = /^(?=.*\d)(?=.*[\p{L}])[\p{L}\p{M}\d\s.,/()%+²³-]+$/u;
const phPattern =
  /^(\d{1,2}(?:[.,]\d{1,2})?)(?:\s*(?:-|–|a)\s*(\d{1,2}(?:[.,]\d{1,2})?))?$/iu;

const getFieldLabel = (field) => {
  const explicitLabel = field.id
    ? document.querySelector(`label[for="${field.id}"]`)
    : null;
  const nearbyLabel = field.closest('div')?.querySelector('label');
  return String(
    explicitLabel?.textContent || nearbyLabel?.textContent || field.name,
  )
    .replace('*', '')
    .trim();
};

const getNativeMessage = (field) => {
  const label = getFieldLabel(field);
  const { validity } = field;

  if (validity.valueMissing) return `${label} es obligatorio.`;
  if (validity.badInput) return `${label} debe ser un número válido.`;
  if (validity.rangeUnderflow) {
    return `${label} debe ser mayor o igual que ${field.min}.`;
  }
  if (validity.rangeOverflow) {
    return `${label} debe ser menor o igual que ${field.max}.`;
  }
  if (validity.stepMismatch) {
    return `${label} no admite esa precisión numérica.`;
  }
  if (validity.tooLong) {
    return `${label} no puede exceder ${field.maxLength} caracteres.`;
  }

  return '';
};

const getPhMessage = (value) => {
  const match = value.match(phPattern);
  if (!match) return 'Usa un rango de pH como 5.5 - 7.0.';

  const minimum = Number(match[1].replace(',', '.'));
  const maximum = Number((match[2] || match[1]).replace(',', '.'));
  if (minimum < 0 || maximum > 14 || minimum > maximum) {
    return 'El pH debe estar entre 0 y 14, de menor a mayor.';
  }

  return '';
};

const getFileMessage = (field) => {
  const files = Array.from(field.files || []);
  const maximumFiles = Number(field.dataset.maxFiles || 0);
  const maximumSize = Number(field.dataset.maxFileSize || 0);

  if (maximumFiles && files.length > maximumFiles) {
    return `Puedes seleccionar como máximo ${maximumFiles} imágenes.`;
  }
  if (maximumSize && files.some((file) => file.size > maximumSize)) {
    return 'Cada imagen debe pesar como máximo 5 MB.';
  }
  if (files.some((file) => !validImageTypes.has(file.type))) {
    return 'Sólo se permiten imágenes JPG, PNG o WEBP.';
  }

  return '';
};

const getFormatMessage = (field) => {
  const value = field.value.trim();
  if (!value && field.type !== 'file') return '';

  switch (field.dataset.cropFormat) {
    case 'scientific-name':
      return scientificNamePattern.test(value)
        ? ''
        : 'Usa únicamente letras y signos taxonómicos.';
    case 'quantity':
      return quantityPattern.test(value)
        ? ''
        : 'Incluye una cantidad y su unidad, por ejemplo: 8 toneladas/ha.';
    case 'ph':
      return getPhMessage(value);
    default:
      return field.type === 'file' ? getFileMessage(field) : '';
  }
};

const getRangeMessage = (field, form) => {
  const pair = rangePairs.find(([minimum, maximum]) =>
    [minimum, maximum].includes(field.name),
  );
  if (!pair) return '';

  const [minimumName, maximumName, label] = pair;
  const minimumValue = form.elements.namedItem(minimumName)?.value;
  const maximumValue = form.elements.namedItem(maximumName)?.value;
  if (minimumValue === '' || maximumValue === '') return '';

  return Number(minimumValue) > Number(maximumValue)
    ? `La ${label} máxima no puede ser menor que la mínima.`
    : '';
};

const getPresentationTarget = (field, form) => {
  if (field.type !== 'file') return field;
  return form.querySelector(`label[for="${field.id}"]`) || field;
};

const ensureErrorElement = (field) => {
  const errorId = `${field.id || field.name}-error`;
  let error = document.getElementById(errorId);
  if (error) return error;

  error = document.createElement('p');
  error.id = errorId;
  error.className = 'mt-1 text-xs font-medium text-destructive';
  error.hidden = true;

  const anchor =
    field.type === 'file' ? field.closest('label') || field : field;
  anchor.insertAdjacentElement('afterend', error);
  field.setAttribute('aria-describedby', errorId);
  return error;
};

const renderFieldState = (field, form, message) => {
  const error = ensureErrorElement(field);
  const target = getPresentationTarget(field, form);
  error.textContent = message;
  error.hidden = !message;
  field.setAttribute('aria-invalid', String(Boolean(message)));
  target.classList.toggle('border-destructive', Boolean(message));
  target.classList.toggle('ring-2', Boolean(message));
  target.classList.toggle('ring-destructive/20', Boolean(message));
};

const validateField = (field, form) => {
  field.setCustomValidity('');
  const message =
    getNativeMessage(field) ||
    getFormatMessage(field) ||
    getRangeMessage(field, form);
  field.setCustomValidity(message);
  renderFieldState(field, form, message);
  return message;
};

const getFormControls = (form) =>
  Array.from(form.elements).filter(
    (field) =>
      field.name && ['INPUT', 'SELECT', 'TEXTAREA'].includes(field.tagName),
  );

const updateCharacterCounter = (field) => {
  if (!field.hasAttribute('data-character-counter')) return;

  const counterId = `${field.id}-counter`;
  let counter = document.getElementById(counterId);
  if (!counter) {
    counter = document.createElement('p');
    counter.id = counterId;
    counter.className = 'mt-1 text-right text-[10px] text-on-surface-variant';
    field.insertAdjacentElement('afterend', counter);
  }
  counter.textContent = `${field.value.length} / ${field.maxLength}`;
};

const renderSummary = (summary, messages, moveFocus = true) => {
  const list = summary.querySelector('#crop-form-validation-errors');
  list.replaceChildren();

  for (const message of [...new Set(messages)].slice(0, 6)) {
    const item = document.createElement('li');
    item.textContent = message;
    list.appendChild(item);
  }

  summary.classList.remove('hidden');
  if (moveFocus) {
    summary.focus({ preventScroll: true });
    summary.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

const hideSummary = (summary) => {
  summary.classList.add('hidden');
  summary.querySelector('#crop-form-validation-errors').replaceChildren();
};

const collectMessages = (controls, form) =>
  controls.map((field) => validateField(field, form)).filter(Boolean);

const refreshVisibleSummary = (controls, form, summary) => {
  if (summary.classList.contains('hidden')) return;

  const messages = collectMessages(controls, form);
  if (messages.length > 0) renderSummary(summary, messages, false);
  else hideSummary(summary);
};

const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();

  const message = await response.text();
  return { success: false, message };
};

const setSubmitting = (form, submitting) => {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;

  button.disabled = submitting;
  button.classList.toggle('cursor-wait', submitting);
  button.classList.toggle('opacity-60', submitting);
};

const applyServerErrors = (form, fieldErrors) => {
  for (const [fieldName, messages] of Object.entries(fieldErrors || {})) {
    const field = form.elements.namedItem(fieldName);
    if (!field || !('setCustomValidity' in field)) continue;

    const message = Array.isArray(messages) ? messages[0] : messages;
    field.setCustomValidity(message);
    renderFieldState(field, form, message);
  }
};

const submitForm = async (form, summary) => {
  setSubmitting(form, true);
  let restoreButton = true;

  try {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form),
    });

    if (response.redirected) {
      restoreButton = false;
      window.location.assign(response.url);
      return;
    }

    const result = await parseResponse(response);

    if (!response.ok || !result.success) {
      applyServerErrors(form, result.fieldErrors);
      renderSummary(summary, result.errors || [result.message]);
      showAppNotification({
        type: 'error',
        title: 'No se guardó el cultivo',
        message:
          result.message || 'Revisa la información e intenta nuevamente.',
      });
      return;
    }

    showAppNotification({
      type: 'success',
      title: 'Cultivo guardado',
      message: result.message,
      duration: 2000,
    });
    restoreButton = false;
    window.setTimeout(
      () => window.location.assign(result.redirect || '/private/crops'),
      500,
    );
  } catch (error) {
    console.error('Error al guardar el cultivo:', error);
    showAppNotification({
      type: 'error',
      title: 'Error de conexión',
      message: 'No se pudo guardar. Tus datos siguen en el formulario.',
    });
  } finally {
    if (restoreButton) setSubmitting(form, false);
  }
};

export const initializeCropFormValidation = (form) => {
  if (!form) return null;

  const controls = getFormControls(form);
  const summary = document.getElementById('crop-form-validation-summary');
  let touchedFields = new WeakSet();

  for (const field of controls) {
    updateCharacterCounter(field);
    field.addEventListener('blur', () => {
      touchedFields.add(field);
      validateField(field, form);
    });
    field.addEventListener('input', () => {
      updateCharacterCounter(field);
      if (touchedFields.has(field) || field.value) validateField(field, form);
      refreshVisibleSummary(controls, form, summary);
    });
    field.addEventListener('change', () => {
      touchedFields.add(field);
      validateField(field, form);
      refreshVisibleSummary(controls, form, summary);
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    controls.forEach((field) => touchedFields.add(field));
    const messages = collectMessages(controls, form);

    if (messages.length > 0) {
      renderSummary(summary, messages);
      showAppNotification({
        type: 'warning',
        title: 'Formulario incompleto o inválido',
        message: `Hay ${messages.length} campo${messages.length === 1 ? '' : 's'} por corregir.`,
      });
      controls.find((field) => !field.validity.valid)?.focus();
      return;
    }

    hideSummary(summary);
    void submitForm(form, summary);
  });

  return {
    reset() {
      touchedFields = new WeakSet();
      hideSummary(summary);
      for (const field of controls) {
        field.setCustomValidity('');
        renderFieldState(field, form, '');
        updateCharacterCounter(field);
      }
    },
  };
};
