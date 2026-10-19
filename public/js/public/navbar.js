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

  const navToggle = document.getElementById('public-nav-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const navIcon = document.getElementById('public-nav-icon');

  if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', () => {
      const isHidden = mobileMenu.classList.contains('hidden');
      if (isHidden) {
        mobileMenu.classList.remove('hidden');
        if (navIcon) navIcon.textContent = 'close';
        navToggle.setAttribute('aria-expanded', 'true');
      } else {
        mobileMenu.classList.add('hidden');
        if (navIcon) navIcon.textContent = 'menu';
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
});
