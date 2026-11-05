/**
 * login.js — Agrosystem INIFAP
 * Toggle interactivo de visibilidad de contraseña en el formulario de inicio de sesión.
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggle-password-visibility');
    const passwordInput = document.getElementById('password');

    if (!toggleBtn || !passwordInput) return;

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
  });
})();
