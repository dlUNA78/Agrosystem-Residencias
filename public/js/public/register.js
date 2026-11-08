/**
 * register.js — Agrosystem INIFAP
 * Checklist interactivo de requisitos de contraseña y visibilidad en la vista de registro.
 */

(function () {
  'use strict';

  function updateRequirementItem(ruleName, isMet) {
    const item = document.querySelector(`[data-pwd-req="${ruleName}"]`);
    if (!item) return;
    const dot = item.querySelector('[data-req-dot]');
    item.classList.toggle('text-emerald-700', isMet);
    item.classList.toggle('font-semibold', isMet);
    item.classList.toggle('text-slate-500', !isMet);
    if (dot) {
      dot.classList.toggle('bg-emerald-500', isMet);
      dot.classList.toggle('bg-slate-300', !isMet);
    }
  }

  function evaluatePasswordChecklist(val) {
    const raw = val || '';
    updateRequirementItem('length', raw.length >= 8);
    updateRequirementItem('upper', /[A-ZÁÉÍÓÚÑ]/.test(raw));
    updateRequirementItem('lower', /[a-záéíóúñ]/.test(raw));
    updateRequirementItem('number', /\d/.test(raw));
  }

  document.addEventListener('DOMContentLoaded', () => {
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.getElementById('toggle-register-password');

    if (passwordInput) {
      passwordInput.addEventListener('input', () => {
        evaluatePasswordChecklist(passwordInput.value);
      });
    }

    if (toggleBtn && passwordInput) {
      toggleBtn.addEventListener('click', () => {
        const isPassword = passwordInput.getAttribute('type') === 'password';
        passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
        const icon = toggleBtn.querySelector('i');
        if (icon) {
          icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
          if (typeof window.lucide?.createIcons === 'function') {
            window.lucide.createIcons();
          }
        }
      });
    }
  });
})();
