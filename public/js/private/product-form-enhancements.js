const normalizeSearchText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const initializeRelationSearch = (form) => {
  const searches = Array.from(
    form?.querySelectorAll('[data-relation-search]') || [],
  );

  searches.forEach((search) => {
    search.addEventListener('input', () => {
      const query = normalizeSearchText(search.value.trim());
      const container = document.getElementById(search.dataset.relationSearch);
      container?.querySelectorAll('.relation-option').forEach((option) => {
        option.classList.toggle(
          'hidden',
          !normalizeSearchText(option.dataset.searchText).includes(query),
        );
      });
    });
  });

  return {
    reset() {
      searches.forEach((search) => {
        search.value = '';
        search.dispatchEvent(new Event('input'));
      });
    },
    select(name, records = []) {
      const selectedIds = new Set(records.map(({ id }) => String(id)));
      form
        ?.querySelectorAll(`input[name="${name}"]`)
        .forEach((field) => (field.checked = selectedIds.has(field.value)));
    },
  };
};

export const initializeProductImages = ({ input, validate }) => {
  const gallery = document.getElementById('selected-image-preview');
  const counter = document.getElementById('selected-image-count');
  const clearButton = document.getElementById('clear-selected-images');
  let selectedFiles = [];
  let existingImages = [];
  let objectUrls = [];

  const syncInput = () => {
    const transfer = new DataTransfer();
    selectedFiles.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
  };
  const thumbnail = ({ url, label, alt }) => {
    const item = document.createElement('figure');
    item.className =
      'overflow-hidden rounded-xl border border-border bg-card shadow-sm';
    const image = document.createElement('img');
    image.src = url;
    image.alt = alt;
    image.className = 'h-24 w-full object-cover';
    const caption = document.createElement('figcaption');
    caption.className =
      'truncate px-2 py-1.5 text-[10px] text-muted-foreground';
    caption.textContent = label;
    item.append(image, caption);
    return item;
  };
  const render = () => {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = selectedFiles.map((file) => URL.createObjectURL(file));
    gallery?.replaceChildren();
    existingImages.forEach((image, index) =>
      gallery?.appendChild(
        thumbnail({
          url: image.image_url,
          label: 'Imagen guardada',
          alt: image.alt_text || `Imagen guardada ${index + 1}`,
        }),
      ),
    );
    selectedFiles.forEach((file, index) =>
      gallery?.appendChild(
        thumbnail({
          url: objectUrls[index],
          label: file.name,
          alt: `Nueva imagen ${index + 1}`,
        }),
      ),
    );
    const total = existingImages.length + selectedFiles.length;
    gallery?.classList.toggle('hidden', total === 0);
    gallery?.classList.toggle('grid', total > 0);
    clearButton?.classList.toggle('hidden', selectedFiles.length === 0);
    if (counter) {
      counter.textContent = total
        ? `${existingImages.length} guardada(s) · ${selectedFiles.length} nueva(s)`
        : 'Ninguna imagen seleccionada.';
    }
  };

  input?.addEventListener('change', () => {
    const additions = Array.from(input.files || []);
    const keys = new Set(
      selectedFiles.map(
        (file) => `${file.name}:${file.size}:${file.lastModified}`,
      ),
    );
    additions.forEach((file) => {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (!keys.has(key) && selectedFiles.length < 10) {
        selectedFiles.push(file);
        keys.add(key);
      }
    });
    syncInput();
    validate?.(input);
    render();
  });
  clearButton?.addEventListener('click', () => {
    selectedFiles = [];
    syncInput();
    validate?.(input);
    render();
  });

  return {
    reset() {
      selectedFiles = [];
      existingImages = [];
      syncInput();
      render();
    },
    setExisting(images = []) {
      existingImages = images.filter((image) => image?.image_url);
      render();
    },
  };
};
