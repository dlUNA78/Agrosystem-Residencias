/**
 * crops.js — Comportamiento interactivo del Catálogo Público de Cultivos (/crops)
 * Gestiona:
 *   - Búsqueda en tiempo real con debounce y AbortController
 *   - Chips táctiles de categoría y temporada sincronizados con filtros
 *   - Botón de limpieza rápida del campo de búsqueda
 *   - Skeleton loading mientras se obtienen resultados
 *   - Estado vacío (empty state) institucional con botón de restauración
 *   - Paginación dinámica interactiva
 *   - Fallback de imágenes sin onerror inline
 */

const escapeHTML = (str) => {
  if (!str) return '';
  const p = document.createElement('p');
  p.appendChild(document.createTextNode(str));
  return p.innerHTML;
};

const buildCropBadges = (crop) => {
  const badges = [];
  if (crop.growthCycle) {
    badges.push(`
      <span class="inline-flex items-center gap-1 rounded-md border border-emerald-200/80 bg-emerald-50/70 px-2 py-0.5 text-[10px] font-semibold text-[#1b4332]">
        <span class="material-symbols-outlined text-xs">schedule</span>
        ${escapeHTML(crop.growthCycle)}
      </span>
    `);
  }
  if (crop.season) {
    badges.push(`
      <span class="inline-flex items-center gap-1 rounded-md border border-blue-200/80 bg-blue-50/70 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
        <span class="material-symbols-outlined text-xs">calendar_month</span>
        ${escapeHTML(crop.season)}
      </span>
    `);
  }
  if (crop.plaguesCount > 0) {
    badges.push(`
      <span class="inline-flex items-center gap-1 rounded-md border border-rose-200/80 bg-rose-50/70 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
        <span class="material-symbols-outlined text-xs">bug_report</span>
        ${crop.plaguesCount} plagas
      </span>
    `);
  }
  return badges.length > 0
    ? `<div class="flex flex-wrap items-center gap-1.5 pt-1">${badges.join('')}</div>`
    : '';
};

const buildCropCardHtml = (crop) => {
  const safeImageUrl = encodeURI(
    crop.imageUrl || crop.image_url || '/images/test/default.png',
  );
  const safeName = escapeHTML(crop.commonName || crop.name);
  const safeCategory = escapeHTML(crop.category || 'Agrícola');
  const safeScientificName = escapeHTML(crop.scientificName || '');
  const safeDescription = escapeHTML(
    crop.description || 'Cultivo registrado en el catálogo oficial de INIFAP.',
  );
  const safeId = escapeHTML(String(crop.id));
  const badgesHtml = buildCropBadges(crop);

  return `
    <article class="group flex flex-col border border-border bg-card transition-all duration-200 hover:border-[#1b4332]/40 rounded-xl overflow-hidden shadow-2xs hover:shadow-md hover:-translate-y-0.5">
      <div class="h-1.5 w-full bg-[#1b4332]"></div>

      <div class="relative aspect-4/3 overflow-hidden bg-muted">
        <img
          class="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          src="${safeImageUrl}"
          alt="${safeName}"
          loading="lazy"
          decoding="async"
        />
        <div aria-hidden="true" class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-black/20 pointer-events-none"></div>

        <div class="absolute left-3 top-3 flex items-center gap-1.5 bg-card/90 px-2.5 py-1 backdrop-blur rounded-md border border-border shadow-2xs">
          <span aria-hidden="true" class="inline-block size-1.5 rounded-full bg-[#1b4332]"></span>
          <span class="text-mono-label text-foreground capitalize font-bold text-[10px]">${safeCategory}</span>
        </div>

        <span class="absolute left-3 bottom-3 text-mono-label text-[10px] text-white/90 font-mono tracking-wider drop-shadow-xs select-none">
          ACERVO FOTOGRÁFICO · INIFAP
        </span>
      </div>

      <div class="flex flex-1 flex-col gap-3 p-5">
        <p class="text-mono-label text-muted-foreground font-semibold text-[10px]">
          ${safeCategory} — CULTIVO NACIONAL
        </p>

        <div class="flex flex-col gap-1">
          <h3 class="text-base sm:text-lg font-headline font-bold leading-tight tracking-tight text-foreground group-hover:text-[#1b4332] transition-colors">
            <a href="/crops/${safeId}">${safeName}</a>
          </h3>
          ${safeScientificName ? `<p class="font-mono text-xs italic text-muted-foreground">${safeScientificName}</p>` : ''}
        </div>

        <p class="line-clamp-3 text-xs sm:text-sm leading-relaxed text-muted-foreground">
          ${safeDescription}
        </p>

        ${badgesHtml}

        <div class="mt-auto flex items-end justify-between gap-4 border-t border-border pt-4">
          <div class="flex flex-col gap-0.5">
            <span class="text-mono-label text-muted-foreground text-[10px]">Estatus normativo</span>
            <span class="text-xs font-semibold text-emerald-800">Validado INIFAP</span>
          </div>
          <a href="/crops/${safeId}" class="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#1b4332] hover:underline">
            Ver detalle →
          </a>
        </div>
      </div>
    </article>
  `;
};

const buildSkeletonCardsHtml = (count = 8) =>
  Array.from({ length: count })
    .map(
      () => `
    <div class="flex flex-col border border-border bg-card rounded-xl overflow-hidden shadow-2xs animate-pulse">
      <div class="h-1.5 w-full bg-muted"></div>
      <div class="aspect-4/3 w-full bg-muted/60"></div>
      <div class="flex flex-1 flex-col gap-3 p-5">
        <div class="h-3 w-1/3 bg-muted rounded"></div>
        <div class="h-5 w-3/4 bg-muted rounded"></div>
        <div class="h-3 w-1/2 bg-muted rounded"></div>
        <div class="space-y-2 pt-2">
          <div class="h-3 w-full bg-muted rounded"></div>
          <div class="h-3 w-4/5 bg-muted rounded"></div>
        </div>
        <div class="mt-auto border-t border-border pt-4 flex justify-between">
          <div class="h-4 w-20 bg-muted rounded"></div>
          <div class="h-4 w-16 bg-muted rounded"></div>
        </div>
      </div>
    </div>
  `,
    )
    .join('');

const buildEmptyStateHtml = (searchQuery) => `
  <div class="col-span-full text-center py-16 bg-card border border-border rounded-xl p-8 shadow-2xs">
    <span class="material-symbols-outlined text-6xl text-muted-foreground/40 mb-3">agriculture</span>
    <h3 class="text-xl font-bold text-foreground mb-1">No se encontraron cultivos</h3>
    <p class="text-sm text-muted-foreground max-w-md mx-auto mb-6">
      ${searchQuery ? `No hay resultados para "${escapeHTML(searchQuery)}". Intenta con otro término o limpia los filtros.` : 'No hay registros agronómicos disponibles para el filtro seleccionado.'}
    </p>
    <button type="button" id="btn-reset-crop-filters" class="px-5 py-2.5 bg-[#1b4332] text-white font-bold text-xs rounded-lg hover:bg-[#2d6a4f] transition-colors cursor-pointer shadow-2xs">
      Ver todos los cultivos
    </button>
  </div>
`;

const buildPaginationHtml = (currentPage, totalPages) => {
  if (totalPages <= 1) return '';
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return `
    <nav class="flex items-center gap-2 bg-card border border-border p-1.5 rounded-xl shadow-2xs" aria-label="Navegación de páginas">
      <button
        type="button"
        data-page="${currentPage - 1}"
        class="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-secondary text-foreground transition-colors cursor-pointer ${!hasPrev ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}"
        ${!hasPrev ? 'disabled' : ''}
        aria-label="Página anterior"
      >
        <span class="material-symbols-outlined text-xl">chevron_left</span>
      </button>

      <span class="px-4 text-xs font-mono font-semibold text-foreground">
        Página ${currentPage} de ${totalPages}
      </span>

      <button
        type="button"
        data-page="${currentPage + 1}"
        class="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-secondary text-foreground transition-colors cursor-pointer ${!hasNext ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}"
        ${!hasNext ? 'disabled' : ''}
        aria-label="Página siguiente"
      >
        <span class="material-symbols-outlined text-xl">chevron_right</span>
      </button>
    </nav>
  `;
};

// ── Controlador de Estado y Peticiones ───────────────────────────────────────
let activeAbortController = null;
let debounceTimeout = null;

const buildCropQueryParams = ({ search, category, season, page }) => {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (season) params.set('season', season);
  if (page > 1) params.set('page', String(page));
  return params;
};

const updateCountDisplays = (totalCount) => {
  const countHeader = document.getElementById('total-crops-count-header');
  const countNumber = document.getElementById('total-crops-count-number');
  if (countHeader) countHeader.textContent = String(totalCount);
  if (countNumber) countNumber.textContent = String(totalCount);
};

const renderCropGrid = (grid, crops, search) => {
  if (!grid) return;
  if (crops.length === 0) {
    grid.innerHTML = buildEmptyStateHtml(search);
    document
      .getElementById('btn-reset-crop-filters')
      ?.addEventListener('click', resetAllFilters);
    return;
  }
  grid.innerHTML = crops.map(buildCropCardHtml).join('');
};

const updatePaginationView = (paginationContainer, data) => {
  if (!paginationContainer) return;
  const current = data.currentPage || 1;
  const total = data.totalPages || 1;
  paginationContainer.innerHTML = buildPaginationHtml(current, total);
};

const handleCropsResponse = (data, search, params) => {
  const grid = document.getElementById('crops-grid');
  const paginationContainer = document.getElementById(
    'crops-pagination-container',
  );
  updateCountDisplays(data.totalCount || 0);
  renderCropGrid(grid, data.crops || [], search);
  updatePaginationView(paginationContainer, data);

  const queryStr = params.toString();
  const newUrl = queryStr ? `/crops?${queryStr}` : '/crops';
  window.history.replaceState({}, '', newUrl);
};

const resetAbortController = () => {
  if (activeAbortController) {
    activeAbortController.abort();
  }
  activeAbortController = new AbortController();
  return activeAbortController;
};

const setSkeletonState = () => {
  const grid = document.getElementById('crops-grid');
  if (grid) grid.innerHTML = buildSkeletonCardsHtml(8);
};

const fetchCrops = async ({
  search = '',
  category = '',
  season = '',
  page = 1,
}) => {
  const controller = resetAbortController();
  setSkeletonState();
  const params = buildCropQueryParams({ search, category, season, page });

  try {
    const response = await fetch(`/api/crops?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Error al consultar cultivos');

    const data = await response.json();
    handleCropsResponse(data, search, params);
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Error fetching crops:', error);
    }
  }
};

const getFilterValues = () => {
  const searchInput = document.getElementById('search-crops-input');
  const categorySelect = document.getElementById('category-crops-filter');
  const seasonSelect = document.getElementById('season-crops-filter');

  return {
    search: searchInput?.value.trim() || '',
    category: categorySelect?.value || '',
    season: seasonSelect?.value || '',
  };
};

const triggerDebouncedFetch = (page = 1) => {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    const filters = getFilterValues();
    fetchCrops({ ...filters, page });
  }, 250);
};

const updateChipStyles = (containerSelector, activeValue) => {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.querySelectorAll('button[data-value]').forEach((btn) => {
    const isSelected = btn.dataset.value === activeValue;
    btn.classList.toggle('bg-[#1b4332]', isSelected);
    btn.classList.toggle('text-white', isSelected);
    btn.classList.toggle('font-bold', isSelected);
    btn.classList.toggle('shadow-2xs', isSelected);
    btn.classList.toggle('bg-secondary', !isSelected);
    btn.classList.toggle('text-foreground', !isSelected);
  });
};

const resetAllFilters = () => {
  const searchInput = document.getElementById('search-crops-input');
  const categorySelect = document.getElementById('category-crops-filter');
  const seasonSelect = document.getElementById('season-crops-filter');

  if (searchInput) searchInput.value = '';
  if (categorySelect) categorySelect.value = '';
  if (seasonSelect) seasonSelect.value = '';

  updateChipStyles('#category-chips-container', '');
  updateChipStyles('#season-chips-container', '');

  fetchCrops({ page: 1 });
};

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-crops-input');
  const categorySelect = document.getElementById('category-crops-filter');
  const seasonSelect = document.getElementById('season-crops-filter');
  const clearBtn = document.getElementById('clear-crops-search-btn');
  const filterForm = document.getElementById('form-filtros-crops');
  const paginationContainer = document.getElementById(
    'crops-pagination-container',
  );
  const grid = document.getElementById('crops-grid');

  // Delegación de fallback para imágenes rotas
  grid?.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (
        img.tagName === 'IMG' &&
        !img.src.includes('/images/test/default.png')
      ) {
        img.src = '/images/test/default.png';
      }
    },
    true,
  );

  // Evitar submit tradicional que recarga toda la página
  filterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const filters = getFilterValues();
    fetchCrops({ ...filters, page: 1 });
  });

  searchInput?.addEventListener('input', () => {
    if (clearBtn) {
      clearBtn.classList.toggle('hidden', !searchInput.value);
    }
    triggerDebouncedFetch(1);
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    clearBtn.classList.add('hidden');
    triggerDebouncedFetch(1);
  });

  categorySelect?.addEventListener('change', () => {
    updateChipStyles('#category-chips-container', categorySelect.value);
    const filters = getFilterValues();
    fetchCrops({ ...filters, page: 1 });
  });

  seasonSelect?.addEventListener('change', () => {
    updateChipStyles('#season-chips-container', seasonSelect.value);
    const filters = getFilterValues();
    fetchCrops({ ...filters, page: 1 });
  });

  // Chips de categoría
  document
    .querySelectorAll('#category-chips-container button[data-value]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const value = btn.dataset.value;
        if (categorySelect) categorySelect.value = value;
        updateChipStyles('#category-chips-container', value);
        const filters = getFilterValues();
        fetchCrops({ ...filters, page: 1 });
      });
    });

  // Chips de temporada
  document
    .querySelectorAll('#season-chips-container button[data-value]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const value = btn.dataset.value;
        if (seasonSelect) seasonSelect.value = value;
        updateChipStyles('#season-chips-container', value);
        const filters = getFilterValues();
        fetchCrops({ ...filters, page: 1 });
      });
    });

  // Paginación dinámica
  paginationContainer?.addEventListener('click', (event) => {
    const pageBtn = event.target.closest('button[data-page]');
    if (!pageBtn || pageBtn.disabled) return;
    const page = Number(pageBtn.dataset.page);
    if (Number.isSafeInteger(page) && page > 0) {
      const filters = getFilterValues();
      fetchCrops({ ...filters, page });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  document
    .getElementById('btn-reset-crop-filters')
    ?.addEventListener('click', resetAllFilters);
});
