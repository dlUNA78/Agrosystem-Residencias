// MODAL CULTIVOS
{
  // ELEMENTOS DEL MODAL
  const modalCrop = document.getElementById('modal-crop');

  const modalTitle = document.getElementById('modal-crop-title');

  const cropForm = document.getElementById('crop-form');

  // BOTONES

  const btnAddCrop = document.getElementById('btn-add-crop');

  const btnAddCropCard = document.getElementById('btn-add-crop-card');

  const btnCloseCrop = document.getElementById('modal-crop-close');

  const btnCancelCrop = document.getElementById('modal-crop-cancel');

  const backdropCrop = document.getElementById('modal-crop-backdrop');

  // IMÁGENES

  const imageInput = document.getElementById('crop-images');

  const imagePreview = document.getElementById('crop-images-preview');

  // ABRIR MODAL PARA NUEVO CULTIVO

  function openCreateModal() {
    if (!modalCrop) return;

    // Limpiar formulario

    cropForm.reset();

    // Restaurar action original

    cropForm.action = '/private/crops/create';

    // Cambiar título

    modalTitle.textContent = 'Nuevo Cultivo';

    // Limpiar imágenes

    if (imagePreview) {
      imagePreview.innerHTML = '';
    }

    if (imageInput) {
      imageInput.value = '';
    }

    // Abrir modal

    modalCrop.classList.remove('hidden');

    modalCrop.classList.add('flex');
  }

  // ABRIR MODAL

  function openModal() {
    if (!modalCrop) return;

    modalCrop.classList.remove('hidden');

    modalCrop.classList.add('flex');
  }

  // CERRAR MODAL

  function closeModal() {
    if (!modalCrop) return;

    modalCrop.classList.remove('flex');

    modalCrop.classList.add('hidden');
  }

  // BOTÓN NUEVO CULTIVO

  if (btnAddCrop) {
    btnAddCrop.addEventListener('click', openCreateModal);
  }

  if (btnAddCropCard) {
    btnAddCropCard.addEventListener('click', openCreateModal);
  }

  // CERRAR MODAL
  if (btnCloseCrop) {
    btnCloseCrop.addEventListener('click', closeModal);
  }

  if (btnCancelCrop) {
    btnCancelCrop.addEventListener('click', closeModal);
  }

  if (backdropCrop) {
    backdropCrop.addEventListener('click', closeModal);
  }

  // CERRAR CON ESC

  document.addEventListener('keydown', function (event) {
    if (
      event.key === 'Escape' &&
      modalCrop &&
      !modalCrop.classList.contains('hidden')
    ) {
      closeModal();
    }
  });

  // FUNCIÓN PARA ASIGNAR VALORES

  function setValue(id, value) {
    const element = document.getElementById(id);

    if (!element) return;

    element.value = value ?? '';
  }

  function appendImagePreview({ source, label, isNew = false }) {
    if (!imagePreview || !source) return;

    const preview = document.createElement('div');
    preview.className =
      'relative aspect-square rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-low';

    const image = document.createElement('img');
    image.src = source;
    image.alt = label || 'Imagen del cultivo';
    image.className = 'w-full h-full object-cover';
    image.addEventListener('error', () => {
      if (image.src.endsWith('/images/test/default.png')) return;
      image.src = '/images/test/default.png';
    });
    preview.appendChild(image);

    const caption = document.createElement('div');
    caption.className = isNew
      ? 'absolute top-2 right-2 px-2 py-1 rounded-md bg-primary text-white text-[10px]'
      : 'absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate';
    caption.textContent = isNew ? 'Nueva' : label || 'Imagen';
    preview.appendChild(caption);
    imagePreview.appendChild(preview);
  }

  // CARGAR IMÁGENES EXISTENTES

  function loadExistingImages(images) {
    if (!imagePreview) return;

    imagePreview.innerHTML = '';

    if (!images || images.length === 0) {
      return;
    }

    images.forEach((image) => {
      appendImagePreview({
        source: image.image_url,
        label: image.original_name || 'Imagen del cultivo',
      });
    });
  }

  // EDITAR CULTIVO

  document.addEventListener('click', async function (event) {
    const editButton = event.target.closest('.edit-crop-btn');

    if (!editButton) return;

    const cropId = editButton.dataset.id;

    if (!cropId) {
      console.error('No se encontró el ID del cultivo');

      return;
    }

    try {
      // OBTENER CULTIVO

      const response = await fetch(`/private/crops/${cropId}`, {
        headers: { Accept: 'application/json' },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'No se pudo obtener el cultivo');
      }

      const crop = data.crop;

      // CAMBIAR TÍTULO

      modalTitle.textContent = 'Editar Cultivo';

      // CAMBIAR ACTION DEL FORMULARIO

      cropForm.action = `/private/crops/update/${crop.id}`;

      // IDENTIFICACIÓN

      setValue('crop-name', crop.name);

      setValue('crop-scientific-name', crop.scientific_name);

      setValue('crop-category', crop.category);

      setValue('crop-family', crop.family);

      setValue('crop-genus', crop.genus);

      setValue('crop-variety', crop.variety);

      // REGIÓN

      setValue('crop-region', crop.region);

      setValue('crop-state', crop.state);

      setValue('crop-min-altitude', crop.min_altitude);

      setValue('crop-max-altitude', crop.max_altitude);

      // CLIMA

      setValue('crop-climate', crop.climate);

      setValue('crop-min-temperature', crop.min_temperature);

      setValue('crop-max-temperature', crop.max_temperature);

      setValue('crop-min-rainfall', crop.min_rainfall);

      setValue('crop-max-rainfall', crop.max_rainfall);

      setValue('crop-humidity', crop.humidity);

      // SUELO

      setValue('crop-soil', crop.soil_type);

      setValue('crop-ph', crop.ph_range);

      setValue('crop-drainage', crop.drainage);

      setValue('crop-organic-matter', crop.organic_matter);

      // CICLO Y PRODUCCIÓN

      setValue('crop-season', crop.season);

      setValue('crop-cycle', crop.cycle);

      setValue('crop-harvest-days', crop.harvest_days);

      setValue('crop-yield', crop.average_yield);

      setValue('crop-density', crop.planting_density);

      setValue('crop-depth', crop.planting_depth);

      // REQUERIMIENTOS

      setValue('crop-water', crop.water_requirement);

      setValue('crop-irrigation', crop.irrigation_type);

      setValue('crop-sun', crop.sunlight_requirement);

      // MANEJO

      setValue('crop-nutrients', crop.nutrients);

      setValue('crop-fertilization', crop.fertilization);

      setValue(
        'crop-pruning',
        crop.requires_pruning === true
          ? 'true'
          : crop.requires_pruning === false
            ? 'false'
            : '',
      );

      setValue('crop-pollination', crop.pollination_type);

      // INFORMACIÓN

      setValue('crop-description', crop.description);

      setValue('crop-observations', crop.observations);

      // CARGAR IMÁGENES

      loadExistingImages(crop.images);

      // ABRIR MODAL
      openModal();
    } catch (error) {
      console.error('ERROR AL CARGAR CULTIVO:', error);

      alert('No se pudo cargar la información del cultivo');
    }
  });

  // PREVISUALIZAR NUEVAS IMÁGENES

  if (imageInput && imagePreview) {
    imageInput.addEventListener('change', function () {
      const files = Array.from(this.files);

      if (files.length === 0) {
        return;
      }

      // IMPORTANTE:
      // No borramos las imágenes existentes.
      // Las nuevas se agregan debajo.

      files.forEach(function (file) {
        const reader = new FileReader();

        reader.onload = function (event) {
          appendImagePreview({
            source: event.target.result,
            label: file.name,
            isNew: true,
          });
        };

        reader.readAsDataURL(file);
      });
    });
  }

  // CAMBIO DE VISTA

  const tableView = document.getElementById('crops-table-view');

  const gridView = document.getElementById('crops-grid-view');

  const btnTable = document.getElementById('view-table');

  const btnGrid = document.getElementById('view-grid');

  if (btnTable && btnGrid && tableView && gridView) {
    // GRID POR DEFECTO

    btnGrid.classList.add('bg-[#43655c]', 'text-white');

    btnGrid.classList.remove('text-on-surface-variant');

    btnTable.classList.remove('bg-[#43655c]', 'text-white');

    btnTable.classList.add('text-on-surface-variant');

    // TABLA

    btnTable.addEventListener('click', function () {
      tableView.classList.remove('hidden');

      gridView.classList.add('hidden');

      btnTable.classList.add('bg-[#43655c]', 'text-white');

      btnTable.classList.remove('text-on-surface-variant');

      btnGrid.classList.remove('bg-[#43655c]', 'text-white');

      btnGrid.classList.add('text-on-surface-variant');
    });

    // GRID

    btnGrid.addEventListener('click', function () {
      tableView.classList.add('hidden');

      gridView.classList.remove('hidden');

      btnGrid.classList.add('bg-[#43655c]', 'text-white');

      btnGrid.classList.remove('text-on-surface-variant');

      btnTable.classList.remove('bg-[#43655c]', 'text-white');

      btnTable.classList.add('text-on-surface-variant');
    });
  }

  // MODAL ELIMINAR CULTIVO
  const modalDeleteCrop = document.getElementById('modal-delete-crop');
  const modalDeleteCropBackdrop = document.getElementById(
    'modal-delete-crop-backdrop',
  );
  const modalDeleteCropCancel = document.getElementById(
    'modal-delete-crop-cancel',
  );
  const deleteCropForm = document.getElementById('delete-crop-form');
  const deleteCropName = document.getElementById('delete-crop-name');

  // ABRIR MODAL DESDE TABLA Y GRID
  document.querySelectorAll('.delete-crop-btn').forEach((button) => {
    button.addEventListener('click', function () {
      const cropId = this.dataset.id;
      const cropName = this.dataset.name;

      // Mostrar nombre del cultivo
      deleteCropName.textContent = cropName;
      // Configurar ruta del formulario
      deleteCropForm.action = `/private/crops/delete/${cropId}`;

      // Mostrar modal
      modalDeleteCrop.classList.remove('hidden');
      modalDeleteCrop.classList.add('flex');
    });
  });

  // CERRAR MODAL
  function closeDeleteCropModal() {
    if (!modalDeleteCrop) return;
    modalDeleteCrop.classList.add('hidden');
    modalDeleteCrop.classList.remove('flex');
  }

  // BOTÓN CANCELAR
  modalDeleteCropCancel?.addEventListener('click', closeDeleteCropModal);

  // CLIC EN EL FONDO
  modalDeleteCropBackdrop?.addEventListener('click', closeDeleteCropModal);

  // TECLA ESC
  document.addEventListener('keydown', function (event) {
    if (
      event.key === 'Escape' &&
      modalDeleteCrop &&
      !modalDeleteCrop.classList.contains('hidden')
    ) {
      closeDeleteCropModal();
    }
  });

  // BUSCADOR EN TIEMPO REAL

  const searchInput = document.getElementById('crop-search');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const search = searchInput.value.toLowerCase().trim();

      // FILAS DE LA TABLA

      const rows = document.querySelectorAll('#crops-table-view tbody tr');

      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();

        row.classList.toggle('hidden', !text.includes(search));
      });

      // TARJETAS DEL GRID

      const cards = document.querySelectorAll('#crops-grid-view > article');

      cards.forEach((card) => {
        const text = card.textContent.toLowerCase();

        card.classList.toggle('hidden', !text.includes(search));
      });
    });
  }
}
