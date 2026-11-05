/**
 * modal-scroll-lock.js — Controlador Centralizado de Bloqueo de Scroll para Modales
 * Agrosystem INIFAP
 *
 * Previene el desplazamiento no deseado del fondo (scroll leaking) cuando un modal está activo.
 * - Cero MutationObservers recursivos en el body (elimina bloqueos de hilo principal).
 * - Bloquea la propagación de rueda táctil / scroll en backdrops de modales.
 * - Sincroniza overflow-hidden de forma puntual sin interferir con la navegación móvil.
 */

(function () {
  'use strict';

  const MODAL_SELECTOR =
    '[role="dialog"]:not(#mobile-drawer), [aria-modal="true"]:not(#mobile-drawer), #modal-user, #modal-role, #modal-user-permissions, #modal-revealed-codes';

  function isModalOpen(modal) {
    if (!modal) return false;
    if (modal.classList.contains('hidden')) return false;
    if (modal.getAttribute('aria-hidden') === 'true') return false;
    return modal.offsetParent !== null || modal.classList.contains('flex');
  }

  function getActiveModal() {
    const modals = document.querySelectorAll(MODAL_SELECTOR);
    for (let i = 0; i < modals.length; i += 1) {
      if (isModalOpen(modals[i])) {
        return modals[i];
      }
    }
    return null;
  }

  function syncBodyScrollLock() {
    if (getActiveModal()) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }

  document.addEventListener(
    'wheel',
    (event) => {
      const activeModal = getActiveModal();
      if (!activeModal) return;

      const scrollable = event.target.closest(
        '.overflow-y-auto, .overflow-auto, textarea',
      );
      if (!scrollable) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  document.addEventListener(
    'touchmove',
    (event) => {
      const activeModal = getActiveModal();
      if (!activeModal) return;

      const scrollable = event.target.closest(
        '.overflow-y-auto, .overflow-auto, textarea',
      );
      if (!scrollable) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  window.modalScrollLock = {
    sync: syncBodyScrollLock,
    lock: () => document.body.classList.add('overflow-hidden'),
    unlock: () => document.body.classList.remove('overflow-hidden'),
  };
})();
