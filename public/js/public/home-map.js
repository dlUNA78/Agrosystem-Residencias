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
