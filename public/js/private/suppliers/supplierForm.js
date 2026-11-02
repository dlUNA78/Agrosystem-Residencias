import {
  buildFormRequest,
  fetchHtmlDocument,
  showAsyncToast,
  swapFragments,
  withButtonLoading,
} from '../asyncUi.js';
import { applySupplierSavedView } from './supplierViewToggle.js';

const FORM_FIELD_IDS = [
  ['supplier-name', 'name'],
  ['supplier-commercial-name', 'commercialName'],
  ['supplier-rfc', 'rfc'],
  ['supplier-supply-type', 'supplyType'],
  ['supplier-contact-name', 'contactName'],
  ['supplier-contact-position', 'contactPosition'],
  ['supplier-email', 'email'],
  ['supplier-alternative-email', 'alternativeEmail'],
  ['supplier-phone', 'phone'],
  ['supplier-alternative-phone', 'alternativePhone'],
  ['supplier-address', 'address'],
  ['supplier-city', 'city'],
  ['supplier-state', 'state'],
  ['supplier-postal-code', 'postalCode'],
  ['supplier-country', 'country', 'México'],
  ['supplier-supplied-products', 'suppliedProducts'],
  ['supplier-brands', 'brands'],
  ['supplier-delivery-time', 'deliveryTime'],
  ['supplier-minimum-order', 'minimumOrder'],
  ['supplier-payment-method', 'paymentMethod'],
  ['supplier-status', 'status', 'pendiente'],
];

const setFieldValue = (elementId, value) => {
  const field = document.getElementById(elementId);
  if (field) {
    field.value = value;
  }
};

const populateSupplierFields = (data) => {
  FORM_FIELD_IDS.forEach(([elementId, dataKey, defaultValue = '']) => {
    setFieldValue(elementId, data[dataKey] ?? defaultValue);
  });
};

const submitSupplierFormAsync = async (formSupplier, closeModal) => {
  const submitBtn = document.getElementById('btn-submit-supplier');
  const isEdit = formSupplier.action.includes('/update/');

  await withButtonLoading(submitBtn, 'Guardando...', async () => {
    const { url, init } = buildFormRequest(formSupplier);
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
    showAsyncToast(
      isEdit
        ? 'Proveedor actualizado correctamente.'
        : 'Proveedor registrado en el padrón.',
      'success',
    );
  });
};

export const initializeSupplierForm = () => {
  const modalSupplier = document.getElementById('modal-supplier');
  const formSupplier = document.getElementById('form-supplier');
  const modalTitle = document.getElementById('supplier-modal-title');
  const btnCloseSupplier = document.getElementById('btn-close-modal-supplier');
  const btnCancelSupplier = document.getElementById(
    'btn-cancel-modal-supplier',
  );

  if (!modalSupplier || !formSupplier) {
    return;
  }

  const closeSupplierModal = () => {
    modalSupplier.classList.remove('flex');
    modalSupplier.classList.add('hidden');
  };

  const openNewSupplierModal = () => {
    formSupplier.reset();
    setFieldValue('supplier-country', 'México');
    if (modalTitle) {
      modalTitle.textContent = 'Nuevo Proveedor';
    }
    formSupplier.action = '/private/suppliers/create';
    modalSupplier.classList.remove('hidden');
    modalSupplier.classList.add('flex');
  };

  const openEditSupplierModal = (button) => {
    populateSupplierFields(button.dataset);
    if (modalTitle) {
      modalTitle.textContent = 'Editar Proveedor';
    }
    formSupplier.action = `/private/suppliers/update/${button.dataset.id}`;
    modalSupplier.classList.remove('hidden');
    modalSupplier.classList.add('flex');
  };

  btnCloseSupplier?.addEventListener('click', closeSupplierModal);
  btnCancelSupplier?.addEventListener('click', closeSupplierModal);

  modalSupplier.addEventListener('click', (event) => {
    if (event.target === modalSupplier) {
      closeSupplierModal();
    }
  });

  document.addEventListener('click', (event) => {
    const addTrigger = event.target.closest(
      '#btn-add-supplier, #btn-add-supplier-card',
    );
    if (addTrigger) {
      openNewSupplierModal();
      return;
    }
    const editBtn = event.target.closest('.btn-edit-supplier');
    if (editBtn) {
      openEditSupplierModal(editBtn);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modalSupplier.classList.contains('hidden')) {
      closeSupplierModal();
    }
  });

  formSupplier.addEventListener('submit', (event) => {
    event.preventDefault();
    submitSupplierFormAsync(formSupplier, closeSupplierModal);
  });
};
