document.addEventListener('DOMContentLoaded', () => {
  const paths = document.querySelectorAll('.state-path');
  const rankingButtons = document.querySelectorAll('.btn-ranking');

  const cardEstado = document.getElementById('card-estado');
  const cardAlertas = document.getElementById('card-alertas');
  const cardNivel = document.getElementById('card-nivel');
  const cardCultivo = document.getElementById('card-cultivo');
  const cardPrincipal = document.getElementById('card-principal');
  const cardLink = document.getElementById('card-link');

  function actualizarTarjeta(data) {
    if (!data) return;
    if (cardEstado) cardEstado.textContent = data.estado;
    if (cardAlertas) cardAlertas.textContent = data.alertas;
    if (cardNivel) cardNivel.textContent = data.nivel;
    if (cardCultivo) cardCultivo.textContent = data.cultivo;
    if (cardPrincipal) cardPrincipal.textContent = data.principal;
    if (cardLink && data.principal) {
      cardLink.href = `/plagues?search=${encodeURIComponent(data.principal)}`;
    }
  }

  function seleccionarEstado(nombreEstado) {
    paths.forEach((path) => {
      const esSeleccionado = path.dataset.estado === nombreEstado;
      path.setAttribute('stroke-width', esSeleccionado ? '2.5' : '1.2');
      path.style.opacity = esSeleccionado ? '1' : '0.8';

      if (esSeleccionado) {
        actualizarTarjeta(path.dataset);
      }
    });
  }

  // Eventos para el SVG
  paths.forEach((path) => {
    path.addEventListener('mouseenter', () => {
      actualizarTarjeta(path.dataset);
      path.style.opacity = '1';
    });

    path.addEventListener('mouseleave', () => {
      path.style.opacity = '0.85';
    });

    path.addEventListener('click', () => {
      seleccionarEstado(path.dataset.estado);
    });
  });

  // Eventos para la lista del Ranking
  rankingButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const estado = btn.dataset.estado;
      seleccionarEstado(estado);
    });
  });

  // Buscador etiquetas frecuentes
  const frequentBtns = document.querySelectorAll('.frequent-tag-btn');
  const searchInput = document.getElementById('hero-search-input');
  const searchForm = document.getElementById('hero-search-form');

  frequentBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const query = btn.getAttribute('data-query');
      if (query && searchInput) {
        searchInput.value = query;
        if (searchForm) {
          searchForm.submit();
        }
      }
    });
  });
});
