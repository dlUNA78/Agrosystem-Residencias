/**
 * form-validator.js — Validación Estricta en Tiempo Real y Sanitización de Inputs en Cliente
 * Agrosystem INIFAP
 */

(function () {
  'use strict';

  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]{2,120}$/;
  const PHONE_REGEX = /^\d{10,15}$/;

  function getOrCreateFeedbackEl(input) {
    const parent = input.closest('div') || input.parentElement;
    if (!parent) return null;
    let feedback = parent.querySelector('[data-field-feedback]');
    if (!feedback) {
      feedback = document.createElement('p');
      feedback.dataset.fieldFeedback = 'true';
      feedback.className =
        'mt-1 hidden text-[11px] font-medium text-rose-600 transition-all';
      parent.appendChild(feedback);
    }
    return feedback;
  }

  function showFieldState(input, errorMessage) {
    const feedback = getOrCreateFeedbackEl(input);
    const hasError = Boolean(errorMessage);

    input.classList.toggle('border-rose-400', hasError);
    input.classList.toggle('focus:border-rose-500', hasError);
    input.setAttribute('aria-invalid', hasError ? 'true' : 'false');

    if (feedback) {
      feedback.textContent = errorMessage || '';
      feedback.classList.toggle('hidden', !hasError);
    }
    return !hasError;
  }

  function checkEmailField(value, required) {
    if (!value) return required ? 'El correo electrónico es obligatorio.' : '';
    if (!EMAIL_REGEX.test(value)) {
      return 'Ingresa un correo electrónico válido (ej. usuario@dominio.mx).';
    }
    return '';
  }

  function checkPasswordStrength(value, isStrictPolicy) {
    if (!value) return 'La contraseña es obligatoria.';
    if (value.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres.';
    }
    if (!isStrictPolicy) return '';
    if (!/[A-ZÁÉÍÓÚÑ]/.test(value)) {
      return 'Incluye al menos una letra mayúscula.';
    }
    if (!/[a-záéíóúñ]/.test(value)) {
      return 'Incluye al menos una letra minúscula.';
    }
    if (!/\d/.test(value)) {
      return 'Incluye al menos un número.';
    }
    return '';
  }

  function checkNameField(value, required) {
    if (!value) return required ? 'Este nombre es obligatorio.' : '';
    if (value.length < 2) return 'Debe contener al menos 2 caracteres.';
    if (!NAME_REGEX.test(value)) {
      return 'Solo se permiten letras, espacios y signos básicos (sin números ni símbolos especiales).';
    }
    return '';
  }

  function checkPhoneField(value, required) {
    if (!value) return required ? 'El teléfono es obligatorio.' : '';
    const digits = value.replace(/[\s()-+]/g, '');
    if (!PHONE_REGEX.test(digits)) {
      return 'Ingresa un número telefónico válido de 10 a 15 dígitos.';
    }
    return '';
  }

  function isSkippableInput(input) {
    if (!(
      input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement
    )) {
      return true;
    }
    return input.disabled || input.readOnly || input.type === 'hidden';
  }

  const RULE_BY_NAME = {
    new_password: 'strict-password',
    full_name: 'name',
    phone: 'phone',
    email: 'email',
  };

  const RULE_BY_DATASET = {
    email: 'email',
    'strict-password': 'strict-password',
    'person-name': 'name',
    phone: 'phone',
  };

  function resolveValidatorType(input) {
    const datasetRule = RULE_BY_DATASET[input.dataset.validate];
    if (datasetRule) return datasetRule;
    const namedRule = RULE_BY_NAME[(input.name || '').toLowerCase()];
    if (namedRule) return namedRule;
    if (input.type === 'email') return 'email';
    if (input.type === 'password' && input.required) return 'password';
    return 'default';
  }

  function resolveFieldErrorMessage(input) {
    const val = input.value.trim();
    const required = input.required;
    const kind = resolveValidatorType(input);

    if (kind === 'email') return checkEmailField(val, required);
    if (kind === 'strict-password') {
      return checkPasswordStrength(input.value, true);
    }
    if (kind === 'password') {
      const isRegister = Boolean(input.closest('form[action*="/register"]'));
      return checkPasswordStrength(input.value, isRegister);
    }
    if (kind === 'name') return checkNameField(val, required);
    if (kind === 'phone') return checkPhoneField(val, required);
    return required && !val ? 'Este campo es obligatorio.' : '';
  }

  function evaluateInput(input) {
    if (isSkippableInput(input)) return true;
    return showFieldState(input, resolveFieldErrorMessage(input));
  }

  function stripForbiddenCharactersOnInput(input) {
    const nameAttr = (input.name || '').toLowerCase();
    const rule = input.dataset.validate || '';
    if (rule === 'person-name' || nameAttr === 'full_name') {
      const cleaned = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]/g, '');
      if (cleaned !== input.value) {
        input.value = cleaned;
      }
    } else if (rule === 'phone' || nameAttr === 'phone') {
      const cleaned = input.value.replace(/[^\d\s()-+]/g, '');
      if (cleaned !== input.value) {
        input.value = cleaned;
      }
    }
  }

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    )) {
      return;
    }
    stripForbiddenCharactersOnInput(target);
    if (
      target.getAttribute('aria-invalid') === 'true' ||
      target.dataset.validateLive === 'true'
    ) {
      evaluateInput(target);
    }
  });

  document.addEventListener(
    'blur',
    (event) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        if (target.value.trim() !== '' || target.dataset.validate) {
          evaluateInput(target);
        }
      }
    },
    true,
  );

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if ((form.getAttribute('method') || 'GET').toUpperCase() === 'GET') return;
    if (form.hasAttribute('data-skip-client-validation')) return;

    const fields = form.querySelectorAll('input, textarea');
    let firstInvalid = null;

    fields.forEach((field) => {
      const ok = evaluateInput(field);
      if (!ok && !firstInvalid) {
        firstInvalid = field;
      }
    });

    if (firstInvalid) {
      event.preventDefault();
      firstInvalid.focus();
    }
  });

  window.AgrosystemValidator = {
    evaluateInput,
    showFieldState,
  };
})();
