// MODAL DE CREACIÓN DE PLAGAS
    (() => {

        const modal = document.getElementById("modal-plague");
        const form = document.getElementById("plague-form");

        const btnAdd = document.getElementById("btn-add-plague");
        const btnAddCard = document.getElementById("btn-add-plague-card");

        const btnClose = document.getElementById("modal-plague-close");
        const btnCancel = document.getElementById("modal-plague-cancel");
        const backdrop = document.getElementById("modal-plague-backdrop");

        const title = document.getElementById("modal-plague-title");

        const imageInput = document.getElementById("plague-image");
        const imagePreview = document.getElementById("plague-preview");

        // BUSCADOR EN TIEMPO REAL
        const searchInput = document.getElementById("plague-search");

        if (searchInput) {

            searchInput.addEventListener("input", () => {

                const search = searchInput.value.toLowerCase().trim();

                // FILAS DE LA TABLA
                const rows = document.querySelectorAll(
                    "#plagues-table-view tbody tr"
                );

                rows.forEach(row => {

                    const text = row.textContent.toLowerCase();

                    row.style.display =
                        text.includes(search) ? "" : "none";

                });

                // TARJETAS DEL GRID
                const cards = document.querySelectorAll(
                    "#plagues-grid-view > div:not(#btn-add-plague-card)"
                );

                cards.forEach(card => {

                    const text = card.textContent.toLowerCase();

                    card.style.display =
                        text.includes(search) ? "" : "none";

                });

            });

        }

        function openModal() {

            form.reset();

            title.textContent = "Nueva Plaga";

            form.action = "/private/plagues/create";

            imagePreview.src = "";
            imagePreview.classList.add("hidden");

            modal.classList.remove("hidden");
            modal.classList.add("flex");
        }

        function closeModal() {
            modal.classList.remove("flex");
            modal.classList.add("hidden");
        }

        if (btnAdd) btnAdd.addEventListener("click", openModal);
        if (btnAddCard) btnAddCard.addEventListener("click", openModal);

        btnClose.addEventListener("click", closeModal);
        btnCancel.addEventListener("click", closeModal);
        backdrop.addEventListener("click", closeModal);

        imageInput.addEventListener("change", function () {

            const file = this.files[0];

            if (!file) {
                imagePreview.src = "";
                imagePreview.classList.add("hidden");
                return;
            }

            imagePreview.src = URL.createObjectURL(file);
            imagePreview.classList.remove("hidden");

        });

        // CAMBIO DE VISTA

        const tableView = document.getElementById("plagues-table-view");
        const gridView = document.getElementById("plagues-grid-view");

        const btnTable = document.getElementById("view-table");
        const btnGrid = document.getElementById("view-grid");

        if (btnTable && btnGrid) {

            btnGrid.classList.add("bg-[#43655c]", "text-white");
            btnGrid.classList.remove("text-on-surface-variant");

            btnTable.classList.remove("bg-[#43655c]", "text-white");
            btnTable.classList.add("text-on-surface-variant");

            btnTable.addEventListener("click", () => {

                tableView.style.display = "";
                gridView.style.display = "none";

                btnTable.classList.add("bg-[#43655c]", "text-white");
                btnTable.classList.remove("text-on-surface-variant");

                btnGrid.classList.remove("bg-[#43655c]", "text-white");
                btnGrid.classList.add("text-on-surface-variant");

            });

            btnGrid.addEventListener("click", () => {

                tableView.style.display = "none";
                gridView.style.display = "grid";

                btnGrid.classList.add("bg-[#43655c]", "text-white");
                btnGrid.classList.remove("text-on-surface-variant");

                btnTable.classList.remove("bg-[#43655c]", "text-white");
                btnTable.classList.add("text-on-surface-variant");

            });

        }

    })();

// MODAL DE ELIMINACIÓN DE PLAGAS
    document.addEventListener("DOMContentLoaded", () => {

        const modal = document.getElementById("modal-delete-plague");
        const backdrop = document.getElementById("modal-delete-plague-backdrop");

        const deleteForm = document.getElementById("delete-plague-form");
        const deleteName = document.getElementById("delete-plague-name");

        const cancelButton = document.getElementById(
            "btn-cancel-delete-plague"
        );

        document.querySelectorAll(".btn-delete-plague").forEach(button => {

            button.addEventListener("click", () => {

                const id = button.dataset.id;
                const name = button.dataset.name;

                deleteName.textContent = name;

                deleteForm.action =
                    `/private/plagues/delete/${id}`;

                modal.classList.remove("hidden");
                modal.classList.add("flex");

            });

        });

        const closeModal = () => {
            modal.classList.add("hidden");
            modal.classList.remove("flex");
        };

        cancelButton.addEventListener("click", closeModal);
        backdrop.addEventListener("click", closeModal);

    });
