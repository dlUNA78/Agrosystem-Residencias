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
  if (files.some((file) => !ALLOWED_IMAGE_TYPES.has(file.type))) {
    return 'Sólo se permiten fotografías en formato JPG, PNG o WEBP.';
  }
  if (files.some((file) => file.size > MAX_IMAGE_SIZE)) {
    return 'Cada imagen puede pesar como máximo 5 MB.';
  }
  return '';
};

const normalizePreviewUrl = (rawUrl) => {
  if (!rawUrl) return '/images/products/default.png';
  return rawUrl.startsWith('/') || rawUrl.startsWith('http')
    ? rawUrl
    : `/${rawUrl}`;
};

const createThumbImage = (src, alt) => {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.className = 'h-full w-full object-contain p-1.5 bg-slate-50';
  img.addEventListener('error', () => {
    img.src = '/images/products/default.png';
  });
  return img;
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

export const createProductImageEditor = () => {
  const fileInput = document.getElementById('image');
  const pickerBtn = document.getElementById('product-image-picker');
  const clearBtn = document.getElementById('clear-selected-images');
  const previewContainer = document.getElementById('selected-image-preview');
  const counterEl = document.getElementById('product-image-counter');
  const summaryCountEl = document.getElementById('selected-image-count');
  const errorEl = document.getElementById('product-image-error');
  const noteEl = document.getElementById('product-existing-images-note');
  const removedIdsInput = document.getElementById('product-removed-image-ids');
  const primaryIdInput = document.getElementById('product-primary-image-id');
  const defaultSourceInput = document.getElementById(
    'product-image-source-default',
  );

  let existingImages = [];
  const removedImageIds = new Set();
  let selectedFiles = [];
  const newFileSources = new Map();
  let objectUrls = [];
  let primaryImageId = null;

  const getRemainingExisting = () =>
    existingImages.filter((img) => !removedImageIds.has(img.id));

  const setErrorMessage = (msg) => {
    if (!errorEl) return;
    errorEl.textContent = msg || '';
    errorEl.classList.toggle('hidden', !msg);
  };

  const syncHiddenInputs = () => {
    if (removedIdsInput) {
      removedIdsInput.value = Array.from(removedImageIds).join(',');
    }
    if (primaryIdInput) {
      primaryIdInput.value = primaryImageId ? String(primaryImageId) : '';
    }
  };

  const syncCounters = (remainingCount) => {
    const total = remainingCount + selectedFiles.length;
    if (counterEl) {
      counterEl.textContent = `${total} / ${MAX_IMAGES} fotos`;
      counterEl.classList.toggle('text-rose-700', total > MAX_IMAGES);
    }
    if (summaryCountEl) {
      summaryCountEl.textContent = total
        ? `${remainingCount} guardada(s) · ${selectedFiles.length} nueva(s)`
        : 'Ninguna imagen seleccionada.';
    }
    noteEl?.classList.toggle('hidden', remainingCount === 0);
    clearBtn?.classList.toggle('hidden', selectedFiles.length === 0);
    previewContainer?.classList.toggle('hidden', total === 0);
    previewContainer?.classList.toggle('grid', total > 0);
  };

  const ensurePrimaryImage = (remaining) => {
    if (remaining.length === 0) {
      primaryImageId = null;
      return;
    }
    const stillExists = remaining.some((img) => img.id === primaryImageId);
    if (!stillExists) {
      const preferred = remaining.find((img) => img.is_primary) || remaining[0];
      primaryImageId = preferred.id;
    }
  };

  const buildExistingCard = (image) => {
    const isPrimary = image.id === primaryImageId;
    const figure = document.createElement('figure');
    figure.className = `rounded-xl overflow-hidden border bg-card shadow-2xs flex flex-col ${
      isPrimary
        ? 'border-[#1b4332] ring-2 ring-[#1b4332]/20'
        : 'border-border/80'
    }`;

    const mediaBox = document.createElement('div');
    mediaBox.className = 'relative aspect-square overflow-hidden';

    const img = createThumbImage(
      normalizePreviewUrl(image.image_url),
      image.original_name || 'Imagen del producto',
    );

    const caption = document.createElement('figcaption');
    caption.className =
      'absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/70 px-2 py-1 text-[10px] text-white backdrop-blur-xs';

    const primaryBtn = document.createElement('button');
    primaryBtn.type = 'button';
    primaryBtn.className = isPrimary
      ? 'font-bold text-amber-300 truncate cursor-default'
      : 'text-white/85 hover:text-amber-200 truncate cursor-pointer';
    primaryBtn.textContent = isPrimary ? '★ Portada' : 'Portada';
    primaryBtn.addEventListener('click', () => {
      if (primaryImageId === image.id) return;
      primaryImageId = image.id;
      renderAll();
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className =
      'shrink-0 rounded px-1 font-bold text-rose-300 hover:text-rose-100 cursor-pointer';
    removeBtn.textContent = 'Quitar';
    removeBtn.addEventListener('click', async () => {
      const confirmed = await confirmAsyncAction({
        title: '¿Quitar fotografía del producto?',
        description:
          'La imagen se eliminará de la galería cuando guardes los cambios de la ficha.',
        confirmLabel: 'Quitar imagen',
        cancelLabel: 'Conservar',
        variant: 'danger',
      });
      if (!confirmed) return;
      removedImageIds.add(image.id);
      renderAll();
    });

    caption.append(primaryBtn, removeBtn);
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

  const buildNewCard = (file, index, url) => {
    const fileKey = getFileKey(file);
    const figure = document.createElement('figure');
    figure.className =
      'rounded-xl overflow-hidden border border-emerald-300 bg-card shadow-2xs flex flex-col';

    const mediaBox = document.createElement('div');
    mediaBox.className = 'relative aspect-square overflow-hidden';

    const img = createThumbImage(url, file.name);
    const caption = document.createElement('figcaption');
    caption.className =
      'absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/70 px-2 py-1 text-[10px] text-white backdrop-blur-xs';

    const badge = document.createElement('span');
    badge.className = 'font-bold text-emerald-300 truncate';
    badge.textContent = 'Nueva';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className =
      'shrink-0 rounded px-1 font-bold text-rose-300 hover:text-rose-100 cursor-pointer';
    removeBtn.textContent = 'Quitar';
    removeBtn.addEventListener('click', () => {
      newFileSources.delete(fileKey);
      selectedFiles.splice(index, 1);
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
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = selectedFiles.map((file) => URL.createObjectURL(file));

    const remaining = getRemainingExisting();
    ensurePrimaryImage(remaining);

    if (previewContainer) {
      previewContainer.replaceChildren();
      remaining.forEach((img) =>
        previewContainer.appendChild(buildExistingCard(img)),
      );
      selectedFiles.forEach((file, idx) =>
        previewContainer.appendChild(buildNewCard(file, idx, objectUrls[idx])),
      );
    }

    syncHiddenInputs();
    syncCounters(remaining.length);
  };

  const addIncomingFiles = (incomingList) => {
    const incoming = Array.from(incomingList || []);
    if (incoming.length === 0) return;

    const validationError = validateIncomingFiles(incoming);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const existingKeys = new Set(
      selectedFiles.map((f) => `${f.name}:${f.size}:${f.lastModified}`),
    );
    const uniqueIncoming = incoming.filter(
      (f) => !existingKeys.has(`${f.name}:${f.size}:${f.lastModified}`),
    );

    const remainingCount = getRemainingExisting().length;
    if (
      remainingCount + selectedFiles.length + uniqueIncoming.length >
      MAX_IMAGES
    ) {
      setErrorMessage(
        `La galería puede contener como máximo ${MAX_IMAGES} imágenes en total.`,
      );
      return;
    }

    setErrorMessage('');
    selectedFiles = [...selectedFiles, ...uniqueIncoming];
    if (fileInput) fileInput.value = '';
    renderAll();
  };

  pickerBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', () =>
    addIncomingFiles(fileInput.files),
  );
  clearBtn?.addEventListener('click', () => {
    selectedFiles = [];
    newFileSources.clear();
    if (fileInput) fileInput.value = '';
    setErrorMessage('');
    renderAll();
  });

  pickerBtn?.addEventListener('dragover', (event) => {
    event.preventDefault();
    pickerBtn.classList.add('border-[#1b4332]', 'bg-[#e6f0e6]/60');
  });
  pickerBtn?.addEventListener('dragleave', () => {
    pickerBtn.classList.remove('border-[#1b4332]', 'bg-[#e6f0e6]/60');
  });
  pickerBtn?.addEventListener('drop', (event) => {
    event.preventDefault();
    pickerBtn.classList.remove('border-[#1b4332]', 'bg-[#e6f0e6]/60');
    addIncomingFiles(event.dataTransfer?.files);
  });

  const normalizeLoadedImages = (images) => {
    if (!Array.isArray(images)) return [];
    return images
      .filter((img) => img && (img.image_url || img.url))
      .map((img) => ({
        id: Number(img.id),
        image_url: img.image_url || img.url,
        original_name: img.original_name || '',
        source: img.source || '',
        is_primary: Boolean(img.is_primary),
      }));
  };

  return {
    loadExistingImages(images = []) {
      existingImages = normalizeLoadedImages(images);
      removedImageIds.clear();
      selectedFiles = [];
      newFileSources.clear();
      primaryImageId =
        existingImages.find((img) => img.is_primary)?.id ||
        existingImages[0]?.id ||
        null;
      if (defaultSourceInput) {
        defaultSourceInput.value = existingImages[0]?.source || '';
      }
      setErrorMessage('');
      if (fileInput) fileInput.value = '';
      renderAll();
    },
    reset() {
      existingImages = [];
      removedImageIds.clear();
      selectedFiles = [];
      newFileSources.clear();
      primaryImageId = null;
      setErrorMessage('');
      if (defaultSourceInput) defaultSourceInput.value = '';
      if (fileInput) fileInput.value = '';
      renderAll();
    },
    buildFormData(form) {
      syncHiddenInputs();
      const formData = new FormData(form);
      formData.delete('images');
      selectedFiles.forEach((file) =>
        formData.append('images', file, file.name),
      );
      return formData;
    },
  };
};
