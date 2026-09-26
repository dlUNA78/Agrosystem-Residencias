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

export const initializeSupplierForm = () => {
  const modalSupplier = document.getElementById('modal-supplier');
  const formSupplier = document.getElementById('form-supplier');
  const modalTitle = document.getElementById('supplier-modal-title');
  const btnAddSupplier = document.getElementById('btn-add-supplier');
  const btnAddSupplierCard = document.getElementById('btn-add-supplier-card');
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

    const countryInput = document.getElementById('supplier-country');
    if (countryInput) {
      countryInput.value = 'México';
    }

    if (modalTitle) {
      modalTitle.textContent = 'Nuevo Proveedor';
    }

    formSupplier.action = '/private/suppliers/create';

    modalSupplier.classList.remove('hidden');
    modalSupplier.classList.add('flex');
  };

  const openEditSupplierModal = (button) => {
    const data = button.dataset;

    FORM_FIELD_IDS.forEach(([elementId, dataKey, defaultValue = '']) => {
      const field = document.getElementById(elementId);
      if (field) {
        field.value = data[dataKey] ?? defaultValue;
      }
    });

    if (modalTitle) {
      modalTitle.textContent = 'Editar Proveedor';
    }

    formSupplier.action = `/private/suppliers/update/${data.id}`;

    modalSupplier.classList.remove('hidden');
    modalSupplier.classList.add('flex');
  };

  btnAddSupplier?.addEventListener('click', openNewSupplierModal);
  btnAddSupplierCard?.addEventListener('click', openNewSupplierModal);
  btnCloseSupplier?.addEventListener('click', closeSupplierModal);
  btnCancelSupplier?.addEventListener('click', closeSupplierModal);

  modalSupplier.addEventListener('click', (event) => {
    if (event.target === modalSupplier) {
      closeSupplierModal();
    }
  });

  const editButtons = document.querySelectorAll('.btn-edit-supplier');
  editButtons.forEach((button) => {
    button.addEventListener('click', () => {
      openEditSupplierModal(button);
    });
  });
};
