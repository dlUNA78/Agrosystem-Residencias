const setModalVisibility = (modal, isOpen, trigger) => {
  modal.classList.toggle('hidden', !isOpen);
  modal.classList.toggle('flex', isOpen);
  document.body.classList.toggle('overflow-hidden', isOpen);

  if (isOpen) {
    // Resetear combobox filters al abrir el modal
    modal.querySelectorAll('[data-combobox-filter]').forEach((input) => {
      input.value = '';
      const targetId = input.dataset.comboboxFilter;
      const select = document.getElementById(targetId);
      const emptyMsg = modal.querySelector(
        `[data-combobox-empty="${targetId}"]`,
      );
      if (select) {
        Array.from(select.options).forEach((opt) => {
          opt.hidden = false;
        });
      }
      if (emptyMsg) {
        emptyMsg.classList.add('hidden');
      }
    });

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

const normalizeText = (text) =>
  (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const filterSelectOptions = (select, query, emptyMsg) => {
  let visibleCount = 0;

  Array.from(select.options).forEach((opt, idx) => {
    if (idx === 0) {
      opt.hidden = false;
      return;
    }
    const matches = normalizeText(opt.textContent).includes(query);
    opt.hidden = !matches;
    if (matches) visibleCount += 1;
  });

  if (emptyMsg) {
    emptyMsg.classList.toggle('hidden', visibleCount > 0 || query === '');
  }

  if (select.selectedIndex > 0 && select.options[select.selectedIndex].hidden) {
    select.selectedIndex = 0;
  }
};

const setupComboboxFilters = () => {
  document.querySelectorAll('[data-combobox-filter]').forEach((input) => {
    const targetSelectId = input.dataset.comboboxFilter;
    const select = document.getElementById(targetSelectId);
    const emptyMsg = document.querySelector(
      `[data-combobox-empty="${targetSelectId}"]`,
    );
    if (!select) return;

    input.addEventListener('input', () => {
      const query = normalizeText(input.value.trim());
      filterSelectOptions(select, query, emptyMsg);
    });
  });
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

  setupComboboxFilters();

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closers.forEach((close) => close());
  });
});
