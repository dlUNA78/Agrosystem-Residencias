export const initializeIngredientModal = () => {
  const modalIngredient = document.getElementById('modal-ingredient');
  const btnAddIngredient = document.getElementById('btn-add-ingredient');
  const btnAddIngredientCard = document.getElementById(
    'btn-add-ingredient-card',
  );
  const btnCloseIngredient = document.getElementById(
    'btn-close-modal-ingredient',
  );
  const btnCancelIngredient = document.getElementById(
    'btn-cancel-modal-ingredient',
  );

  if (!modalIngredient) {
    return;
  }

  const openModal = () => {
    modalIngredient.classList.remove('hidden');
    modalIngredient.classList.add('flex');
  };

  const closeModal = () => {
    modalIngredient.classList.remove('flex');
    modalIngredient.classList.add('hidden');
  };

  btnAddIngredient?.addEventListener('click', openModal);
  btnAddIngredientCard?.addEventListener('click', openModal);
  btnCloseIngredient?.addEventListener('click', closeModal);
  btnCancelIngredient?.addEventListener('click', closeModal);

  modalIngredient.addEventListener('click', (e) => {
    if (e.target === modalIngredient) {
      closeModal();
    }
  });
};
