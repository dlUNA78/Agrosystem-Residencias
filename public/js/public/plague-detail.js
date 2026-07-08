document.addEventListener("DOMContentLoaded", () => {
  // Carousel Initialization
  (function () {
    const slides = document.getElementById('hero-slides');
    const prevBtn = document.getElementById('hero-prev');
    const nextBtn = document.getElementById('hero-next');
    const dotsWrap = document.getElementById('hero-dots');
    const srcLabel = document.getElementById('hero-source-label');

    const items = slides ? slides.children : [];
    const total = items.length;
    if (total <= 1) {
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
      return;
    }

    const sources = Array.from(items).map(el => {
      const caption = el.querySelector('p');
      return caption ? caption.textContent.trim() : 'Banco de Germoplasma INIFAP';
    });

    let current = 0;
    let timer;

    for (let i = 0; i < total; i++) {
      const dot = document.createElement('button');
      dot.className = 'w-2 h-2 rounded-full transition-all ' + (i === 0 ? 'bg-white w-5' : 'bg-white/40');
      dot.setAttribute('aria-label', 'Slide ' + (i + 1));
      dot.addEventListener('click', () => goTo(i));
      if (dotsWrap) dotsWrap.appendChild(dot);
    }

    function goTo(n) {
      current = (n + total) % total;
      if (slides) slides.style.transform = 'translateX(-' + (current * 100) + '%)';
      if (dotsWrap) {
        Array.from(dotsWrap.children).forEach((d, i) => {
          d.className = 'h-2 rounded-full transition-all ' + (i === current ? 'bg-white w-5' : 'bg-white/40 w-2');
        });
      }
      if (srcLabel) srcLabel.textContent = 'Imagen por: ' + sources[current];
      resetTimer();
    }

    function resetTimer() {
      clearInterval(timer);
      timer = setInterval(() => goTo(current + 1), 5000);
    }

    if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));

    resetTimer();
  })();
});

window.addEventListener('load', function () {
  const mapEl = document.getElementById('incidence-map');
  if (!mapEl || typeof L === 'undefined') return;

  const datasetRegions = mapEl.dataset.regions;
  if (!datasetRegions) return;

  let regions = [];
  try {
    regions = JSON.parse(datasetRegions);
  } catch (e) {
    console.error("Failed to parse incidence regions:", e);
    return;
  }

  const riskColors = {
    'Alto':  '#9f403d',
    'Medio': '#43655c',
    'Bajo':  '#50635f',
  };

  const map = L.map('incidence-map', {
    center: [23.6345, -102.5528],
    zoom: 5,
    zoomControl: true,
    scrollWheelZoom: false,
    attributionControl: false,
  });

  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    { maxZoom: 19, subdomains: 'abcd' }
  ).addTo(map);

  const bounds = [];
  regions.forEach(function (r) {
    const riskLevel = r.riskLevel || 'Medio';
    const markerColor = riskColors[riskLevel] || riskColors['Medio'];

    const circle = L.circleMarker([r.lat, r.lng], {
      radius:      10,
      fillColor:   markerColor,
      color:       markerColor,
      weight:      2,
      opacity:     0.9,
      fillOpacity: 0.35,
    }).addTo(map);

    circle.bindPopup(
      '<div style="font-family: Inter, sans-serif; min-width: 140px;">'
      + '<p style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#596061;margin:0 0 4px;">Zona de Incidencia</p>'
      + '<p style="font-weight:700;font-size:14px;margin:0;color:#2d3435;">' + r.name + '</p>'
      + '<p style="font-size:11px;font-weight:600;margin:4px 0 0;color:'+markerColor+';">Riesgo ' + riskLevel + '</p>'
      + '</div>',
      { closeButton: false }
    );

    if (r.hasCoords) bounds.push([r.lat, r.lng]);
  });

  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 7 });
  } else if (bounds.length === 1) {
    map.setView(bounds[0], 7);
  }
});
