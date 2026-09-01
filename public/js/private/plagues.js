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

  const imageInput = document.getElementById('plague-images');
  const imagePreviews = document.getElementById('plague-image-previews');
  const existingImagesNote = document.getElementById(
    'plague-existing-images-note',
  );
  const exportButton = document.getElementById('btn-export-plagues');
  const biologicalCycleBuilder = document.getElementById(
    'biological-cycle-builder',
  );
  const biologicalStageTemplate = document.getElementById(
    'biological-cycle-stage-template',
  );
  const addBiologicalStageButton = document.getElementById(
    'btn-add-biological-stage',
  );
  const maximumBiologicalStages = 20;
  const maximumImagesPerSelection = 10;
  const maximumImageSize = 5 * 1024 * 1024;
  const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  let currentExistingImages = [];
  let previewObjectUrls = [];

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
    releaseImagePreviewUrls();

    document.body.classList.remove('overflow-hidden');
  }

  function releaseImagePreviewUrls() {
    previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    previewObjectUrls = [];
  }

  function normalizeExistingImages(rawImages, fallbackUrl = '') {
    if (!rawImages) {
      return fallbackUrl ? [{ url: fallbackUrl }] : [];
    }

    try {
      const parsed =
        typeof rawImages === 'string' ? JSON.parse(rawImages) : rawImages;

      if (!Array.isArray(parsed)) {
        return fallbackUrl ? [{ url: fallbackUrl }] : [];
      }

      return parsed
        .map((image) => ({
          url: typeof image === 'string' ? image : image?.url,
          caption: typeof image === 'object' ? image?.caption : '',
        }))
        .filter((image) => image.url);
    } catch {
      return fallbackUrl ? [{ url: fallbackUrl }] : [];
    }
  }

  function buildImagePreview({ url, label, isNew }) {
    const figure = document.createElement('figure');
    figure.className =
      'overflow-hidden rounded-xl border border-border/80 bg-card';

    const image = document.createElement('img');
    image.src = url;
    image.alt = label;
    image.className = 'h-24 w-full object-cover';

    const caption = document.createElement('figcaption');
    caption.className =
      'flex items-center justify-between gap-1 px-2 py-1.5 text-[10px]';

    const name = document.createElement('span');
    name.className = 'truncate text-muted-foreground';
    name.textContent = label;

    const status = document.createElement('span');
    status.className = isNew
      ? 'shrink-0 font-bold text-[#1b4332]'
      : 'shrink-0 font-bold text-muted-foreground';
    status.textContent = isNew ? 'Nueva' : 'Actual';

    caption.append(name, status);
    figure.append(image, caption);

    return figure;
  }

  function renderImagePreviews(existingImages = [], newFiles = []) {
    if (!imagePreviews) return;

    releaseImagePreviewUrls();
    imagePreviews.replaceChildren();

    existingImages.forEach((image, index) => {
      imagePreviews.append(
        buildImagePreview({
          url: image.url,
          label: image.caption || `Imagen ${index + 1}`,
          isNew: false,
        }),
      );
    });

    newFiles.forEach((file) => {
      const objectUrl = URL.createObjectURL(file);
      previewObjectUrls.push(objectUrl);
      imagePreviews.append(
        buildImagePreview({
          url: objectUrl,
          label: file.name,
          isNew: true,
        }),
      );
    });

    const hasImages = existingImages.length > 0 || newFiles.length > 0;
    imagePreviews.classList.toggle('hidden', !hasImages);
    imagePreviews.classList.toggle('grid', hasImages);
    existingImagesNote?.classList.toggle('hidden', existingImages.length === 0);
  }

  function resetImagePreviews() {
    currentExistingImages = [];
    renderImagePreviews();
  }

  function formatHistoricalStageTitle(value) {
    const words = String(value || '')
      .replaceAll('_', ' ')
      .trim();
    return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : '';
  }

  function normalizeBiologicalStages(rawCycle) {
    if (!rawCycle) return [];

    let cycle = rawCycle;

    if (typeof cycle === 'string') {
      try {
        cycle = JSON.parse(cycle);
      } catch {
        return cycle
          .split(/\r?\n/)
          .map((title) => ({ title: title.trim() }))
          .filter((stage) => stage.title);
      }
    }

    if (Array.isArray(cycle)) {
      return cycle
        .map((stage) => {
          if (typeof stage === 'string') {
            return { title: stage, description: '', duration: '' };
          }

          return {
            title: stage?.title || stage?.name || stage?.stage || '',
            description:
              stage?.description || stage?.details || stage?.detail || '',
            duration: stage?.duration || stage?.time || '',
          };
        })
        .filter((stage) => stage.title || stage.description || stage.duration);
    }

    if (cycle && typeof cycle === 'object') {
      return Object.entries(cycle).map(([stage, duration]) => ({
        title: formatHistoricalStageTitle(stage),
        description: '',
        duration: String(duration || ''),
      }));
    }

    return [];
  }

  function updateBiologicalStageNumbers() {
    if (!biologicalCycleBuilder) return;

    const stages = biologicalCycleBuilder.querySelectorAll(
      '[data-biological-stage]',
    );

    stages.forEach((stage, index) => {
      const number = stage.querySelector('[data-stage-number]');
      if (number) number.textContent = String(index + 1);
    });

    if (addBiologicalStageButton) {
      const limitReached = stages.length >= maximumBiologicalStages;
      addBiologicalStageButton.disabled = limitReached;
      addBiologicalStageButton.classList.toggle('opacity-50', limitReached);
      addBiologicalStageButton.classList.toggle(
        'cursor-not-allowed',
        limitReached,
      );
    }
  }

  function addBiologicalStage(stage = {}) {
    if (!biologicalCycleBuilder || !biologicalStageTemplate) return;

    const currentStages = biologicalCycleBuilder.querySelectorAll(
      '[data-biological-stage]',
    );
    if (currentStages.length >= maximumBiologicalStages) return;

    const fragment = biologicalStageTemplate.content.cloneNode(true);
    const stageElement = fragment.querySelector('[data-biological-stage]');
    const stageTitle = stageElement?.querySelector(
      '[name="biological_cycle_title[]"]',
    );
    const stageDuration = stageElement?.querySelector(
      '[name="biological_cycle_duration[]"]',
    );
    const stageDescription = stageElement?.querySelector(
      '[name="biological_cycle_description[]"]',
    );
    const removeButton = stageElement?.querySelector(
      '.remove-biological-stage',
    );

    if (stageTitle) stageTitle.value = stage.title || '';
    if (stageDuration) stageDuration.value = stage.duration || '';
    if (stageDescription) stageDescription.value = stage.description || '';

    removeButton?.addEventListener('click', () => {
      stageElement.remove();

      if (
        biologicalCycleBuilder.querySelectorAll('[data-biological-stage]')
          .length === 0
      ) {
        addBiologicalStage();
      }

      updateBiologicalStageNumbers();
    });

    biologicalCycleBuilder.append(fragment);
    updateBiologicalStageNumbers();
    window.lucide?.createIcons();
  }

  function resetBiologicalCycle(rawCycle = []) {
    if (!biologicalCycleBuilder) return;

    biologicalCycleBuilder.replaceChildren();
    const stages = normalizeBiologicalStages(rawCycle).slice(
      0,
      maximumBiologicalStages,
    );

    if (stages.length === 0) {
      addBiologicalStage();
      return;
    }

    stages.forEach((stage) => addBiologicalStage(stage));
  }

  // ABRIR MODAL PARA CREAR

  function openCreateModal() {
    if (!form) return;

    form.reset();
    resetBiologicalCycle();

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
    resetImagePreviews();

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

    resetBiologicalCycle(data.biologicalCycle || []);

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

    // MOSTRAR GALERÍA ACTUAL
    currentExistingImages = normalizeExistingImages(data.images, data.imageUrl);
    renderImagePreviews(currentExistingImages);

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

  addBiologicalStageButton?.addEventListener('click', () => {
    addBiologicalStage();
  });

  resetBiologicalCycle();

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

  // PREVISUALIZACIÓN DE IMÁGENES

  if (imageInput) {
    imageInput.addEventListener('change', function () {
      const files = Array.from(this.files || []);

      if (files.length === 0) {
        renderImagePreviews(currentExistingImages);
        return;
      }

      if (files.length > maximumImagesPerSelection) {
        alert(`Selecciona como máximo ${maximumImagesPerSelection} imágenes.`);
        this.value = '';
        renderImagePreviews(currentExistingImages);
        return;
      }

      if (files.some((file) => !allowedImageTypes.has(file.type))) {
        alert('Todas las imágenes deben ser JPG, PNG o WEBP.');
        this.value = '';
        renderImagePreviews(currentExistingImages);
        return;
      }

      if (files.some((file) => file.size > maximumImageSize)) {
        alert('Cada imagen puede pesar como máximo 5 MB.');
        this.value = '';
        renderImagePreviews(currentExistingImages);
        return;
      }

      renderImagePreviews(currentExistingImages, files);
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
