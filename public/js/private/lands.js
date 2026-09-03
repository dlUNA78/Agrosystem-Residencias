/**
 * public/js/private/lands.js
 *
 * Script estático de interactividad para la vista "Mis Terrenos".
 * Responsabilidades:
 *   1. Inicializar el mapa de visualización de parcelas existentes (#lands-map).
 *   2. Inicializar el mini-mapa de selección GPS dentro del modal (#farm-map).
 *   3. Al hacer clic en el mini-mapa, colocar/mover un marcador y escribir
 *      las coordenadas en los inputs ocultos #lat y #lng del formulario.
 *   4. Manejar la apertura/cierre del modal de registro.
 *
 * ⚠️  Este archivo NO contiene lógica de negocio ni accede a req/res.
 *     Los datos de las parcelas existentes se leen desde el DOM (atributos data-*).
 */

document.addEventListener('DOMContentLoaded', function () {
  // ============================================================
  // 1. MAPA DE VISUALIZACIÓN (terrenos ya registrados)
  // ============================================================
  const landsMapEl = document.getElementById('lands-map');

  if (landsMapEl) {
    // Centro por defecto: México
    const landsMap = L.map('lands-map', { zoomControl: true }).setView(
      [23.634501, -102.552784],
      5,
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(landsMap);

    // Forzar re-cálculo del tamaño por si el sidebar causa un reflow al cargar
    setTimeout(() => landsMap.invalidateSize(), 200);

    // Ícono personalizado para cada parcela
    const farmIcon = L.divIcon({
      html: `<div style="
                width:30px;height:30px;
                background:#0F2E2E;
                border:3px solid white;
                border-radius:50%;
                display:flex;align-items:center;justify-content:center;
                box-shadow:0 2px 8px rgba(0,0,0,0.3)">
               <svg width="14" height="14" fill="white" viewBox="0 0 24 24">
                 <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
               </svg>
             </div>`,
      className: '',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30],
    });

    // Leer las tarjetas del DOM y colocar marcadores si tienen coordenadas
    const farmCards = document.querySelectorAll(
      '#lands-grid article[data-lat]',
    );
    const markers = [];

    farmCards.forEach((card) => {
      const lat = parseFloat(card.dataset.lat);
      const lng = parseFloat(card.dataset.lng);
      const name =
        card.querySelector('h2')?.textContent?.trim() ?? 'Sin nombre';
      const farmId = card.querySelector('a[href]')?.getAttribute('href') ?? '#';

      if (!isNaN(lat) && !isNaN(lng)) {
        const marker = L.marker([lat, lng], { icon: farmIcon })
          .addTo(landsMap)
          .bindPopup(
            `<b>${name}</b><br>
             <a href="${farmId}" style="color:#43655c;font-weight:bold;font-size:12px">
               📂 Abrir Expediente →
             </a>`,
          );
        markers.push(marker);
      }
    });

    // Ajustar la vista al grupo de marcadores
    const btnZoomFit = document.getElementById('map-zoom-fit');
    if (btnZoomFit) {
      btnZoomFit.addEventListener('click', function () {
        if (markers.length > 0) {
          const group = L.featureGroup(markers);
          landsMap.fitBounds(group.getBounds().pad(0.25));
        } else {
          // Si no hay marcadores, centrar en México
          landsMap.setView([23.634501, -102.552784], 5);
        }
      });
    }
  }

  // ============================================================
  // 2. MODAL — Registrar Nuevo Predio
  // ============================================================
  const modalNewLand = document.getElementById('modal-new-land');
  const btnOpenNewLand = document.getElementById('btn-open-new-land');
  const btnOpenNewLandCard = document.getElementById('btn-open-new-land-card');
  const btnCloseNewLand = document.getElementById('btn-close-new-land');
  const btnCancelNewLand = document.getElementById('btn-cancel-new-land');
  const backdrop = document.getElementById('modal-new-land-backdrop');

  // Mini-mapa del modal — se inicializa una sola vez al abrir el modal
  let farmMap = null;
  let farmMarker = null;

  function openModal() {
    if (!modalNewLand) return;
    modalNewLand.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Inicializar el mini-mapa la primera vez que se abre
    if (!farmMap) {
      // Centro por defecto: México (ajustable por el usuario)
      farmMap = L.map('farm-map', {
        zoomControl: true,
        fadeAnimation: true,
      }).setView([19.432608, -99.133209], 5);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(farmMap);

      // ── Evento clic: colocar/mover marcador y actualizar inputs ocultos ──
      farmMap.on('click', function (e) {
        const { lat, lng } = e.latlng;

        // Actualizar los inputs OCULTOS del formulario (los que se envían al servidor)
        document.getElementById('lat').value = lat.toFixed(7);
        document.getElementById('lng').value = lng.toFixed(7);

        // Actualizar los indicadores visuales (lectura humana, no se envían)
        const latDisplay = document.getElementById('lat-display');
        const lngDisplay = document.getElementById('lng-display');
        if (latDisplay) latDisplay.textContent = lat.toFixed(6);
        if (lngDisplay) lngDisplay.textContent = lng.toFixed(6);

        // Mover o crear el marcador
        if (farmMarker) {
          farmMarker.setLatLng([lat, lng]);
        } else {
          farmMarker = L.marker([lat, lng]).addTo(farmMap);
        }
      });
    }

    // Forzar re-cálculo del tamaño de inmediato para cargar las imágenes sin delay
    requestAnimationFrame(() => {
      if (farmMap) farmMap.invalidateSize();
    });
  }

  function closeModal() {
    if (!modalNewLand) return;
    modalNewLand.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // Bindear eventos de apertura/cierre
  if (btnOpenNewLand) btnOpenNewLand.addEventListener('click', openModal);
  if (btnOpenNewLandCard)
    btnOpenNewLandCard.addEventListener('click', openModal);
  if (btnCloseNewLand) btnCloseNewLand.addEventListener('click', closeModal);
  if (btnCancelNewLand) btnCancelNewLand.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  // Cerrar con Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });
});
