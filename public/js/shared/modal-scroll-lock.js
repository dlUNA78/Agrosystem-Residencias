/**
 * modal-scroll-lock.js — Controlador Centralizado de Bloqueo de Scroll y Aislamiento de Eventos para Modales
 * Agrosystem INIFAP
 *
 * Previene el desplazamiento del fondo (body/html) cuando cualquier modal está abierto,
 * incluso cuando el cursor está sobre un <input>, <select> o zona sin overflow dentro del modal.
 */

(function () {
  'use strict';

  const MODAL_SELECTOR =
    '[role="dialog"]:not(#mobile-drawer), [aria-modal="true"]:not(#mobile-drawer), [id^="modal-"], [data-land-modal], [data-modal]';

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

  function applyLockClasses(shouldLock) {
    document.documentElement.classList.toggle('overflow-hidden', shouldLock);
    document.body.classList.toggle('overflow-hidden', shouldLock);
  }

  function syncBodyScrollLock() {
    applyLockClasses(Boolean(getActiveModal()));
  }

  function isElementScrollableY(el) {
    if (!el || el === document.body || el === document.documentElement) {
      return false;
    }
    if (el.scrollHeight <= el.clientHeight + 1) {
      return false;
    }
    const style = window.getComputedStyle(el);
    const overflowY = style ? style.overflowY : '';
    return overflowY === 'auto' || overflowY === 'scroll';
  }

  function findScrollableContainerInModal(target, activeModal) {
    let node = target instanceof Element ? target : null;
    while (node && node !== document.body && activeModal.contains(node)) {
      if (node.tagName === 'TEXTAREA' && node.scrollHeight > node.clientHeight) {
        return node;
      }
      if (isElementScrollableY(node)) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function isAtScrollBoundary(scrollable, deltaY) {
    if (deltaY < 0 && scrollable.scrollTop <= 0) {
      return true;
    }
    if (
      deltaY > 0 &&
      scrollable.scrollTop + scrollable.clientHeight >=
        scrollable.scrollHeight - 1
    ) {
      return true;
    }
    return false;
  }

  function handleModalWheel(event) {
    const activeModal = getActiveModal();
    if (!activeModal) return;

    applyLockClasses(true);

    const target = event.target;
    if (
      target instanceof HTMLInputElement &&
      target.type === 'number' &&
      document.activeElement === target
    ) {
      event.preventDefault();
      return;
    }

    const scrollable = findScrollableContainerInModal(target, activeModal);
    if (!scrollable || isAtScrollBoundary(scrollable, event.deltaY)) {
      event.preventDefault();
    }
  }

  function handleModalTouchMove(event) {
    const activeModal = getActiveModal();
    if (!activeModal) return;

    applyLockClasses(true);

    const scrollable = findScrollableContainerInModal(
      event.target,
      activeModal,
    );
    if (!scrollable) {
      event.preventDefault();
    }
  }

  document.addEventListener('wheel', handleModalWheel, { passive: false });
  document.addEventListener('touchmove', handleModalTouchMove, {
    passive: false,
  });

  document.addEventListener('click', () => {
    window.requestAnimationFrame(syncBodyScrollLock);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      window.requestAnimationFrame(syncBodyScrollLock);
    }
  });

  window.modalScrollLock = {
    sync: syncBodyScrollLock,
    lock: () => applyLockClasses(true),
    unlock: () => syncBodyScrollLock(),
  };
})();
