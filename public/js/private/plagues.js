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
  const exportButton = document.getElementById('btn-export-plagues');

  if (exportButton) {
    exportButton.addEventListener('click', () => window.print());
  }

  document.querySelectorAll('.plague-list-image').forEach((image) => {
    image.addEventListener(
      'error',
      () => {
        image.classList.add('hidden');
        const fallback = image.nextElementSibling;

        if (fallback?.classList.contains('plague-image-fallback')) {
          fallback.classList.remove('hidden');
          fallback.classList.add('flex');
        }
      },
      { once: true },
    );
  });

  // CAMPOS DEL FORMULARIO

  const inputName = form?.querySelector('[name="name"]');

  const inputScientificName = form?.querySelector('[name="scientific_name"]');

  const inputCategory = form?.querySelector('[name="category"]');

  const inputRegion = form?.querySelector('[name="region"]');

  const inputRiskLevel = form?.querySelector('[name="risk_level"]');

  const inputDescription = form?.querySelector('[name="description"]');

  const inputSymptoms = form?.querySelector('[name="symptoms"]');

  const inputControlMethods = form?.querySelector('[name="control_methods"]');

  const inputBiologicalControl = form?.querySelector(
    '[name="biological_control"]',
  );

  const inputBiologicalCycle = form?.querySelector('[name="biological_cycle"]');

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

  // FILTROS DEL LADO DEL SERVIDOR

  const filterForm = document.getElementById('plague-filter-form');
  const filterSelects = document.querySelectorAll('.filter-select');

  filterSelects.forEach((select) => {
    select.addEventListener('change', () => filterForm?.requestSubmit());
  });

  // CAMBIO DE VISTA TABLA / GRID

  const tableView = document.getElementById('plagues-table-view');

  const gridView = document.getElementById('plagues-grid-view');

  const btnTable = document.getElementById('view-table');

  const btnGrid = document.getElementById('view-grid');

  function activateTableView() {
    if (tableView) {
      tableView.classList.remove('hidden');
    }

    if (gridView) {
      gridView.classList.add('hidden');
    }

    if (btnTable) {
      btnTable.classList.add('bg-[#1b4332]', 'text-white');

      btnTable.classList.remove('text-muted-foreground');
    }

    if (btnGrid) {
      btnGrid.classList.remove('bg-[#1b4332]', 'text-white');

      btnGrid.classList.add('text-muted-foreground');
    }
  }

  function activateGridView() {
    if (tableView) {
      tableView.classList.add('hidden');
    }

    if (gridView) {
      gridView.classList.remove('hidden');
    }

    if (btnGrid) {
      btnGrid.classList.add('bg-[#1b4332]', 'text-white');

      btnGrid.classList.remove('text-muted-foreground');
    }

    if (btnTable) {
      btnTable.classList.remove('bg-[#1b4332]', 'text-white');

      btnTable.classList.add('text-muted-foreground');
    }
  }

  if (btnTable && btnGrid) {
    const preferredView = window.localStorage.getItem('plagues-private-view');

    if (preferredView === 'table') {
      activateTableView();
    } else {
      activateGridView();
    }

    btnTable.addEventListener('click', () => {
      activateTableView();
      window.localStorage.setItem('plagues-private-view', 'table');
    });

    btnGrid.addEventListener('click', () => {
      activateGridView();
      window.localStorage.setItem('plagues-private-view', 'grid');
    });
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
