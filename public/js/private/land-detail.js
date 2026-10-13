const normalizeText = (text) =>
  (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const addDaysToDateString = (dateStr, days) => {
  if (!dateStr || Number.isNaN(days)) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const formatReadableDate = (dateStr) => {
  if (!dateStr) return '--';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const setModalVisibility = (modal, isOpen, trigger) => {
  modal.classList.toggle('hidden', !isOpen);
  modal.classList.toggle('flex', isOpen);
  document.body.classList.toggle('overflow-hidden', isOpen);

  if (isOpen) {
    modal.querySelectorAll('[data-combobox-filter]').forEach((input) => {
      input.value = '';
      const targetId = input.dataset.comboboxFilter;
      const select = document.getElementById(targetId);
      const emptyMsg = modal.querySelector(
        `[data-combobox-empty="${targetId}"]`,
      );
      if (select) {
        Array.from(select.options).forEach((opt) => {
          opt.hidden = false;
        });
      }
      if (emptyMsg) {
        emptyMsg.classList.add('hidden');
      }
    });

    modal.querySelector('input, select, textarea, button')?.focus();
  } else {
    trigger?.focus();
  }
};

const configureModal = (modal, triggers) => {
  let lastTrigger = null;
  const close = () => {
    if (!modal.classList.contains('hidden')) {
      setModalVisibility(modal, false, lastTrigger);
    }
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      lastTrigger = trigger;
      setModalVisibility(modal, true, trigger);
    });
  });
  modal
    .querySelectorAll('[data-land-modal-close]')
    .forEach((button) => button.addEventListener('click', close));
  return close;
};

const filterSelectOptions = (select, query, emptyMsg) => {
  let visibleCount = 0;

  Array.from(select.options).forEach((opt, idx) => {
    if (idx === 0) {
      opt.hidden = false;
      return;
    }
    const matches = normalizeText(opt.textContent).includes(query);
    opt.hidden = !matches;
    if (matches) visibleCount += 1;
  });

  if (emptyMsg) {
    emptyMsg.classList.toggle('hidden', visibleCount > 0 || query === '');
  }

  if (select.selectedIndex > 0 && select.options[select.selectedIndex].hidden) {
    select.selectedIndex = 0;
  }
};

const setupComboboxFilters = () => {
  document
    .querySelectorAll('[data-combobox-filter]:not([data-crop-search-input])')
    .forEach((input) => {
      const targetSelectId = input.dataset.comboboxFilter;
      const select = document.getElementById(targetSelectId);
      const emptyMsg = document.querySelector(
        `[data-combobox-empty="${targetSelectId}"]`,
      );
      if (!select) return;

      input.addEventListener('input', () => {
        const query = normalizeText(input.value.trim());
        filterSelectOptions(select, query, emptyMsg);
      });
    });
};

const buildCropSuggestionItem = (crop, onSelect) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className =
    'w-full text-left p-2.5 hover:bg-muted/80 rounded-xl flex items-center justify-between transition-colors';

  const infoDiv = document.createElement('div');
  const nameP = document.createElement('p');
  nameP.className = 'text-xs font-bold text-foreground';
  nameP.textContent = crop.name;
  const sciP = document.createElement('p');
  sciP.className = 'text-[11px] italic text-muted-foreground';
  sciP.textContent = crop.scientific;
  infoDiv.appendChild(nameP);
  infoDiv.appendChild(sciP);

  const metaDiv = document.createElement('div');
  metaDiv.className = 'flex items-center gap-1.5 text-[10px]';
  const catBadge = document.createElement('span');
  catBadge.className =
    'rounded bg-muted px-2 py-0.5 font-semibold text-muted-foreground';
  catBadge.textContent = crop.category;
  const daysBadge = document.createElement('span');
  daysBadge.className = 'font-bold text-primary';
  daysBadge.textContent = `~${crop.harvestDays}d`;
  metaDiv.appendChild(catBadge);
  metaDiv.appendChild(daysBadge);

  button.appendChild(infoDiv);
  button.appendChild(metaDiv);
  button.addEventListener('click', () => onSelect(crop));
  return button;
};

const extractCropsFromSelect = (select) => {
  if (!select) return [];
  return Array.from(select.options)
    .filter((opt) => opt.value && opt.value !== 'custom')
    .map((opt) => ({
      id: opt.value,
      name: opt.dataset.name || opt.textContent.split('·')[0].trim(),
      scientific: opt.dataset.scientific || '',
      category: opt.dataset.category || 'General',
      harvestDays: Number(opt.dataset.harvestDays) || 120,
    }));
};

const syncDates = (plantingInput, harvestInput, cycleDays, caller) => {
  if (caller === 'planting' && plantingInput.value) {
    harvestInput.value = addDaysToDateString(plantingInput.value, cycleDays);
  } else if (caller === 'harvest' && harvestInput.value) {
    plantingInput.value = addDaysToDateString(harvestInput.value, -cycleDays);
  } else if (plantingInput.value && !harvestInput.value) {
    harvestInput.value = addDaysToDateString(plantingInput.value, cycleDays);
  }
};

const updateSummaryLabels = (displays, harvestDate, cycleDays, cropName) => {
  if (displays.days) displays.days.textContent = String(cycleDays);
  if (displays.harvest)
    displays.harvest.textContent = formatReadableDate(harvestDate);
  if (displays.name) displays.name.textContent = cropName;
};

const setupCategoryFilters = (modal, onSelectCrop) => {
  const categoryBtns = modal.querySelectorAll('[data-category-filter]');
  const cropCards = modal.querySelectorAll('[data-crop-card-item]');

  categoryBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const selectedCategory = btn.dataset.categoryFilter;
      categoryBtns.forEach((b) => {
        b.classList.remove('bg-primary', 'text-white');
        b.classList.add('bg-muted', 'text-muted-foreground');
      });
      btn.classList.add('bg-primary', 'text-white');
      btn.classList.remove('bg-muted', 'text-muted-foreground');

      cropCards.forEach((card) => {
        const matches =
          selectedCategory === 'all' ||
          card.dataset.category === selectedCategory;
        card.classList.toggle('hidden', !matches);
      });
    });
  });

  cropCards.forEach((card) => {
    card.addEventListener('click', () => {
      onSelectCrop({
        id: card.dataset.id,
        name: card.dataset.name,
        scientific: card.dataset.scientific,
        category: card.dataset.category,
        harvestDays: Number(card.dataset.harvestDays) || 120,
      });
    });
  });
};

const setupCycleModalUX = () => {
  const modal = document.querySelector('[data-land-modal="cycle"]');
  if (!modal) return;

  const select = document.getElementById('cycle-crop');
  const searchInput = modal.querySelector('[data-crop-search-input]');
  const suggestionsPanel = modal.querySelector('[data-crop-suggestions-panel]');
  const suggestionsList = modal.querySelector('[data-crop-suggestions-list]');
  const customPrompt = modal.querySelector('[data-crop-custom-prompt]');
  const customNamePreview = modal.querySelector(
    '[data-crop-custom-name-preview]',
  );
  const customCropBtn = modal.querySelector('[data-crop-custom-btn]');
  const showAllBtn = modal.querySelector('[data-crop-show-all-btn]');
  const catalogToggle = modal.querySelector('[data-crop-catalog-toggle]');
  const catalogPanel = modal.querySelector('[data-crop-catalog-panel]');
  const selectedCard = modal.querySelector('[data-crop-selected-card]');
  const selectedName = modal.querySelector('[data-crop-selected-name]');
  const selectedMeta = modal.querySelector('[data-crop-selected-meta]');
  const clearBtn = modal.querySelector('[data-crop-clear-btn]');
  const searchWrapper = modal.querySelector('[data-crop-search-wrapper]');
  const customNameInput = document.getElementById('cycle-custom-crop-name');
  const customDaysInput = document.getElementById('cycle-custom-harvest-days');
  const plantingInput = document.getElementById('cycle-date');
  const harvestInput = document.getElementById('cycle-harvest-date');

  const displays = {
    days: modal.querySelector('[data-crop-cycle-days]'),
    harvest: modal.querySelector('[data-harvest-date-display]'),
    name: modal.querySelector('[data-crop-cycle-name]'),
  };

  const crops = extractCropsFromSelect(select);
  let activeCrop = null;

  const getCycleDays = () => Number(activeCrop?.harvestDays) || 120;

  const recalculateDates = (caller = 'planting') => {
    const days = getCycleDays();
    syncDates(plantingInput, harvestInput, days, caller);
    const cropName = activeCrop?.name || 'Cultivo seleccionado';
    updateSummaryLabels(displays, harvestInput.value, days, cropName);
  };

  const applyCropSelection = (crop) => {
    activeCrop = crop;
    select.value = crop.id;
    if (customNameInput) customNameInput.value = '';
    selectedName.textContent = crop.name;
    selectedMeta.textContent = `${crop.scientific || ''} · ${crop.category || ''} · ~${crop.harvestDays} días`;
    selectedCard.classList.remove('hidden');
    searchWrapper.classList.add('hidden');
    suggestionsPanel.classList.add('hidden');
    catalogPanel.classList.add('hidden');
    recalculateDates('planting');
  };

  const applyCustomCrop = (customName) => {
    const name = customName.trim();
    if (!name) return;
    activeCrop = { name, isCustom: true, harvestDays: 120 };
    select.value = 'custom';
    if (customNameInput) customNameInput.value = name;
    if (customDaysInput) customDaysInput.value = '120';
    selectedName.textContent = `${name} (Personalizado)`;
    selectedMeta.textContent =
      'Cultivo no catalogado · Ciclo agronómico estándar: ~120 días';
    selectedCard.classList.remove('hidden');
    searchWrapper.classList.add('hidden');
    suggestionsPanel.classList.add('hidden');
    catalogPanel.classList.add('hidden');
    recalculateDates('planting');
  };

  const resetSelection = () => {
    activeCrop = null;
    select.value = '';
    if (customNameInput) customNameInput.value = '';
    selectedCard.classList.add('hidden');
    searchWrapper.classList.remove('hidden');
    searchInput.value = '';
    recalculateDates('planting');
    searchInput.focus();
  };

  clearBtn?.addEventListener('click', resetSelection);

  searchInput?.addEventListener('input', () => {
    const query = normalizeText(searchInput.value.trim());
    suggestionsList.innerHTML = '';

    if (!query) {
      suggestionsPanel.classList.add('hidden');
      return;
    }

    const matches = crops.filter(
      (c) =>
        normalizeText(c.name).includes(query) ||
        normalizeText(c.scientific).includes(query),
    );

    if (matches.length > 0) {
      matches
        .slice(0, 8)
        .forEach((c) =>
          suggestionsList.appendChild(
            buildCropSuggestionItem(c, applyCropSelection),
          ),
        );
      customPrompt.classList.add('hidden');
    } else {
      customNamePreview.textContent = searchInput.value.trim();
      customPrompt.classList.remove('hidden');
    }

    suggestionsPanel.classList.remove('hidden');
  });

  customCropBtn?.addEventListener('click', () => {
    applyCustomCrop(searchInput.value);
  });

  showAllBtn?.addEventListener('click', () => {
    suggestionsPanel.classList.add('hidden');
    catalogPanel.classList.remove('hidden');
  });

  catalogToggle?.addEventListener('click', () => {
    catalogPanel.classList.toggle('hidden');
  });

  plantingInput?.addEventListener('input', () => recalculateDates('planting'));
  harvestInput?.addEventListener('input', () => recalculateDates('harvest'));

  setupCategoryFilters(modal, applyCropSelection);
  recalculateDates('planting');
};

document.addEventListener('DOMContentLoaded', () => {
  const closers = [];
  const editModal = document.getElementById('modal-edit-land');
  const editTrigger = document.getElementById('btn-open-edit-land');

  if (editModal && editTrigger) {
    editModal
      .querySelectorAll(
        '#btn-close-edit-land, #btn-cancel-edit-land, #modal-edit-land-backdrop',
      )
      .forEach((button) => button.setAttribute('data-land-modal-close', ''));
    closers.push(configureModal(editModal, [editTrigger]));
  }

  document.querySelectorAll('[data-land-modal]').forEach((modal) => {
    const name = modal.dataset.landModal;
    const triggers = [
      ...document.querySelectorAll(`[data-land-modal-open="${name}"]`),
    ];
    closers.push(configureModal(modal, triggers));
  });

  setupComboboxFilters();
  setupCycleModalUX();

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closers.forEach((close) => close());
  });
});
