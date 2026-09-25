const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const normalizeExistingImages = (rawImages, fallbackUrl = '') => {
  if (!rawImages) return fallbackUrl ? [{ id: null, url: fallbackUrl }] : [];

  try {
    const parsed =
      typeof rawImages === 'string' ? JSON.parse(rawImages) : rawImages;
    if (!Array.isArray(parsed)) {
      return fallbackUrl ? [{ id: null, url: fallbackUrl }] : [];
    }

    return parsed
      .map((image) => ({
        id: Number.isSafeInteger(Number(image?.id)) ? Number(image.id) : null,
        url: typeof image === 'string' ? image : image?.url,
        caption: typeof image === 'object' ? image?.caption : '',
      }))
      .filter((image) => image.url);
  } catch {
    return fallbackUrl ? [{ id: null, url: fallbackUrl }] : [];
  }
};

const buildImagePreview = ({ url, label, isNew, onRemove }) => {
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

  if (onRemove) {
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className =
      'shrink-0 rounded px-1.5 py-0.5 font-bold text-red-700 hover:bg-red-50';
    removeButton.textContent = 'Quitar';
    removeButton.setAttribute('aria-label', `Quitar ${label}`);
    removeButton.addEventListener('click', onRemove);
    caption.append(removeButton);
  }

  figure.append(image, caption);
  return figure;
};

export const createPlagueImageEditor = () => {
  const input = document.getElementById('plague-images');
  const previews = document.getElementById('plague-image-previews');
  const existingImagesNote = document.getElementById(
    'plague-existing-images-note',
  );
  const removedIdsInput = document.getElementById('plague-removed-image-ids');
  const error = document.getElementById('plague-image-error');
  let existingImages = [];
  let selectedFiles = [];
  let removedIds = new Set();
  let previewUrls = [];

  const setError = (message = '') => {
    if (!error) return;
    error.textContent = message;
    error.classList.toggle('hidden', !message);
  };

  const releasePreviewUrls = () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];
  };

  const syncInput = () => {
    if (!input || typeof DataTransfer === 'undefined') return;
    const transfer = new DataTransfer();
    selectedFiles.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
  };

  const render = () => {
    if (!previews) return;
    releasePreviewUrls();
    previews.replaceChildren();
    const activeImages = existingImages.filter(
      (image) => !removedIds.has(image.id),
    );

    activeImages.forEach((image, index) => {
      previews.append(
        buildImagePreview({
          url: image.url,
          label: image.caption || `Imagen ${index + 1}`,
          isNew: false,
          onRemove:
            image.id === null
              ? null
              : () => {
                  removedIds.add(image.id);
                  if (removedIdsInput) {
                    removedIdsInput.value = [...removedIds].join(',');
                  }
                  setError();
                  render();
                },
        }),
      );
    });

    selectedFiles.forEach((file, index) => {
      const objectUrl = URL.createObjectURL(file);
      previewUrls.push(objectUrl);
      previews.append(
        buildImagePreview({
          url: objectUrl,
          label: file.name,
          isNew: true,
          onRemove: () => {
            selectedFiles.splice(index, 1);
            syncInput();
            setError();
            render();
          },
        }),
      );
    });

    const hasImages = activeImages.length > 0 || selectedFiles.length > 0;
    previews.classList.toggle('hidden', !hasImages);
    previews.classList.toggle('grid', hasImages);
    existingImagesNote?.classList.toggle('hidden', activeImages.length === 0);
  };

  const reset = () => {
    existingImages = [];
    selectedFiles = [];
    removedIds = new Set();
    if (removedIdsInput) removedIdsInput.value = '';
    if (input) input.value = '';
    setError();
    syncInput();
    render();
  };

  const load = (data) => {
    existingImages = normalizeExistingImages(data.images, data.imageUrl);
    selectedFiles = [];
    removedIds = new Set();
    if (removedIdsInput) removedIdsInput.value = '';
    if (input) input.value = '';
    setError();
    render();
  };

  input?.addEventListener('change', () => {
    const additions = Array.from(input.files || []);
    if (additions.length === 0) {
      syncInput();
      render();
      return;
    }
    if (additions.some((file) => !ALLOWED_IMAGE_TYPES.has(file.type))) {
      setError('Todas las imágenes deben ser JPG, PNG o WEBP.');
      syncInput();
      render();
      return;
    }
    if (additions.some((file) => file.size > MAX_IMAGE_SIZE)) {
      setError('Cada imagen puede pesar como máximo 5 MB.');
      syncInput();
      render();
      return;
    }

    const activeExistingCount = existingImages.filter(
      (image) => !removedIds.has(image.id),
    ).length;
    const knownFiles = new Set(
      selectedFiles.map(
        (file) => `${file.name}:${file.size}:${file.lastModified}`,
      ),
    );
    const uniqueAdditions = additions.filter((file) => {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (knownFiles.has(key)) return false;
      knownFiles.add(key);
      return true;
    });
    const available = MAX_IMAGES - activeExistingCount - selectedFiles.length;

    if (uniqueAdditions.length > available) {
      setError(
        `La galería admite 10 imágenes en total. Puedes agregar ${Math.max(0, available)} más.`,
      );
      syncInput();
      render();
      return;
    }

    selectedFiles.push(...uniqueAdditions);
    setError();
    syncInput();
    render();
  });

  return { load, releasePreviewUrls, reset };
};
