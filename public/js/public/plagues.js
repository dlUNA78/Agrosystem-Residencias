/**
 * plagues.js — Comportamiento interactivo del Catálogo de Plagas (/plagues)
 * Gestiona:
 *   - Búsqueda en tiempo real con debounce y AbortController
 *   - Chips táctiles de categoría y riesgo sincronizados con selectores
 *   - Botón de limpieza rápida del campo de búsqueda
 *   - Skeleton loading mientras se obtienen resultados
 *   - Estado vacío (empty state) institucional con botón de restauración
 *   - Paginación interactiva
 * Cumple con RULES.MD (JS en public/js/public/).
 */

const escapeHTML = (str) => {
  if (!str) return '';
  const p = document.createElement('p');
  p.appendChild(document.createTextNode(str));
  return p.innerHTML;
};

const getRiskStyles = (riskLabel) => {
  const isCritical = riskLabel === 'Crítico' || riskLabel === 'Alto';
  const isModerate = riskLabel === 'Moderado' || riskLabel === 'Medio';
  return {
    bar: isCritical
      ? 'bg-rose-600'
      : isModerate
        ? 'bg-amber-500'
        : 'bg-emerald-600',
    dot: isCritical
      ? 'bg-rose-600 animate-pulse'
      : isModerate
        ? 'bg-amber-500'
        : 'bg-emerald-600',
  };
};

const getRiskChipClass = (chipRisk, isSelected) => {
  const base =
    'risk-chip px-2.5 py-1 rounded-md text-xs font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer active:scale-95 flex items-center gap-1.5';
  if (!isSelected) {
    return `${base} bg-secondary text-foreground hover:bg-border`;
  }
  const riskClassMap = {
    Crítico:
      'bg-rose-100 text-rose-900 border border-rose-300 font-bold shadow-2xs',
    Moderado:
      'bg-amber-100 text-amber-900 border border-amber-300 font-bold shadow-2xs',
    Bajo: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold shadow-2xs',
  };
  return `${base} ${riskClassMap[chipRisk] || 'bg-[#1b4332] text-white shadow-2xs'}`;
};

const buildHostCropsBadgesHtml = (plague) => {
  const hostCrops = Array.isArray(plague.hostCrops) ? plague.hostCrops : [];
  if (hostCrops.length === 0) return '';

  const chips = hostCrops
    .map(
      (cropName) =>
        `<span class="inline-flex items-center gap-1 rounded-md border border-emerald-200/80 bg-emerald-50/70 px-2 py-0.5 text-[10px] font-semibold text-[#1b4332]">${escapeHTML(cropName)}</span>`,
    )
    .join('');

  const extra = Number(plague.extraHostCropsCount) || 0;
  const extraChip =
    extra > 0
      ? `<span class="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">+${extra}</span>`
      : '';

  return `<div class="flex flex-wrap items-center gap-1 pt-0.5">${chips}${extraChip}</div>`;
};

const buildPlagueCardHtml = (plague) => {
  const safeImageUrl = encodeURI(
    plague.imageUrl || plague.image_url || '/images/test/default.png',
  );
  const safeName = escapeHTML(plague.name);
  const safeCategory = escapeHTML(plague.category);
  const safeScientificName = escapeHTML(plague.scientificName);
  const safeDescription = escapeHTML(plague.description);
  const safeRiskLabel = escapeHTML(plague.riskLabel || 'Bajo');
  const safeId = escapeHTML(plague.id.toString());
  const credit = escapeHTML(plague.imageCredit || 'ACERVO FOTO · INIFAP');
  const hostCropsHtml = buildHostCropsBadgesHtml(plague);

  const { bar, dot } = getRiskStyles(safeRiskLabel);

  return `
    <article class="group flex flex-col border border-border bg-card transition-all duration-200 hover:border-[#1b4332]/40 rounded-xl overflow-hidden shadow-2xs hover:shadow-md hover:-translate-y-0.5">
      <div class="h-1.5 w-full ${bar}"></div>

      <div class="relative aspect-4/3 overflow-hidden bg-muted">
        <img class="size-full object-cover transition-transform duration-500 group-hover:scale-105" src="${safeImageUrl}" alt="${safeName}" onerror="this.onerror=null; this.src='/images/test/default.png';" loading="lazy" decoding="async" />
        <div aria-hidden="true" class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-black/20 pointer-events-none"></div>
      
        <div class="absolute left-3 top-3 flex items-center gap-1.5 bg-card/90 px-2.5 py-1 backdrop-blur rounded-md border border-border shadow-2xs">
          <span aria-hidden="true" class="inline-block size-1.5 rounded-full ${dot}"></span>
          <span class="text-mono-label text-foreground capitalize font-bold text-[10px]">${safeRiskLabel}</span>
        </div>

        <span class="absolute left-3 bottom-3 text-mono-label text-[10px] text-white/90 font-mono tracking-wider drop-shadow-xs select-none">${credit}</span>
      </div>

      <div class="flex flex-1 flex-col gap-3 p-5">
        <p class="text-mono-label text-muted-foreground font-semibold text-[10px]">
          ${safeCategory} — VIGILANCIA SANITARIA
        </p>

        <div class="flex flex-col gap-1">
          <h3 class="text-base sm:text-lg font-headline font-bold leading-tight tracking-tight text-foreground group-hover:text-[#1b4332] transition-colors">
            ${safeName}
          </h3>
          <p class="font-mono text-xs italic text-muted-foreground">${safeScientificName}</p>
        </div>

        <p class="line-clamp-3 text-xs sm:text-sm leading-relaxed text-muted-foreground">
          ${safeDescription}
        </p>

        ${hostCropsHtml}

        <div class="mt-auto flex items-center justify-between gap-4 border-t border-border pt-4">
          <div class="flex flex-col gap-0.5">
            <span class="text-mono-label text-muted-foreground text-[9px]">Estatus fitosanitario</span>
            <span class="text-xs font-semibold text-emerald-800">Verificado INIFAP</span>
          </div>
          <a href="/plagues/${safeId}" class="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#1b4332] hover:underline active:scale-95 transition-transform">
            <span>Ficha técnica</span>
            <span class="material-symbols-outlined text-sm">arrow_forward</span>
          </a>
        </div>
      </div>
    </article>
  `;
};

const getEmptyStateHtml = () => `
  <div id="plagues-empty-state" class="col-span-full py-16 px-4 text-center bg-card border border-border rounded-xl shadow-xs space-y-4">
    <div class="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto text-muted-foreground border border-border">
      <span class="material-symbols-outlined text-3xl">pest_control</span>
    </div>
    <div class="space-y-1">
      <h3 class="text-lg font-headline font-bold text-foreground">No se encontraron plagas</h3>
      <p class="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
        No hay registros que coincidan con los criterios seleccionados. Intenta modificar el término de búsqueda o restablecer los filtros aplicados.
      </p>
    </div>
    <button type="button" id="reset-filters-btn" class="px-4 py-2 bg-[#1b4332] text-white text-xs font-semibold rounded-md hover:bg-[#133426] transition-all cursor-pointer shadow-2xs active:scale-95">
      Restablecer todos los filtros
    </button>
  </div>
`;

const getCtaCardHtml = () => `
  <article id="cta-new-species" class="group flex flex-col items-center justify-center p-8 border-2 border-dashed border-border hover:border-[#1b4332]/40 rounded-xl bg-card/60 hover:bg-card transition-all text-center">
    <span class="material-symbols-outlined text-4xl text-[#1b4332]/60 mb-3">add_circle</span>
    <h3 class="text-base font-headline font-bold text-foreground mb-1">¿Nueva especie?</h3>
    <p class="text-xs text-muted-foreground leading-relaxed max-w-50">
      Colabora con nuestra red científica reportando nuevas plagas a nuestro personal técnico.
    </p>
  </article>
`;

const renderSkeletons = (container) => {
  if (!container) return;
  container.innerHTML = Array(4)
    .fill(0)
    .map(
      () => `
    <div class="flex flex-col border border-border bg-card rounded-xl overflow-hidden shadow-2xs animate-pulse">
      <div class="h-1.5 w-full bg-muted"></div>
      <div class="aspect-4/3 bg-muted"></div>
      <div class="p-5 space-y-3">
        <div class="h-3 w-1/3 bg-muted rounded"></div>
        <div class="space-y-1.5">
          <div class="h-5 w-3/4 bg-muted rounded"></div>
          <div class="h-3 w-1/2 bg-muted rounded"></div>
        </div>
        <div class="h-10 w-full bg-muted rounded"></div>
        <div class="pt-4 border-t border-border flex justify-between items-center">
          <div class="h-3 w-20 bg-muted rounded"></div>
          <div class="h-3 w-16 bg-muted rounded"></div>
        </div>
      </div>
    </div>
  `,
    )
    .join('');
};

const getFilterValues = (els) => ({
  search: els.searchInput ? els.searchInput.value.trim() : '',
  category: els.categoryFilter ? els.categoryFilter.value : '',
  crop: els.cropFilter ? els.cropFilter.value : '',
  region: els.regionFilter ? els.regionFilter.value : '',
  risk: els.riskFilter ? els.riskFilter.value : '',
});

const buildQueryParams = (page, filters) => {
  const query = new URLSearchParams({ page });
  const map = {
    search: filters.search,
    category: filters.category !== 'Categoría' ? filters.category : '',
    crop: filters.crop && filters.crop !== 'Cultivo' ? filters.crop : '',
    region: filters.region !== 'Región' ? filters.region : '',
    risk: filters.risk !== 'Riesgo' ? filters.risk : '',
  };
  Object.keys(map).forEach((key) => {
    if (map[key]) query.append(key, map[key]);
  });
  return query.toString();
};

const getDOMElements = () => ({
  searchInput: document.getElementById('search-input'),
  searchClearBtn: document.getElementById('search-clear-btn'),
  categoryFilter: document.getElementById('category-filter'),
  cropFilter: document.getElementById('crop-filter'),
  regionFilter: document.getElementById('region-filter'),
  riskFilter: document.getElementById('risk-filter'),
  filterBtn: document.getElementById('filter-btn'),
  categoryChips: document.querySelectorAll('.category-chip'),
  riskChips: document.querySelectorAll('.risk-chip'),
  resetFiltersLink: document.getElementById('reset-all-filters-link'),
  plaguesGrid: document.getElementById('plagues-grid'),
  totalCountNumber: document.getElementById('total-count-number'),
  totalCountHeader: document.getElementById('total-count-number-header'),
  filterForm: document.getElementById('form-filtros'),
  paginationContainer: document.getElementById('pagination-container'),
  prevPageBtn: document.getElementById('prev-page-btn'),
  nextPageBtn: document.getElementById('next-page-btn'),
  currentPageDisplay: document.getElementById('current-page-display'),
});

function initPlaguesCatalog() {
  const els = getDOMElements();

  let currentPage =
    Number(new URLSearchParams(window.location.search).get('page')) || 1;
  let debounceTimeout;
  let activeAbortController = null;

  const updatePaginationUI = (totalPages) => {
    if (!els.paginationContainer) return;
    if (totalPages <= 1) {
      els.paginationContainer.style.display = 'none';
      return;
    }
    els.paginationContainer.style.display = 'flex';
    if (els.currentPageDisplay) {
      els.currentPageDisplay.textContent = `Página ${currentPage} de ${totalPages}`;
    }
    if (els.prevPageBtn) els.prevPageBtn.disabled = currentPage === 1;
    if (els.nextPageBtn) els.nextPageBtn.disabled = currentPage === totalPages;
  };

  const renderPlagues = (data) => {
    const { plagues, totalCount, totalPages, currentPage: newPage } = data;
    currentPage = newPage;

    if (els.totalCountNumber) els.totalCountNumber.textContent = totalCount;
    if (els.totalCountHeader) els.totalCountHeader.textContent = totalCount;

    if (!plagues || plagues.length === 0) {
      els.plaguesGrid.innerHTML = getEmptyStateHtml();
      const emptyResetBtn = document.getElementById('reset-filters-btn');
      if (emptyResetBtn)
        emptyResetBtn.addEventListener('click', resetAllFilters);
    } else {
      els.plaguesGrid.innerHTML =
        plagues.map(buildPlagueCardHtml).join('') + getCtaCardHtml();
    }

    updatePaginationUI(totalPages);
  };

  const fetchPlagues = async () => {
    if (activeAbortController) activeAbortController.abort();
    activeAbortController = new AbortController();

    const filters = getFilterValues(els);
    const queryString = buildQueryParams(currentPage, filters);
    renderSkeletons(els.plaguesGrid);

    try {
      const response = await fetch(`/api/plagues?${queryString}`, {
        signal: activeAbortController.signal,
      });
      if (!response.ok) throw new Error('Error al cargar plagas');

      const data = await response.json();
      window.history.replaceState(null, '', `/plagues?${queryString}`);
      renderPlagues(data);
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Error al obtener las plagas:', error);
    }
  };

  const syncChips = () => {
    const currentCat =
      els.categoryFilter && els.categoryFilter.value !== 'Categoría'
        ? els.categoryFilter.value
        : '';
    els.categoryChips.forEach((chip) => {
      const isSelected = (chip.dataset.category || '') === currentCat;
      chip.className = `category-chip px-2.5 py-1 rounded-md text-xs font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer active:scale-95 ${
        isSelected
          ? 'bg-[#1b4332] text-white shadow-2xs'
          : 'bg-secondary text-foreground hover:bg-border'
      }`;
    });

    const currentRisk =
      els.riskFilter && els.riskFilter.value !== 'Riesgo'
        ? els.riskFilter.value
        : '';
    els.riskChips.forEach((chip) => {
      const chipRisk = chip.dataset.risk || '';
      const isSelected = chipRisk === currentRisk;
      chip.className = getRiskChipClass(chipRisk, isSelected);
    });
  };

  const handleFilterChange = () => {
    currentPage = 1;
    syncChips();
    fetchPlagues();
  };

  const resetAllFilters = (e) => {
    if (e) e.preventDefault();
    if (els.searchInput) els.searchInput.value = '';
    if (els.searchClearBtn) els.searchClearBtn.classList.add('hidden');
    if (els.categoryFilter) els.categoryFilter.value = 'Categoría';
    if (els.cropFilter) els.cropFilter.value = 'Cultivo';
    if (els.regionFilter) els.regionFilter.value = 'Región';
    if (els.riskFilter) els.riskFilter.value = 'Riesgo';
    handleFilterChange();
  };

  const bindSelectAndResetControls = () => {
    [
      els.categoryFilter,
      els.cropFilter,
      els.regionFilter,
      els.riskFilter,
    ].forEach((selectEl) => {
      selectEl?.addEventListener('change', handleFilterChange);
    });
    els.resetFiltersLink?.addEventListener('click', resetAllFilters);
    els.filterBtn?.addEventListener('click', handleFilterChange);
    els.filterForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      handleFilterChange();
    });
  };

  const setupEvents = () => {
    els.searchInput?.addEventListener('input', () => {
      els.searchClearBtn?.classList.toggle(
        'hidden',
        els.searchInput.value.trim().length === 0,
      );
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(handleFilterChange, 250);
    });

    els.searchClearBtn?.addEventListener('click', () => {
      els.searchInput.value = '';
      els.searchClearBtn.classList.add('hidden');
      els.searchInput.focus();
      handleFilterChange();
    });

    els.categoryChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        if (els.categoryFilter) {
          els.categoryFilter.value = chip.dataset.category || 'Categoría';
        }
        handleFilterChange();
      });
    });

    els.riskChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        if (els.riskFilter) {
          els.riskFilter.value = chip.dataset.risk || 'Riesgo';
        }
        handleFilterChange();
      });
    });

    bindSelectAndResetControls();

    els.prevPageBtn?.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        fetchPlagues();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    els.nextPageBtn?.addEventListener('click', () => {
      currentPage++;
      fetchPlagues();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  setupEvents();
}

document.addEventListener('DOMContentLoaded', initPlaguesCatalog);
