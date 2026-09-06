document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('modal-edit-land');
  const openButton = document.getElementById('btn-open-edit-land');
  const closeButtons = [
    document.getElementById('btn-close-edit-land'),
    document.getElementById('btn-cancel-edit-land'),
    document.getElementById('modal-edit-land-backdrop'),
  ].filter(Boolean);

  if (!modal || !openButton) return;

  const openModal = () => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
    document.getElementById('edit-land-name')?.focus();
  };

  const closeModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');
    openButton.focus();
  };

  openButton.addEventListener('click', openModal);
  closeButtons.forEach((button) => button.addEventListener('click', closeModal));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });
});
