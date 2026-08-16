# Design System & UI Guidelines

## 1. Tipografía
- **Titulares y Textos Destacados:** `Oswald` (o alternativamente `Anton`). Fuentes pesadas y condensadas para lograr un diseño de alto impacto y estilo editorial.
- **Cuerpo de Texto y Enlaces (Navbar, botones):** `Inter`. Tipografía limpia y muy legible para balancear la carga visual de los titulares.

## 2. Paleta de Colores
- **Verde Principal (Brand):** Color verde del sistema (ej. `#43655c`), que debe usarse para acentos, botones primarios y resaltados textuales (contraste alto).
- **Blanco Puro (`#ffffff`):** Utilizado para textos sobre fondos oscuros/fotografías y para secciones de descanso visual.
- **Negro y Grises muy oscuros:** Utilizados para fondos, textos principales en fondos claros y overlays translúcidos sobre imágenes de hero, aportando un look moderno y "disruptivo".

## 3. Estilo de Interfaz (UI)
- **Minimalista y Alto Contraste:** Uso intensivo de contrastes fuertes (negro sobre blanco o blanco sobre negro/overlay oscuro) sin depender de cajas suaves o sombras excesivas.
- **Componentes Limpios:** Botones y tarjetas con bordes más rectos o curvas muy sutiles, eliminando el exceso de bordes y sombras para enfocarse en la tipografía y el contenido.
- **Imágenes de Alto Impacto (Hero):** Las fotografías deben ocupar grandes porciones de pantalla (ej. full screen/cover) actuando como fondo inmersivo. El Navbar debe posicionarse de manera transparente y superpuesta sobre estas imágenes.

## 4. Implementación Técnica
- **Tailwind CSS v4:** Toda la implementación de diseño debe realizarse exclusivamente a través de clases de utilidad de Tailwind.
- **Sin Scripts en Línea:** Cualquier interacción compleja en el diseño debe ser extraída a archivos JavaScript estáticos en la carpeta `public/js/`.