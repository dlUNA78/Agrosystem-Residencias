/**
 * loading-states.js — Gestor Global de Estados de Carga y Prevención de Doble Envío
 * Agrosystem INIFAP
 */

(function () {
  'use strict';

  const SPINNER_SVG =
    '<svg class="animate-spin h-3.5 w-3.5 shrink-0 inline-block mr-1.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>' +
    '<path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>' +
    '</svg>';

  function shouldBypassFormLoading(form) {
    if (!form) return true;
    const method = (form.getAttribute('method') || 'GET').toUpperCase();
    if (method === 'GET' && !form.hasAttribute('data-loading-on-get')) {
      return true;
    }
    if (
      form.hasAttribute('data-no-loading') ||
      form.hasAttribute('data-confirm-form') &&
        form.dataset.confirmed !== 'true'
    ) {
      return true;
    }
    return false;
  }

  const LOADING_LABEL_MATCHERS = [
    { keyword: 'iniciar', label: 'Verificando acceso...' },
    { keyword: 'ingresar', label: 'Verificando acceso...' },
    { keyword: 'crear', label: 'Registrando...' },
    { keyword: 'registrar', label: 'Registrando...' },
    { keyword: 'subir', label: 'Subiendo archivo...' },
    { keyword: 'canjear', label: 'Validando código...' },
    { keyword: 'validar', label: 'Validando código...' },
  ];

  function getLoadingLabel(btn) {
    if (btn.dataset.loadingText) return btn.dataset.loadingText;
    const text = (btn.textContent || '').trim().toLowerCase();
    const matched = LOADING_LABEL_MATCHERS.find((item) =>
      text.includes(item.keyword),
    );
    return matched ? matched.label : 'Procesando...';
  }

  function setButtonLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
      if (btn.dataset.isLoadingActive === 'true') return;
      btn.dataset.isLoadingActive = 'true';
      btn.dataset.originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.classList.add('opacity-80', 'cursor-wait');
      const label = getLoadingLabel(btn);
      btn.innerHTML = `${SPINNER_SVG}<span>${label}</span>`;
    } else if (btn.dataset.isLoadingActive === 'true') {
      btn.dataset.isLoadingActive = 'false';
      btn.disabled = false;
      btn.classList.remove('opacity-80', 'cursor-wait');
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
      }
    }
  }

  function resetAllFormButtons() {
    document
      .querySelectorAll('[data-is-loading-active="true"]')
      .forEach((btn) => setButtonLoading(btn, false));
    document
      .querySelectorAll('form[data-submitting="true"]')
      .forEach((form) => {
        delete form.dataset.submitting;
      });
  }

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (shouldBypassFormLoading(form)) return;

    window.requestAnimationFrame(() => {
      if (event.defaultPrevented) return;
      if (form.dataset.submitting === 'true') {
        event.preventDefault();
        return;
      }
      form.dataset.submitting = 'true';
      const submitBtn =
        event.submitter ||
        form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn instanceof HTMLButtonElement) {
        setButtonLoading(submitBtn, true);
      }
    });
  });

  window.addEventListener('pageshow', () => {
    resetAllFormButtons();
  });

  window.AgrosystemLoading = {
    setButtonLoading,
    resetAll: resetAllFormButtons,
  };
})();
