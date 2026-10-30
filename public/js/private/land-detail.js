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
    .querySelectorAll(
      '[data-combobox-filter]:not([data-crop-search-input]):not([data-plague-search-input]):not([data-product-search-input])',
    )
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

/* ══════════════════════════════════════════════════════════════════════════
   1. MÓDULO: CICLOS DE CULTIVO & CÁLCULO DE FECHA DE COSECHA
   ══════════════════════════════════════════════════════════════════════════ */
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

const setupCropCategoryFilters = (modal, onSelectCrop) => {
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
    let days = getCycleDays();
    if (caller === 'harvest' && harvestInput.value && plantingInput.value) {
      const [y1, m1, d1] = plantingInput.value.split('-').map(Number);
      const [y2, m2, d2] = harvestInput.value.split('-').map(Number);
      const diff = Math.round(
        (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000,
      );
      if (diff > 0) {
        days = diff;
        if (customDaysInput) customDaysInput.value = String(diff);
      }
    } else {
      syncDates(plantingInput, harvestInput, days, caller);
    }
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

  setupCropCategoryFilters(modal, applyCropSelection);
  recalculateDates('planting');
};

/* ══════════════════════════════════════════════════════════════════════════
   2. MÓDULO: PLAGAS / HALLAZGOS FITOSANITARIOS
   ══════════════════════════════════════════════════════════════════════════ */
const buildPlagueSuggestionItem = (plague, onSelect) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className =
    'w-full text-left p-2.5 hover:bg-muted/80 rounded-xl flex items-center justify-between transition-colors';

  const infoDiv = document.createElement('div');
  const nameP = document.createElement('p');
  nameP.className = 'text-xs font-bold text-foreground';
  nameP.textContent = plague.name;
  const sciP = document.createElement('p');
  sciP.className = 'text-[11px] italic text-muted-foreground';
  sciP.textContent = plague.scientific;
  infoDiv.appendChild(nameP);
  infoDiv.appendChild(sciP);

  if (plague.category) {
    const metaDiv = document.createElement('div');
    const catBadge = document.createElement('span');
    catBadge.className =
      'rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground';
    catBadge.textContent = plague.category;
    metaDiv.appendChild(catBadge);
    button.appendChild(metaDiv);
  }

  button.appendChild(infoDiv);
  button.addEventListener('click', () => onSelect(plague));
  return button;
};

const extractPlaguesFromSelect = (select) => {
  if (!select) return [];
  return Array.from(select.options)
    .filter((opt) => opt.value && opt.value !== 'custom')
    .map((opt) => ({
      id: opt.value,
      name: opt.dataset.name || opt.textContent.split('·')[0].trim(),
      scientific: opt.dataset.scientific || '',
      category: opt.dataset.category || '',
    }));
};

const setupPlagueCategoryFilters = (modal, onSelectPlague) => {
  const categoryBtns = modal.querySelectorAll('[data-plague-category-filter]');
  const plagueCards = modal.querySelectorAll('[data-plague-card-item]');

  categoryBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const selectedCategory = btn.dataset.plagueCategoryFilter;
      categoryBtns.forEach((b) => {
        b.classList.remove('bg-primary', 'text-white');
        b.classList.add('bg-muted', 'text-muted-foreground');
      });
      btn.classList.add('bg-primary', 'text-white');
      btn.classList.remove('bg-muted', 'text-muted-foreground');

      plagueCards.forEach((card) => {
        const matches =
          selectedCategory === 'all' ||
          card.dataset.category === selectedCategory;
        card.classList.toggle('hidden', !matches);
      });
    });
  });

  plagueCards.forEach((card) => {
    card.addEventListener('click', () => {
      onSelectPlague({
        id: card.dataset.id,
        name: card.dataset.name,
        scientific: card.dataset.scientific,
        category: card.dataset.category,
      });
    });
  });
};

const setupHealthModalUX = () => {
  const modal = document.querySelector('[data-land-modal="health"]');
  if (!modal) return;

  const select = document.getElementById('health-plague');
  const searchInput = modal.querySelector('[data-plague-search-input]');
  const suggestionsPanel = modal.querySelector(
    '[data-plague-suggestions-panel]',
  );
  const suggestionsList = modal.querySelector('[data-plague-suggestions-list]');
  const customPrompt = modal.querySelector('[data-plague-custom-prompt]');
  const customNamePreview = modal.querySelector(
    '[data-plague-custom-name-preview]',
  );
  const customPlagueBtn = modal.querySelector('[data-plague-custom-btn]');
  const showAllBtn = modal.querySelector('[data-plague-show-all-btn]');
  const catalogToggle = modal.querySelector('[data-plague-catalog-toggle]');
  const catalogPanel = modal.querySelector('[data-plague-catalog-panel]');
  const selectedCard = modal.querySelector('[data-plague-selected-card]');
  const selectedName = modal.querySelector('[data-plague-selected-name]');
  const selectedMeta = modal.querySelector('[data-plague-selected-meta]');
  const clearBtn = modal.querySelector('[data-plague-clear-btn]');
  const searchWrapper = modal.querySelector('[data-plague-search-wrapper]');
  const customNameInput = document.getElementById('health-custom-plague-name');

  const plagues = extractPlaguesFromSelect(select);

  const applyPlagueSelection = (plague) => {
    select.value = plague.id;
    if (customNameInput) customNameInput.value = '';
    selectedName.textContent = plague.name;
    selectedMeta.textContent = `${plague.scientific || ''}${plague.category ? ` · ${plague.category}` : ''}`;
    selectedCard.classList.remove('hidden');
    searchWrapper.classList.add('hidden');
    suggestionsPanel.classList.add('hidden');
    catalogPanel.classList.add('hidden');
  };

  const applyCustomPlague = (customName) => {
    const name = customName.trim();
    if (!name) return;
    select.value = 'custom';
    if (customNameInput) customNameInput.value = name;
    selectedName.textContent = `${name} (Personalizada)`;
    selectedMeta.textContent = 'Plaga no catalogada / alerta local';
    selectedCard.classList.remove('hidden');
    searchWrapper.classList.add('hidden');
    suggestionsPanel.classList.add('hidden');
    catalogPanel.classList.add('hidden');
  };

  const resetSelection = () => {
    select.value = '';
    if (customNameInput) customNameInput.value = '';
    selectedCard.classList.add('hidden');
    searchWrapper.classList.remove('hidden');
    searchInput.value = '';
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

    const matches = plagues.filter(
      (p) =>
        normalizeText(p.name).includes(query) ||
        normalizeText(p.scientific).includes(query),
    );

    if (matches.length > 0) {
      matches
        .slice(0, 8)
        .forEach((p) =>
          suggestionsList.appendChild(
            buildPlagueSuggestionItem(p, applyPlagueSelection),
          ),
        );
      customPrompt.classList.add('hidden');
    } else {
      customNamePreview.textContent = searchInput.value.trim();
      customPrompt.classList.remove('hidden');
    }

    suggestionsPanel.classList.remove('hidden');
  });

  customPlagueBtn?.addEventListener('click', () => {
    applyCustomPlague(searchInput.value);
  });

  showAllBtn?.addEventListener('click', () => {
    suggestionsPanel.classList.add('hidden');
    catalogPanel.classList.remove('hidden');
  });

  catalogToggle?.addEventListener('click', () => {
    catalogPanel.classList.toggle('hidden');
  });

  setupPlagueCategoryFilters(modal, applyPlagueSelection);
};

/* ══════════════════════════════════════════════════════════════════════════
   3. MÓDULO: PRODUCTOS / AGROQUÍMICOS & RECOMENDACIÓN INTELIGENTE
   ══════════════════════════════════════════════════════════════════════════ */
const buildProductSuggestionItem = (prod, onSelect) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className =
    'w-full text-left p-2.5 hover:bg-muted/80 rounded-xl flex items-center justify-between transition-colors';

  const infoDiv = document.createElement('div');
  const nameP = document.createElement('p');
  nameP.className = 'text-xs font-bold text-foreground';
  nameP.textContent = prod.name;
  const ingP = document.createElement('p');
  ingP.className = 'text-[11px] text-muted-foreground';
  ingP.textContent = prod.activeIngredient
    ? `Ingrediente: ${prod.activeIngredient}`
    : 'Agroquímico validado';
  infoDiv.appendChild(nameP);
  infoDiv.appendChild(ingP);

  const metaDiv = document.createElement('div');
  metaDiv.className = 'flex flex-col items-end gap-1';
  if (prod.isTargetForDetectedPest) {
    const pestBadge = document.createElement('span');
    pestBadge.className =
      'rounded-full bg-emerald-500/10 text-emerald-700 px-2 py-0.5 text-[9px] font-bold border border-emerald-500/20';
    pestBadge.textContent = '⭐ Recomendado INIFAP';
    metaDiv.appendChild(pestBadge);
  }
  if (prod.presentation) {
    const presBadge = document.createElement('span');
    presBadge.className =
      'rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground';
    presBadge.textContent = prod.presentation;
    metaDiv.appendChild(presBadge);
  }

  button.appendChild(infoDiv);
  button.appendChild(metaDiv);
  button.addEventListener('click', () => onSelect(prod));
  return button;
};

const extractProductsFromSelect = (select) => {
  if (!select) return [];
  return Array.from(select.options)
    .filter((opt) => opt.value && opt.value !== 'custom')
    .map((opt) => ({
      id: opt.value,
      name: opt.dataset.name || opt.textContent.split('·')[0].trim(),
      activeIngredient: opt.dataset.activeIngredient || '',
      presentation: opt.dataset.presentation || '',
      targetPlagueIds: (opt.dataset.targetPlagueIds || '').split(','),
      targetPlagueNames: opt.dataset.targetPlagueNames || '',
    }));
};

const filterPlaguesForLot = (allPlagues, cropId) => {
  if (!cropId) return allPlagues;
  return allPlagues.filter((p) => String(p.farmCropId) === String(cropId));
};

const renderLotPlaguesBadges = (badgesContainer, uniquePlagues) => {
  if (!badgesContainer) return;
  badgesContainer.innerHTML = '';
  uniquePlagues.forEach((p) => {
    const span = document.createElement('span');
    span.className =
      'rounded-full bg-amber-200/80 px-2.5 py-0.5 text-xs font-bold text-amber-900 flex items-center gap-1';
    span.textContent = `🐛 ${p.name} (${p.severity})`;
    badgesContainer.appendChild(span);
  });
};

const updateProductRecommendationsForPlagues = (products, uniquePlagues) => {
  if (uniquePlagues.length === 0) {
    products.forEach((prod) => {
      prod.isTargetForDetectedPest = false;
    });
    return;
  }
  const plagueNames = uniquePlagues.map((p) => normalizeText(p.name));
  const plagueIds = uniquePlagues.map((p) => String(p.id)).filter(Boolean);
  products.forEach((prod) => {
    const matchesName = plagueNames.some((pName) =>
      normalizeText(prod.targetPlagueNames).includes(pName),
    );
    const matchesId = prod.targetPlagueIds.some((id) =>
      plagueIds.includes(String(id)),
    );
    prod.isTargetForDetectedPest = matchesName || matchesId;
  });
};

const filterAndRenderProductSuggestions = ({
  query,
  products,
  suggestionsList,
  suggestionsPanel,
  customPrompt,
  customNamePreview,
  searchInput,
  onSelect,
}) => {
  suggestionsList.innerHTML = '';
  if (!query) {
    suggestionsPanel.classList.add('hidden');
    return;
  }
  const matches = products.filter(
    (prod) =>
      normalizeText(prod.name).includes(query) ||
      normalizeText(prod.activeIngredient).includes(query) ||
      normalizeText(prod.targetPlagueNames).includes(query),
  );
  if (matches.length > 0) {
    matches.sort(
      (a, b) =>
        Number(b.isTargetForDetectedPest) - Number(a.isTargetForDetectedPest),
    );
    matches
      .slice(0, 8)
      .forEach((prod) =>
        suggestionsList.appendChild(buildProductSuggestionItem(prod, onSelect)),
      );
    customPrompt.classList.add('hidden');
  } else {
    customNamePreview.textContent = searchInput.value.trim();
    customPrompt.classList.remove('hidden');
  }
  suggestionsPanel.classList.remove('hidden');
};

const parsePlaguesJson = (raw) => {
  try {
    return JSON.parse(raw || '[]');
  } catch (_err) {
    return [];
  }
};

const setupLotRecommendationUX = ({
  cycleSelect,
  recommendationsBox,
  badgesContainer,
  allDetectedPlagues,
  products,
  modal,
  applyProductSelection,
}) => {
  const refresh = () => {
    if (!recommendationsBox) return;
    const selectedCropId = cycleSelect?.value || '';
    const lotPlagues = filterPlaguesForLot(allDetectedPlagues, selectedCropId);
    const uniquePlagues = [
      ...new Map(lotPlagues.map((p) => [p.name, p])).values(),
    ];

    if (uniquePlagues.length === 0) {
      recommendationsBox.classList.add('hidden');
      updateProductRecommendationsForPlagues(products, []);
    } else {
      recommendationsBox.classList.remove('hidden');
      renderLotPlaguesBadges(badgesContainer, uniquePlagues);
      updateProductRecommendationsForPlagues(products, uniquePlagues);
    }
    setupQuickRecommendedProducts(modal, products, applyProductSelection);
  };

  cycleSelect?.addEventListener('change', refresh);
  refresh();
};

const setupQuickRecommendedProducts = (modal, products, onSelect) => {
  const listContainer = modal.querySelector(
    '[data-smart-recommended-products-list]',
  );
  if (!listContainer) return;

  const recommendedProducts = products.filter((p) => p.isTargetForDetectedPest);
  if (recommendedProducts.length === 0) {
    const parentBox = modal.querySelector(
      '[data-detected-plagues-recommendations]',
    );
    if (parentBox) parentBox.classList.add('hidden');
    return;
  }

  listContainer.innerHTML = '';
  recommendedProducts.slice(0, 4).forEach((prod) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'rounded-lg border border-amber-600/40 bg-card px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 hover:border-amber-600 transition-all flex items-center gap-1.5 shadow-sm';
    btn.textContent = `⭐ ${prod.name}`;
    btn.title = `Autorizado para control de plaga detectada`;
    btn.addEventListener('click', () => onSelect(prod));
    listContainer.appendChild(btn);
  });
};

const setupApplicationModalUX = () => {
  const modal = document.querySelector('[data-land-modal="application"]');
  if (!modal) return;

  const select = document.getElementById('application-product');
  const searchInput = modal.querySelector('[data-product-search-input]');
  const suggestionsPanel = modal.querySelector(
    '[data-product-suggestions-panel]',
  );
  const suggestionsList = modal.querySelector(
    '[data-product-suggestions-list]',
  );
  const customPrompt = modal.querySelector('[data-product-custom-prompt]');
  const customNamePreview = modal.querySelector(
    '[data-product-custom-name-preview]',
  );
  const customProductBtn = modal.querySelector('[data-product-custom-btn]');
  const showAllBtn = modal.querySelector('[data-product-show-all-btn]');
  const catalogToggle = modal.querySelector('[data-product-catalog-toggle]');
  const catalogPanel = modal.querySelector('[data-product-catalog-panel]');
  const selectedCard = modal.querySelector('[data-product-selected-card]');
  const selectedName = modal.querySelector('[data-product-selected-name]');
  const selectedMeta = modal.querySelector('[data-product-selected-meta]');
  const clearBtn = modal.querySelector('[data-product-clear-btn]');
  const searchWrapper = modal.querySelector('[data-product-search-wrapper]');
  const customNameInput = document.getElementById(
    'application-custom-product-name',
  );
  const productCards = modal.querySelectorAll('[data-product-card-item]');

  const cycleSelect = document.getElementById('application-cycle');
  const recommendationsBox = modal.querySelector(
    '[data-detected-plagues-recommendations]',
  );
  const badgesContainer = modal.querySelector('[data-lot-plagues-badges]');
  const allDetectedPlagues = parsePlaguesJson(
    recommendationsBox?.dataset.plaguesJson,
  );

  const products = extractProductsFromSelect(select);

  const applyProductSelection = (prod) => {
    select.value = prod.id;
    if (customNameInput) customNameInput.value = '';
    selectedName.textContent = prod.name;
    selectedMeta.textContent = `${prod.activeIngredient ? `Ingrediente: ${prod.activeIngredient}` : 'Producto oficial'}${prod.presentation ? ` · ${prod.presentation}` : ''}`;
    selectedCard.classList.remove('hidden');
    searchWrapper.classList.add('hidden');
    suggestionsPanel.classList.add('hidden');
    catalogPanel.classList.add('hidden');
  };

  const applyCustomProduct = (customName) => {
    const name = customName.trim();
    if (!name) return;
    select.value = 'custom';
    if (customNameInput) customNameInput.value = name;
    selectedName.textContent = `${name} (Personalizado)`;
    selectedMeta.textContent = 'Agroquímico no catalogado / formulación local';
    selectedCard.classList.remove('hidden');
    searchWrapper.classList.add('hidden');
    suggestionsPanel.classList.add('hidden');
    catalogPanel.classList.add('hidden');
  };

  const resetSelection = () => {
    select.value = '';
    if (customNameInput) customNameInput.value = '';
    selectedCard.classList.add('hidden');
    searchWrapper.classList.remove('hidden');
    searchInput.value = '';
    searchInput.focus();
  };

  clearBtn?.addEventListener('click', resetSelection);

  searchInput?.addEventListener('input', () => {
    const query = normalizeText(searchInput.value.trim());
    filterAndRenderProductSuggestions({
      query,
      products,
      suggestionsList,
      suggestionsPanel,
      customPrompt,
      customNamePreview,
      searchInput,
      onSelect: applyProductSelection,
    });
  });

  customProductBtn?.addEventListener('click', () => {
    applyCustomProduct(searchInput.value);
  });

  showAllBtn?.addEventListener('click', () => {
    suggestionsPanel.classList.add('hidden');
    catalogPanel.classList.remove('hidden');
  });

  catalogToggle?.addEventListener('click', () => {
    catalogPanel.classList.toggle('hidden');
  });

  productCards.forEach((card) => {
    card.addEventListener('click', () => {
      applyProductSelection({
        id: card.dataset.id,
        name: card.dataset.name,
        activeIngredient: card.dataset.activeIngredient,
        presentation: card.dataset.presentation,
      });
    });
  });

  setupLotRecommendationUX({
    cycleSelect,
    recommendationsBox,
    badgesContainer,
    allDetectedPlagues,
    products,
    modal,
    applyProductSelection,
  });
};

const setupCycleLotSelect = () => {
  const lotSelect = document.getElementById('cycle-lot-select');
  const areaInput = document.getElementById('cycle-area');
  if (!lotSelect || !areaInput) return;

  lotSelect.addEventListener('change', () => {
    if (lotSelect.value === '__custom__') {
      areaInput.value = '';
      areaInput.focus();
    } else if (lotSelect.value) {
      areaInput.value = lotSelect.value;
    }
  });
};

const setupLotTabsFilter = () => {
  const filterBtns = document.querySelectorAll('[data-lot-filter]');
  const activeIndicator = document.querySelector('[data-active-lot-indicator]');
  if (filterBtns.length === 0) return;

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const selectedLot = btn.dataset.lotFilter;

      filterBtns.forEach((b) => {
        b.classList.remove('bg-primary', 'text-white', 'shadow-sm');
        b.classList.add('bg-card', 'text-muted-foreground');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('bg-primary', 'text-white', 'shadow-sm');
      btn.classList.remove('bg-card', 'text-muted-foreground');
      btn.setAttribute('aria-selected', 'true');

      if (activeIndicator) {
        activeIndicator.textContent =
          selectedLot === 'all'
            ? 'Viendo: Todos los lotes'
            : `Viendo: Lote ${selectedLot}`;
      }

      document.querySelectorAll('[data-cycle-lot]').forEach((card) => {
        const matches =
          selectedLot === 'all' || card.dataset.cycleLot === selectedLot;
        card.classList.toggle('hidden', !matches);
      });

      document.querySelectorAll('[data-health-lot]').forEach((row) => {
        const matches =
          selectedLot === 'all' || row.dataset.healthLot === selectedLot;
        row.classList.toggle('hidden', !matches);
      });

      document.querySelectorAll('[data-application-lot]').forEach((row) => {
        const matches =
          selectedLot === 'all' || row.dataset.applicationLot === selectedLot;
        row.classList.toggle('hidden', !matches);
      });
    });
  });
};

const setupLotEditUX = () => {
  const editModal = document.querySelector('[data-land-modal="edit-lot"]');
  const editButtons = document.querySelectorAll('[data-edit-lot-btn]');
  if (!editModal || editButtons.length === 0) return;

  const form = editModal.querySelector('#form-edit-lot');
  const nameInput = editModal.querySelector('#edit-lot-name');
  const sizeInput = editModal.querySelector('#edit-lot-size');
  const descInput = editModal.querySelector('#edit-lot-desc');

  editButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const lotId = btn.dataset.lotId;
      if (nameInput) nameInput.value = btn.dataset.lotName || '';
      if (sizeInput) sizeInput.value = btn.dataset.lotSize || '';
      if (descInput) descInput.value = btn.dataset.lotDesc || '';

      if (form) {
        const baseAction = form.getAttribute('action') || '';
        form.action = baseAction.replace(
          /\/lots\/[^/]+\/update/,
          `/lots/${lotId}/update`,
        );
      }

      setModalVisibility(editModal, true, btn);
    });
  });
};

/* ══════════════════════════════════════════════════════════════════════════
   INICIALIZACIÓN PRINCIPAL
   ══════════════════════════════════════════════════════════════════════════ */
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
  setupCycleLotSelect();
  setupLotTabsFilter();
  setupLotEditUX();
  setupHealthModalUX();
  setupApplicationModalUX();

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closers.forEach((close) => close());
  });
});
