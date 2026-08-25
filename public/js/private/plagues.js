document.addEventListener('DOMContentLoaded', () => {
  // ELEMENTOS DEL MODAL CREAR / EDITAR

  const modal = document.getElementById('modal-plague');
  const form = document.getElementById('plague-form');

  const btnAdd = document.getElementById('btn-add-plague');
  const btnAddCard = document.getElementById('btn-add-plague-card');

  const btnClose = document.getElementById('modal-plague-close');
  const btnCancel = document.getElementById('modal-plague-cancel');
  const backdrop = document.getElementById('modal-plague-backdrop');

  const title = document.getElementById('modal-plague-title');
  const btnSave = document.getElementById('btn-save-plague');

  const imageInput = document.getElementById('plague-image');
  const imagePreview = document.getElementById('plague-preview');

  // CAMPOS DEL FORMULARIO

  const inputName = form?.querySelector('[name="name"]');

  const inputScientificName = form?.querySelector('[name="scientific_name"]');

  const inputCategory = form?.querySelector('[name="category"]');

  const inputRegion = form?.querySelector('[name="region"]');

  const inputRiskLevel = form?.querySelector('[name="risk_level"]');

  const inputStatus = form?.querySelector('[name="status"]');

  const inputDescription = form?.querySelector('[name="description"]');

  const inputSymptoms = form?.querySelector('[name="symptoms"]');

  const inputControlMethods = form?.querySelector('[name="control_methods"]');

  const inputBiologicalControl = form?.querySelector(
    '[name="biological_control"]',
  );

  const inputBiologicalCycle = form?.querySelector('[name="biological_cycle"]');

  const inputVerifiedBy = form?.querySelector('[name="verified_by"]');

  const inputVerifiedAt = form?.querySelector('[name="verified_at"]');

  // FUNCIONES AUXILIARES

  function showModal() {
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    document.body.classList.add('overflow-hidden');
  }

  function hideModal() {
    if (!modal) return;

    modal.classList.remove('flex');
    modal.classList.add('hidden');

    document.body.classList.remove('overflow-hidden');
  }

  function resetImagePreview() {
    if (!imagePreview) return;

    imagePreview.src = '';
    imagePreview.classList.add('hidden');
  }

  // ABRIR MODAL PARA CREAR

  function openCreateModal() {
    if (!form) return;

    form.reset();

    // Acción para CREAR
    form.action = '/private/plagues/create';

    // Título
    if (title) {
      title.textContent = 'Nueva Plaga';
    }

    // Botón
    if (btnSave) {
      btnSave.innerHTML = `
                <span class="material-symbols-outlined text-[18px]">save</span>
                Guardar plaga
            `;
    }

    // Limpiar imagen
    resetImagePreview();

    if (imageInput) {
      imageInput.value = '';
    }

    showModal();
  }

  // ABRIR MODAL PARA EDITAR

  function openEditModal(button) {
    if (!form || !button) return;

    const data = button.dataset;

    const id = data.id || '';

    // VALIDACIÓN

    if (!id) {
      console.error('No se encontró el ID de la plaga.');
      return;
    }

    // CARGAR DATOS EN EL FORMULARIO

    if (inputName) {
      inputName.value = data.name || '';
    }

    if (inputScientificName) {
      inputScientificName.value = data.scientificName || '';
    }

    if (inputCategory) {
      inputCategory.value = data.category || '';
    }

    if (inputRegion) {
      inputRegion.value = data.region || '';
    }

    if (inputRiskLevel) {
      inputRiskLevel.value = data.riskLevel || '';
    }

    if (inputStatus) {
      const status = String(data.status).toLowerCase();

      inputStatus.value = status === 'true' ? 'true' : 'false';
    }

    if (inputDescription) {
      inputDescription.value = data.description || '';
    }

    if (inputSymptoms) {
      inputSymptoms.value = data.symptoms || '';
    }

    if (inputControlMethods) {
      inputControlMethods.value = data.controlMethods || '';
    }

    if (inputBiologicalControl) {
      inputBiologicalControl.value = data.biologicalControl || '';
    }

    if (inputBiologicalCycle) {
      inputBiologicalCycle.value = data.biologicalCycle || '';
    }

    if (inputVerifiedBy) {
      inputVerifiedBy.value = data.verifiedBy || '';
    }

    if (inputVerifiedAt) {
      inputVerifiedAt.value = data.verifiedAt || '';
    }

    // CAMBIAR FORM ACTION
    form.action = `/private/plagues/update/${id}`;

    // CAMBIAR TÍTULO

    if (title) {
      title.textContent = 'Editar Plaga';
    }

    // CAMBIAR TEXTO DEL BOTÓN

    if (btnSave) {
      btnSave.innerHTML = `
                <span class="material-symbols-outlined text-[18px]">save</span>
                Guardar cambios
            `;
    }

    // MOSTRAR IMAGEN ACTUAL
    if (imagePreview) {
      if (data.imageUrl) {
        imagePreview.src = `/${data.imageUrl}`;

        imagePreview.classList.remove('hidden');
      } else {
        resetImagePreview();
      }
    }

    // LIMPIAR INPUT DE ARCHIVO

    if (imageInput) {
      imageInput.value = '';
    }

    // ABRIR MODAL

    showModal();
  }

  // BOTONES DE CREAR

  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      openCreateModal();
    });
  }

  if (btnAddCard) {
    btnAddCard.addEventListener('click', () => {
      openCreateModal();
    });
  }

  // BOTONES DE EDITAR

  const editButtons = document.querySelectorAll('.btn-edit-plague');

  editButtons.forEach((button) => {
    button.addEventListener('click', () => {
      openEditModal(button);
    });
  });

  // CERRAR MODAL

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      hideModal();
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      hideModal();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      hideModal();
    });
  }

  // ESC PARA CERRAR

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (modal && !modal.classList.contains('hidden')) {
        hideModal();
      }
    }
  });

  // PREVISUALIZACIÓN DE IMAGEN

  if (imageInput) {
    imageInput.addEventListener('change', function () {
      const file = this.files[0];

      if (!file) {
        return;
      }

      // Validar que sea imagen

      if (!file.type.startsWith('image/')) {
        alert('Selecciona un archivo de imagen válido.');

        this.value = '';

        resetImagePreview();

        return;
      }

      // Liberar URL anterior si existiera

      if (imagePreview && imagePreview.dataset.objectUrl) {
        URL.revokeObjectURL(imagePreview.dataset.objectUrl);
      }

      const objectUrl = URL.createObjectURL(file);

      if (imagePreview) {
        imagePreview.src = objectUrl;

        imagePreview.dataset.objectUrl = objectUrl;

        imagePreview.classList.remove('hidden');
      }
    });
  }

  // BUSCADOR EN TIEMPO REAL
  // IMPORTANTE:
  // Se soportan ambos IDs:
  //
  // #plague-search
  // #search-input
  //
  // Esto evita romper el partial reutilizable.

  const searchInput =
    document.getElementById('plague-search') ||
    document.getElementById('search-input');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const search = searchInput.value.toLowerCase().trim();

      // TABLA

      const rows = document.querySelectorAll('#plagues-table-view tbody tr');

      rows.forEach((row) => {
        // No ocultar la fila de "no hay registros"

        if (
          row.querySelector('.btn-edit-plague') ||
          row.querySelector('.btn-delete-plague')
        ) {
          const text = row.textContent.toLowerCase();

          row.style.display = text.includes(search) ? '' : 'none';
        }
      });

      // GRID

      const cards = document.querySelectorAll('#plagues-grid-view article');

      cards.forEach((card) => {
        // La tarjeta "Nueva plaga" nunca se oculta

        if (card.id === 'cta-new-plague' || card.id === 'btn-add-plague-card') {
          return;
        }

        const text = card.textContent.toLowerCase();

        card.style.display = text.includes(search) ? '' : '';

        if (search && !text.includes(search)) {
          card.style.display = 'none';
        }
      });
    });
  }
  // CAMBIO DE VISTA TABLA / GRID

  const tableView = document.getElementById('plagues-table-view');

  const gridView = document.getElementById('plagues-grid-view');

  const btnTable = document.getElementById('view-table');

  const btnGrid = document.getElementById('view-grid');

  function activateTableView() {
    if (tableView) {
      tableView.style.display = '';
    }

    if (gridView) {
      gridView.style.display = 'none';
    }

    if (btnTable) {
      btnTable.classList.add('bg-[#43655c]', 'text-white');

      btnTable.classList.remove('text-on-surface-variant');
    }

    if (btnGrid) {
      btnGrid.classList.remove('bg-[#43655c]', 'text-white');

      btnGrid.classList.add('text-on-surface-variant');
    }
  }

  function activateGridView() {
    if (tableView) {
      tableView.style.display = 'none';
    }

    if (gridView) {
      gridView.style.display = 'grid';
    }

    if (btnGrid) {
      btnGrid.classList.add('bg-[#43655c]', 'text-white');

      btnGrid.classList.remove('text-on-surface-variant');
    }

    if (btnTable) {
      btnTable.classList.remove('bg-[#43655c]', 'text-white');

      btnTable.classList.add('text-on-surface-variant');
    }
  }

  if (btnTable && btnGrid) {
    // Vista inicial
    activateGridView();

    btnTable.addEventListener('click', activateTableView);

    btnGrid.addEventListener('click', activateGridView);
  }

  // MODAL DE ELIMINACIÓN
  const deleteModal = document.getElementById('modal-delete-plague');

  const deleteBackdrop = document.getElementById(
    'modal-delete-plague-backdrop',
  );

  const deleteForm = document.getElementById('delete-plague-form');

  const deleteName = document.getElementById('delete-plague-name');

  const cancelDelete = document.getElementById('btn-cancel-delete-plague');

  function openDeleteModal(button) {
    if (!deleteModal || !deleteForm || !button) {
      return;
    }

    const id = button.dataset.id || '';

    const name = button.dataset.name || 'esta plaga';

    if (!id) {
      console.error('No se encontró el ID de la plaga para eliminar.');

      return;
    }

    if (deleteName) {
      deleteName.textContent = name;
    }

    deleteForm.action = `/private/plagues/delete/${id}`;

    deleteModal.classList.remove('hidden');

    deleteModal.classList.add('flex');
  }

  function closeDeleteModal() {
    if (!deleteModal) {
      return;
    }

    deleteModal.classList.remove('flex');

    deleteModal.classList.add('hidden');
  }

  const deleteButtons = document.querySelectorAll('.btn-delete-plague');

  deleteButtons.forEach((button) => {
    button.addEventListener('click', () => {
      openDeleteModal(button);
    });
  });

  if (cancelDelete) {
    cancelDelete.addEventListener('click', closeDeleteModal);
  }

  if (deleteBackdrop) {
    deleteBackdrop.addEventListener('click', closeDeleteModal);
  }

  // ESC PARA CERRAR MODAL DE ELIMINACIÓN

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    if (deleteModal && !deleteModal.classList.contains('hidden')) {
      closeDeleteModal();
    }
  });

  // VER DETALLES DE LA PLAGA

  const viewButtons = document.querySelectorAll('.btn-view-plague');

  viewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.id;

      if (!id) {
        console.error('No se encontró el ID de la plaga.');
        return;
      }

      window.location.href = `/private/plagues/${id}`;
    });
  });
});
