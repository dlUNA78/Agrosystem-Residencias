/**
 * main.js — Agrosystem Dashboard
 * Gestiona:
 *   - Toggle del sidebar con botón hamburguesa / botón de cierre
 *   - Swipe horizontal (touch) para abrir/cerrar el sidebar
 *   - Backdrop overlay en pantallas pequeñas
 *   - Ajuste dinámico del ancho del topnav y el margen del main-content
 *   - Persistencia del estado en localStorage
 *   - pointer-events:none en sidebar cerrado (evita bloquear scroll táctil)
 *   - Bloqueo del scroll del body cuando el sidebar está abierto en móvil
 */

(function () {
  'use strict';

  /* ─── Constantes ──────────────────────────────────────────── */
  const SIDEBAR_WIDTH   = 256;   // 16rem = 256px
  const SWIPE_THRESHOLD = 50;    // px mínimos para registrar un swipe
  const EDGE_ZONE       = 24;    // px desde el borde izquierdo para activar swipe-open
  const STORAGE_KEY     = 'agrosys_sidebar_open';
  const LG_BREAKPOINT   = 1024;  // px — coincide con Tailwind "lg"

  /* ─── Referencias DOM ─────────────────────────────────────── */
  const sidebar    = document.getElementById('sidebar');
  const topnav     = document.getElementById('topnav');
  const mainContent= document.getElementById('main-content');
  const backdrop   = document.getElementById('sidebar-backdrop');
  const toggleBtn  = document.getElementById('sidebar-toggle-btn');
  const closeBtn   = document.getElementById('sidebar-close-btn');

  if (!sidebar) return; // No estamos en una página privada

  /* ─── Estado ──────────────────────────────────────────────── */
  let isOpen   = true;
  let touchStartX = 0;
  let touchStartY = 0;

  /* ─── Helpers ─────────────────────────────────────────────── */
  function isLargeScreen() {
    return window.innerWidth >= LG_BREAKPOINT;
  }

  /**
   * Aplica las clases CSS que reflejan el estado isOpen:
   * - Desplaza el sidebar fuera/dentro de la pantalla
   * - Ajusta el ancho/posición del navbar y el padding del main
   * - Muestra / oculta el backdrop
   */
  function applyState(animate) {
    if (!animate) {
      sidebar.style.transition    = 'none';
      topnav.style.transition     = 'none';
      mainContent.style.transition= 'none';
    }

    if (isOpen) {
      // Sidebar visible — habilitar pointer-events
      sidebar.style.transform    = 'translateX(0)';
      sidebar.style.pointerEvents = 'auto';

      if (isLargeScreen()) {
        // En desktop el navbar y el main se desplazan
        topnav.style.width           = `calc(100% - ${SIDEBAR_WIDTH}px)`;
        topnav.style.left            = `${SIDEBAR_WIDTH}px`;
        mainContent.style.marginLeft = `${SIDEBAR_WIDTH}px`;
        // En desktop NO bloqueamos el scroll del body
        unlockBodyScroll();
      } else {
        // En móvil: sidebar es overlay, bloquear scroll del body
        topnav.style.width           = '100%';
        topnav.style.left            = '0';
        mainContent.style.marginLeft = '0';
        lockBodyScroll();
        showBackdrop(true);
      }
    } else {
      // Sidebar oculto — deshabilitar pointer-events para que el touch pase al content
      sidebar.style.transform    = `translateX(-${SIDEBAR_WIDTH}px)`;
      sidebar.style.pointerEvents = 'none';
      topnav.style.width           = '100%';
      topnav.style.left            = '0';
      mainContent.style.marginLeft = '0';
      unlockBodyScroll();
      showBackdrop(false);
    }

    // Restaurar transición en el siguiente frame
    if (!animate) {
      requestAnimationFrame(() => {
        sidebar.style.transition    = '';
        topnav.style.transition     = '';
        mainContent.style.transition= '';
      });
    }
  }

  /* Bloquea el scroll del body (sidebar overlay en móvil) */
  function lockBodyScroll() {
    // Guardar posición actual para evitar salto al restaurar
    if (document.body.style.overflow === 'hidden') return;
    document.body.dataset.scrollY = window.scrollY;
    document.body.style.overflow  = 'hidden';
    document.body.style.position  = 'fixed';
    document.body.style.top       = `-${window.scrollY}px`;
    document.body.style.width     = '100%';
  }

  /* Restaura el scroll del body */
  function unlockBodyScroll() {
    if (document.body.style.overflow !== 'hidden') return;
    const scrollY = parseInt(document.body.dataset.scrollY || '0', 10);
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top      = '';
    document.body.style.width    = '';
    window.scrollTo(0, scrollY);
  }

  function showBackdrop(show) {
    if (!backdrop) return;
    if (show && !isLargeScreen()) {
      backdrop.style.opacity       = '1';
      backdrop.style.pointerEvents = 'auto';
      backdrop.setAttribute('aria-hidden', 'false');
    } else {
      backdrop.style.opacity       = '0';
      backdrop.style.pointerEvents = 'none';
      backdrop.setAttribute('aria-hidden', 'true');
    }
  }

  function setSidebarOpen(open, animate = true) {
    isOpen = open;
    applyState(animate);
    try { localStorage.setItem(STORAGE_KEY, open ? '1' : '0'); } catch (_) {}
  }

  function toggleSidebar() {
    setSidebarOpen(!isOpen);
  }

  /* ─── Inicialización ──────────────────────────────────────── */
  function init() {
    // Leer estado guardado
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (_) {}

    if (saved === null) {
      // Por defecto: abierto en desktop, cerrado en móvil
      isOpen = isLargeScreen();
    } else {
      isOpen = saved === '1';
    }

    // Aplica sin animación en la carga inicial (evita flash)
    applyState(false);

    // ── Botones ────────────────────────────────────────────────
    if (toggleBtn) toggleBtn.addEventListener('click', toggleSidebar);
    if (closeBtn)  closeBtn.addEventListener('click', () => setSidebarOpen(false));
    if (backdrop)  backdrop.addEventListener('click', () => setSidebarOpen(false));

    // ── Swipe touch ────────────────────────────────────────────
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend',   onTouchEnd,   { passive: true });

    // ── Resize ────────────────────────────────────────────────
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // En desktop siempre quitar el backdrop y desbloquear scroll
        if (isLargeScreen()) {
          showBackdrop(false);
          unlockBodyScroll();
        }
        applyState(false);
      }, 150);
    });
  }

  /* ─── Swipe Handlers ──────────────────────────────────────── */
  function onTouchStart(e) {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }

  function onTouchEnd(e) {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    // Ignorar desplazamientos mayoritariamente verticales
    if (Math.abs(dy) > Math.abs(dx)) return;
    // Ignorar swipes demasiado cortos
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;

    if (dx > 0 && !isOpen && touchStartX <= EDGE_ZONE) {
      // Swipe derecha desde el borde izquierdo → abrir
      setSidebarOpen(true);
    } else if (dx < 0 && isOpen) {
      // Swipe izquierda → cerrar
      setSidebarOpen(false);
    }
  }

  /* ─── Arranque ────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
