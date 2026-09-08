const setModalVisibility = (modal, isOpen, trigger) => {
  modal.classList.toggle('hidden', !isOpen);
  modal.classList.toggle('flex', isOpen);
  document.body.classList.toggle('overflow-hidden', isOpen);

  if (isOpen) {
    modal.querySelector('input, select, textarea, button')?.focus();
  } else {
    trigger?.focus();
  }
};

const configureModal = (modal, triggers) => {
  let lastTrigger = null;
  const close = () => {
    if (!modal.classList.contains('hidden')) {
      setModalVisibility(modal, false, lastTrigger);
    }
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      lastTrigger = trigger;
      setModalVisibility(modal, true, trigger);
    });
  });
  modal
    .querySelectorAll('[data-land-modal-close]')
    .forEach((button) => button.addEventListener('click', close));
  return close;
};

document.addEventListener('DOMContentLoaded', () => {
  const closers = [];
  const editModal = document.getElementById('modal-edit-land');
  const editTrigger = document.getElementById('btn-open-edit-land');

  if (editModal && editTrigger) {
    editModal
      .querySelectorAll(
        '#btn-close-edit-land, #btn-cancel-edit-land, #modal-edit-land-backdrop',
      )
      .forEach((button) => button.setAttribute('data-land-modal-close', ''));
    closers.push(configureModal(editModal, [editTrigger]));
  }

  document.querySelectorAll('[data-land-modal]').forEach((modal) => {
    const name = modal.dataset.landModal;
    const triggers = [
      ...document.querySelectorAll(`[data-land-modal-open="${name}"]`),
    ];
    closers.push(configureModal(modal, triggers));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closers.forEach((close) => close());
  });
});
