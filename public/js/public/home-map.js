/**
 * home-map.js — Comportamiento interactivo de la página de inicio (Home)
 * Gestiona:
 *   - Buscador multifacético con tabs de ámbito y botón de borrado rápido
 *   - Sincronización bidireccional entre el Mapa SVG, el selector móvil y el Ranking
 *   - Tooltip flotante interactivo para desktop en el mapa de México
 *   - Actualización dinámica de la tarjeta de la entidad con badges de severidad
 *   - Filtros de temporada del calendario agrícola (siembra / cosecha / todos)
 * Cumple con RULES.MD (JS en public/js/public/).
 */
document.addEventListener('DOMContentLoaded', () => {
  // ─── 1. BUSCADOR MULTIFACÉTICO (HERO) ────────────────────────────────────
  const scopeButtons = document.querySelectorAll('.search-scope-btn');
  const searchForm = document.getElementById('hero-search-form');
  const searchInput = document.getElementById('hero-search-input');
  const searchIcon = document.getElementById('hero-search-icon');
  const clearBtn = document.getElementById('hero-search-clear');
  const frequentBtns = document.querySelectorAll('.frequent-tag-btn');

  // Alternancia entre pestañas de ámbito (Plagas, Cultivos, Insumos, Regiones)
  if (scopeButtons.length && searchForm && searchInput) {
    scopeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        // Desactivar todas las pestañas
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

        // Activar pestaña seleccionada
        btn.setAttribute('aria-selected', 'true');
        btn.classList.add(
          'bg-card',
          'text-[#1b4332]',
          'shadow-2xs',
          'font-semibold',
        );
        btn.classList.remove('text-muted-foreground', 'font-medium');

        // Actualizar acción del formulario, icono y placeholder
        const action = btn.dataset.action || '/plagues';
        const placeholder = btn.dataset.placeholder || '';
        const icon = btn.dataset.icon || 'search';

        searchForm.setAttribute('action', action);
        searchInput.setAttribute('placeholder', placeholder);
        if (searchIcon) searchIcon.textContent = icon;

        searchInput.focus();
      });
    });
  }

  // Botón para limpiar el texto de búsqueda
  if (searchInput && clearBtn) {
    const toggleClearBtn = () => {
      if (searchInput.value.trim().length > 0) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    };

    searchInput.addEventListener('input', toggleClearBtn);

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      toggleClearBtn();
      searchInput.focus();
    });
  }

  // Consultas frecuentes
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

  // ─── 2. MAPA DE MÉXICO, SELECTOR MÓVIL Y RANKING ──────────────────────────
  const paths = document.querySelectorAll('.state-path');
  const rankingButtons = document.querySelectorAll('.btn-ranking');
  const stateSelect = document.getElementById('state-select-control');

  const cardEstado = document.getElementById('card-estado');
  const cardAlertas = document.getElementById('card-alertas');
  const cardNivelText = document.getElementById('card-nivel-text');
  const cardNivelDot = document.getElementById('card-nivel-dot');
  const cardNivelBadge = document.getElementById('card-nivel');
  const cardCultivo = document.getElementById('card-cultivo');
  const cardPrincipal = document.getElementById('card-principal');
  const cardLink = document.getElementById('card-link');

  const tooltip = document.getElementById('map-tooltip');
  const tooltipState = document.getElementById('tooltip-state');
  const tooltipAlertas = document.getElementById('tooltip-alerts');

  // Estilos de badge según severidad
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

  function actualizarTarjeta(data) {
    if (!data) return;

    if (cardEstado) cardEstado.textContent = data.estado;
    if (cardAlertas) cardAlertas.textContent = data.alertas;
    if (cardCultivo) cardCultivo.textContent = data.cultivo;
    if (cardPrincipal) cardPrincipal.textContent = data.principal;
    if (cardNivelText) cardNivelText.textContent = data.nivel;

    actualizarBadgeRiesgo(data.nivel);

    if (cardLink && data.principal) {
      cardLink.href = `/plagues?search=${encodeURIComponent(data.principal)}`;
    }
  }

  function seleccionarEstado(nombreEstado) {
    if (!nombreEstado) return;

    // Sincronizar selector dropdown si existe
    if (stateSelect && stateSelect.value !== nombreEstado) {
      stateSelect.value = nombreEstado;
    }

    // Resaltar en SVG
    paths.forEach((path) => {
      const esSeleccionado = path.dataset.estado === nombreEstado;
      if (esSeleccionado) {
        path.classList.add('is-selected');
        path.style.opacity = '1';
        actualizarTarjeta(path.dataset);
      } else {
        path.classList.remove('is-selected');
        path.style.opacity = '0.85';
      }
    });

    // Resaltar en la lista del Ranking
    rankingButtons.forEach((btn) => {
      if (btn.dataset.estado === nombreEstado) {
        btn.classList.add('bg-secondary', 'ring-1', 'ring-[#1b4332]/30');
      } else {
        btn.classList.remove('bg-secondary', 'ring-1', 'ring-[#1b4332]/30');
      }
    });
  }

  // Evento para el selector móvil accesible
  if (stateSelect) {
    stateSelect.addEventListener('change', () => {
      seleccionarEstado(stateSelect.value);
    });
  }

  // Eventos para el SVG del mapa de México
  paths.forEach((path) => {
    path.addEventListener('mouseenter', () => {
      // Mostrar tooltip en desktop
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

    path.addEventListener('click', () => {
      seleccionarEstado(path.dataset.estado);
    });

    // Soporte de navegación por teclado (Enter / Space)
    path.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        seleccionarEstado(path.dataset.estado);
      }
    });
  });

  // Eventos para los botones del Ranking
  rankingButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const estado = btn.dataset.estado;
      seleccionarEstado(estado);
    });
  });

  // ─── 3. FILTROS DEL CALENDARIO AGRÍCOLA ────────────────────────────────────
  const seasonFilters = document.querySelectorAll('.season-filter-btn');
  const cropRows = document.querySelectorAll('.crop-calendar-row');

  if (seasonFilters.length && cropRows.length) {
    seasonFilters.forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter || 'all';

        // Actualizar apariencia de los botones de filtro
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

        // Filtrar filas
        cropRows.forEach((row) => {
          const rowSeason = row.dataset.season;
          if (filter === 'all' || rowSeason === filter) {
            row.style.display = 'flex';
            row.style.opacity = '1';
          } else {
            row.style.display = 'none';
          }
        });
      });
    });
  }

  // ─── 4. ANIMACIONES DE ENTRADA Y REVELADO AL SCROLL ──────────────────────
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

    // Permitir un frame para que el navegador procese los estilos iniciales antes de observar
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

    // Coordinar el inicio del conteo con la animación de entrada de la tarjeta hero (300ms)
    setTimeout(() => {
      counters.forEach((c) => animateCounter(c));
    }, 300);
  }

  initScrollReveal();
  initCounters();
});
