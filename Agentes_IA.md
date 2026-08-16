
Guía de Estándares, Arquitectura y
Reglas del Proyecto:
Agrosystem-Residencias
Este documento especifica las normas arquitectónicas, de ciberseguridad, de estructuración de
código y de lógica de negocio que TODOS los desarrolladores y Agentes de IA deben
respetar estrictamente al colaborar en la plataforma Agrosystem-Residencias. La finalidad
de esta guía es evitar la acumulación de deuda técnica, mantener la coherencia del repositorio
y garantizar un desarrollo limpio bajo el patrón MVC.

1. Stack Tecnológico Estándar
   El proyecto está configurado bajo una infraestructura moderna y ligera. Todo desarrollo nuevo
   debe ajustarse exactamente a estas herramientas:
   Capa / Componente Tecnología Seleccionada Regla de Uso

Backend Node.js + Express 5 Sintaxis de ES Modules
("type": "module" en
package.json).

Gestor de Paquetes pnpm Obligatorio usar pnpm.
Prohibido usar npm o yarn.

Base de Datos & ORM PostgreSQL + Sequelize

ORM

Comandos ejecutados
siempre con pnpm exec
sequelize-cli ....

Motor de Vistas Express-Handlebars (.hbs) Renderizado del lado del
servidor (SSR). Cero lógica
de JS en la vista.

Capa / Componente Tecnología Seleccionada Regla de Uso

Estilos CSS TailwindCSS v4 Compilado mediante script
pnpm run dev:css.

Autenticación Passport.js (Local) +
connect-pg-simple

Sesiones persistentes
guardadas en PostgreSQL y
passwords con bcrypt.

2. Las 6 Reglas de Oro Inquebrantables
   Regla 1: Sintaxis Estricta de ES Modules (No CommonJS / No .cjs)
   Todo el código JavaScript del backend debe utilizar la sintaxis moderna import y export. Queda
   estrictamente prohibido el uso de require(), module.exports o crear archivos con extensión .cjs
   para evadir incompatibilidades del CLI de Sequelize. Las migraciones y seeders deben crearse
   con extensión .js utilizando export default { async up(...) }.
   Regla 2: Cero Etiquetas  en Vistas Handlebars (.hbs)
   Las plantillas Handlebars (.hbs) se limitan exclusivamente al marcado HTML y a la estructura
   SSR. Ningún agente o desarrollador debe escribir bloques de código JavaScript en línea (como
   inicialización de mapas de Leaflet, carruseles o event listeners) dentro de los archivos
   Handlebars.
   ● Toda la lógica de cliente debe guardarse en archivos externos bajo public/js/public/ o
   public/js/private/.
   ● Los scripts se vinculan a la vista desde el controlador enviando la variable extraScripts:
   extraScripts: ''
   Regla 3: Transferencia de Datos Frontend mediante Atributos HTML5
   (data-*)
   Para pasar información desde el servidor (Handlebars) hacia los scripts del cliente (JS
   estáticos), se debe usar el patrón de atributos data-* en el DOM. Prohibido inyectar JSON
   directamente en variables dentro de etiquetas script.

<!-- En la vista Handlebars (.hbs) -->

<div id="incidence-map" data-regions="{{incidenceRegionsJson}}"
data-risk="{{plague.risk_level}}"></div>
// En el archivo JavaScript externo (public/js/public/plague-detail.js)
const mapEl = document.getElementById('incidence-map');
const regions = JSON.parse(mapEl.dataset.regions || '[]');

Regla 4: Aislamiento de Seguridad en el Área Privada
En los controladores privados (privateController.js), toda consulta de lectura, creación,
actualización o eliminación DEBE incluir la restricción de usuario autenticado:
// Correcto: Aislamiento total de parcelas por usuario
const farms = await Farm.findAll({
where: {
user_id: req.user.id,
status: true
}
});

Regla 5: Separación de Lógica de Negocio (Catálogo Oficial vs
Monitoreo Privado)
Para evitar distorsiones en la información científica del INIFAP:
● Zona Pública (Catálogo Oficial): Lee exclusivamente de las tablas autorizadas por el
Administrador (Plagues, PlagueRegions, Crops). El mapa y catálogo público muestran
posturas oficiales.
● Zona Privada (Monitoreo de Campo): Cada agricultor lleva sus datos en sus parcelas
(Farms, FarmCrops). Los reportes de usuarios NO modifican directamente la vista
pública.
● Puente Epidemiológico: La acumulación de reportes de usuarios generará alertas
internas en el panel administrativo del INIFAP. Solo el Administrador actualizará la tabla
oficial (PlagueRegions) cuando confirme un brote real.
Regla 6: Ejecución de CLI con pnpm
Cualquier comando de migración, seeder o generación de modelos debe ejecutarse usando el
prefijo pnpm exec para evitar choques en el gestor de paquetes local:
pnpm exec sequelize-cli db:migrate
pnpm exec sequelize-cli db:seed --seed nombre-del-seeder.js

3. Estructura de Directorios MVC
   La arquitectura del proyecto sigue una clara división de responsabilidades:
   ● app.js: Punto de entrada, configuración de middleware global, variables de entorno y
   conexión a PostgreSQL.
   ● src/models/: Definición de modelos de Sequelize y sus asociaciones mediante
   associate(models).
   ● src/migrations/: Scripts de control de versiones de la base de datos (archivos .js).
   ● src/seeders/: Poblado de datos iniciales o de prueba para desarrollo.
   ● src/controllers/:
   ○ authController.js: Registro, Login, Logout y Verificación INIFAP (Upgrade).
   ○ privateController.js: Gestión de terrenos, cultivos asignados, reportes y
   administración.
   ○ public/: Controlador de catálogos públicos (plagas, cultivos, productos, foro).
   ● src/routes/: Definición de endpoints segmentados en auth.js, publicRoutes.js y
   privateRoutes.js.
   ● src/views/: Plantillas Handlebars divididas en layouts/, partials/, public/, private/ y auth/.
   ● public/js/: Código JavaScript del cliente organizado en public/js/public/ y public/js/private/.
4. Prompt Contextual Rápido para Agentes de IA
   Cada vez que inicies conversación con un nuevo Agente de IA para desarrollar una tarea en el
   proyecto, puedes incluir este bloque de contexto inicial:
   PROMPT DE INICIO PARA AGENTES:
   "Estás trabajando en el proyecto 'Agrosystem-Residencias' (Node.js Express 5 + ES
   Modules + PostgreSQL + Sequelize + Handlebars + TailwindCSS).
   Debes respetar estrictamente las reglas del proyecto:
5. Usa pnpm y sintaxis de ES Modules (import/export). No utilices .cjs.
6. CERO etiquetas  dentro de vistas Handlebars (.hbs). La interactividad de cliente
   debe ir en archivos JS externos en public/js/.
7. Pasa datos del servidor al cliente usando atributos HTML5 data-*.
8. En el controlador privado, aísla las consultas con `where: { user_id: req.user.id }`.
9. Entrégame el código completo organizado bajo el patrón MVC."
