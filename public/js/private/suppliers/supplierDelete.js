export const initializeSupplierDelete = () => {
  const modalDeleteSupplier = document.getElementById('modal-delete-supplier');
  const deleteSupplierName = document.getElementById('delete-supplier-name');
  const formDeleteSupplier = document.getElementById('form-delete-supplier');
  const btnCloseDeleteSupplier = document.getElementById(
    'btn-close-delete-supplier',
  );
  const btnCancelDeleteSupplier = document.getElementById(
    'btn-cancel-delete-supplier',
  );

  if (!modalDeleteSupplier) {
    return;
  }

  const closeDeleteSupplierModal = () => {
    modalDeleteSupplier.classList.remove('flex');
    modalDeleteSupplier.classList.add('hidden');
  };

  const deleteButtons = document.querySelectorAll('.btn-delete-supplier');
  deleteButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const supplierId = button.dataset.id;
      const supplierName = button.dataset.name;

      if (deleteSupplierName) {
        deleteSupplierName.textContent = supplierName || '';
      }

      if (formDeleteSupplier) {
        formDeleteSupplier.action = `/private/suppliers/delete/${supplierId}`;
      }

      modalDeleteSupplier.classList.remove('hidden');
      modalDeleteSupplier.classList.add('flex');
    });
  });

  btnCloseDeleteSupplier?.addEventListener('click', closeDeleteSupplierModal);
  btnCancelDeleteSupplier?.addEventListener('click', closeDeleteSupplierModal);

  modalDeleteSupplier.addEventListener('click', (event) => {
    if (event.target === modalDeleteSupplier) {
      closeDeleteSupplierModal();
    }
  });
};
