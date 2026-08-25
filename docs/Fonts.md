
# Guía de Tipografías y Especificación Tipográfica (fonts.md)

Este documento detalla el **sistema tipográfico completo** del proyecto **AgroSystem INIFAP**, especificando las familias de fuentes utilizadas, las opciones de importación web para tu proyecto **Express + HBS + Tailwind v4**, la configuración de variables CSS y la **matriz de uso sección por sección**.

---

## 1. Familias Tipográficas del Sistema

El diseño se basa en una combinación tipográfica técnica de alto contraste: una fuente Sans-serif moderna y limpia para el contenido general, y una fuente Monospaced (monoespaciada) para datos numéricos, códigos, etiquetas micro-técnicas y nombres científicos.

| Tipo de Fuente             | Familia Original (v0) | Alternativa Recomendada (Google Fonts)               | Uso Principal                                                                                                                                           |
| :------------------------- | :-------------------- | :--------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Principal (Sans)** | `Geist Sans`        | `Inter` / `Outfit` / `Roboto`                  | Títulos principales, subtítulos, textos de párrafo, navegación, botones y descripciones.                                                            |
| **Técnica (Mono)**  | `Geist Mono`        | `JetBrains Mono` / `Fira Code` / `Roboto Mono` | Números tabulares, folios, fechas, datos numéricos de mapas/métricas, etiquetas técnicas (`.text-mono-label`) y nombres científicos en itálica. |

---

## 2. Métodos de Importación e Integración CSS

### Opción A: Importación mediante Google Fonts (Recomendado para Express + HBS)

Agrega el siguiente bloque de enlaces `<link>` dentro de la etiqueta `<head>` de tu plantilla principal `views/layouts/main.hbs`:

```html
<!-- Importación de Google Fonts: Geist Sans y Geist Mono (o Inter y JetBrains Mono) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

### Opción B: Declaración e Importación en el archivo CSS (`public/css/style.css`)

Si prefieres usar `@import` directamente dentro de tu archivo CSS compilado con Tailwind v4:

```css
@import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&family=Geist:wght@400;500;600;700&display=swap');
@import 'tailwindcss';

@theme inline {
  /* Definición de tokens tipográficos */
  --font-sans: 'Geist', 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace;
}

/* Utilidad para etiquetas de micro-datos técnicos superiores */
@utility text-mono-label {
  font-family: var(--font-mono);
  font-size: 0.6875rem; /* 11px */
  letter-spacing: 0.1em; /* Tracking amplio */
  text-transform: uppercase;
}
```

---

## 3. Matriz de Uso de Fuentes por Componente y Sección

A continuación se desglosa exactamente qué fuente, tamaño, peso y clases utilitarias de Tailwind v4 se aplican en cada parte del diseño:

### 1. Encabezado Global (`SiteHeader`)

- **Franja Institucional Superior (Texto INIFAP)**: `Geist Mono` · `11px (0.6875rem)` · Regular · Uppercase · Clases: `text-mono-label opacity-90`
- **Timestamp de actualización**: `Geist Mono` · `11px` · Regular · Uppercase · Clases: `text-mono-label opacity-70`
- **Insignia del Logo ("AS")**: `Geist Mono` · `14px (0.875rem)` · Semi-bold (`font-semibold`) · Clases: `font-mono text-sm font-semibold`
- **Título de Marca ("AgroSystem INIFAP")**: `Geist Sans` · `14px` · Semi-bold · Clases: `text-sm font-semibold tracking-tight`
- **Subtítulo de Marca ("Sistema Nacional de Consulta")**: `Geist Mono` · `11px` · Regular · Uppercase · Clases: `text-mono-label text-muted-foreground`
- **Enlaces de Navegación ("Inicio", "Plagas", etc.)**: `Geist Sans` · `14px` · Medium (`font-medium`) · Clases: `text-sm font-medium`

---

### 2. Sección Principal de Búsqueda (`HeroSearch`)

- **Etiqueta Superior de Subsección**: `Geist Mono` · `11px` · Regular · Uppercase · Clases: `text-mono-label text-primary`
- **Título H1 ("Consulta la sanidad vegetal...")**: `Geist Sans` · `36px a 48px` · Semi-bold · Tight · Clases: `text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl`
- **Párrafo Descriptivo**: `Geist Sans` · `14px` · Regular · Leading relaxed · Clases: `text-sm leading-relaxed text-muted-foreground`
- **Campo de Búsqueda Input**: `Geist Sans` · `14px` · Regular · Clases: `text-sm placeholder:text-muted-foreground`
- **Etiqueta "Consultas frecuentes"**: `Geist Mono` · `11px` · Regular · Uppercase · Clases: `text-mono-label text-muted-foreground`
- **Tags / Chips de Tendencias**: `Geist Sans` · `12px (0.75rem)` · Regular · Clases: `text-xs text-muted-foreground`
- **Valores Numéricos de Métricas (`2,490`, `32`, `11`)**: `Geist Mono` · `24px (1.5rem)` · Medium · Números Tabulares · Clases: `font-mono text-2xl font-medium tabular-nums`
- **Etiquetas de Métricas ("Registros verificados", etc.)**: `Geist Sans` · `12px` · Regular · Clases: `text-xs text-muted-foreground`

---

### 3. Mapa de Alertas e Incidentes (`AlertMap`)

- **Subtítulo "Panorama nacional"**: `Geist Mono` · `11px` · Regular · Uppercase · Clases: `text-mono-label text-primary`
- **Título H2 ("Alertas fitosanitarias por entidad")**: `Geist Sans` · `24px a 30px` · Semi-bold · Clases: `text-2xl font-semibold tracking-tight md:text-3xl`
- **Badge "Entidad seleccionada"**: `Geist Mono` · `11px` · Regular · Uppercase · Clases: `text-mono-label text-muted-foreground`
- **Nombre de Estado Seleccionado H3 ("Sinaloa")**: `Geist Sans` · `20px (1.25rem)` · Semi-bold · Clases: `text-xl font-semibold tracking-tight`
- **Cifra de Avisos Vigentes**: `Geist Mono` · `24px` · Medium · Tabular · Clases: `font-mono text-2xl font-medium tabular-nums`
- **Nivel de Riesgo ("Alta", "Media")**: `Geist Sans` · `14px` · Medium · Clases: `text-sm font-medium`
- **Nombre Científico de Plaga Incidente**: `Geist Mono` · `14px` · Itálica (`italic`) · Clases: `font-mono text-sm italic`
- **Rangos de Leyenda del Mapa ("0", "1–9", "10–24", "25+")**: `Geist Mono` · `12px` · Regular · Clases: `font-mono text-xs text-muted-foreground`
- **Número de Posición en Ranking ("01", "02")**: `Geist Mono` · `12px` · Regular · Tabular · Clases: `font-mono text-xs tabular-nums`
- **Nombre de Estado en Ranking**: `Geist Sans` · `14px` · Regular · Clases: `text-sm`
- **Cifra de Alertas en Ranking**: `Geist Mono` · `14px` · Regular · Tabular · Clases: `font-mono text-sm tabular-nums`

---

### 4. Tabla de Avisos Recientes (`RecentAlerts`)

- **Encabezados de Columna (`Folio`, `Fecha`, `Entidad`, etc.)**: `Geist Mono` · `11px` · Regular · Uppercase · Clases: `text-mono-label text-muted-foreground`
- **Folio de Alerta (`SNVF-2026-0841`)**: `Geist Mono` · `12px` · Regular · Clases: `font-mono text-xs text-muted-foreground`
- **Fecha (`22 AGO`)**: `Geist Mono` · `12px` · Regular · Tabular · Clases: `font-mono text-xs tabular-nums`
- **Entidad Federativa**: `Geist Sans` · `14px` · Medium · Clases: `text-sm font-medium`
- **Nombre Científico en Tabla**: `Geist Mono` · `14px` · Itálica · Clases: `font-mono text-sm italic`
- **Nombre Común de Plaga**: `Geist Sans` · `12px` · Regular · Clases: `text-xs text-muted-foreground`
- **Badge de Nivel ("ALTA", "MEDIA", "BAJA")**: `Geist Mono` · `11px` · Regular · Uppercase · Clases: `text-mono-label text-destructive`

---

### 5. Calendario del Ciclo Agrícola (`SeasonCalendar`)

- **Subtítulo "Ciclo agrícola 2026"**: `Geist Mono` · `11px` · Regular · Uppercase · Clases: `text-mono-label text-primary`
- **Leyenda "Siembra" / "Cosecha"**: `Geist Mono` · `12px` · Regular · Clases: `font-mono text-xs text-muted-foreground`
- **Abreviatura de Meses (`E`, `F`, `M`, ...)**: `Geist Mono` · `12px` · Regular / Semi-bold en mes actual · Clases: `font-mono text-xs`
- **Nombre de Cultivo**: `Geist Sans` · `14px` · Medium · Clases: `text-sm font-medium`
- **Nombre Científico de Cultivo (`Zea mays`)**: `Geist Mono` · `12px` · Itálica · Clases: `font-mono text-xs italic text-muted-foreground`
- **Número de Fichas**: `Geist Mono` · `14px` · Regular · Tabular · Clases: `font-mono text-sm tabular-nums`

---

### 6. Tarjetas de Acervo e Índice (`DatabaseIndex`)

- **Cifra Numérica Principal (`1,240`, `450`, `800`)**: `Geist Mono` · `30px (1.875rem)` · Medium · Tabular · Clases: `font-mono text-3xl font-medium tabular-nums`
- **Unidad de Medida ("fichas", "paquetes")**: `Geist Mono` · `11px` · Regular · Uppercase · Clases: `text-mono-label text-muted-foreground`
- **Título de Tarjeta H3**: `Geist Sans` · `14px` · Semi-bold · Clases: `text-sm font-semibold tracking-tight`
- **Descripción de Tarjeta**: `Geist Sans` · `12px` · Regular · Leading relaxed · Clases: `text-xs leading-relaxed text-muted-foreground`

---

### 7. Pie de Página (`SiteFooter`)

- **Títulos de Columna ("Consulta", "Institucional", "Servicios")**: `Geist Mono` · `11px` · Regular · Uppercase · Clases: `text-mono-label opacity-60`
- **Enlaces de Pie de Página**: `Geist Sans` · `12px` · Regular · Clases: `text-xs opacity-80`
- **Textos de Sincronización y Derechos**: `Geist Mono` · `11px` · Regular · Uppercase · Clases: `text-mono-label opacity-60`

---

## 4. Resumen de Clases de Tailwind CSS v4 para Fuentes

| Propósito                             | Clases de Tailwind v4            | Efecto Tipográfico                                                                        |
| :------------------------------------- | :------------------------------- | :----------------------------------------------------------------------------------------- |
| **Fuente Sans Por Defecto**      | `font-sans`                    | Aplica la familia`Geist` o `Inter`.                                                    |
| **Fuente Monoespaciada**         | `font-mono`                    | Aplica la familia`Geist Mono` o `JetBrains Mono`.                                      |
| **Etiqueta Micro-Técnica**      | `text-mono-label`              | Fuente Mono, 11px (0.6875rem), mayúsculas y espaciado amplio (`letter-spacing: 0.1em`). |
| **Nombre Científico**           | `font-mono italic`             | Fuente Mono en itálica para términos en latín (ej.*Spodoptera frugiperda*).           |
| **Cifras Alineadas / Tabulares** | `tabular-nums`                 | Garantiza que los números (0-9) tengan el mismo ancho visual en tablas y contadores.      |
| **Títulos de Alto Impacto**     | `font-semibold tracking-tight` | Peso 600 con espaciado entre letras ligeramente contraído para estética moderna.         |
