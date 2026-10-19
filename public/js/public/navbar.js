/**
 * navbar.js — Comportamiento interactivo del menú público institucional
 * Controla:
 *   - Menú desplegable de usuario (perfil, ascenso inifap, cerrar sesión)
 *   - Menú responsive móvil (abrir/cerrar panel con icono animado)
 * Cumple con RULES.MD (todo JS en public/js/public/).
 */
document.addEventListener('DOMContentLoaded', () => {
  const userBtn = document.getElementById('user-menu-button');
  const userDropdown = document.getElementById('user-menu-dropdown');
  const userArrow = document.getElementById('user-menu-arrow');

  if (userBtn && userDropdown) {
    userBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = userDropdown.classList.contains('hidden');
      if (isHidden) {
        userDropdown.classList.remove('hidden');
        if (userArrow) userArrow.style.transform = 'rotate(180deg)';
      } else {
        userDropdown.classList.add('hidden');
        if (userArrow) userArrow.style.transform = 'rotate(0deg)';
      }
    });

    document.addEventListener('click', (e) => {
      if (!userDropdown.contains(e.target) && !userBtn.contains(e.target)) {
        userDropdown.classList.add('hidden');
        if (userArrow) userArrow.style.transform = 'rotate(0deg)';
      }
    });
  }

  // ─── 2. DRAWER MÓVIL OFF-CANVAS & BOTTOM BAR ───────────────────────────
  const navToggle = document.getElementById('public-nav-toggle');
  const drawerBackdrop = document.getElementById('mobile-drawer-backdrop');
  const drawer = document.getElementById('mobile-drawer');
  const drawerClose = document.getElementById('mobile-drawer-close');
  const bottomBarMenuBtn = document.getElementById('bottom-bar-menu-btn');

  function openDrawer() {
    if (!drawer || !drawerBackdrop) return;
    drawerBackdrop.classList.remove('hidden');
    drawer.classList.remove('invisible', 'pointer-events-none');
    requestAnimationFrame(() => {
      drawerBackdrop.classList.remove('opacity-0');
      drawerBackdrop.classList.add('opacity-100');
      drawer.classList.remove('translate-x-full');
      drawer.classList.add('translate-x-0');
    });
    document.body.style.overflow = 'hidden';
    if (navToggle) navToggle.setAttribute('aria-expanded', 'true');
  }

  function closeDrawer() {
    if (!drawer || !drawerBackdrop) return;
    drawerBackdrop.classList.remove('opacity-100');
    drawerBackdrop.classList.add('opacity-0');
    drawer.classList.remove('translate-x-0');
    drawer.classList.add('translate-x-full');
    setTimeout(() => {
      drawerBackdrop.classList.add('hidden');
      drawer.classList.add('invisible', 'pointer-events-none');
      document.body.style.overflow = '';
    }, 300);
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
  }

  if (navToggle) navToggle.addEventListener('click', openDrawer);
  if (bottomBarMenuBtn) bottomBarMenuBtn.addEventListener('click', openDrawer);
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });
});
