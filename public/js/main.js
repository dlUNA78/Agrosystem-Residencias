/**
 * main.js — Agrosystem Shell & Dashboard UI
 * Gestiona:
 *   - Inicialización local de iconos Lucide y fallbacks resilientes de imágenes (cero JS inline)
 *   - Toggle del sidebar con botón hamburguesa / botón de cierre / swipe táctil
 *   - Backdrop overlay y bloqueo de scroll en pantallas móviles
 *   - Menú accesible de usuario (click, teclado Escape y clic exterior)
 *   - Buscador rápido contextual del topbar privado y botón volver arriba
 */

(function () {
  'use strict';

  const SIDEBAR_WIDTH = 256;
  const SWIPE_THRESHOLD = 50;
  const EDGE_ZONE = 24;
  const STORAGE_KEY = 'agrosys_sidebar_open';
  const LG_BREAKPOINT = 1024;
  const SCROLL_TOP_THRESHOLD = 280;

  function initLucideIcons() {
    if (typeof window.lucide?.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function initSafeImageFallbacks() {
    document.querySelectorAll('img[data-fallback-src]').forEach((image) => {
      image.addEventListener('error', () => {
        const fallbackSource = image.dataset.fallbackSrc;
        if (!fallbackSource || image.src.endsWith(fallbackSource)) return;
        image.src = fallbackSource;
      });
    });

    document.querySelectorAll('img[data-hide-on-error]').forEach((image) => {
      image.addEventListener('error', () => {
        image.classList.add('hidden');
      });
    });
  }

  function initPrivateUserMenu() {
    const container = document.getElementById('user-menu-container');
    const trigger = document.getElementById('user-menu-trigger');
    const dropdown = document.getElementById('user-menu-dropdown');
    if (!container || !trigger || !dropdown) return;

    const setExpanded = (open) => {
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      dropdown.classList.toggle('hidden', !open);
    };

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
      setExpanded(!isExpanded);
    });

    document.addEventListener('click', (event) => {
      if (!container.contains(event.target)) {
        setExpanded(false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    });
  }

  function initPrivateGlobalSearch() {
    const form = document.getElementById('private-global-search-form');
    const input = document.getElementById('private-global-search');
    const mainContent = document.getElementById('main-content');
    if (!form || !input || !mainContent) return;

    form.addEventListener('submit', (event) => {
      const localInput = mainContent.querySelector(
        'input[name="search"], input[name="q"]',
      );
      if (!localInput) return;

      event.preventDefault();
      localInput.value = input.value.trim();
      localInput.focus();
      localInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function initPrivateScrollTop() {
    const scrollBtn = document.getElementById('private-scroll-top');
    if (!scrollBtn) return;

    const syncVisibility = () => {
      const visible = window.scrollY > SCROLL_TOP_THRESHOLD;
      scrollBtn.classList.toggle('opacity-0', !visible);
      scrollBtn.classList.toggle('pointer-events-none', !visible);
      scrollBtn.classList.toggle('translate-y-3', !visible);
      scrollBtn.classList.toggle('opacity-100', visible);
      scrollBtn.classList.toggle('pointer-events-auto', visible);
      scrollBtn.classList.toggle('translate-y-0', visible);
    };

    window.addEventListener('scroll', syncVisibility, { passive: true });
    scrollBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    syncVisibility();
  }

  function initPrivateSidebar() {
    const sidebar = document.getElementById('sidebar');
    const topnav = document.getElementById('topnav');
    const mainContent = document.getElementById('main-content');
    const backdrop = document.getElementById('sidebar-backdrop');
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const closeBtn = document.getElementById('sidebar-close-btn');

    if (!sidebar || !topnav || !mainContent) return;

    let isOpen = true;
    let touchStartX = 0;
    let touchStartY = 0;

    const isLargeScreen = () => window.innerWidth >= LG_BREAKPOINT;

    const lockBodyScroll = () => {
      if (document.body.style.overflow === 'hidden') return;
      document.body.dataset.scrollY = String(window.scrollY);
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${window.scrollY}px`;
      document.body.style.width = '100%';
    };

    const unlockBodyScroll = () => {
      if (document.body.style.overflow !== 'hidden') return;
      const scrollY = parseInt(document.body.dataset.scrollY || '0', 10);
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };

    const showBackdrop = (show) => {
      if (!backdrop) return;
      const visible = Boolean(show && !isLargeScreen());
      backdrop.style.opacity = visible ? '1' : '0';
      backdrop.style.pointerEvents = visible ? 'auto' : 'none';
      backdrop.setAttribute('aria-hidden', visible ? 'false' : 'true');
    };

    const applyOpenLayout = () => {
      sidebar.style.transform = 'translateX(0)';
      sidebar.style.pointerEvents = 'auto';

      if (isLargeScreen()) {
        topnav.style.width = `calc(100% - ${SIDEBAR_WIDTH}px)`;
        topnav.style.left = `${SIDEBAR_WIDTH}px`;
        mainContent.style.marginLeft = `${SIDEBAR_WIDTH}px`;
        unlockBodyScroll();
        showBackdrop(false);
        return;
      }

      topnav.style.width = '100%';
      topnav.style.left = '0';
      mainContent.style.marginLeft = '0';
      lockBodyScroll();
      showBackdrop(true);
    };

    const applyClosedLayout = () => {
      sidebar.style.transform = `translateX(-${SIDEBAR_WIDTH}px)`;
      sidebar.style.pointerEvents = 'none';
      topnav.style.width = '100%';
      topnav.style.left = '0';
      mainContent.style.marginLeft = '0';
      unlockBodyScroll();
      showBackdrop(false);
    };

    const setTransitions = (value) => {
      sidebar.style.transition = value;
      topnav.style.transition = value;
      mainContent.style.transition = value;
    };

    const applyState = (animate) => {
      if (!animate) setTransitions('none');
      if (isOpen) {
        applyOpenLayout();
      } else {
        applyClosedLayout();
      }
      if (!animate) {
        requestAnimationFrame(() => setTransitions(''));
      }
    };

    const readSavedSidebarState = () => {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    };

    const persistSidebarState = (open) => {
      try {
        localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
      } catch {
        // Ignorar bloqueo de almacenamiento local
      }
    };

    const setSidebarOpen = (open, animate = true) => {
      isOpen = open;
      applyState(animate);
      persistSidebarState(open);
    };

    const onTouchStart = (event) => {
      const touch = event.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    };

    const onTouchEnd = (event) => {
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < SWIPE_THRESHOLD) return;

      if (dx > 0 && !isOpen && touchStartX <= EDGE_ZONE) {
        setSidebarOpen(true);
      } else if (dx < 0 && isOpen) {
        setSidebarOpen(false);
      }
    };

    const saved = readSavedSidebarState();
    isOpen = isLargeScreen() ? (saved === null ? true : saved === '1') : false;
    applyState(false);

    toggleBtn?.addEventListener('click', () => setSidebarOpen(!isOpen));
    closeBtn?.addEventListener('click', () => setSidebarOpen(false));
    backdrop?.addEventListener('click', () => setSidebarOpen(false));

    sidebar.querySelectorAll('a[href]').forEach((navLink) => {
      navLink.addEventListener('click', () => {
        if (!isLargeScreen()) {
          setSidebarOpen(false);
        }
      });
    });
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (isLargeScreen()) {
          showBackdrop(false);
          unlockBodyScroll();
        }
        applyState(false);
      }, 150);
    });
  }

  function boot() {
    initLucideIcons();
    initSafeImageFallbacks();
    initPrivateSidebar();
    initPrivateUserMenu();
    initPrivateGlobalSearch();
    initPrivateScrollTop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
