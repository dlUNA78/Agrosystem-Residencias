/**
 * modal-scroll-lock.js — Controlador Centralizado de Bloqueo de Scroll para Modales
 * Agrosystem INIFAP
 *
 * Utiliza MutationObserver para sincronizar automáticamente la clase `overflow-hidden`
 * en `document.body` cada vez que cualquier modal (`[role="dialog"]`, `[aria-modal="true"]`)
 * se abre o se cierra en cualquier pantalla del sistema.
 */

(function () {
  'use strict';

  const MODAL_SELECTOR =
    '[role="dialog"], [aria-modal="true"], .modal-overlay, #modal-user, #modal-view-user, #modal-user-permissions, #modal-revealed-codes';

  function syncBodyScrollLock() {
    const modals = document.querySelectorAll(MODAL_SELECTOR);
    let isAnyModalOpen = false;

    for (let i = 0; i < modals.length; i += 1) {
      const modal = modals[i];
      const isHidden =
        modal.classList.contains('hidden') ||
        modal.getAttribute('aria-hidden') === 'true' ||
        window.getComputedStyle(modal).display === 'none';

      if (!isHidden) {
        isAnyModalOpen = true;
        break;
      }
    }

    if (isAnyModalOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }

  // Inicializar observador de mutaciones en el DOM para cambios de clases o atributos
  const observer = new MutationObserver(() => {
    syncBodyScrollLock();
  });

  document.addEventListener('DOMContentLoaded', () => {
    syncBodyScrollLock();

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-hidden'],
      subtree: true,
    });
  });

  // Exportar helper al ámbito global para llamadas manuales si se requiere
  window.modalScrollLock = {
    sync: syncBodyScrollLock,
  };
})();
