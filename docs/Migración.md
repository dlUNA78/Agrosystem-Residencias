
# Guía Técnica de Portabilidad y Diseño: Sección Catálogo de Plagas (`/plagas`)

## De React/Next.js a Express.js + Handlebars (HBS) + Tailwind CSS v4

Esta guía está redactada exclusivamente para replicar con máxima precisión el diseño, interacción, efectos visuales y sistema tipográfico de la vista **/plagas (Catálogo de Plagas de AgroSystem INIFAP)** en tu proyecto de **Express + HBS + Tailwind CSS v4**.

---

## 1. Especificación Tipográfica por Elemento UI (`/plagas`)

Para garantizar la fidelidad 1:1, a continuación se desglosa la **fuente exacta, peso, tamaño y clases utilitarias de Tailwind v4** para cada elemento de la pantalla de `/plagas`:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Geist Sans (sans-serif)      --> Títulos, párrafos, opciones, links     │
│ Geist Mono (monospace)       --> Datos, números, etiquetas, itálica     │
└─────────────────────────────────────────────────────────────────────────┘
```

| Elemento UI en`/plagas`                                | Familia Tipográfica | Peso / Estilo            | Tamaño / Interlineado | Clases de Tailwind v4                                                   |
| :------------------------------------------------------- | :------------------- | :----------------------- | :--------------------- | :---------------------------------------------------------------------- |
| **Top Banner "INIFAP"**                            | `Geist Mono`       | Regular · Uppercase     | 11px (`0.6875rem`)   | `text-mono-label opacity-90`                                          |
| **Título Marca "AgroSystem INIFAP"**              | `Geist Sans`       | Semi-bold (600)          | 14px (`0.875rem`)    | `text-sm font-semibold tracking-tight`                                |
| **Subtítulo Marca**                               | `Geist Mono`       | Regular · Uppercase     | 11px (`0.6875rem`)   | `text-mono-label text-muted-foreground`                               |
| **Enlace Navbar Activo ("Plagas")**                | `Geist Sans`       | Medium (500)             | 14px (`0.875rem`)    | `rounded-full bg-primary text-sm font-medium text-primary-foreground` |
| **Enlaces Navbar Inactivos**                       | `Geist Sans`       | Regular (400)            | 14px (`0.875rem`)    | `rounded-full text-sm text-muted-foreground hover:bg-muted`           |
| **Subtítulo de Sección ("Base de datos...")**    | `Geist Mono`       | Regular · Uppercase     | 11px (`0.6875rem`)   | `text-mono-label text-primary`                                        |
| **Título H1 ("Catálogo de Plagas")**             | `Geist Sans`       | Semi-bold (600)          | 36px–48px             | `text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl`    |
| **Párrafo Descriptivo de Entrada**                | `Geist Sans`       | Regular (400)            | 14px (`0.875rem`)    | `max-w-xl text-sm leading-relaxed text-muted-foreground`              |
| **Cifras de Métricas (`8`, `3`)**             | `Geist Mono`       | Medium (500) · Tabular  | 30px (`1.875rem`)    | `font-mono text-3xl font-medium tabular-nums`                         |
| **Etiqueta Métricas ("Especies...")**             | `Geist Mono`       | Regular · Uppercase     | 11px (`0.6875rem`)   | `text-mono-label text-muted-foreground`                               |
| **Input de Búsqueda (Placeholder/Texto)**         | `Geist Sans`       | Regular (400)            | 14px (`0.875rem`)    | `text-sm placeholder:text-muted-foreground`                           |
| **Dropdowns Select (`Categoría`, `Región`)** | `Geist Sans`       | Regular (400)            | 14px (`0.875rem`)    | `text-sm text-foreground`                                             |
| **Contador de Especies Encontradas**               | `Geist Mono`       | Regular · Uppercase     | 11px (`0.6875rem`)   | `text-mono-label text-muted-foreground`                               |
| **Boton "Limpiar Filtros"**                        | `Geist Sans`       | Medium (500)             | 12px (`0.75rem`)     | `text-xs font-medium text-primary`                                    |
| **Badge de Riesgo en Tarjeta**                     | `Geist Mono`       | Regular · Uppercase     | 11px (`0.6875rem`)   | `text-mono-label text-foreground`                                     |
| **Taxonomía ("INSECTO — HEMIPTERA:...")**        | `Geist Mono`       | Regular · Uppercase     | 11px (`0.6875rem`)   | `text-mono-label text-muted-foreground`                               |
| **Nombre Común de Plaga H3**                      | `Geist Sans`       | Semi-bold (600)          | 18px (`1.125rem`)    | `text-lg font-semibold leading-tight tracking-tight`                  |
| **Nombre Científico (*Schizaphis...*)**         | `Geist Mono`       | **Itálica** (400) | 12px (`0.75rem`)     | `font-mono text-xs italic text-muted-foreground`                      |
| **Descripción de Plaga (3 líneas)**              | `Geist Sans`       | Regular (400)            | 14px (`0.875rem`)    | `line-clamp-3 text-sm leading-relaxed text-muted-foreground`          |
| **Chips/Tags de Cultivos**                         | `Geist Sans`       | Regular (400)            | 12px (`0.75rem`)     | `text-xs text-muted-foreground border border-border`                  |
| **Etiqueta "Umbral Económico"**                   | `Geist Mono`       | Regular · Uppercase     | 11px (`0.6875rem`)   | `text-mono-label text-muted-foreground`                               |
| **Valor de Umbral Económico**                     | `Geist Sans`       | Medium (500)             | 12px (`0.75rem`)     | `text-xs font-medium`                                                 |

---

## 2. El Efecto de Fusión al Hacer Scroll ("Sticky Scroll Fusion")

El secreto del diseño radica en la interacción entre **dos elementos pegajosos** (`sticky`) con fondo de cristal translúcido y desenfoque (`backdrop-blur`):

```
┌────────────────────────────────────────────────────────────────────────┐
│ SiteHeader (Navbar)      --> sticky top-0 z-50 (Altura: 104px)         │
├────────────────────────────────────────────────────────────────────────┤
│ Toolbar Filtros / Plagas --> sticky top-[104px] z-30                   │
│                              (Se engancha a 104px al deslizar)         │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Header Principal (`SiteHeader`)**:
   - `sticky top-0 z-50`
   - `bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80`
   - Ocupa una altura fija de **$104\text{px}$** al desplazarse por la pantalla.
2. **Barra de Búsqueda y Filtros (`PestCatalog`)**:
   - `sticky top-[104px] z-30 -mx-6 mb-8 border-b border-border bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80`
   - Al hacer *scroll down*, la barra de filtros sube hasta encontrar la parte inferior del Navbar ($104\text{px}$). En ese momento se detiene y se acopla justo debajo, creando una doble cabecera de cristal translúcido continuo ("efecto fusión").

---

## 3. Configuración de Tokens de Color OKLCH en Tailwind v4

Asegúrate de agregar los tokens de riesgo específicos del catálogo en tu CSS principal (`public/css/style.css`):

```css
@import 'tailwindcss';

@theme inline {
  --font-sans: 'Geist', 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', monospace;

  --color-border: var(--border);
  --color-input: var(--input);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-card: var(--card);
  --color-background: var(--background);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);

  /* Tokens de Nivel de Riesgo para el Catálogo de Plagas */
  --color-risk-critico: var(--risk-critico);
  --color-risk-alto: var(--risk-alto);
  --color-risk-moderado: var(--risk-moderado);
  --color-risk-bajo: var(--risk-bajo);
}

:root {
  color-scheme: light;

  --background: oklch(0.979 0.003 240);
  --foreground: oklch(0.215 0.012 250);
  --card: oklch(1 0 0);
  --border: oklch(0.902 0.005 250);
  --input: oklch(0.902 0.005 250);

  --primary: oklch(0.365 0.058 155);
  --primary-foreground: oklch(0.985 0.002 240);
  --muted: oklch(0.955 0.004 250);
  --muted-foreground: oklch(0.518 0.011 250);

  /* Paleta OKLCH para Nivel de Riesgo de Plagas */
  --risk-critico: oklch(0.512 0.185 27);     /* Rojo crítico */
  --risk-alto: oklch(0.705 0.155 62);       /* Naranja advertencia */
  --risk-moderado: oklch(0.545 0.072 155);   /* Verde medio */
  --risk-bajo: oklch(0.6 0.011 250);         /* Gris neutro */

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

## 4. Implementación Completa en Express + Handlebars

### A. Controlador Express (`controllers/plagasController.js`)

```javascript
// controllers/plagasController.js
const agroData = require('../data/agroData');

exports.renderPlagas = (req, res) => {
  const { q, categoria, region, riesgo } = req.query;

  let resultados = [...agroData.plagas];

  // 1. Filtrado por término libre
  if (q && q.trim()) {
    const term = q.trim().toLowerCase();
    resultados = resultados.filter(
      (p) =>
        p.nombreComun.toLowerCase().includes(term) ||
        p.cientifico.toLowerCase().includes(term) ||
        p.familia.toLowerCase().includes(term) ||
        p.orden.toLowerCase().includes(term) ||
        p.cultivos.some((c) => c.toLowerCase().includes(term))
    );
  }

  // 2. Filtros por dropdowns
  if (categoria && categoria !== 'Todas') {
    resultados = resultados.filter((p) => p.categoria === categoria);
  }

  if (region && region !== 'todas') {
    resultados = resultados.filter((p) => p.region === region);
  }

  if (riesgo && riesgo !== 'todos') {
    resultados = resultados.filter((p) => p.riesgo === riesgo);
  }

  const totalCriticas = agroData.plagas.filter((p) => p.riesgo === 'crítico').length;
  const tieneFiltros = Boolean(q || (categoria && categoria !== 'Todas') || (region && region !== 'todas') || (riesgo && riesgo !== 'todos'));

  res.render('plagas', {
    title: 'Catálogo de Plagas · AgroSystem INIFAP',
    isPlagas: true,
    plagas: resultados,
    totalPlagas: agroData.plagas.length,
    totalCriticas,
    totalEncontradas: resultados.length,
    query: q || '',
    categoria: categoria || 'Todas',
    region: region || 'todas',
    riesgo: riesgo || 'todos',
    tieneFiltros,
  });
};
```

---

### B. Plantilla Handlebars Completa (`views/plagas.hbs`)

```handlebars
<!-- Navbar Flotante Glassmorphic -->
<header id="inicio" class="sticky top-0 z-50">
  <div class="bg-primary text-primary-foreground">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-6 py-2">
      <p class="text-mono-label flex items-center gap-2 opacity-90">
        <span aria-hidden="true" class="inline-block size-1.5 animate-pulse rounded-full bg-level-1"></span>
        Instituto Nacional de Investigaciones Forestales, Agrícolas y Pecuarias
      </p>
      <p class="text-mono-label opacity-70">Actualizado 22.08.2026 · 06:00 h (CDMX)</p>
    </div>
  </div>

  <div class="border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
    <div class="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-3.5">
      <a href="/" class="flex items-center gap-3">
        <span aria-hidden="true" class="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.4 19 2c1 2 2 4.12 2 9a7 7 0 0 1-10 9z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
        </span>
        <span class="flex flex-col leading-tight">
          <span class="text-sm font-semibold tracking-tight">AgroSystem INIFAP</span>
          <span class="text-mono-label text-muted-foreground">Sistema Nacional de Consulta</span>
        </span>
      </a>

      <nav aria-label="Navegación principal" class="hidden items-center gap-1 rounded-full border border-border bg-background/60 p-1 lg:flex">
        <a href="/" class="rounded-full px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Inicio</a>
        <a href="/plagas" class="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">Plagas</a>
        <a href="/#cultivos" class="rounded-full px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Cultivos</a>
        <a href="/#productos" class="rounded-full px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Productos</a>
        <a href="/#foro" class="rounded-full px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Foro</a>
      </nav>

      <div class="flex items-center gap-1.5">
        <a href="/ingresar" class="hidden px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted sm:inline-flex">Ingresar</a>
        <a href="/registro" class="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Registrarse</a>
      </div>
    </div>
  </div>
</header>

<!-- Área Principal del Catálogo de Plagas -->
<main>
  <section aria-labelledby="catalogo-title" class="bg-background">
    <div class="mx-auto max-w-7xl px-6 py-12 md:py-16">
    
      <!-- Encabezado de la Sección -->
      <div class="grid gap-8 border-b border-border pb-10 md:grid-cols-[1.7fr_1fr] md:items-end">
        <div class="flex flex-col gap-4">
          <p class="text-mono-label text-primary">Base de datos científica</p>
          <h1 id="catalogo-title" class="text-4xl font-semibold leading-[1.05] tracking-tight text-balance md:text-5xl">
            Catálogo de Plagas
          </h1>
          <p class="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Enciclopedia especializada de agentes biológicos de importancia agrícola. Información técnica verificada para la gestión inteligente de cultivos y el manejo integrado.
          </p>
        </div>

        <dl class="flex divide-x divide-border border border-border">
          <div class="flex flex-1 flex-col gap-1 px-4 py-4">
            <dd class="font-mono text-3xl font-medium tabular-nums">{{totalPlagas}}</dd>
            <dt class="text-mono-label text-muted-foreground">Especies registradas</dt>
          </div>
          <div class="flex flex-1 flex-col gap-1 px-4 py-4">
            <dd class="font-mono text-3xl font-medium tabular-nums">{{totalCriticas}}</dd>
            <dt class="text-mono-label text-muted-foreground">Nivel crítico</dt>
          </div>
        </dl>
      </div>

      <!-- BARRA DE FILTROS PEGAJOSA CON EFECTO DE FUSIÓN (sticky top-[104px]) -->
      <div class="sticky top-[104px] z-30 -mx-6 mb-8 border-b border-border bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <form action="/plagas" method="GET" id="form-filtros">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
          
            <!-- Campo de Búsqueda -->
            <div class="relative flex-1">
              <svg class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                id="buscar-plaga"
                name="q"
                type="search"
                value="{{query}}"
                placeholder="Buscar por nombre, género, familia o cultivo…"
                class="h-10 w-full border border-input bg-background pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25"
              />
            </div>

            <!-- Dropdowns de Filtrado -->
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-auto lg:flex">
            
              <!-- Filtro Categoría -->
              <div class="relative lg:w-40">
                <select name="categoria" onchange="document.getElementById('form-filtros').submit()" class="h-10 w-full appearance-none border border-input bg-background px-3 pr-8 text-sm outline-none transition-colors focus-visible:border-primary">
                  <option value="Todas" {{#if (eq categoria 'Todas')}}selected{{/if}}>Categoría · Todas</option>
                  <option value="Insecto" {{#if (eq categoria 'Insecto')}}selected{{/if}}>Insecto</option>
                  <option value="Hongo" {{#if (eq categoria 'Hongo')}}selected{{/if}}>Hongo</option>
                  <option value="Oomiceto" {{#if (eq categoria 'Oomiceto')}}selected{{/if}}>Oomiceto</option>
                  <option value="Bacteria" {{#if (eq categoria 'Bacteria')}}selected{{/if}}>Bacteria</option>
                  <option value="Ácaro" {{#if (eq categoria 'Ácaro')}}selected{{/if}}>Ácaro</option>
                </select>
              </div>

              <!-- Filtro Región -->
              <div class="relative lg:w-40">
                <select name="region" onchange="document.getElementById('form-filtros').submit()" class="h-10 w-full appearance-none border border-input bg-background px-3 pr-8 text-sm outline-none transition-colors focus-visible:border-primary">
                  <option value="todas" {{#if (eq region 'todas')}}selected{{/if}}>Región · Todas</option>
                  <option value="Noroeste" {{#if (eq region 'Noroeste')}}selected{{/if}}>Noroeste</option>
                  <option value="Bajío" {{#if (eq region 'Bajío')}}selected{{/if}}>Bajío</option>
                  <option value="Centro" {{#if (eq region 'Centro')}}selected{{/if}}>Centro</option>
                  <option value="Golfo" {{#if (eq region 'Golfo')}}selected{{/if}}>Golfo</option>
                  <option value="Sur-Sureste" {{#if (eq region 'Sur-Sureste')}}selected{{/if}}>Sur-Sureste</option>
                </select>
              </div>

              <!-- Filtro Riesgo -->
              <div class="relative lg:w-40">
                <select name="riesgo" onchange="document.getElementById('form-filtros').submit()" class="h-10 w-full appearance-none border border-input bg-background px-3 pr-8 text-sm outline-none transition-colors focus-visible:border-primary">
                  <option value="todos" {{#if (eq riesgo 'todos')}}selected{{/if}}>Riesgo · Todos</option>
                  <option value="crítico" {{#if (eq riesgo 'crítico')}}selected{{/if}}>Crítico</option>
                  <option value="alto" {{#if (eq riesgo 'alto')}}selected{{/if}}>Alto</option>
                  <option value="moderado" {{#if (eq riesgo 'moderado')}}selected{{/if}}>Moderado</option>
                  <option value="bajo" {{#if (eq riesgo 'bajo')}}selected{{/if}}>Bajo</option>
                </select>
              </div>

            </div>
          </div>

          <!-- Barra de Estado de Filtros -->
          <div class="mt-3 flex items-center justify-between gap-4">
            <p class="text-mono-label flex items-center gap-2 text-muted-foreground">
              {{totalEncontradas}} especies encontradas
            </p>
            {{#if tieneFiltros}}
              <a href="/plagas" class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                ✕ Limpiar filtros
              </a>
            {{/if}}
          </div>
        </form>
      </div>

      <!-- REJILLA DE TARJETAS DE PLAGA (PESTCARD) -->
      {{#if plagas.length}}
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {{#each plagas}}
            <article class="group flex flex-col border border-border bg-card transition-colors hover:border-primary/40">
            
              <!-- 1. Barra de Nivel de Riesgo Superior -->
              <div class="h-1 w-full {{#if (eq this.riesgo 'crítico')}}bg-risk-critico{{else if (eq this.riesgo 'alto')}}bg-risk-alto{{else if (eq this.riesgo 'moderado')}}bg-risk-moderado{{else}}bg-risk-bajo{{/if}}"></div>

              <!-- 2. Marco de Imagen con Filtro Verde INIFAP -->
              <div class="relative aspect-[4/3] overflow-hidden bg-primary">
                <img
                  src="{{this.imagen}}"
                  alt="{{this.nombreComun}}"
                  class="size-full object-cover grayscale contrast-[1.05] transition-transform duration-500 group-hover:scale-105"
                />
                <div aria-hidden="true" class="absolute inset-0 bg-primary opacity-55 mix-blend-color"></div>
                <div aria-hidden="true" class="absolute inset-0 bg-gradient-to-t from-primary/70 via-transparent to-transparent"></div>
              
                <!-- Badge de Riesgo (Top-Left) -->
                <div class="absolute left-3 top-3 flex items-center gap-1.5 bg-card/90 px-2 py-1 backdrop-blur">
                  <span aria-hidden="true" class="inline-block size-1.5 rounded-full {{#if (eq this.riesgo 'crítico')}}bg-risk-critico{{else if (eq this.riesgo 'alto')}}bg-risk-alto{{else if (eq this.riesgo 'moderado')}}bg-risk-moderado{{else}}bg-risk-bajo{{/if}}"></span>
                  <span class="text-mono-label text-foreground capitalize">{{this.riesgo}}</span>
                </div>
              </div>

              <!-- 3. Contenido de la Tarjeta -->
              <div class="flex flex-1 flex-col gap-3 p-5">
              
                <!-- Taxonomía -->
                <p class="text-mono-label text-muted-foreground">
                  {{this.categoria}} — {{this.orden}}: {{this.familia}}
                </p>

                <!-- Nombre Común + Nombre Científico -->
                <div class="flex flex-col gap-1">
                  <h3 class="text-lg font-semibold leading-tight tracking-tight text-balance">
                    {{this.nombreComun}}
                  </h3>
                  <p class="font-mono text-xs italic text-muted-foreground">{{this.cientifico}}</p>
                </div>

                <!-- Descripción corta -->
                <p class="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {{this.descripcion}}
                </p>

                <!-- Chips de Cultivos -->
                <div class="mt-1 flex flex-wrap gap-1.5">
                  {{#each this.cultivos}}
                    <span class="border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      {{this}}
                    </span>
                  {{/each}}
                </div>

                <!-- Pie de Tarjeta: Umbral + Enlace -->
                <div class="mt-auto flex items-end justify-between gap-4 border-t border-border pt-4">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-mono-label text-muted-foreground">Umbral económico</span>
                    <span class="text-xs font-medium">{{this.umbral}}</span>
                  </div>
                  <a href="/plagas/{{this.slug}}" class="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
                    Ficha técnica →
                  </a>
                </div>

              </div>
            </article>
          {{/each}}
        </div>
      {{else}}
        <!-- Estado Vacío sin Resultados -->
        <div class="flex flex-col items-center gap-3 border border-dashed border-border py-20 text-center">
          <p class="text-sm font-medium">No se encontraron especies con esos criterios.</p>
          <p class="max-w-sm text-sm text-muted-foreground">
            Ajusta la búsqueda o elimina algunos filtros para ampliar los resultados del catálogo.
          </p>
          <a href="/plagas" class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            ✕ Limpiar filtros
          </a>
        </div>
      {{/if}}

    </div>
  </section>
</main>
```

---

## 5. Checklist de Verificación para Portabilidad 1:1

- [X] **Tipografía Geist Sans / Mono**: Aplicada rigurosamente a títulos H1, sub-etiquetas `.text-mono-label`, nombres científicos en itálica monoespaciada y cifras numéricas.
- [X] **Fusión Sticky (`top-[104px]`)**: Barra de filtros anclada justo debajo del Navbar pegajoso con traslucidez `backdrop-blur`.
- [X] **Tokens OKLCH**: Paleta `--risk-critico`, `--risk-alto`, `--risk-moderado`, `--risk-bajo` en franja superior e insignias.
- [X] **Tratamiento de Imagen de Plaga**: Escala de grises con tinte verde INIFAP (`grayscale contrast-[1.05] bg-primary opacity-55 mix-blend-color`).
- [X] **Lógica de Filtros**: Integrada al controlador Express para responder dinámicamente mediante `req.query`.
