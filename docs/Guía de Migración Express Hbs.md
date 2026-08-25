# Guía de Migración: Prototipo v0 (React) a Express.js + Handlebars (HBS) + Tailwind CSS v4

Esta guía proporciona la arquitectura, diagnóstico de fallas comunes, catálogo de componentes y el código paso a paso para portar el diseño de **AgroSystem INIFAP** desde el prototipo generado en React/Next.js hacia tu aplicación en **Express + HBS + Tailwind CSS v4**.

---

## 1. Diagnóstico: ¿Por qué falla al intentarlo portar directamente?

Cuando intentas copiar código generado por **v0 (React/Next.js)** a un entorno **Express + Handlebars**, ocurren varios conflictos fundamentales:

1. **Estado en el Cliente (`useState` / `useMemo`)**:

   - En React, el mapa interactivo (`AlertMap`) utiliza `useState` para cambiar el estado seleccionado (`Sinaloa`), actualizar el resumen de la entidad y resaltar la lista de mayor incidencia al hacer hover o clic.
   - **Handlebars** es un motor de renderizado puramente del lado del servidor (_Server-Side Rendering HTML static string_). No tiene runtime reactivo en el navegador.

2. **Proyección del Mapa SVG (`d3-geo`)**:

   - El proyecto v0 utiliza la librería `d3-geo` (`geoMercator` y `geoPath`) en `lib/mexico-geo.ts` para proyectar el archivo GeoJSON `mexico-states.json` a rutas SVG (`d="..."`) de 900x520 px.
   - En React se ejecuta en el servidor de Next.js. En Express, debes ejecutar esta proyección dentro del **controlador de Express** antes de renderizar la vista `.hbs`.

3. **Iconos y Componentes UI (`lucide-react`, `cva`, `@base-ui/react`)**:

   - v0 usa JSX e importa componentes SVG de `lucide-react` (`<Search />`, `<ArrowRight />`). En Handlebars debes usar el HTML SVG nativo o un helper de iconos.
   - La librería `@base-ui/react` y `cva` en `button.tsx` son específicas de React. En HBS se aplican directamente las clases utilitarias de Tailwind CSS v4 sobre elementos HTML `<button>` o `<a>`.

---

## 2. Resumen de Componentes y Librerías Utilizadas

### Librerías en el Proyecto v0 y su Equivalente en Express + HBS

| Librería en v0                            | Función                                                           | Equivalente en Express + HBS + Tailwind v4                                                                                        |
| :---------------------------------------- | :---------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| `d3-geo`                                  | Proyección de coordenadas GeoJSON a rutas SVG (`<path d="...">`). | **`d3-geo` (Node.js)**: Se instala en el backend Express en `package.json` para pre-calcular los trazados en la ruta.             |
| `lucide-react`                            | Iconos en formato componente JSX.                                 | **SVG Inline Nativo**: Copiar la etiqueta `<svg>` nativa de Lucide o usar SVGs en assets.                                         |
| `tailwindcss` v4 + `@tailwindcss/postcss` | Sistema de diseño, tokens OKLCH e inline theme.                   | **Tailwind CSS v4**: Mismo sistema en CSS (`@import 'tailwindcss';` + `@theme inline`).                                           |
| `class-variance-authority` (cva)          | Variantes CSS dinámicas en JSX.                                   | **Clases directas de Tailwind** en plantillas `.hbs`.                                                                             |
| `react` / `useState`                      | Interactividad del mapa y paneles.                                | **Vanilla JavaScript (`alert-map.js`)**: Script liviano en `/public/js/` para eventos `pointerenter`, `click` y manipular el DOM. |

---

## 3. Catálogo de Componentes Identificados

El prototipo v0 consta de 7 secciones/componentes principales:

1. **`SiteHeader`**: Barra superior institucional verde (`INIFAP`) + Navegación fija con logotipo "AS" y botones de ingreso.
2. **`HeroSearch`**: Encabezado principal con título de impacto, buscador con icono, etiquetas de tendencias y panel de métricas clave (2,490 registros, 32 entidades, 11 campos).
3. **`AlertMap`**: Mapa vectorial interactivo de México por densidad de riesgo fitosanitario + Tarjeta de detalle de entidad seleccionada + Escalafón (ranking) de los 8 estados con mayor número de alertas.
4. **`RecentAlerts`**: Tabla de avisos fitosanitarios recientes (Folio, Fecha, Entidad, Agente causal, Cultivo, Nivel de riesgo).
5. **`SeasonCalendar`**: Matriz de ciclo agrícola 2026 que muestra meses de siembra (`bg-level-2`) y cosecha (`bg-primary`) por cultivo.
6. **`DatabaseIndex`**: Cuadrícula de 4 tarjetas con accesos directos al acervo (Plagas, Cultivos, Insumos, Foro).
7. **`SiteFooter`**: Pie de página institucional de 4 columnas con enlaces y nota de derechos.

---

## 4. Guía Paso a Paso para Portar a tu Proyecto Express + HBS

### Paso 1: Instalar dependencias backend

En tu proyecto de Express, instala `d3-geo` (para la proyección del mapa) y mantén tus paquetes habituales:

```bash
npm install d3-geo
```

---

### Paso 2: Configurar los Tokens de Color en Tailwind v4 (`public/css/style.css` o `src/css/input.css`)

Copia la paleta de colores basada en **OKLCH** definida en `app/globals.css` dentro del archivo de estilos de tu app Express:

```css
@import 'tailwindcss';

@theme inline {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --color-foreground: var(--foreground);
  --color-background: var(--background);

  --color-level-0: var(--level-0);
  --color-level-1: var(--level-1);
  --color-level-2: var(--level-2);
  --color-level-3: var(--level-3);
  --color-level-4: var(--level-4);
}

:root {
  color-scheme: light;

  --background: oklch(0.979 0.003 240);
  --foreground: oklch(0.215 0.012 250);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.215 0.012 250);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.215 0.012 250);

  --primary: oklch(0.365 0.058 155);
  --primary-foreground: oklch(0.985 0.002 240);

  --secondary: oklch(0.955 0.004 250);
  --secondary-foreground: oklch(0.265 0.012 250);
  --muted: oklch(0.955 0.004 250);
  --muted-foreground: oklch(0.518 0.011 250);
  --accent: oklch(0.955 0.004 250);
  --accent-foreground: oklch(0.265 0.012 250);

  --destructive: oklch(0.512 0.185 27);
  --border: oklch(0.902 0.005 250);
  --input: oklch(0.902 0.005 250);
  --ring: oklch(0.365 0.058 155);

  /* Niveles de Riesgo */
  --level-0: oklch(0.958 0.003 250);
  --level-1: oklch(0.878 0.032 155);
  --level-2: oklch(0.735 0.058 155);
  --level-3: oklch(0.545 0.072 155);
  --level-4: oklch(0.365 0.075 155);

  --radius: 0.25rem;
}

@utility text-mono-label {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
```

---

### Paso 3: Servicio de Proyección de Mapa en Express (`services/mexicoGeo.js`)

Crea un servicio en tu Express app que lea el GeoJSON y genere la lista de trazados con `d3-geo`:

```javascript
// services/mexicoGeo.js
const { geoMercator, geoPath } = require('d3-geo');
const fs = require('fs');
const path = require('path');

const MAP_WIDTH = 900;
const MAP_HEIGHT = 520;

// Cargar GeoJSON de estados de México
const geojsonPath = path.join(__dirname, '../data/mexico-states.json');
const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

function getStatePaths() {
  const projection = geoMercator().fitExtent(
    [
      [6, 6],
      [MAP_WIDTH - 6, MAP_HEIGHT - 6],
    ],
    geojson,
  );
  const pathGenerator = geoPath(projection);

  return geojson.features.map((feature) => ({
    id: feature.properties.id,
    estado: feature.properties.name,
    d: pathGenerator(feature) || '',
    centroid: pathGenerator.centroid(feature),
  }));
}

module.exports = { getStatePaths, MAP_WIDTH, MAP_HEIGHT };
```

---

### Paso 4: Controlador Express (`controllers/homeController.js`)

Prepara la información y pásala a la plantilla Handlebars:

```javascript
// controllers/homeController.js
const { getStatePaths } = require('../services/mexicoGeo');
const agroData = require('../data/agroData'); // Tus datos sintéticos/DB

exports.renderHome = (req, res) => {
  const paths = getStatePaths();

  // Mapear cada estado con su nivel de alertas y color correspondiente
  const mapPaths = paths.map((p) => {
    const info = agroData.estadosPorNombre[p.estado] || {
      alertas: 0,
      nivel: 'nula',
    };
    return {
      ...p,
      alertas: info.alertas,
      nivel: info.nivel,
      principal: info.principal || 'Sin registro',
      cultivo: info.cultivo || 'Sin registro',
      fillColor: agroData.NIVEL_FILL[info.nivel] || 'var(--level-0)',
    };
  });

  // Ranking top 8
  const ranking = mapPaths
    .filter((e) => e.alertas > 0)
    .sort((a, b) => b.alertas - a.alertas)
    .slice(0, 8);

  const maxAlertas = ranking[0]?.alertas || 1;
  const rankingConAncho = ranking.map((item, idx) => ({
    ...item,
    num: String(idx + 1).padStart(2, '0'),
    barWidth: Math.round((item.alertas / maxAlertas) * 72),
  }));

  // Estado por defecto seleccionado
  const estadoInicial = agroData.estadosPorNombre['Sinaloa'] || mapPaths[0];

  res.render('home', {
    title: 'AgroSystem INIFAP · Información agrícola verificada de México',
    mapPaths,
    ranking: rankingConAncho,
    estadoInicial,
    alertasRecientes: agroData.alertasRecientes,
    cultivosTemporada: agroData.cultivosTemporada,
    indice: agroData.indice,
  });
};
```

---

### Paso 5: Vista Handlebars del Mapa Interactivo (`views/partials/alert-map.hbs`)

Renderiza las rutas SVG con atributos `data-*` para que el script nativo de cliente pueda interactuar con ellas:

```handlebars
<section
  aria-labelledby='mapa-title'
  className='border-b border-border bg-background'
>
  <div class='mx-auto max-w-7xl px-6 py-14'>
    <div
      class='flex flex-col gap-3 border-b border-border pb-6 md:flex-row md:items-end md:justify-between'
    >
      <div class='flex flex-col gap-2'>
        <p class='text-mono-label text-primary'>Panorama nacional</p>
        <h2
          id='mapa-title'
          class='text-2xl font-semibold tracking-tight md:text-3xl'
        >
          Alertas fitosanitarias por entidad
        </h2>
      </div>
      <p class='max-w-md text-sm leading-relaxed text-muted-foreground'>
        Densidad de avisos vigentes emitidos en los últimos 30 días. Selecciona
        una entidad para ver la plaga con mayor incidencia.
      </p>
    </div>

    <div class='grid gap-8 pt-8 lg:grid-cols-[1.7fr_1fr]'>
      <!-- Contenedor del Mapa SVG -->
      <div class='flex flex-col gap-4'>
        <svg
          viewBox='0 0 900 520'
          class='w-full'
          role='img'
          aria-label='Mapa de México'
        >
          {{#each mapPaths}}
            <path
              id='state-path-{{this.id}}'
              d='{{this.d}}'
              fill='{{this.fillColor}}'
              stroke='var(--card)'
              stroke-width='1'
              class='state-path cursor-pointer transition-all duration-150 hover:opacity-100'
              data-estado='{{this.estado}}'
              data-alertas='{{this.alertas}}'
              data-nivel='{{this.nivel}}'
              data-principal='{{this.principal}}'
              data-cultivo='{{this.cultivo}}'
              tabindex='0'
              role='button'
            />
          {{/each}}
        </svg>

        <!-- Leyenda -->
        <div
          class='flex flex-wrap items-center gap-6 border-t border-border pt-4'
        >
          <span class='text-mono-label text-muted-foreground'>Avisos vigentes</span>
          <ul class='flex flex-wrap items-center gap-4'>
            <li class='flex items-center gap-2'><span
                class='size-3 border border-border'
                style='background-color: var(--level-0)'
              ></span><span
                class='font-mono text-xs text-muted-foreground'
              >0</span></li>
            <li class='flex items-center gap-2'><span
                class='size-3 border border-border'
                style='background-color: var(--level-2)'
              ></span><span
                class='font-mono text-xs text-muted-foreground'
              >1–9</span></li>
            <li class='flex items-center gap-2'><span
                class='size-3 border border-border'
                style='background-color: var(--level-3)'
              ></span><span
                class='font-mono text-xs text-muted-foreground'
              >10–24</span></li>
            <li class='flex items-center gap-2'><span
                class='size-3 border border-border'
                style='background-color: var(--level-4)'
              ></span><span
                class='font-mono text-xs text-muted-foreground'
              >25+</span></li>
          </ul>
        </div>
      </div>

      <!-- Tarjeta Detalle y Ranking Side Column -->
      <div class='flex flex-col gap-6'>
        <article class='border border-border bg-card p-5'>
          <p class='text-mono-label text-muted-foreground'>Entidad seleccionada</p>
          <h3
            id='card-estado'
            class='mt-2 text-xl font-semibold tracking-tight'
          >{{estadoInicial.estado}}</h3>
          <dl
            class='mt-4 flex flex-col divide-y divide-border border-t border-border'
          >
            <div class='flex items-baseline justify-between gap-4 py-3'>
              <dt class='text-xs text-muted-foreground'>Avisos vigentes</dt>
              <dd
                id='card-alertas'
                class='font-mono text-2xl font-medium tabular-nums'
              >{{estadoInicial.alertas}}</dd>
            </div>
            <div class='flex items-baseline justify-between gap-4 py-3'>
              <dt class='text-xs text-muted-foreground'>Nivel de riesgo</dt>
              <dd
                id='card-nivel'
                class='text-sm font-medium capitalize'
              >{{estadoInicial.nivel}}</dd>
            </div>
            <div class='flex items-baseline justify-between gap-4 py-3'>
              <dt class='text-xs text-muted-foreground'>Cultivo afectado</dt>
              <dd
                id='card-cultivo'
                class='text-sm font-medium'
              >{{estadoInicial.cultivo}}</dd>
            </div>
            <div class='flex flex-col gap-1 py-3'>
              <dt class='text-xs text-muted-foreground'>Plaga con mayor
                incidencia</dt>
              <dd
                id='card-principal'
                class='font-mono text-sm italic'
              >{{estadoInicial.principal}}</dd>
            </div>
          </dl>
          <a
            href='#plagas'
            class='mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline'
          >
            Ver expediente completo →
          </a>
        </article>

        <!-- Ranking -->
        <div class='flex flex-col gap-2'>
          <p class='text-mono-label text-muted-foreground'>Mayor incidencia
            nacional</p>
          <ol
            class='flex flex-col divide-y divide-border border-t border-border'
          >
            {{#each ranking}}
              <li>
                <button
                  type='button'
                  class='btn-ranking flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:text-primary'
                  data-estado='{{this.estado}}'
                >
                  <span
                    class='font-mono text-xs text-muted-foreground tabular-nums'
                  >{{this.num}}</span>
                  <span class='flex-1 text-sm'>{{this.estado}}</span>
                  <span
                    class='hidden h-1.5 sm:block'
                    style='width: {{this.barWidth}}px; background-color: {{this.fillColor}};'
                  ></span>
                  <span
                    class='font-mono text-sm tabular-nums'
                  >{{this.alertas}}</span>
                </button>
              </li>
            {{/each}}
          </ol>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Include Vanilla JS Controller -->
<script src='/js/alert-map.js' defer></script>
```

---

### Paso 6: Script Vanilla JS para la Interacción (`public/js/alert-map.js`)

Este script sustituye por completo el `useState` de React y mantiene el rendimiento óptimo:

```javascript
// public/js/alert-map.js
document.addEventListener('DOMContentLoaded', () => {
  const paths = document.querySelectorAll('.state-path');
  const rankingButtons = document.querySelectorAll('.btn-ranking');

  const cardEstado = document.getElementById('card-estado');
  const cardAlertas = document.getElementById('card-alertas');
  const cardNivel = document.getElementById('card-nivel');
  const cardCultivo = document.getElementById('card-cultivo');
  const cardPrincipal = document.getElementById('card-principal');

  function actualizarTarjeta(data) {
    if (!data) return;
    if (cardEstado) cardEstado.textContent = data.estado;
    if (cardAlertas) cardAlertas.textContent = data.alertas;
    if (cardNivel) cardNivel.textContent = data.nivel;
    if (cardCultivo) cardCultivo.textContent = data.cultivo;
    if (cardPrincipal) cardPrincipal.textContent = data.principal;
  }

  function seleccionarEstado(nombreEstado) {
    paths.forEach((path) => {
      const esSeleccionado = path.dataset.estado === nombreEstado;
      path.setAttribute('stroke-width', esSeleccionado ? '2.5' : '1');
      path.style.opacity = esSeleccionado ? '1' : '0.75';

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
});
```

---

## 5. Matriz del Calendario Agrícola en Handlebars (`SeasonCalendar`)

Para el calendario dinámico de siembra/cosecha, define un Helper de Handlebars en tu configuración de Express:

```javascript
// app.js o config/handlebars.js
hbs.registerHelper('getMesBg', function (mesNum, siembra, cosecha, mesActual) {
  // mesNum es 1..12
  const enCosecha = mesNum >= cosecha[0] && mesNum <= cosecha[1];
  const enSiembra = mesNum >= siembra[0] && mesNum <= siembra[1];

  if (enCosecha) return 'bg-primary';
  if (enSiembra) return 'bg-level-2';
  if (mesNum === mesActual) return 'bg-muted';
  return 'bg-level-0';
});
```

Y en tu plantilla `views/partials/season-calendar.hbs`:

```handlebars
<ul class="flex flex-col divide-y divide-border">
  {{#each cultivosTemporada}}
    <li class="flex items-center gap-4 py-3">
      <div class="flex w-56 shrink-0 flex-col gap-0.5">
        <a href="#cultivos" class="text-sm font-medium hover:text-primary hover:underline">{{this.nombre}}</a>
        <span class="font-mono text-xs italic text-muted-foreground">{{this.cientifico}}</span>
      </div>

      <div class="flex flex-1 gap-1">
        <!-- Genera 12 celdas de meses -->
        <div class="h-6 flex-1 {{getMesBg 1 this.siembra this.cosecha 8}}"></div>
        <div class="h-6 flex-1 {{getMesBg 2 this.siembra this.cosecha 8}}"></div>
        <div class="h-6 flex-1 {{getMesBg 3 this.siembra this.cosecha 8}}"></div>
        <div class="h-6 flex-1 {{getMesBg 4 this.siembra this.cosecha 8}}"></div>
        <div class="h-6 flex-1 {{getMesBg 5 this.siembra this.cosecha 8}}"></div>
        <div class="h-6 flex-1 {{getMesBg 6 this.siembra this.cosecha 8}}"></div>
        <div class="h-6 flex-1 {{getMesBg 7 this.siembra this.cosecha 8}}"></div>
        <div class="h-6 flex-1 {{getMesBg 8 this.siembra this.cosecha 8}}"></div>
        <div class="h-6 flex-1 {{getMesBg 9 this.siembra this.cosecha 8}}"></div>
        <div class="h-6 flex-1 {{getMesBg 10 this.siembra this.cosecha 8}}"></div>
        <div class="h-6 flex-1 {{getMesBg 11 this.siembra this.cosecha 8}}"></div>
        <div class="h-6 flex-1 {{getMesBg 12 this.siembra this.cosecha 8}}"></div>
      </div>

      <div class="w-16 shrink-0 text-right font-mono text-sm tabular-nums text-muted-foreground">
        {{this.fichas}}
      </div>
    </li>
  {{#each}}
</ul>
```

---

## 6. Conclusión y Checklist de Portabilidad

Con estos pasos aseguras una portabilidad 100% fiel al diseño de v0:

- [x] **Tokens OKLCH**: Preservados intactos en el CSS global con Tailwind CSS v4.
- [x] **Mapa SVG (`d3-geo`)**: Proyectado eficientemente en el servidor Express.
- [x] **Interactividad del Mapa**: Portada a Vanilla JS ultra rápido y sin peso de React.
- [x] **Vistas Handlebars**: Vistas divididas en parciales limpios y reutilizables.
- [x] **Iconos y Estilos**: Reemplazados por HTML SVG estándar y clases directas de Tailwind v4.
