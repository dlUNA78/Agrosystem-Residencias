## 1. Arquitectura y Organización de Código (MVC)

- **Estricto patrón MVC:** El proyecto debe respetar la separación entre Modelos, Vistas y Controladores.
- **Principio de Responsabilidad Única:** Cada archivo debe cumplir una sola función. Si un archivo empieza a crecer excesivamente, sus funciones deben desglosarse en utilidades, helpers o middlewares independientes.
- **Cero código espagueti en Vistas:** Queda prohibido escribir lógica de JS del cliente dentro de los archivos `.hbs`. El JS de frontend vivirá en su carpeta correspondiente (`public/js/public/`, `public/js/private/` o `public/js/shared/`) y se enlazará al final del HTML.

## 2. Reglas de Diseño, Interfaz (UI) y UX

- **TailwindCSS v4:** Todos los estilos deben construirse utilizando únicamente las clases del compilador de Tailwind v4.
- **Fidelidad al Design System:** Se deben respetar estrictamente los colores, tipografías y componentes definidos en la guía de diseño (`Design.md`).
- **Gestión de Librerías UI:** Todo componente de terceros (tablas avanzadas, modales, iconos) **debe instalarse como dependencia con pnpm**.
  - ❌ _Prohibido:_ Pegar links de CDNs (`<link>` o `<script>`) en el HTML sin aprobación.
  - ✅ Al hacer un Commit o Pull Request que añada librerías, se debe **subrayar/destacar** el paquete instalado en la descripción.

## 3. Gestor de Paquetes (Estándar pnpm)

- **Uso exclusivo de pnpm:** Todo el equipo instalará y ejecutará comandos usando `pnpm` (ej. `pnpm add <paquete>`, `pnpm dev`).
- **Prohibido subir lockfiles cruzados:** Queda estrictamente prohibido subir `package-lock.json` o `yarn.lock`. El único archivo de bloqueo permitido en el repositorio es `pnpm-lock.yaml`.

## 4. Base de Datos (Sequelize ORM)

- **Cero cambios manuales en SQL:** Prohibido crear tablas o alterar columnas desde pgAdmin o consola SQL. Todo cambio estructural debe realizarse a través de **Migraciones de Sequelize**.
- **Sincronización:** Antes de programar o tras descargar (`git pull`) cambios del repositorio, se debe ejecutar `pnpm exec sequelize-cli db:migrate` para sincronizar la base local.

## 5. Convenciones de Nomenclatura (Naming Conventions)

- **Modelos:** Singular y PascalCase (Ej. `User.js`, `Plague.js`).
- **Controladores y Rutas:** camelCase (Ej. `userController.js`, `farmRoutes.js`).
- **Vistas (.hbs) y URLs:** kebab-case en minúsculas (Ej. `vista-perfil.hbs`, URL: `/registrar-cultivo`).

## 6. Seguridad y Variables de Entorno (.env)

- **Protección de credenciales:** El archivo `.env` nunca debe subirse a GitHub (debe estar en `.gitignore`).
- **Actualización de plantilla:** Si se añade una nueva variable de entorno (ej. API Key de mapas), se debe agregar la llave vacía en `.env.example` para que el resto del equipo la configure.

## 7. Manejo de Errores

- **Cero bloques `catch` vacíos:** Todo bloque `try...catch` debe registrar el error (`console.error(error)`) y mostrar una vista de error o alerta clara al usuario. Ninguna petición debe quedarse en espera infinita.

## 8. Commits Semánticos

Todos los mensajes de commit deben usar prefijos estandarizados:

- `feat:` Nuevas funcionalidades (Ej: _feat: agrega módulo de plagas e instala tabla UI_).
- `fix:` Corrección de errores (Ej: _fix: corrige error de sesión en el login_).
- `style:` Cambios visuales/CSS sin afectar la lógica (Ej: _style: actualiza botones según Design.md_).

## 9. Recursos y Vistas Compartidas (`shared/`)

- **Principio DRY (Don't Repeat Yourself):** Las vistas, componentes o JS de cliente que se utilicen tanto en la zona Pública como en la Privada (ej. catálogo de plagas, buscador) deben centralizarse en la carpeta `shared/`.
- **Control por permisos:** Las diferencias visuales entre público y privado dentro de la vista compartida se manejarán mediante condicionales en Handlebars (`{{#if user.isAdmin}}...{{/if}}`).

## 10. Flujo de Trabajo en Git (Branching & PRs)

- **Prohibido el commit directo a `main`:** Queda prohibido hacer `git push` directo sobre la rama principal.
- **Feature Branches:** Cada funcionalidad o corrección se trabajará en una rama independiente (Ej: `feature/devA-lands` o `feature/devB-plagues`).
- **Pull Requests (PR):** Al finalizar una tarea, se abrirá un PR en GitHub y el otro integrante del equipo deberá revisar el código antes de hacer el Merge.

## 11. Validación y Sanitización de Datos (Backend)

- **Validación del lado del servidor:** Nunca confiar únicamente en la validación HTML (`required`, `type="email"`). Todos los datos recibidos en `req.body` y `req.params` deben ser validados y sanitizados en el controlador antes de interactuar con el modelo de Sequelize.

## 12. Formateo Automático de Código (Linting & Prettier)

- **Estandarización de formato:** Se usará la extensión **Prettier** en VS Code con la opción _"Format on Save"_ activada en ambas computadoras. Esto garantiza que comillas, sangrías y espacios se mantengan idénticos independientemente de quién escriba el código.

## 13. Optimización de Archivos e Imágenes

- **Límite de peso en Backend:** Al configurar cargas de archivos (con `multer` o similares), se establecerá un peso máximo (ej. máximo 2MB a 5MB por imagen).
- **Consistencia de interfaz:** En las plantillas `.hbs`, todas las imágenes cargadas dinámicamente deberán incluir clases de Tailwind como `object-cover` y proporciones definidas (`aspect-square`, `w-full`) para evitar romper el diseño visual.

### 🛡️ PROTOCOLO ESTRICTO DE MODIFICACIÓN DE CÓDIGO (Reglas para el Agente)

CADA VEZ que modifiques, crees o elimines código en este repositorio, ESTÁS OBLIGADO a seguir este flujo secuencial. Está estrictamente prohibido dar por terminada una tarea sin antes completar todos estos pasos con éxito.

**PASO 1: Escribir o Actualizar Pruebas Primero (TDD)**

- Antes de modificar o crear lógica de negocio (controladores, modelos de Sequelize, rutas), debes crear o actualizar la prueba unitaria en la carpeta `/tests` utilizando Jest.

**PASO 2: Desarrollo del Código Fuente**

- Escribe el código necesario en el sistema para cumplir con los requerimientos, enfocado en hacer que la prueba del Paso 1 sea exitosa.

**PASO 3: Bucle de Ejecución y Auto-Sanación (Crítico)**

- Abre la terminal integrada y ejecuta obligatoriamente: `pnpm run test`
- **SI HAY ERRORES:** Lee el log de error en la terminal (`stderr`), analiza la falla, corrige tu propio código fuente y vuelve a ejecutar `pnpm run test`.
- **PROHIBICIÓN:** No te detengas, no dejes código roto y no pidas intervención humana si una prueba falla. Quedarás en este bucle hasta que la consola devuelva un resultado exitoso (verde).

**PASO 4: Calidad y Formato (Linting)**

- Una vez que las pruebas pasen, ejecuta en la terminal: `pnpm run format`
- Luego, ejecuta: `pnpm run lint`
- Si ESLint arroja advertencias o errores (por ejemplo, complejidad ciclomática mayor a 10, o variables no utilizadas), debes reestructurar tu código para solucionarlos.

**PASO 5: Cierre de la Tarea**

- Solo cuando los comandos `pnpm run test` y `pnpm run lint` se ejecuten limpiamente y sin errores, puedes detenerte y notificar que la modificación ha sido completada de manera segura.
