// MODAL DE CREACIÓN Y EDICIÓN DE PRODUCTOS
    (function () {
        // Modal
        const modal = document.getElementById('modal-product');
        const openBtn = document.getElementById('btn-add-product');
        const openBtnCard = document.getElementById('btn-add-product-card');
        const closeBtn = document.getElementById('modal-product-close');
        const cancelBtn = document.getElementById('modal-product-cancel');
        const backdrop = document.getElementById('modal-product-backdrop');

        function openModal() { modal.classList.remove('hidden'); modal.classList.add('flex'); }
        function closeModal() { modal.classList.add('hidden'); modal.classList.remove('flex'); }

        if (openBtn) openBtn.addEventListener('click', openModal);
        if (openBtnCard) openBtnCard.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        if (backdrop) backdrop.addEventListener('click', closeModal);

        // View toggle
        const tableView = document.getElementById('products-table-view');
        const gridView = document.getElementById('products-grid-view');
        const btnTable = document.getElementById('view-table');
        const btnGrid = document.getElementById('view-grid');

        if (btnTable && btnGrid) {
            btnGrid.classList.add('bg-[#43655c]', 'text-white');
            btnGrid.classList.remove('text-on-surface-variant');
            btnTable.classList.remove('bg-[#43655c]', 'text-white');
            btnTable.classList.add('text-on-surface-variant');

            btnTable.addEventListener('click', function () {
                tableView.style.display = '';
                gridView.style.display = 'none';
                btnTable.classList.add('bg-[#43655c]', 'text-white');
                btnTable.classList.remove('text-on-surface-variant');
                btnGrid.classList.remove('bg-[#43655c]', 'text-white');
                btnGrid.classList.add('text-on-surface-variant');
            });

            btnGrid.addEventListener('click', function () {
                tableView.style.display = 'none';
                gridView.style.display = 'grid';
                btnGrid.classList.add('bg-[#43655c]', 'text-white');
                btnGrid.classList.remove('text-on-surface-variant');
                btnTable.classList.remove('bg-[#43655c]', 'text-white');
                btnTable.classList.add('text-on-surface-variant');
            });
        }
    })();


// MODAL DE ELIMINACIÓN DE PRODUCTOS
    window.addEventListener('DOMContentLoaded', () => {

        const modal = document.getElementById('delete-modal');
        const nameSpan = document.getElementById('delete-product-name');
        const cancelBtn = document.getElementById('cancel-delete');
        const confirmBtn = document.getElementById('confirm-delete');

        let formToDelete = null;

        document.querySelectorAll('[data-delete-btn]').forEach(btn => {
            btn.addEventListener('click', function () {
                const id = this.dataset.id;
                const name = this.dataset.name;

                formToDelete = document.getElementById('delete-form-' + id);

                nameSpan.textContent = name;

                modal.classList.remove('hidden');
                modal.classList.add('flex');
            });
        });

        cancelBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            formToDelete = null;
        });

        confirmBtn.addEventListener('click', () => {
            if (formToDelete) formToDelete.submit();
        });

    });


// FILTROS DE BÚSQUEDA
    document.addEventListener("DOMContentLoaded", () => {

        const searchInput = document.getElementById("{{searchId}}");

        // todos los productos (tabla + grid)
        const items = document.querySelectorAll(".product-item");

        // selects de filtros
        const selects = document.querySelectorAll(".filter-select");

        function applyFilters() {

            const query = (searchInput?.value || "")
                .toLowerCase()
                .trim();

            // obtener filtros activos
            const activeFilters = {};

            selects.forEach(sel => {
                if (sel.value) {
                    activeFilters[sel.id] = sel.value.toLowerCase();
                }
            });

            items.forEach(item => {

                //datos del producto
                const name = (item.dataset.name || "").toLowerCase();
                const category = (item.dataset.category || "").toLowerCase();
                const manufacturer = (item.dataset.manufacturer || "").toLowerCase();
                const active = (item.dataset.active || "").toLowerCase();
                const registration = (item.dataset.registration || "").toLowerCase();

                const matchSearch =
                    name.includes(query) ||
                    category.includes(query) ||
                    manufacturer.includes(query) ||
                    active.includes(query) ||
                    registration.includes(query);

                // filtros selects
                let matchFilters = true;

                for (const key in activeFilters) {

                    const value = activeFilters[key];

                    if (key.includes("category") && category !== value) matchFilters = false;
                    if (key.includes("manufacturer") && manufacturer !== value) matchFilters = false;
                    if (key.includes("status") && status !== value) matchFilters = false;
                    if (key.includes("active") && active !== value) matchFilters = false;
                }

                // mostrar / ocultar
                item.style.display = (matchSearch && matchFilters) ? "" : "none";
            });
        }

        //eventos
        if (searchInput) {
            searchInput.addEventListener("input", applyFilters);
        }

        selects.forEach(sel => {
            sel.addEventListener("change", applyFilters);
        });

    });

    // MODAL DE PRODUCTOS EXPIRADOS
    document.addEventListener("DOMContentLoaded", () => {

        const btnOpen = document.getElementById("btn-expiring-products");
        const modal = document.getElementById("expiring-products-modal");
        const btnClose = document.getElementById("close-expiring-modal");
        const btnCancel = document.getElementById("cancel-expiring-modal");

        btnOpen.addEventListener("click", () => {
            modal.classList.remove("hidden");
            modal.classList.add("flex");
        });

        function closeModal() {
            modal.classList.add("hidden");
            modal.classList.remove("flex");
        }

        btnClose.addEventListener("click", closeModal);
        btnCancel.addEventListener("click", closeModal);

    });

// MODAL DE PRODUCTOS EXPIRADOS
    document.addEventListener("DOMContentLoaded", () => {
        const modal = document.getElementById("modal-product");
        const form = document.getElementById("product-form");
        const title = document.getElementById("modal-title");
        const saveBtn = document.getElementById("btn-save-product");
        const btnAdd = document.getElementById("btn-add-product");
        const btnAddCard = document.getElementById("btn-add-product-card");
        const btnClose = document.getElementById("modal-product-close");
        const btnCancel = document.getElementById("modal-product-cancel");
        const backdrop = document.getElementById("modal-product-backdrop")
        const preview = document.getElementById("image-preview");
        const imageInput = document.getElementById("image");
        function openModal() {
            modal.classList.remove("hidden");
            modal.classList.add("flex");
        }

        function closeModal() {
            modal.classList.add("hidden");
            modal.classList.remove("flex");
        }

        function resetForm() {

            form.reset();

            form.action = "/private/products/create";

            title.textContent = "Nuevo Producto Agroquímico";

            saveBtn.textContent = "Guardar Producto";

            document.getElementById("status").checked = true;

            // Reiniciar imagen
            if (preview) {
                preview.src = "";
                preview.classList.add("hidden");
            }

        }
        // VISTA PREVIA AL AGREGAR

        if (imageInput) {

            imageInput.addEventListener("change", function () {

                const file = this.files[0];

                if (file && preview) {

                    const reader = new FileReader();

                    reader.onload = function (e) {

                        preview.src = e.target.result;
                        preview.classList.remove("hidden");

                    };

                    reader.readAsDataURL(file);

                }

            });

        }
        // ABRIR PARA CREAR
        if (btnAdd) {
            btnAdd.addEventListener("click", () => { resetForm(); openModal(); });
        }
        if (btnAddCard) {
            btnAddCard.addEventListener("click", () => {
                resetForm();
                openModal();
            });
        }
        // CERRAR MODAL
        if (btnClose) {
            btnClose.addEventListener("click", () => {
                resetForm();
                closeModal();

            });
        }
        if (btnCancel) {
            btnCancel.addEventListener("click", () => {
                resetForm();
                closeModal();
            });
        }
        if (backdrop) {
            backdrop.addEventListener("click", () => {
                resetForm();
                closeModal();
            });
        }
        // EDITAR PRODUCTO

        document.querySelectorAll(".btn-edit-product").forEach(btn => {


            btn.addEventListener("click", function () {
                form.action = "/private/products/update/" + this.dataset.id;
                title.textContent = "Editar Producto";
                saveBtn.textContent = "Actualizar Producto";
                document.getElementById("name").value = this.dataset.name || "";
                document.getElementById("category").value = this.dataset.category || "";
                document.getElementById("manufacturer").value = this.dataset.manufacturer || "";
                document.getElementById("active_ingredient").value = this.dataset.active || "";
                document.getElementById("registration_code").value = this.dataset.registration || "";
                document.getElementById("validation_status").value = this.dataset.validation || "";
                document.getElementById("expiration_date").value = this.dataset.expiration ? this.dataset.expiration.substring(0, 10) : "";
                document.getElementById("target_crops").value = this.dataset.crops || "";
                document.getElementById("mode_of_action").value = this.dataset.mode || "";
                document.getElementById("hazard_category").value = this.dataset.hazard || "";
                document.getElementById("suggested_dosage").value = this.dataset.dosage || "";
                document.getElementById("safety_interval_days").value = this.dataset.interval || "";
                document.getElementById("formulation_type").value = this.dataset.formulation || "";
                document.getElementById("safety_sheet_url").value = this.dataset.safetysheet || "";
                document.getElementById("description").value = this.dataset.description || "";
                document.getElementById("status").checked = this.dataset.status === "true" || this.dataset.status === "1";

                // Mostrar imagen guardada

                if (preview) {
                    if (this.dataset.image) {
                        preview.src = "/" + this.dataset.image;
                        preview.classList.remove("hidden");
                    } else {
                        preview.src = "/images/test/default.png";

                        preview.classList.remove("hidden");
                    }

                }
                openModal();

            });

        });

    });
