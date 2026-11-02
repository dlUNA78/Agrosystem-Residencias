import {
  buildFormRequest,
  fetchHtmlDocument,
  showAsyncToast,
  swapFragments,
  withButtonLoading,
} from '../asyncUi.js';
import { applySupplierSavedView } from './supplierViewToggle.js';

const submitDeleteSupplierAsync = async (formDeleteSupplier, closeModal) => {
  const submitBtn = document.getElementById('btn-confirm-delete-supplier');

  await withButtonLoading(submitBtn, 'Eliminando...', async () => {
    const { url, init } = buildFormRequest(formDeleteSupplier);
    const result = await fetchHtmlDocument(url, init);
    if (!result.ok) {
      if (!result.aborted) {
        showAsyncToast(result.errorMessage, 'error');
      }
      return;
    }

    swapFragments(result.doc, [
      '#suppliers-stats-grid',
      '#suppliers-results-region',
    ]);
    applySupplierSavedView();
    closeModal();
    showAsyncToast('Proveedor eliminado del padrón.', 'success');
  });
};

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

  document.addEventListener('click', (event) => {
    const button = event.target.closest('.btn-delete-supplier');
    if (!button) return;

    if (deleteSupplierName) {
      deleteSupplierName.textContent = button.dataset.name || '';
    }
    if (formDeleteSupplier) {
      formDeleteSupplier.action = `/private/suppliers/delete/${button.dataset.id}`;
    }

    modalDeleteSupplier.classList.remove('hidden');
    modalDeleteSupplier.classList.add('flex');
  });

  btnCloseDeleteSupplier?.addEventListener('click', closeDeleteSupplierModal);
  btnCancelDeleteSupplier?.addEventListener('click', closeDeleteSupplierModal);

  modalDeleteSupplier.addEventListener('click', (event) => {
    if (event.target === modalDeleteSupplier) {
      closeDeleteSupplierModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      !modalDeleteSupplier.classList.contains('hidden')
    ) {
      closeDeleteSupplierModal();
    }
  });

  formDeleteSupplier?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitDeleteSupplierAsync(formDeleteSupplier, closeDeleteSupplierModal);
  });
};
