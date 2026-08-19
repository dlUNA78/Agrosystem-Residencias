
document.addEventListener('DOMContentLoaded', () => {

    // =====================================================
    // VISTAS: TABLA / GRID
    // =====================================================

    const tableView = document.getElementById('suppliers-table-view');
    const gridView = document.getElementById('suppliers-grid-view');

    const btnTable = document.getElementById('view-table');
    const btnGrid = document.getElementById('view-grid');

    if (btnTable && btnGrid && tableView && gridView) {

        gridView.style.display = 'grid';
        tableView.style.display = 'none';

        btnGrid.classList.add('bg-[#43655c]', 'text-white');
        btnGrid.classList.remove('text-on-surface-variant');

        btnTable.classList.remove('bg-[#43655c]', 'text-white');
        btnTable.classList.add('text-on-surface-variant');


        btnTable.addEventListener('click', () => {

            tableView.style.display = '';
            gridView.style.display = 'none';

            btnTable.classList.add('bg-[#43655c]', 'text-white');
            btnTable.classList.remove('text-on-surface-variant');

            btnGrid.classList.remove('bg-[#43655c]', 'text-white');
            btnGrid.classList.add('text-on-surface-variant');

        });


        btnGrid.addEventListener('click', () => {

            tableView.style.display = 'none';
            gridView.style.display = 'grid';

            btnGrid.classList.add('bg-[#43655c]', 'text-white');
            btnGrid.classList.remove('text-on-surface-variant');

            btnTable.classList.remove('bg-[#43655c]', 'text-white');
            btnTable.classList.add('text-on-surface-variant');

        });

    }


    // =====================================================
    // MODAL: AÑADIR / EDITAR PROVEEDOR
    // =====================================================

    const modalSupplier =
        document.getElementById('modal-supplier');

    const formSupplier =
        document.getElementById('form-supplier');

    const modalTitle =
        document.getElementById('supplier-modal-title');

    const btnAddSupplier =
        document.getElementById('btn-add-supplier');

    const btnAddSupplierCard =
        document.getElementById('btn-add-supplier-card');

    const btnCloseSupplier =
        document.getElementById('btn-close-modal-supplier');

    const btnCancelSupplier =
        document.getElementById('btn-cancel-modal-supplier');


    // =====================================================
    // ABRIR MODAL EN MODO NUEVO
    // =====================================================

    function openNewSupplierModal() {

        if (!modalSupplier || !formSupplier) return;

        // Limpiar todos los campos
        formSupplier.reset();

        // Restaurar valores por defecto
        document.getElementById('supplier-country').value = 'México';

        // Título
        modalTitle.textContent = 'Nuevo Proveedor';

        // Ruta para crear
        formSupplier.action = '/private/suppliers/create';

        // Mostrar modal
        modalSupplier.classList.remove('hidden');
        modalSupplier.classList.add('flex');

    }


    // =====================================================
    // ABRIR MODAL EN MODO EDITAR
    // =====================================================

    function openEditSupplierModal(button) {

        if (!modalSupplier || !formSupplier) return;

        // Obtener datos del botón
        const data = button.dataset;

        // Cargar datos en el formulario
        document.getElementById('supplier-name').value = data.name || '';
        document.getElementById('supplier-commercial-name').value = data.commercialName || '';
        document.getElementById('supplier-rfc').value = data.rfc || '';
        document.getElementById('supplier-supply-type').value = data.supplyType || '';
        document.getElementById('supplier-contact-name').value = data.contactName || '';
        document.getElementById('supplier-contact-position').value = data.contactPosition || '';
        document.getElementById('supplier-email').value = data.email || '';
        document.getElementById('supplier-alternative-email').value = data.alternativeEmail || '';
        document.getElementById('supplier-phone').value = data.phone || '';
        document.getElementById('supplier-alternative-phone').value = data.alternativePhone || '';
        document.getElementById('supplier-address').value = data.address || '';
        document.getElementById('supplier-city').value = data.city || '';
        document.getElementById('supplier-state').value = data.state || '';
        document.getElementById('supplier-postal-code').value = data.postalCode || '';
        document.getElementById('supplier-country').value = data.country || 'México';
        document.getElementById('supplier-supplied-products').value = data.suppliedProducts || '';
        document.getElementById('supplier-brands').value = data.brands || '';
        document.getElementById('supplier-delivery-time').value = data.deliveryTime || '';
        document.getElementById('supplier-minimum-order').value = data.minimumOrder || '';
        document.getElementById('supplier-payment-method').value = data.paymentMethod || '';
        document.getElementById('supplier-status').value = data.status || 'pendiente';
        // Cambiar título
        modalTitle.textContent = 'Editar Proveedor';
        // Cambiar ruta del formulario
        formSupplier.action = `/private/suppliers/update/${data.id}`;
        // Mostrar modal
        modalSupplier.classList.remove('hidden');
        modalSupplier.classList.add('flex');

    }
    // BOTÓN NUEVO PROVEEDOR
    btnAddSupplier?.addEventListener('click', openNewSupplierModal);
    btnAddSupplierCard?.addEventListener('click', openNewSupplierModal);

    // =====================================================
    // BOTONES EDITAR
    const editButtons = document.querySelectorAll('.btn-edit-supplier');
    editButtons.forEach(button => {
        button.addEventListener('click', () => {
            openEditSupplierModal(button);
        });
    });

    // CERRAR MODAL DE PROVEEDOR
    function closeSupplierModal() {
        if (!modalSupplier) return;
        modalSupplier.classList.remove('flex');
        modalSupplier.classList.add('hidden');

    }
    btnCloseSupplier?.addEventListener('click', closeSupplierModal);
    btnCancelSupplier?.addEventListener('click', closeSupplierModal);

    modalSupplier?.addEventListener('click', (event) => {
        if (event.target === modalSupplier) {
            closeSupplierModal();
        }
    });


    // =====================================================
    // MODAL: ELIMINAR PROVEEDOR
    // =====================================================

    const modalDeleteSupplier = document.getElementById('modal-delete-supplier');
    const deleteSupplierName = document.getElementById('delete-supplier-name');
    const formDeleteSupplier = document.getElementById('form-delete-supplier');
    const btnCloseDeleteSupplier = document.getElementById('btn-close-delete-supplier');
    const btnCancelDeleteSupplier = document.getElementById('btn-cancel-delete-supplier');
    const deleteButtons = document.querySelectorAll('.btn-delete-supplier');

    deleteButtons.forEach(button => {
        button.addEventListener('click', () => {
            const supplierId = button.dataset.id;
            const supplierName = button.dataset.name;
            if (deleteSupplierName) {
                deleteSupplierName.textContent = supplierName;
            }
            if (formDeleteSupplier) {
                formDeleteSupplier.action = `/private/suppliers/delete/${supplierId}`;
            }
            if (modalDeleteSupplier) {
                modalDeleteSupplier.classList.remove('hidden');
                modalDeleteSupplier.classList.add('flex');
            }
        });
    });

    btnCloseDeleteSupplier?.addEventListener('click', closeDeleteSupplierModal);
    btnCancelDeleteSupplier?.addEventListener('click', closeDeleteSupplierModal);

    modalDeleteSupplier?.addEventListener('click', (event) => {
        if (event.target === modalDeleteSupplier) {
            closeDeleteSupplierModal();
        }
    });

    function closeDeleteSupplierModal() {
        if (!modalDeleteSupplier) return;
        modalDeleteSupplier.classList.remove('flex');
        modalDeleteSupplier.classList.add('hidden');
    }

});


// MODAL DE ELIMINACIÓN DE PROVEEDORES
(() => {

    // BUSCADOR EN TIEMPO REAL DE PROVEEDORES
    const searchInput = document.getElementById("supplier-search");

    if (!searchInput) return;

    searchInput.addEventListener("input", () => {

        const search = searchInput.value.toLowerCase().trim();

        // TABLA DE PROVEEDORES
        const rows = document.querySelectorAll(
            "#suppliers-table-view tbody tr"
        );

        rows.forEach(row => {

            const text = row.textContent.toLowerCase();

            row.style.display =
                text.includes(search) ? "" : "none";

        });

        // GRID DE PROVEEDORES
        const cards = document.querySelectorAll(
            "#suppliers-grid-view > div"
        );

        cards.forEach(card => {

            const text = card.textContent.toLowerCase();

            card.style.display =
                text.includes(search) ? "" : "none";

        });

    });

})();
