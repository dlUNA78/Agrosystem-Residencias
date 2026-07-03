document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("search-input");
  const categoryFilter = document.getElementById("category-filter");
  const regionFilter = document.getElementById("region-filter");
  const riskFilter = document.getElementById("risk-filter");
  const filterBtn = document.getElementById("filter-btn");

  const plaguesGrid = document.getElementById("plagues-grid");
  const totalCountNumber = document.getElementById("total-count-number");

  const paginationContainer = document.getElementById("pagination-container");
  const prevPageBtn = document.getElementById("prev-page-btn");
  const nextPageBtn = document.getElementById("next-page-btn");
  const currentPageDisplay = document.getElementById("current-page-display");

  let currentPage = 1;
  let debounceTimeout;

  const fetchPlagues = async () => {
    const search = searchInput.value.trim();
    const category = categoryFilter.value;
    const region = regionFilter.value;
    const risk = riskFilter.value;

    const queryParams = new URLSearchParams({
      page: currentPage
    });

    if (search) queryParams.append("search", search);
    if (category && category !== "Categoría") queryParams.append("category", category);
    if (region && region !== "Región") queryParams.append("region", region);
    if (risk && risk !== "Riesgo") queryParams.append("risk", risk);

    try {
      const response = await fetch(`/api/plagues?${queryParams.toString()}`);
      if (!response.ok) throw new Error("Error fetching data");

      const data = await response.json();
      renderPlagues(data);
    } catch (error) {
      console.error("Error al obtener las plagas:", error);
    }
  };

  const escapeHTML = (str) => {
    if (!str) return "";
    const p = document.createElement("p");
    p.appendChild(document.createTextNode(str));
    return p.innerHTML;
  };

  const renderPlagues = (data) => {
    const { plagues, totalCount, totalPages, currentPage: newCurrentPage } = data;

    currentPage = newCurrentPage;
    totalCountNumber.textContent = totalCount;

    // Save CTA card if it exists in DOM or use default HTML if not found (on first load it should exist)
    const existingCta = document.getElementById("cta-new-species");
    const ctaCardHtml = existingCta ? existingCta.outerHTML : `
      <article id="cta-new-species" class="group bg-surface-container-lowest rounded-xl overflow-hidden editorial-shadow ghost-border flex flex-col hover:translate-y-[-4px] transition-all duration-300 border-2 border-dashed border-primary/20 items-center justify-center p-8">
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

    plaguesGrid.innerHTML = "";

    plagues.forEach(plague => {
      const article = document.createElement("article");
      article.className = "group bg-surface-container-lowest rounded-xl overflow-hidden editorial-shadow ghost-border flex flex-col hover:translate-y-[-4px] transition-all duration-300";

      const safeImageUrl = encodeURI(plague.imageUrl || '');
      const safeName = escapeHTML(plague.name);
      const safeCategory = escapeHTML(plague.category);
      const safeScientificName = escapeHTML(plague.scientificName);
      const safeDescription = escapeHTML(plague.description);
      const safeRiskBadgeClass = escapeHTML(plague.riskBadgeClass);
      const safeRiskLabel = escapeHTML(plague.riskLabel);
      const safeId = escapeHTML(plague.id.toString());

      article.innerHTML = `
        <div class="relative h-56 overflow-hidden">
          <img class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src="${safeImageUrl}" alt="${safeName}" />
          <div class="absolute top-4 left-4">
            <span class="px-2 py-1 rounded ${safeRiskBadgeClass} text-[10px] font-bold uppercase tracking-wider">
              ${safeRiskLabel}
            </span>
          </div>
        </div>
        <div class="p-6 flex-1 flex flex-col">
          <span class="text-[10px] font-label font-bold uppercase tracking-widest text-primary mb-2">
            ${safeCategory}
          </span>
          <h3 class="text-xl font-headline font-bold text-on-surface mb-1 leading-tight">
            ${safeName}
          </h3>
          <p class="text-sm italic text-on-surface-variant mb-4">
            ${safeScientificName}
          </p>
          <p class="text-sm text-on-surface-variant line-clamp-2 leading-relaxed mb-6">
            ${safeDescription}
          </p>
          <div class="mt-auto pt-4 border-t border-surface-container flex justify-between items-center">
            <a href="/plagues/${safeId}" class="text-primary font-bold text-sm flex items-center gap-1 group/btn">
              Ver detalle
              <span class="material-symbols-outlined text-sm group-hover/btn:translate-x-1 transition-transform">arrow_forward</span>
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
      paginationContainer.style.display = "none";
    } else {
      paginationContainer.style.display = "flex";
      currentPageDisplay.textContent = `Página ${currentPage} de ${totalPages}`;

      prevPageBtn.disabled = currentPage === 1;
      nextPageBtn.disabled = currentPage === totalPages;
    }
  };

  const handleFilterChange = () => {
    currentPage = 1;
    fetchPlagues();
  };

  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(handleFilterChange, 300);
  });

  categoryFilter.addEventListener("change", handleFilterChange);
  regionFilter.addEventListener("change", handleFilterChange);
  riskFilter.addEventListener("change", handleFilterChange);

  if (filterBtn) {
    // Hide filter btn as we do it in real time, but keep functionality if clicked
    filterBtn.addEventListener("click", handleFilterChange);
  }

  prevPageBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      fetchPlagues();
    }
  });

  nextPageBtn.addEventListener("click", () => {
    currentPage++;
    fetchPlagues();
  });
});
