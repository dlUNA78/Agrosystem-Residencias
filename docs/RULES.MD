# Reglas de ingeniería y colaboración

**Versión:** 2.0

**Estado:** propuesta de gobernanza

**Documento relacionado:** [Matriz RBAC](./RBAC.MD)

## 1. Alcance y lenguaje normativo

Estas reglas aplican a código, migraciones, vistas, scripts, pruebas y documentación del repositorio.

- **DEBE / NO DEBE:** requisito obligatorio para aprobar y fusionar un PR.
- **DEBERÍA:** práctica recomendada que puede omitirse si el PR documenta la razón.
- **PUEDE:** alternativa permitida.
- Si una regla entra en conflicto con la implementación actual, la desviación existente no se replica. Se crea una tarea de regularización y el código nuevo sigue esta versión.
- Una excepción temporal DEBE quedar explicada en el PR, incluir su riesgo y tener una tarea de seguimiento.

## 2. Arquitectura y responsabilidades

- El proyecto DEBE conservar una arquitectura MVC extendida con servicios, middlewares, validadores y utilidades.
- Los controladores DEBEN orquestar la petición y la respuesta. La autorización contextual, validación reutilizable, transformación de datos y reglas de negocio DEBEN vivir en módulos dedicados cuando no sean triviales.
- Los modelos Sequelize DEBEN concentrar definición, asociaciones y comportamiento propio de la entidad; no deben renderizar vistas ni depender de Express.
- Las vistas `.hbs` DEBEN limitarse a presentación y condicionales simples. No se permite lógica de negocio ni JavaScript ejecutable dentro de ellas.
- Todo JavaScript del navegador DEBE vivir en `public/js/public/`, `public/js/private/` o `public/js/shared/`.
- Un archivo que mezcle varias responsabilidades DEBE dividirse. Como señal de revisión, todo controlador o servicio mayor a 300 líneas y toda vista mayor a 500 líneas DEBE justificar por qué no se descompone.

## 3. Interfaz, Tailwind y dependencias visuales

- Tailwind CSS v4 es la herramienta principal para estilos de interfaz.
- Los tokens y estilos base PUEDEN definirse mediante `@theme`, `@layer` y `@utility` en `public/css/input.css`.
- CSS personalizado sólo se permite para comportamientos que no sean razonables con utilidades, como mapas, gráficas o estados calculados. La excepción DEBE estar acotada y comentada.
- No se permiten atributos `style` estáticos. Para valores calculados en tiempo de ejecución se DEBERÍA usar una variable CSS con valor validado.
- No se permiten manejadores inline como `onclick`, `onchange`, `onsubmit` u `onerror`.
- Las librerías UI DEBEN instalarse con `pnpm` e importarse desde el proyecto. No se permiten scripts o estilos UI desde CDN.
- Fuentes, mapas, imágenes u otros recursos remotos DEBEN estar documentados, usar proveedores aprobados y ser compatibles con la política CSP.
- Las imágenes dinámicas DEBEN declarar texto alternativo, dimensiones o proporción y `object-cover`/`object-contain` según corresponda.

## 4. Gestor de paquetes y entorno de ejecución

- Se usa exclusivamente `pnpm`.
- El único lockfile permitido es `pnpm-lock.yaml`; no se versionan `package-lock.json` ni `yarn.lock`.
- Las versiones de Node y pnpm DEBERÍAN fijarse en el repositorio para que desarrollo y CI usen el mismo entorno.
- Todo script de instalación de una dependencia DEBE revisarse y quedar aprobado explícitamente en la configuración de pnpm.
- Un PR que agregue o actualice dependencias DEBE explicar el propósito, el paquete afectado y cualquier script de build autorizado.

## 5. Base de datos y Sequelize

- Todo cambio estructural DEBE realizarse mediante una migración Sequelize versionada.
- No se permite crear o alterar tablas manualmente, mediante `sequelize.sync({ alter: true })` ni durante el arranque de la aplicación.
- Esto incluye tablas auxiliares como sesiones, auditoría y relaciones.
- Cada migración DEBE implementar un `down` coherente y revisarse considerando datos existentes.
- Los seeders se limitan a datos; PUEDEN usar consultas de lectura para resolver relaciones.
- Tras actualizar el repositorio se DEBE ejecutar:

  ```bash
  pnpm exec sequelize-cli db:migrate
  ```

- Si el PR modifica el esquema, DEBE incluir pruebas o evidencia de migración desde el estado anterior y, cuando sea seguro, de reversión.

## 6. Convenciones de nombres

- Clases y modelos Sequelize: singular y PascalCase, por ejemplo `PlagueImage`.
- Archivos JavaScript: lower camelCase, por ejemplo `plagueImage.js`, `plagueController.js` y `privateRoutes.js`.
- Vistas, parciales y URLs: kebab-case en minúsculas, por ejemplo `plague-detail.hbs` y `/private/plagues/:id`.
- Tablas y columnas mantienen la convención ya establecida por sus migraciones; cualquier cambio requiere migración.
- Los nombres DEBEN describir el dominio. No se mezclan `pest` y `plague` para la misma entidad salvo compatibilidad temporal documentada.

## 7. Variables de entorno y secretos

- `.env` nunca se versiona.
- Toda variable nueva DEBE agregarse sin secretos a `.env.example`.
- Las llaves usan `UPPER_SNAKE_CASE`.
- La aplicación DEBE fallar al iniciar si falta una variable crítica; no se permiten secretos ni credenciales por defecto.
- Logs, errores, fixtures, capturas y descripciones de PR NO DEBEN exponer contraseñas, tokens, cadenas de conexión ni códigos de acceso.

## 8. Autenticación, autorización y RBAC

- La política oficial de permisos se define en [RBAC.MD](./RBAC.MD).
- Toda ruta privada DEBE verificar autenticación y autorización en el servidor.
- Ocultar un botón en Handlebars mejora la experiencia, pero NO constituye una medida de seguridad.
- Las vistas compartidas DEBEN recibir capacidades calculadas por backend (`canEdit`, `canVerify`, `canPublish`) en lugar de deducir permisos a partir del rol.
- Las acciones sobre un registro DEBEN validar también propiedad, estado del workflow y separación entre autor y revisor.
- Las rutas administrativas DEBEN usar un middleware explícito de administrador, incluso cuando el enlace sólo sea visible para ese rol.
- Los listados y detalles públicos DEBEN consultar únicamente registros publicados o aprobados. Un ID conocido no debe permitir abrir un borrador.
- El estado activo o suspendido de la cuenta DEBE comprobarse antes de autorizar el acceso.

## 9. Validación y persistencia

- No se confía en validaciones HTML ni en datos enviados por el cliente.
- `req.body`, `req.params` y `req.query` DEBEN normalizarse y validarse antes de interactuar con Sequelize.
- La validación PUEDE vivir en un servicio o middleware; el controlador conserva la responsabilidad de responder con el código apropiado.
- Sólo se persisten campos incluidos en una lista permitida. Está prohibido pasar `req.body` completo o usar asignación masiva sin filtrar.
- IDs, enumeraciones, URLs, fechas, números y límites de paginación DEBEN validarse y acotarse.
- Las operaciones que modifican una entidad y sus relaciones o archivos DEBEN usar una transacción o una estrategia de compensación.
- Los errores esperables de entrada deben producir `400`; ausencia, `404`; falta de autenticación, `401` o redirección; falta de permiso, `403`; conflictos de estado, `409`.

## 10. Seguridad web

- Toda operación que cambie estado DEBE usar un método no seguro (`POST`, `PUT`, `PATCH` o `DELETE`) y protección CSRF.
- El cierre de sesión DEBE realizarse mediante `POST` con CSRF.
- Las cookies de sesión DEBEN usar `httpOnly`, `sameSite`, `secure` en producción y una duración explícita.
- El identificador de sesión DEBE regenerarse al iniciar sesión y al elevar privilegios.
- Helmet y una Content Security Policy DEBEN mantenerse activados. Toda excepción de CSP debe ser específica y documentada.
- Los mensajes enviados al cliente no deben revelar detalles internos, consultas, rutas físicas ni secretos.
- Los eventos de creación, cambio de estado, publicación, eliminación y administración de usuarios DEBEN registrarse en auditoría.
- Los endpoints sensibles DEBEN tener rate limiting apto para el entorno de despliegue; una implementación en memoria sólo es aceptable en desarrollo.

## 11. Recursos y vistas compartidas

- La presentación o interacción reutilizada entre la zona pública y privada DEBE centralizarse en `src/views/shared/`, `src/views/partials/` o `public/js/shared/`.
- No se duplica una ficha completa para cambiar únicamente acciones privadas.
- El backend DEBE entregar un view model apropiado al contexto. La vista no debe conocer campos sensibles o estados que el público no pueda consultar.
- Archivos obsoletos o sin referencias DEBEN eliminarse en el mismo PR que completa su reemplazo.

## 12. Carga y ciclo de vida de archivos

- Las imágenes aceptadas son JPG, PNG o WEBP, con un máximo de 5 MB por archivo y 10 archivos por operación, salvo una excepción justificada.
- Se DEBE validar extensión, MIME y firma real del archivo.
- Los nombres almacenados DEBEN generarse en el servidor y las rutas destino deben estar limitadas a directorios permitidos.
- La aplicación DEBE crear de forma segura los directorios esperados.
- Si falla la transacción de base de datos, los archivos recién escritos DEBEN eliminarse.
- Al reemplazar o eliminar registros debe existir una política explícita para archivos huérfanos.
- Las rutas guardadas en la base DEBEN coincidir con la ubicación pública real y no contener rutas absolutas del sistema operativo.

## 13. Pruebas

- Para lógica de negocio nueva o corregida, primero se agrega o actualiza una prueba que reproduzca el comportamiento esperado.
- Se requieren pruebas unitarias para servicios y validadores, e integración para rutas, persistencia, permisos y workflows.
- Cada mutación privada DEBE probar al menos: usuario no autenticado, rol no permitido, propietario permitido, no propietario rechazado y estado inválido.
- Cada detalle público DEBE probar que un registro no publicado responde como inexistente.
- Las pruebas no usan la base de producción ni dependen del orden de ejecución.
- Un PR no se considera validado sólo porque Jest no encontró pruebas; CI DEBE exigir una suite real.
- La cobertura es una señal, no un sustituto de escenarios. Los umbrales se definirán en la configuración de calidad del repositorio.

## 14. Formato, lint y calidad automática

- Prettier DEBE cubrir JavaScript, JSON, Markdown y CSS. DEBERÍA cubrir Handlebars sólo después de validar su compatibilidad en un PR dedicado; mientras tanto, las vistas `.hbs` pueden permanecer excluidas y deben conservar convenciones manuales consistentes.
- ESLint DEBE usar una única configuración activa. Las reglas documentadas, incluida complejidad, deben existir en esa configuración.
- Las advertencias de ESLint cuentan como fallos en CI.
- `format` PUEDE escribir cambios localmente; CI sólo verifica mediante `format:check`.
- Antes de solicitar revisión, el autor DEBE ejecutar los comandos definidos en `package.json` para pruebas, lint y formato.
- Hasta que se agreguen los scripts de calidad definitivos, la verificación transitoria es:

  ```bash
  pnpm run test
  pnpm run lint -- --max-warnings=0
  pnpm exec prettier --check .
  ```

- El PR de automatización inmediatamente posterior a esta propuesta DEBE crear `format:check` y alinear estos comandos con CI.
- Excepción de adopción: este PR de gobernanza PUEDE validar únicamente los documentos modificados y registrar las fallas globales heredadas. No se fusionará otro PR funcional hasta que el PR de baseline deje las verificaciones globales en verde.

## 15. Commits, ramas y Pull Requests

- No se hacen commits ni pushes directos a `main`.
- Cada cambio se desarrolla en una rama independiente creada desde `main` actualizado.
- Los commits usan prefijos semánticos: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` o `style:`.
- Todo PR DEBE describir alcance, riesgos, migraciones, dependencias, pruebas automáticas y validación manual.
- El responsable del proyecto es la autoridad final para aceptar y fusionar cambios; GitHub no necesita una aprobación de otra persona.
- Una revisión independiente DEBERÍA solicitarse para cambios de alto riesgo, especialmente autenticación, RBAC, migraciones destructivas, exposición pública de datos, secretos y dependencias críticas.
- Las verificaciones requeridas DEBEN terminar correctamente antes del merge.
- El responsable del proyecto PUEDE fusionar su propio PR después de revisar el diff y confirmar el checklist.
- Los administradores no deben omitir verificaciones automáticas salvo incidente urgente. El bypass requiere una explicación pública y un PR posterior de regularización.
- Los PR deben ser acotados; cambios de documentación, tooling, seguridad y funcionalidad se separan cuando puedan revisarse independientemente.

## 16. Flujo obligatorio de modificación

1. Actualizar `main` y crear una rama específica.
2. Leer estas reglas y la matriz RBAC; declarar el alcance del cambio.
3. Para lógica de negocio, crear o actualizar primero las pruebas.
4. Implementar el cambio respetando arquitectura, validación y autorización.
5. Crear y ejecutar migraciones cuando cambie el esquema.
6. Ejecutar pruebas, lint y formato hasta obtener resultados limpios.
7. Realizar la validación manual proporcional al riesgo.
8. Revisar `git diff` para evitar secretos, archivos generados o cambios fuera de alcance.
9. Abrir el PR usando la plantilla del repositorio.
10. Esperar las verificaciones, completar el checklist y obtener la autorización del responsable del proyecto antes del merge.

No se declara una tarea terminada si alguno de los pasos aplicables falla. Si existe un bloqueo externo, se documenta con evidencia y no se presenta el cambio como completado.
