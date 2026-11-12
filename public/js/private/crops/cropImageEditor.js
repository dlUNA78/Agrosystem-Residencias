import { confirmAsyncAction } from '../asyncUi.js';

const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const validateIncomingFiles = (files) => {
  if (files.some((f) => !ALLOWED_IMAGE_TYPES.has(f.type))) {
    return 'Todas las imágenes deben ser JPG, JPEG, PNG o WEBP.';
  }
  if (files.some((f) => f.size > MAX_IMAGE_SIZE)) {
    return 'Cada imagen puede pesar como máximo 5 MB.';
  }
  return '';
};

const getFileKey = (file) => `${file.name}:${file.size}:${file.lastModified}`;

const buildCreditFooter = ({ id, source = '', isNew, onSourceChange }) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'border-t border-border/60 bg-muted/20 p-1.5';

  if (!isNew && id) {
    const idInput = document.createElement('input');
    idInput.type = 'hidden';
    idInput.name = 'existing_image_source_ids';
    idInput.value = String(id);
    wrapper.appendChild(idInput);
  }

  const sourceInput = document.createElement('input');
  sourceInput.type = 'text';
  sourceInput.name = isNew ? 'new_image_sources' : 'existing_image_sources';
  sourceInput.value = source || '';
  sourceInput.maxLength = 255;
  sourceInput.placeholder = 'Crédito / fuente (opcional)';
  sourceInput.className =
    'w-full rounded-lg border border-input bg-card px-2 py-1 text-[10px] text-foreground focus:border-[#1b4332] focus:outline-hidden';
  sourceInput.addEventListener('input', (event) => {
    onSourceChange?.(event.target.value);
  });
  wrapper.appendChild(sourceInput);
  return wrapper;
};

export const createCropImageEditor = () => {
  const fileInput = document.getElementById('crop-images');
  const previewContainer = document.getElementById('crop-images-preview');
  const counterEl = document.getElementById('crop-image-counter');
  const errorEl = document.getElementById('crop-image-error');
  const noteEl = document.getElementById('crop-existing-images-note');
  const removedIdsInput = document.getElementById('crop-removed-image-ids');
  const primaryIdInput = document.getElementById('crop-primary-image-id');
  const defaultSourceInput = document.getElementById(
    'crop-image-source-default',
  );

  let existingImages = [];
  const removedImageIds = new Set();
  let selectedFiles = [];
  const newFileSources = new Map();
  let primaryImageId = null;

  const updateCounter = () => {
    const remainingExisting = existingImages.filter(
      (img) => !removedImageIds.has(img.id),
    );
    const total = remainingExisting.length + selectedFiles.length;
    if (counterEl) {
      counterEl.textContent = `${total} / ${MAX_IMAGES} fotos`;
      counterEl.classList.toggle('text-rose-700', total > MAX_IMAGES);
    }
    if (noteEl) {
      noteEl.classList.toggle('hidden', remainingExisting.length === 0);
    }
  };

  const syncHiddenInputs = () => {
    if (removedIdsInput) {
      removedIdsInput.value = Array.from(removedImageIds).join(',');
    }
    if (primaryIdInput) {
      primaryIdInput.value = primaryImageId ? String(primaryImageId) : '';
    }
  };

  const syncFileInput = () => {
    if (!fileInput) return;
    try {
      const dt = new DataTransfer();
      selectedFiles.forEach((file) => dt.items.add(file));
      fileInput.files = dt.files;
    } catch {
      // DataTransfer no disponible en entornos limitados
    }
  };

  const setErrorMessage = (msg) => {
    if (!errorEl) return;
    if (msg) {
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
    } else {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
  };

  const renderExistingCard = (image) => {
    const isPrimary = image.id === primaryImageId || image.is_primary;
    const figure = document.createElement('figure');
    figure.className =
      'rounded-xl overflow-hidden border border-border bg-card shadow-2xs flex flex-col';

    const mediaBox = document.createElement('div');
    mediaBox.className = 'relative aspect-square overflow-hidden';

    const img = document.createElement('img');
    img.src = image.image_url?.startsWith('/')
      ? image.image_url
      : `/${image.image_url}`;
    img.alt = image.original_name || 'Imagen del cultivo';
    img.className = 'w-full h-full object-cover';
    img.addEventListener('error', () => {
      img.src = '/images/test/default.png';
    });

    const caption = document.createElement('figcaption');
    caption.className =
      'absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs p-1.5 flex items-center justify-between text-[10px] text-white';

    const badge = document.createElement('span');
    badge.className = isPrimary
      ? 'font-bold text-amber-300 flex items-center gap-0.5'
      : 'text-white/80';
    badge.textContent = isPrimary ? '★ Principal' : 'Actual';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className =
      'text-rose-300 hover:text-rose-100 font-bold px-1.5 py-0.5 rounded cursor-pointer';
    removeBtn.textContent = 'Quitar';
    removeBtn.addEventListener('click', async () => {
      const confirmed = await confirmAsyncAction({
        title: '¿Quitar imagen del cultivo?',
        description:
          'La imagen se eliminará definitivamente de la ficha al guardar los cambios.',
        confirmLabel: 'Quitar foto',
        cancelLabel: 'Conservar',
        variant: 'danger',
      });
      if (!confirmed) return;
      removedImageIds.add(image.id);
      renderAll();
    });

    caption.append(badge, removeBtn);
    mediaBox.append(img, caption);
    figure.append(
      mediaBox,
      buildCreditFooter({
        id: image.id,
        source: image.source || '',
        isNew: false,
        onSourceChange: (value) => {
          image.source = value;
        },
      }),
    );
    return figure;
  };

  const renderNewCard = (file, index) => {
    const fileKey = getFileKey(file);
    const figure = document.createElement('figure');
    figure.className =
      'rounded-xl overflow-hidden border border-emerald-300 bg-card shadow-2xs flex flex-col';

    const mediaBox = document.createElement('div');
    mediaBox.className = 'relative aspect-square overflow-hidden';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name;
    img.className = 'w-full h-full object-cover';

    const caption = document.createElement('figcaption');
    caption.className =
      'absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs p-1.5 flex items-center justify-between text-[10px] text-white';

    const badge = document.createElement('span');
    badge.className = 'font-bold text-emerald-300';
    badge.textContent = 'Nueva';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className =
      'text-rose-300 hover:text-rose-100 font-bold px-1.5 py-0.5 rounded cursor-pointer';
    removeBtn.textContent = 'Quitar';
    removeBtn.addEventListener('click', () => {
      newFileSources.delete(fileKey);
      selectedFiles.splice(index, 1);
      syncFileInput();
      renderAll();
    });

    caption.append(badge, removeBtn);
    mediaBox.append(img, caption);
    figure.append(
      mediaBox,
      buildCreditFooter({
        source: newFileSources.get(fileKey) || '',
        isNew: true,
        onSourceChange: (value) => {
          newFileSources.set(fileKey, value);
        },
      }),
    );
    return figure;
  };

  const renderAll = () => {
    if (!previewContainer) return;
    previewContainer.innerHTML = '';

    const remainingExisting = existingImages.filter(
      (img) => !removedImageIds.has(img.id),
    );
    remainingExisting.forEach((img) => {
      previewContainer.appendChild(renderExistingCard(img));
    });

    selectedFiles.forEach((file, index) => {
      previewContainer.appendChild(renderNewCard(file, index));
    });

    syncHiddenInputs();
    updateCounter();
  };

  const handleNewFiles = (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;

    const remainingExisting = existingImages.filter(
      (img) => !removedImageIds.has(img.id),
    );
    if (
      remainingExisting.length + selectedFiles.length + list.length >
      MAX_IMAGES
    ) {
      setErrorMessage(
        `La galería puede contener como máximo ${MAX_IMAGES} fotos.`,
      );
      return;
    }

    const validationError = validateIncomingFiles(list);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage('');
    selectedFiles = [...selectedFiles, ...list];
    syncFileInput();
    renderAll();
  };

  fileInput?.addEventListener('change', () => {
    handleNewFiles(fileInput.files);
  });

  return {
    loadExistingImages: (images = []) => {
      existingImages = Array.isArray(images)
        ? images.map((img) => ({
            id: Number(img.id),
            image_url: img.image_url || img.url,
            original_name: img.original_name,
            source: img.source || '',
            is_primary: Boolean(img.is_primary),
          }))
        : [];
      removedImageIds.clear();
      selectedFiles = [];
      newFileSources.clear();
      const primary = existingImages.find((img) => img.is_primary);
      primaryImageId = primary ? primary.id : existingImages[0]?.id || null;
      if (defaultSourceInput) {
        defaultSourceInput.value = existingImages[0]?.source || '';
      }
      setErrorMessage('');
      syncFileInput();
      renderAll();
    },
    reset: () => {
      existingImages = [];
      removedImageIds.clear();
      selectedFiles = [];
      newFileSources.clear();
      primaryImageId = null;
      setErrorMessage('');
      if (defaultSourceInput) defaultSourceInput.value = '';
      if (fileInput) fileInput.value = '';
      if (previewContainer) previewContainer.innerHTML = '';
      syncHiddenInputs();
      updateCounter();
    },
    hasImages: () =>
      existingImages.filter((img) => !removedImageIds.has(img.id)).length +
        selectedFiles.length >
      0,
  };
};
