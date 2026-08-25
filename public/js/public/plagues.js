document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  const categoryFilter = document.getElementById('category-filter');
  const regionFilter = document.getElementById('region-filter');
  const riskFilter = document.getElementById('risk-filter');
  const filterBtn = document.getElementById('filter-btn');

  const plaguesGrid = document.getElementById('plagues-grid');
  const totalCountNumber = document.getElementById('total-count-number');

  const paginationContainer = document.getElementById('pagination-container');
  const prevPageBtn = document.getElementById('prev-page-btn');
  const nextPageBtn = document.getElementById('next-page-btn');
  const currentPageDisplay = document.getElementById('current-page-display');

  let currentPage = 1;
  let debounceTimeout;

  const fetchPlagues = async () => {
    const search = searchInput.value.trim();
    const category = categoryFilter.value;
    const region = regionFilter.value;
    const risk = riskFilter.value;

    const queryParams = new URLSearchParams({
      page: currentPage,
    });

    if (search) queryParams.append('search', search);
    if (category && category !== 'Categoría')
      queryParams.append('category', category);
    if (region && region !== 'Región') queryParams.append('region', region);
    if (risk && risk !== 'Riesgo') queryParams.append('risk', risk);

    try {
      const response = await fetch(`/api/plagues?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Error fetching data');

      const data = await response.json();
      renderPlagues(data);
    } catch (error) {
      console.error('Error al obtener las plagas:', error);
    }
  };

  const escapeHTML = (str) => {
    if (!str) return '';
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(str));
    return p.innerHTML;
  };

  const renderPlagues = (data) => {
    const {
      plagues,
      totalCount,
      totalPages,
      currentPage: newCurrentPage,
    } = data;

    currentPage = newCurrentPage;
    totalCountNumber.textContent = totalCount;

    // Save CTA card if it exists in DOM or use default HTML if not found (on first load it should exist)
    const existingCta = document.getElementById('cta-new-species');
    const ctaCardHtml = existingCta
      ? existingCta.outerHTML
      : `
      <article id="cta-new-species" class="group bg-surface-container-lowest rounded-xl overflow-hidden editorial-shadow ghost-border flex flex-col hover:-translate-y-1 transition-all duration-300 border-2 border-dashed border-primary/20 items-center justify-center p-8">
        <div class="text-center">
          <span class="material-symbols-outlined text-4xl text-primary/40 mb-4">add_circle</span>
          <h3 class="text-lg font-headline font-bold text-on-surface mb-2">¿Nueva especie?</h3>
          <p class="text-xs text-on-surface-variant leading-relaxed mb-6">
            Colabora con nuestra red científica reportando una nueva plaga.
          </p>
          <button class="px-6 py-2 bg-surface-container-high rounded-full text-xs font-bold text-primary uppercase tracking-wider hover:bg-primary-container transition-colors">
            Solicitar registro
          </button>
        </div>
      </article>
    `;

    plaguesGrid.innerHTML = '';

    plagues.forEach((plague) => {
      const article = document.createElement('article');
      article.className =
        'group flex flex-col border border-border bg-card transition-all duration-200 hover:border-[#1b4332]/40 rounded-lg overflow-hidden shadow-2xs hover:shadow-md';

      const safeImageUrl = encodeURI(plague.imageUrl || plague.image_url || '/images/test/default.png');
      const safeName = escapeHTML(plague.name);
      const safeCategory = escapeHTML(plague.category);
      const safeScientificName = escapeHTML(plague.scientificName);
      const safeDescription = escapeHTML(plague.description);
      const safeRiskLabel = escapeHTML(plague.riskLabel || 'Bajo');
      const safeId = escapeHTML(plague.id.toString());

      const isCritical = safeRiskLabel === 'Crítico' || safeRiskLabel === 'Alto';
      const isModerate = safeRiskLabel === 'Moderado' || safeRiskLabel === 'Medio';
      const riskBarColor = isCritical ? 'bg-rose-600' : isModerate ? 'bg-amber-500' : 'bg-emerald-600';
      const riskDotColor = isCritical ? 'bg-rose-600 animate-pulse' : isModerate ? 'bg-amber-500' : 'bg-emerald-600';

      article.innerHTML = `
        <div class="h-1 w-full ${riskBarColor}"></div>

        <div class="relative aspect-4/3 overflow-hidden bg-muted">
          <img class="size-full object-cover transition-transform duration-500 group-hover:scale-105" src="${safeImageUrl}" alt="${safeName}" onerror="this.onerror=null; this.src='/images/test/default.png';" />
          <div aria-hidden="true" class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-black/20 pointer-events-none"></div>
        
          <div class="absolute left-3 top-3 flex items-center gap-1.5 bg-card/90 px-2 py-1 backdrop-blur rounded-md border border-border shadow-2xs">
            <span aria-hidden="true" class="inline-block size-1.5 rounded-full ${riskDotColor}"></span>
            <span class="text-mono-label text-foreground capitalize font-bold">${safeRiskLabel}</span>
          </div>

          <span class="absolute left-3 bottom-3 text-mono-label text-[10px] text-white/90 font-mono tracking-wider drop-shadow-xs select-none">${escapeHTML(plague.imageCredit || 'ACERVO FOTO · INIFAP')}</span>
        </div>

        <div class="flex flex-1 flex-col gap-3 p-5">
          <p class="text-mono-label text-muted-foreground font-semibold">
            ${safeCategory} — VIGILANCIA SANITARIA
          </p>

          <div class="flex flex-col gap-1">
            <h3 class="text-lg font-headline font-bold leading-tight tracking-tight text-foreground group-hover:text-[#1b4332] transition-colors">
              ${safeName}
            </h3>
            <p class="font-mono text-xs italic text-muted-foreground">${safeScientificName}</p>
          </div>

          <p class="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            ${safeDescription}
          </p>

          <div class="mt-auto flex items-end justify-between gap-4 border-t border-border pt-4">
            <div class="flex flex-col gap-0.5">
              <span class="text-mono-label text-muted-foreground">Estatus fitosanitario</span>
              <span class="text-xs font-semibold text-emerald-800">Verificado INIFAP</span>
            </div>
            <a href="/plagues/${safeId}" class="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#1b4332] hover:underline">
              Ficha técnica →
            </a>
          </div>
        </div>
      `;
      plaguesGrid.appendChild(article);
    });

    // Append the CTA card at the end
    plaguesGrid.insertAdjacentHTML('beforeend', ctaCardHtml);

    // Update pagination UI
    if (totalPages <= 1) {
      paginationContainer.style.display = 'none';
    } else {
      paginationContainer.style.display = 'flex';
      currentPageDisplay.textContent = `Página ${currentPage} de ${totalPages}`;

      prevPageBtn.disabled = currentPage === 1;
      nextPageBtn.disabled = currentPage === totalPages;
    }
  };

  const handleFilterChange = () => {
    currentPage = 1;
    fetchPlagues();
  };

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(handleFilterChange, 300);
  });

  categoryFilter.addEventListener('change', handleFilterChange);
  regionFilter.addEventListener('change', handleFilterChange);
  riskFilter.addEventListener('change', handleFilterChange);

  if (filterBtn) {
    // Hide filter btn as we do it in real time, but keep functionality if clicked
    filterBtn.addEventListener('click', handleFilterChange);
  }

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      fetchPlagues();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    currentPage++;
    fetchPlagues();
  });
});
