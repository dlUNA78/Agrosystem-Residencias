# Resumen de Cambios para el Proyecto (Desde Commit `0ea54b9`)

¡Hola! Este documento es una guía detallada de todas las implementaciones, refactorizaciones y nuevas características que se han integrado en el proyecto desde el commit del sistema de login (`0ea54b9bbb0730d3ba03b2b46a98bc7c9c8179d9`) hasta el estado actual de la rama.

Este documento está diseñado para ayudarte a entender la arquitectura actual, la nueva base de datos y cómo poner a correr el entorno de manera correcta.

---

## 1. Cambios Estructurales y Lógica (Backend)

### Autenticación, Sesiones y Flujo de Ascenso (Upgrade INIFAP)
Se integró todo un sistema de autenticación utilizando **Passport.js** y **Bcrypt** para el hash de contraseñas. Además, las sesiones se almacenan de manera persistente en PostgreSQL.

- **Vistas y Controladores de Auth**: Se crearon las vistas `login.hbs`, `register.hbs` y `upgrade.hbs`. La lógica vive en `src/controllers/authController.js`.
- **Niveles de Acceso (RBAC)**: Todos los usuarios nuevos se registran por defecto con el rol de `"agricultor"`.
- **Middlewares de Protección**: Se implementó `src/middlewares/authMiddleware.js` que cuenta con:
  - `isAuthenticated`: Bloquea acceso si el usuario no ha iniciado sesión.
  - `requirePanelAccess`: **Bloqueo estricto**. Solo usuarios con rol `"inifap"` o `"admin"` pueden entrar al panel privado (`/dashboard`).
- **Flujo de "Upgrade" (Canje de códigos)**:
  Para que un usuario `"agricultor"` pueda entrar al panel privado, debe canjear un código secreto de uso único en la ruta `/auth/upgrade`. Esto ejecutará una transacción segura en base de datos para:
  1. Invalidar/Quemar el código.
  2. Actualizar el rol del usuario a `"inifap"`.

### Refactorización de Controladores y Rutas Públicas
Anteriormente, teníamos un único archivo `publicController.js` que manejaba todas las vistas públicas. Esto se dividió en controladores específicos dentro de `src/controllers/public/`:
- **`homeController.js`**: Maneja la página de inicio (estadísticas, hilos recientes).
- **`plagueController.js`**: Maneja el catálogo de plagas (`/plagues`), la API dinámica de búsqueda (`/api/plagues`) y el detalle individual de cada plaga (`/plagues/:id`).
- **`cropController.js`**: Maneja los cultivos.
- **`productController.js`**: Maneja el listado y detalle de productos.
- **`forumController.js`**: Maneja la vista general del foro.

**Nuevas Rutas en `src/routes/publicRoutes.js`:**
Se agregaron endpoints individuales para soportar el detalle dinámico:
- `GET /api/plagues` (Para búsqueda dinámica con JavaScript en el frontend)
- `GET /plagues/:id` (Vista detallada de la plaga, con mapas de Leaflet)
- `GET /crops/:id`
- `GET /products/:id`

---

## 2. Base de Datos (Modelos y Migraciones)

El catálogo de plagas y la base de datos sufrieron un crecimiento masivo para soportar datos más biológicos y geográficos reales:

### Nuevos Campos Agregados:
- **Plagas (`Plague`) y Cultivos (`Crop`)**: Ahora tienen el campo `scientific_name` (Nombre Científico).
- **Detalles Biológicos de Plagas**: Se añadieron los campos `biological_cycle` (Ciclo biológico, en formato JSONB) y `biological_control` (Control biológico).
- **Sistema de Verificación INIFAP**: A las plagas se les agregó `verified_by` (Quién verificó) y `verified_at` (Cuándo se verificó) para darles validación institucional.

### Nuevas Tablas y Relaciones:
- **`PlagueImages`**: Se creó una tabla para soportar múltiples imágenes por plaga (usado para un carrusel de galería en la vista de detalle). Relación 1 a Muchos.
- **`PlagueProducts`**: Tabla pivote para relacionar Plagas con Productos directamente (N a N).
- **`Regions` y `PlagueRegions`**: Se agregó un sistema geográfico completo. Las `Regions` tienen latitud y longitud. `PlagueRegions` es la tabla intermedia que dice qué plagas están en qué regiones y su nivel de riesgo específico por región.

---

## 3. Interfaz de Usuario y Vistas (Frontend)

### Vista del Catálogo de Plagas (`plagues.hbs`)
- Se refactorizó por completo para soportar **búsqueda y filtrado dinámico**.
- En lugar de recargar la página para buscar, ahora se conecta mediante JavaScript al endpoint `/api/plagues` para buscar plagas en tiempo real.

### Vista de Detalle de Plaga (`plague-detail.hbs`)
Es la adición más grande en el frontend:
- **Mapas Interactivos**: Integra `Leaflet` para renderizar un mapa con las zonas geográficas de riesgo (Regiones de la plaga).
- **Carrusel de Imágenes**: Muestra la tabla `PlagueImages`.
- **Línea de Tiempo**: Muestra el ciclo biológico de la plaga gráficamente.
- **Productos Relacionados**: Muestra los productos ligados a la plaga usando la nueva tabla pivote.
- **Sello de Verificación**: Muestra si la información biológica está verificada institucionalmente.

### Scripts del Cliente (`public/js/public/`)
Se implementó una política de **cero scripts en línea**. Toda la lógica de las vistas está en archivos separados:
- `plagues.js`: Hace los fetch a `/api/plagues`, maneja el debounce (retraso en tipeo) y renderiza las tarjetas dinámicamente en el DOM.
- `plague-detail.js`: Inicializa los mapas de `Leaflet` (OpenStreetMap) usando las coordenadas de las regiones embebidas en el HTML, y maneja la interactividad del carrusel y pestañas.

---

## 4. Pasos para ejecutar el proyecto en tu PC

Debido a que hay muchas migraciones, nuevas tablas y seeders, **tu base de datos actual ya no funcionará con el código**. Debes resetearla siguiendo estos pasos estrictamente:

1. **Instalar nuevas dependencias (si aplica):**
   ```bash
   pnpm install
   ```
   *(Asegúrate de que estás usando pnpm)*

2. **Reconstruir CSS (Tailwind):**
   Si no ves los estilos actualizados, asegúrate de tener Tailwind corriendo:
   ```bash
   npm run dev:css
   ```
   *(O dejarlo corriendo en una terminal aparte mientras trabajas).*

3. **Resetear y sembrar la base de datos:**
   Este es el paso más importante. Necesitas tirar la DB actual y correr todas las migraciones y seeders nuevos en orden. Ejecuta el siguiente comando en tu terminal:
   ```bash
   npx sequelize-cli db:migrate:undo:all
   npx sequelize-cli db:migrate
   npx sequelize-cli db:seed:all
   ```
   *Nota:* Al correr los seeders, se insertarán automáticamente las regiones, imágenes, los datos biológicos, las relaciones de riesgo geográfico y todos los productos actualizados.

4. **Levantar el servidor:**
   ```bash
   npm run dev:server
   ```
   Revisa en tu navegador `http://localhost:3000/plagues` y entra al detalle de alguna de las plagas (como "Pulgón Verde" o "Gusano Cogollero") para que veas el mapa interactivo y toda la funcionalidad nueva en acción.

5. **Generar un código para el panel privado INIFAP (Upgrade):**
   Como los nuevos usuarios nacen siendo "agricultores", para probar el panel de administración (`/dashboard`) necesitarás un código. Para generarlo, abre una terminal en la raíz del proyecto y ejecuta el script de administración:
   ```bash
   node src/scripts/generateInifapCodes.js --count 1
   ```
   Este comando te devolverá un código (ej. `INIFAP-A3K9-7ZP2`). Luego:
   - Entra a `http://localhost:3000/auth/login` y crea un usuario.
   - Navega a `http://localhost:3000/auth/upgrade`.
   - Ingresa el código y el cargo que desees.
   - ¡Listo! Tu rol cambiará a `"inifap"` y serás redirigido al panel.

---

### Notas Adicionales para el Desarrollo
- Las nuevas vistas dinámicas pasan los datos desde el servidor al frontend usando etiquetas invisibles y parseando con `JSON.parse` dentro de los archivos estáticos JS. **Si necesitas agregar funcionalidad frontend, no uses `<script>` dentro de los `.hbs`.**
- Ahora estamos utilizando el estándar ES Modules (`import/export`) en todo el backend (Modelos, Controladores, Seeders y Migraciones). No uses `require` ni `.cjs`.

¡Cualquier duda técnica con respecto a las nuevas tablas o la API de Leaflet puedes consultarlo conmigo!
