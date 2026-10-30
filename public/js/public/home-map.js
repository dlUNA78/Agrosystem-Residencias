/**
 * home-map.js — Comportamiento interactivo de la página de inicio (Home)
 * Gestiona:
 *   - Buscador multifacético con tabs de ámbito y botón de borrado rápido
 *   - Sincronización bidireccional entre el Mapa SVG, selector móvil, chips rápidos y Ranking
 *   - Tooltip flotante interactivo para desktop en el mapa de México
 *   - Actualización dinámica de la tarjeta de la entidad con badges de severidad y enlace directo
 *   - Filtros de severidad para el Boletín Oficial (desktop y móvil)
 *   - Filtros de temporada y vista dual móvil del calendario agrícola
 *   - Botón flotante volver arriba (Scroll to Top FAB)
 *   - Animaciones de revelado al scroll y contadores dinámicos
 * Cumple con RULES.MD (JS en public/js/public/).
 */

const MEXICAN_STATES = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'México',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
];

const mapPlagueItem = (p) => ({
  url: `/plagues/${p.id}`,
  title: p.name,
  subtitle: p.scientificName || p.category,
  icon: 'pest_control',
  badge: p.riskLabel || p.category,
  badgeClass:
    p.riskBadgeClass || 'bg-emerald-50 text-emerald-800 border-emerald-200',
});

const mapCropItem = (c) => ({
  url: `/crops/${c.id}`,
  title: c.name,
  subtitle: c.scientific_name || c.category,
  icon: 'psychiatry',
  badge: c.category || 'Cultivo',
  badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
});

const mapProductItem = (pr) => ({
  url: `/products/${pr.id}`,
  title: pr.name,
  subtitle: pr.active_ingredient || pr.manufacturer || '',
  icon: 'science',
  badge: pr.category || 'Insumo',
  badgeClass: 'bg-secondary text-foreground border-border',
});

const mapScopeItems = (scope, data) => {
  if (scope === 'plagues') return (data.plagues || []).map(mapPlagueItem);
  if (scope === 'crops') return (data.crops || []).map(mapCropItem);
  if (scope === 'products') return (data.products || []).map(mapProductItem);
  return [];
};

const filterLandsSuggestions = (query) => {
  const normalized = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return MEXICAN_STATES.filter((s) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .includes(normalized),
  )
    .slice(0, 6)
    .map((state) => ({
      url: `/lands?search=${encodeURIComponent(state)}`,
      title: state,
      subtitle: 'Entidad Federativa · Cobertura INIFAP',
      icon: 'travel_explore',
      badge: 'Región',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    }));
};

const getScopeEndpoint = (scope, query) => {
  const endpoints = {
    plagues: `/api/plagues?search=${encodeURIComponent(query)}&limit=5`,
    crops: `/api/crops?search=${encodeURIComponent(query)}&limit=5`,
    products: `/api/products?search=${encodeURIComponent(query)}&limit=5`,
  };
  return endpoints[scope] || '';
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function initHeroAutocomplete(searchForm, searchInput, clearBtn) {
  const dropdown = document.getElementById('hero-autocomplete-dropdown');
  const dropdownList = document.getElementById('hero-autocomplete-list');
  const scopeLabel = document.getElementById('hero-autocomplete-scope-label');
  const seeAllText = document.getElementById('hero-autocomplete-see-all');
  const loadingIndicator = document.getElementById('hero-search-loading');

  if (!dropdown || !dropdownList || !searchInput || !searchForm) return;

  let debounceTimer = null;
  let activeAbortController = null;
  let currentIndex = -1;

  const getScope = () => {
    const activeBtn = document.querySelector(
      '.search-scope-btn[aria-selected="true"]',
    );
    return activeBtn?.dataset?.scope || 'plagues';
  };

  const showDropdown = () => {
    dropdown.classList.remove('hidden');
    searchInput.setAttribute('aria-expanded', 'true');
  };

  const hideDropdown = () => {
    dropdown.classList.add('hidden');
    searchInput.setAttribute('aria-expanded', 'false');
    currentIndex = -1;
  };

  const updateActiveItem = (items, index) => {
    items.forEach((item, i) => {
      if (i === index) {
        item.classList.add('bg-secondary', 'ring-1', 'ring-[#1b4332]/40');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('bg-secondary', 'ring-1', 'ring-[#1b4332]/40');
      }
    });
  };

  const renderSuggestions = (items, scope, query) => {
    currentIndex = -1;
    if (!items.length) {
      dropdownList.innerHTML = `
        <div class="p-4 text-center text-muted-foreground text-xs">
          <span class="material-symbols-outlined text-2xl text-muted-foreground/60 block mb-1">search_off</span>
          No se encontraron coincidencias para "<strong class="text-foreground">${escapeHtml(query)}</strong>".
        </div>
      `;
      showDropdown();
      return;
    }

    const scopeLabels = {
      plagues: 'PLAGAS COINCIDENTES',
      crops: 'CULTIVOS COINCIDENTES',
      products: 'INSUMOS COINCIDENTES',
      lands: 'REGIONES COINCIDENTES',
    };
    if (scopeLabel) {
      scopeLabel.textContent = scopeLabels[scope] || 'SUGERENCIAS DISPONIBLES';
    }
    if (seeAllText) {
      seeAllText.textContent = `Ver todas las coincidencias para "${query}"...`;
    }

    dropdownList.innerHTML = items
      .map(
        (item, index) => `
      <a
        href="${item.url}"
        class="autocomplete-item flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-secondary/70 transition-colors text-foreground group text-left"
        role="option"
        tabindex="-1"
        data-index="${index}"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-md bg-secondary text-[#1b4332] flex items-center justify-center shrink-0 border border-border group-hover:bg-[#1b4332] group-hover:text-white transition-colors">
            <span class="material-symbols-outlined text-base">${item.icon}</span>
          </div>
          <div class="min-w-0 truncate">
            <p class="font-bold text-xs text-foreground group-hover:text-[#1b4332] truncate">${escapeHtml(item.title)}</p>
            ${item.subtitle ? `<p class="text-[11px] font-mono italic text-muted-foreground truncate">${escapeHtml(item.subtitle)}</p>` : ''}
          </div>
        </div>
        ${
          item.badge
            ? `<span class="inline-block px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded border shrink-0 ${item.badgeClass || 'bg-secondary text-foreground border-border'}">
                ${escapeHtml(item.badge)}
              </span>`
            : ''
        }
      </a>
    `,
      )
      .join('');

    showDropdown();
  };

  const fetchSuggestions = async (query) => {
    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    const { signal } = activeAbortController;

    const scope = getScope();

    if (loadingIndicator) loadingIndicator.classList.remove('hidden');

    try {
      if (scope === 'lands') {
        const items = filterLandsSuggestions(query);
        renderSuggestions(items, 'lands', query);
        return;
      }

      const endpoint = getScopeEndpoint(scope, query);
      if (!endpoint) return;

      const res = await fetch(endpoint, {
        signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = mapScopeItems(scope, data);

      renderSuggestions(items, scope, query);
    } catch (err) {
      if (err.name === 'AbortError') return;
      dropdownList.innerHTML = `
        <div class="p-3 text-center text-muted-foreground text-xs">
          No fue posible cargar sugerencias en este momento.
        </div>
      `;
      showDropdown();
    } finally {
      if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
  };

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) {
      hideDropdown();
      if (loadingIndicator) loadingIndicator.classList.add('hidden');
      return;
    }
    debounceTimer = setTimeout(() => {
      fetchSuggestions(q);
    }, 220);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (dropdown.classList.contains('hidden')) return;
    const items = dropdownList.querySelectorAll('.autocomplete-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      currentIndex = (currentIndex + 1) % items.length;
      updateActiveItem(items, currentIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      currentIndex = (currentIndex - 1 + items.length) % items.length;
      updateActiveItem(items, currentIndex);
    } else if (e.key === 'Enter') {
      if (currentIndex >= 0 && items[currentIndex]) {
        e.preventDefault();
        items[currentIndex].click();
      }
    } else if (e.key === 'Escape') {
      hideDropdown();
    }
  });

  searchInput.addEventListener('focus', () => {
    const q = searchInput.value.trim();
    if (q.length >= 2 && dropdownList.children.length > 0) {
      showDropdown();
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      hideDropdown();
      if (activeAbortController) activeAbortController.abort();
      if (loadingIndicator) loadingIndicator.classList.add('hidden');
    });
  }

  document.addEventListener('click', (e) => {
    if (!searchForm.contains(e.target)) {
      hideDropdown();
    }
  });
}

// ─── 1. BUSCADOR MULTIFACÉTICO (HERO) ──────────────────────────────────────
function initHeroSearch() {
  const scopeButtons = document.querySelectorAll('.search-scope-btn');
  const searchForm = document.getElementById('hero-search-form');
  const searchInput = document.getElementById('hero-search-input');
  const searchIcon = document.getElementById('hero-search-icon');
  const clearBtn = document.getElementById('hero-search-clear');
  const frequentBtns = document.querySelectorAll('.frequent-tag-btn');

  if (scopeButtons.length && searchForm && searchInput) {
    scopeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        scopeButtons.forEach((b) => {
          b.setAttribute('aria-selected', 'false');
          b.classList.remove(
            'bg-card',
            'text-[#1b4332]',
            'shadow-2xs',
            'font-semibold',
          );
          b.classList.add('text-muted-foreground', 'font-medium');
        });

        btn.setAttribute('aria-selected', 'true');
        btn.classList.add(
          'bg-card',
          'text-[#1b4332]',
          'shadow-2xs',
          'font-semibold',
        );
        btn.classList.remove('text-muted-foreground', 'font-medium');

        searchForm.setAttribute('action', btn.dataset.action || '/plagues');
        searchInput.setAttribute('placeholder', btn.dataset.placeholder || '');
        if (searchIcon) searchIcon.textContent = btn.dataset.icon || 'search';
        searchInput.focus();

        if (searchInput.value.trim().length >= 2) {
          searchInput.dispatchEvent(new Event('input'));
        }
      });
    });
  }

  if (searchInput && clearBtn) {
    const toggleClearBtn = () => {
      clearBtn.classList.toggle(
        'hidden',
        searchInput.value.trim().length === 0,
      );
    };

    searchInput.addEventListener('input', toggleClearBtn);
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      toggleClearBtn();
      searchInput.focus();
    });
  }

  frequentBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const query = btn.getAttribute('data-query');
      if (query && searchInput) {
        searchInput.value = query;
        if (clearBtn) clearBtn.classList.remove('hidden');
        if (searchForm) searchForm.submit();
      }
    });
  });

  initHeroAutocomplete(searchForm, searchInput, clearBtn);
}

// ─── 2. MAPA DE MÉXICO, CHIPS MÓVILES Y RANKING ────────────────────────────
function initMexicoMap() {
  const paths = document.querySelectorAll('.state-path');
  const rankingButtons = document.querySelectorAll('.btn-ranking');
  const stateSelect = document.getElementById('state-select-control');
  const mobileChips = document.querySelectorAll('.mobile-state-chip');

  const cardEstado = document.getElementById('card-estado');
  const cardAlertas = document.getElementById('card-alertas');
  const cardNivelText = document.getElementById('card-nivel-text');
  const cardNivelDot = document.getElementById('card-nivel-dot');
  const cardNivelBadge = document.getElementById('card-nivel');
  const cardCultivo = document.getElementById('card-cultivo');
  const cardPrincipal = document.getElementById('card-principal');
  const cardLink = document.getElementById('card-link');
  const cardStateSearchBtn = document.getElementById('card-state-search-btn');
  const cardStateSearchLabel = document.getElementById(
    'card-state-search-label',
  );

  const tooltip = document.getElementById('map-tooltip');
  const tooltipState = document.getElementById('tooltip-state');
  const tooltipAlertas = document.getElementById('tooltip-alerts');

  const riskStyles = {
    alta: {
      badge: ['bg-rose-50', 'text-rose-700', 'border-rose-200'],
      dot: ['bg-rose-500', 'animate-pulse'],
    },
    media: {
      badge: ['bg-amber-50', 'text-amber-800', 'border-amber-200'],
      dot: ['bg-amber-500'],
    },
    baja: {
      badge: ['bg-emerald-50', 'text-emerald-800', 'border-emerald-200'],
      dot: ['bg-emerald-500'],
    },
    nula: {
      badge: ['bg-slate-50', 'text-slate-600', 'border-slate-200'],
      dot: ['bg-slate-400'],
    },
  };

  const allBadgeClasses = [
    'bg-rose-50',
    'text-rose-700',
    'border-rose-200',
    'bg-amber-50',
    'text-amber-800',
    'border-amber-200',
    'bg-emerald-50',
    'text-emerald-800',
    'border-emerald-200',
    'bg-slate-50',
    'text-slate-600',
    'border-slate-200',
  ];

  const allDotClasses = [
    'bg-rose-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-slate-400',
    'animate-pulse',
  ];

  function actualizarBadgeRiesgo(nivel) {
    if (!cardNivelBadge || !cardNivelDot) return;
    cardNivelBadge.classList.remove(...allBadgeClasses);
    cardNivelDot.classList.remove(...allDotClasses);
    const style = riskStyles[nivel] || riskStyles.baja;
    cardNivelBadge.classList.add(...style.badge);
    cardNivelDot.classList.add(...style.dot);
  }

  function setElText(el, val) {
    if (el && val !== undefined) el.textContent = val;
  }

  function actualizarTarjeta(data) {
    if (!data) return;
    setElText(cardEstado, data.estado);
    setElText(cardAlertas, data.alertas);
    setElText(cardCultivo, data.cultivo);
    setElText(cardPrincipal, data.principal);
    setElText(cardNivelText, data.nivel);
    actualizarBadgeRiesgo(data.nivel);

    if (cardLink && data.principal) {
      cardLink.href = `/plagues?search=${encodeURIComponent(data.principal)}`;
    }
    if (cardStateSearchBtn && data.estado) {
      cardStateSearchBtn.href = `/plagues?search=${encodeURIComponent(data.estado)}`;
      if (cardStateSearchLabel) {
        cardStateSearchLabel.textContent = `Plagas en ${data.estado}`;
      }
    }
  }

  function syncMobileChips(nombreEstado) {
    mobileChips.forEach((chip) => {
      const isSel = chip.dataset.estado === nombreEstado;
      chip.classList.toggle('bg-[#1b4332]', isSel);
      chip.classList.toggle('text-white', isSel);
      chip.classList.toggle('border-[#1b4332]', isSel);
      chip.classList.toggle('shadow-2xs', isSel);
      chip.classList.toggle('bg-secondary', !isSel);
      chip.classList.toggle('text-foreground', !isSel);
      chip.classList.toggle('border-border', !isSel);
    });
  }

  function seleccionarEstado(nombreEstado) {
    if (!nombreEstado) return;

    if (stateSelect && stateSelect.value !== nombreEstado) {
      stateSelect.value = nombreEstado;
    }
    syncMobileChips(nombreEstado);

    paths.forEach((path) => {
      const esSeleccionado = path.dataset.estado === nombreEstado;
      path.classList.toggle('is-selected', esSeleccionado);
      path.style.opacity = esSeleccionado ? '1' : '0.85';
      if (esSeleccionado) {
        actualizarTarjeta(path.dataset);
      }
    });

    rankingButtons.forEach((btn) => {
      const esSel = btn.dataset.estado === nombreEstado;
      btn.classList.toggle('bg-secondary', esSel);
      btn.classList.toggle('ring-1', esSel);
      btn.classList.toggle('ring-[#1b4332]/30', esSel);
    });
  }

  if (stateSelect) {
    stateSelect.addEventListener('change', () =>
      seleccionarEstado(stateSelect.value),
    );
  }

  mobileChips.forEach((chip) => {
    chip.addEventListener('click', () =>
      seleccionarEstado(chip.dataset.estado),
    );
  });

  paths.forEach((path) => {
    path.addEventListener('mouseenter', () => {
      if (tooltip && tooltipState && tooltipAlertas) {
        tooltipState.textContent = path.dataset.estado;
        tooltipAlertas.textContent = `${path.dataset.alertas} avisos`;
        tooltip.classList.remove('hidden');
      }
      path.style.opacity = '1';
    });

    path.addEventListener('mousemove', (e) => {
      if (tooltip && !tooltip.classList.contains('hidden')) {
        tooltip.style.left = `${e.clientX + 14}px`;
        tooltip.style.top = `${e.clientY + 14}px`;
      }
    });

    path.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.classList.add('hidden');
      if (!path.classList.contains('is-selected')) {
        path.style.opacity = '0.85';
      }
    });

    path.addEventListener('click', () =>
      seleccionarEstado(path.dataset.estado),
    );
    path.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        seleccionarEstado(path.dataset.estado);
      }
    });
  });

  rankingButtons.forEach((btn) => {
    btn.addEventListener('click', () => seleccionarEstado(btn.dataset.estado));
  });
}

// ─── 3. FILTROS DE SEVERIDAD DEL BOLETÍN OFICIAL ───────────────────────────
function initBoletinFilters() {
  const boletinFilterBtns = document.querySelectorAll('.boletin-filter-btn');
  const boletinTableRows = document.querySelectorAll('.boletin-table-row');
  const boletinCardItems = document.querySelectorAll('.boletin-card-item');

  if (!boletinFilterBtns.length) return;

  boletinFilterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const severity = (btn.dataset.severity || 'all').toLowerCase();

      boletinFilterBtns.forEach((b) => {
        b.classList.remove(
          'bg-[#1b4332]',
          'text-white',
          'shadow-2xs',
          'font-semibold',
        );
        b.classList.add('bg-secondary', 'text-muted-foreground', 'font-medium');
      });
      btn.classList.add(
        'bg-[#1b4332]',
        'text-white',
        'shadow-2xs',
        'font-semibold',
      );
      btn.classList.remove(
        'bg-secondary',
        'text-muted-foreground',
        'font-medium',
      );

      const filterElement = (el) => {
        const itemLevel = (el.dataset.level || '').toLowerCase();
        el.style.display =
          severity === 'all' || itemLevel.includes(severity) ? '' : 'none';
      };

      boletinTableRows.forEach(filterElement);
      boletinCardItems.forEach(filterElement);
    });
  });
}

// ─── 4. CALENDARIO AGRÍCOLA (MODO MÓVIL Y FILTROS) ─────────────────────────
function initCalendarControls() {
  const calViewCardsBtn = document.getElementById('calendar-view-cards-btn');
  const calViewMatrixBtn = document.getElementById('calendar-view-matrix-btn');
  const calMobileCards = document.getElementById('calendar-mobile-cards');
  const calMatrixWrapper = document.getElementById('calendar-matrix-wrapper');

  if (
    calViewCardsBtn &&
    calViewMatrixBtn &&
    calMobileCards &&
    calMatrixWrapper
  ) {
    calViewCardsBtn.addEventListener('click', () => {
      calViewCardsBtn.classList.add('bg-card', 'text-[#1b4332]', 'shadow-2xs');
      calViewCardsBtn.classList.remove('text-muted-foreground');
      calViewMatrixBtn.classList.remove(
        'bg-card',
        'text-[#1b4332]',
        'shadow-2xs',
      );
      calViewMatrixBtn.classList.add('text-muted-foreground');

      calMobileCards.classList.remove('hidden');
      calMatrixWrapper.classList.add('hidden');
      calMatrixWrapper.classList.remove('block');
    });

    calViewMatrixBtn.addEventListener('click', () => {
      calViewMatrixBtn.classList.add('bg-card', 'text-[#1b4332]', 'shadow-2xs');
      calViewMatrixBtn.classList.remove('text-muted-foreground');
      calViewCardsBtn.classList.remove(
        'bg-card',
        'text-[#1b4332]',
        'shadow-2xs',
      );
      calViewCardsBtn.classList.add('text-muted-foreground');

      calMobileCards.classList.add('hidden');
      calMatrixWrapper.classList.remove('hidden');
      calMatrixWrapper.classList.add('block');
    });
  }

  const seasonFilters = document.querySelectorAll('.season-filter-btn');
  const cropRows = document.querySelectorAll('.crop-calendar-row');
  const cropMobileCards = document.querySelectorAll('.crop-mobile-card');

  if (!seasonFilters.length) return;

  seasonFilters.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter || 'all';

      seasonFilters.forEach((b) => {
        b.classList.remove(
          'bg-card',
          'text-[#1b4332]',
          'shadow-2xs',
          'font-semibold',
        );
        b.classList.add('text-muted-foreground');
      });
      btn.classList.add(
        'bg-card',
        'text-[#1b4332]',
        'shadow-2xs',
        'font-semibold',
      );
      btn.classList.remove('text-muted-foreground');

      const filterSeason = (el) => {
        const rowSeason = el.dataset.season;
        el.style.display =
          filter === 'all' || rowSeason === filter ? '' : 'none';
      };

      cropRows.forEach(filterSeason);
      cropMobileCards.forEach(filterSeason);
    });
  });
}

// ─── 5. BOTÓN FLOTANTE VOLVER ARRIBA (SCROLL TO TOP FAB) ───────────────────
function initScrollTopFAB() {
  const scrollTopBtn = document.getElementById('scroll-to-top');
  if (!scrollTopBtn) return;

  window.addEventListener('scroll', () => {
    const isVisible = window.scrollY > 350;
    scrollTopBtn.classList.toggle('opacity-0', !isVisible);
    scrollTopBtn.classList.toggle('pointer-events-none', !isVisible);
    scrollTopBtn.classList.toggle('translate-y-4', !isVisible);
    scrollTopBtn.classList.toggle('opacity-100', isVisible);
    scrollTopBtn.classList.toggle('pointer-events-auto', isVisible);
    scrollTopBtn.classList.toggle('translate-y-0', isVisible);
  });

  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ─── 6. ANIMACIONES DE ENTRADA Y REVELADO AL SCROLL ────────────────────────
function initScrollReveal() {
  const revealElements = document.querySelectorAll(
    '.reveal-on-scroll, .reveal-scale',
  );
  if (!revealElements.length) return;

  if (!('IntersectionObserver' in window)) {
    revealElements.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
  );

  requestAnimationFrame(() => {
    revealElements.forEach((el) => observer.observe(el));
  });
}

function animateCounter(el) {
  const rawTarget = el.dataset.target || el.textContent || '0';
  const targetNum = parseInt(rawTarget.replace(/[^\d]/g, ''), 10);
  if (isNaN(targetNum) || targetNum <= 0) return;

  el.textContent = '0';
  const duration = 1200;
  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const currentVal = Math.round(targetNum * easeProgress);

    el.textContent = currentVal.toLocaleString('es-MX');

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = rawTarget;
    }
  }

  requestAnimationFrame(step);
}

function initCounters() {
  const counters = document.querySelectorAll('.counter-stat');
  if (!counters.length) return;

  setTimeout(() => {
    counters.forEach((c) => animateCounter(c));
  }, 300);
}

// ─── ARRANQUE GLOBAL EN DOMCONTENTLOADED ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initHeroSearch();
  initMexicoMap();
  initBoletinFilters();
  initCalendarControls();
  initScrollTopFAB();
  initScrollReveal();
  initCounters();
});
