# Hallazgos Fuera de Alcance (Fase 0)

Problemas detectados durante la ejecución y perfilado de la **Fase 0 (`0.A1`, `0.A2`, `0.A3`)** que no se modificaron por pertenecer al alcance de fases posteriores o requerir decisión de diseño.

## 1. Middleware de `publicRateLimiter` y límite de memoria interceptando rutas privadas/API

- **Ubicación**: [app.js](../app.js#L365), [publicRoutes.js](../src/routes/publicRoutes.js#L26), [publicReadOnlyGuard.js](../src/middlewares/publicReadOnlyGuard.js#L3-L11), [rateLimiter.js](../src/middlewares/rateLimiter.js).
- **Qué se observó**: `app.use('/', publicRoutes)` monta `router.use(publicRateLimiter)` en `/` antes de los enrutadores privados, de autenticación y de notificaciones/API. En consecuencia, las peticiones hacia rutas privadas y autenticadas también pasan por ese limitador en memoria (referenciado además en [RULES.MD](RULES.MD#L108) respecto a límite distribuido y diferenciación de tráfico).

## 2. Rol `agricultor` bloqueado con HTTP `403` en `/api/notifications`

- **Ubicación**: [app.js](../app.js#L366-L367), [privateRoutes.js](../src/routes/privateRoutes.js#L39), [notificationRoutes.js](../src/routes/notificationRoutes.js).
- **Qué se observó**: Al perfilar `GET /api/notifications` con sesión de rol `agricultor`, la petición devolvió HTTP `403` (`15.85 ms`). El middleware `router.use(requirePanelAccess)` montado sobre `/` en `privateRoutes` se ejecuta antes de `notificationRoutes`, bloqueando el consumo de notificaciones API a cuentas `agricultor` sin acceso al panel.

## 3. Operación de escritura (`FarmLot.create`) dentro de petición `GET`

- **Ubicación**: [landDetailController.js](../src/controllers/private/lands/landDetailController.js#L144-L160).
- **Qué se observó**: Al perfilar `GET /private/lands/:id/expediente` sobre el predio sintético `150128`, se ejecutó `INSERT INTO "FarmLots"` durante una petición de solo lectura `GET` cuando el predio no tiene lotes registrados (posteriormente esa inserción requirió considerarse al limpiar datos sintéticos por la llave foránea hacia `Farms`).

## 4. Comportamiento de pruebas existentes bajo volumen sintético y en paralelo

- **Ubicación**: [notifications.test.js](../tests/private/notifications.test.js#L34-L36), `tests/users/profileAdvanced.test.js`, `tests/users/usersManagement.test.js`, [cropRoutes.test.js](../tests/private/cropRoutes.test.js#L56-L82), `tests/private/productRoutes.test.js`.
- **Qué se observó**:
  - `tests/private/notifications.test.js` pasa `13/13` de forma aislada (`14.871 s` incluso con `50k` notificaciones sembradas), pero su `beforeAll` selecciona usuario con `User.findOne({ where: { role: 'admin', status: 'activo' } })` sin correo fijo ni `ORDER BY`. Cuando las suites paralelas se ralentizan, puede colisionar con admins temporales creados y eliminados concurrentemente por `cropRoutes.test.js` o `productRoutes.test.js` _(resuelto en `1.A0` para `notifications.test.js`, `cropRoutes.test.js`, `productRoutes.test.js` y `profileAdvanced.test.js`)_.
  - Con los `~750k` registros sintéticos cargados en `agrosystem_test`, `tests/users/profileAdvanced.test.js` falla `3/18` casos (`revokeOtherSessions` `5,133 ms`, `revokeAllUserSessions` `5,828 ms`, `getEnrichedProfileData(farmerUser)` `5,591 ms`) contra el timeout de `5000 ms` de Jest debido a que `listUserActiveSessions` demora `~3,129 ms` escaneando sesiones activas en `"session"`.
  - Antes de agregar `VACUUM FULL ANALYZE` al flujo `--reset` de [seedLoadTestData.js](../src/scripts/seedLoadTestData.js#L215-L230), el borrado masivo de `750k` filas dejaba decenas de MB de páginas muertas/libres (`AuditLogs` `30 MB`, `session` `23 MB`, `Notifications` `6.9 MB`, `Farms` `3.3 MB`, `FarmCrops` `2.3 MB`), provocando un timeout intermitente en `beforeAll` de `tests/private/cropRoutes.test.js` durante la suite paralela completa (aunque aislada pasó en `3.803 s`).

## 5. Deuda estructural de esquema, índices y ciclo de vida de sesiones

- **Ubicación**: Esquema en PostgreSQL (`agrosystem_test`), [app.js](../app.js#L334), [cropDetailController.js](../src/controllers/private/crops/cropDetailController.js#L32-L62), [landsController.js](../src/controllers/private/landsController.js), [reportsService.js](../src/services/reportsService.js).
- **Qué se observó**:
  - Tablas `AuditLogs`, `Farms`, `FarmCrops`, `FarmApplications`, `FarmHealthReports` y `Plagues` carecen de índices secundarios (solo PK), causando `Seq Scan` en lecturas y escaneos completos en verificaciones de llave foránea al eliminar `Farms`.
  - `InifapCodes` y `RbacRoles` tienen índices únicos duplicados (`InifapCodes_code_key` / `inifap_codes_code` y `RbacRoles_slug_key` / `idx_rbac_roles_slug`).
  - Persisten sesiones expiradas en `"session"` (`100,469` totales frente a `80,113` vigentes con `expire > NOW()`) y `enrichSessionActivity` dispara `INSERT ... ON CONFLICT` en casi cada GET privado autenticado.
  - Los cuellos específicos de consulta (producto cartesiano en detalle de cultivo `22.9 s`, `/private/lands` sin paginación `37.4 MB`, `4x` consultas repetidas en reportes y `LIKE '%...%'` en auditoría) se detallan con métricas en [carga-baseline.md](carga-baseline.md).

## 6. `logging` de Sequelize activo en producción y saturación del event loop bajo carga `k6`

- **Ubicación**: [config.js](../src/config/config.js#L3-L28), flujo PDF/reportes y resultados documentados en [carga-baseline.md](carga-baseline.md#L112-L155).
- **Qué se observó**:
  - Ninguno de los entornos (`development`, `test`, `production`) en [config.js](../src/config/config.js#L3-L28) configura `logging: false`. En el entorno Docker de pruebas de carga (`NODE_ENV=production`), Node imprimió `Executing (default): ...` a `stdout` en cada consulta SQL durante miles de peticiones concurrentes (`4.38%` del tiempo activo JS solo en logging en `/products`).
  - En las corridas de [catalog.js](../loadtests/catalog.js), aunque PostgreSQL ejecutó cada consulta pública en `<= 0.71 ms`, el proceso único de Node se saturó en `~130–142 req/s` (`p95`: `653 ms` en `50` VUs -> `2,471 ms` en `200` VUs -> `7,509 ms` con `116` rechazos `0 ms` en `500` VUs) por combinación de hidratación Sequelize (`~32–40%` CPU), renderizado SSR (`~8–13%`), logging SQL a `stdout`, compresión y pool Sequelize por defecto.
  - En las corridas de [pdf.js](../loadtests/pdf.js), además de repetir `4x` la lectura de todos los `Farms` activos del usuario (`8,335` predios por consulta en el admin sembrado), cada descarga `GET /private/reports?...&format=pdf` ejecutó un `INSERT INTO "AuditLogs"` (`953` escrituras en `50` VUs y `1,025` en `200` VUs) y topó la capacidad de generación PDF del proceso en `~15 req/s` (`p95 = 23.05 s` a `200` VUs).
  - En [auth-panel.js](../loadtests/auth-panel.js), el panel alcanzó su punto de quiebre ya en `50` VUs (`7.41%` de fallos por timeout de `60 s` en `GET /private/lands` y `GET /private/ingredients`, `127.4 s` por iteración) sin que el contenedor cayera por OOM (`153.9 MiB / 1.5 GiB`, `RestartCount=0`).

## 7. Mapa vectorial SVG de México (`~136 KB`) incrustado inline en vistas SSR y costo de hidratación/formato

- **Ubicación**: [mexicoGeo.js](../src/services/mexicoGeo.js#L12-L35), [cropDetailController.js](../src/controllers/public/crops/cropDetailController.js#L91-L100), [cropDetailService.js](../src/services/cropDetailService.js#L52) y medición en [carga-baseline.md](carga-baseline.md#L158-L215).
- **Qué se observó**:
  - El HTML sin comprimir de `/` (`250,500 B`), `/crops/1` (`216,033 B`) y `/plagues/1` (`238,447 B`) dedica **`56%–63%`** (`136–141 KB`) a repetir el mapa SVG completo de los 32 estados de México inline en el servidor, duplicando el trabajo de Handlebars (`13.45%` CPU en detalle vs `7.82%` en listado), generación de ETag MD5 / `Buffer.from` (`4.76%` CPU en detalle) y compresión en cada solicitud.
  - En `GET /crops/1`, `formatDate` en [cropDetailService.js](../src/services/cropDetailService.js#L52) fue el 2.º consumidor individual más alto del perfil `--cpu-prof` (`3.20%` del tiempo activo), mientras que la hidratación de modelos Sequelize (`_groupJoinData`, `baseClone`, `__defNormalProp`) consumió `21.87%–26.10%` de CPU JS en peticiones públicas.

## 8. Exportaciones CSV/GeoJSON de `/private/lands` con miles de predios y mapa paginado (`1.A12` / `1.A12b`)

- **Ubicación**: [landsController.js](../src/controllers/private/landsController.js#L62-L90), [landExportService.js](../src/services/landExportService.js) y [list.hbs](../src/views/private/lands/list.hbs#L138-L172).
- **Qué se observó**:
  - **Medición de exportaciones con `8,335` predios activos del usuario administrador sobre `agrosystem_load`** (sin cambios en `1.A12`):
    - `GET /private/lands?format=csv`: **`1,299.57–1,305.26 ms`**, tamaño **`1,081,408 B` (`1.031 MB`)**, incremento de heap **`+38.49 a +39.38 MB`** (`heapUsed` `62.53 -> 101.02 MB` antes / `37.64 -> 77.02 MB` después; RSS `156.18–297.65 MB`).
    - `GET /private/lands?format=geojson`: **`1,160.92–1,349.93 ms`**, tamaño **`2,644,673 B` (`2.522 MB`)**, incremento de heap **`+34.12 a +47.47 MB`** (`heapUsed` `64.68 -> 112.14 MB` antes / `39.89 -> 74.01 MB` después; RSS `155.73–305.41 MB`).
    - Ambas exportaciones cargan y serializan todas las instancias Sequelize en memoria en una sola respuesta; si el padrón por usuario sigue creciendo o concurren descargas simultáneas, convendrá transmitir por cursor/stream o limitar el rango exportado.
  - **Tarea futura `1.A12b` (Mapa completo con endpoint JSON mínimo + clustering)**: tras paginar `/private/lands` a `12` predios por página en `1.A12`, el mapa interactivo Leaflet muestra únicamente los pines con GPS de la página actual para mantener el HTML en `~143 KB`. Si se requiere explorar simultáneamente todos los predios georreferenciados del usuario en el mapa, se propone como tarea futura **`1.A12b`** exponer un endpoint JSON ligero (`id, name, location_lat, location_lng`) acotado y con clustering en cliente (`Leaflet.markercluster` o equivalente).

## 9. Compromiso del tope por cuenta en `authLimiter` (`1.A4`)

- **Ubicación**: [rateLimiter.js](../src/middlewares/rateLimiter.js#L350-L460).
- **Compromiso aceptado para Fase 1**:
  - La capa 3 de `authLimiter` fija un tope de **`25` intentos fallidos cada `15` minutos** por cuenta (`AUTH_ACCOUNT_RATE_LIMIT_MAX=25`) sin retraso progresivo (para evitar conexiones abiertas como vector de DoS).
  - Si un atacante distribuye 25 intentos fallidos desde múltiples IPs contra un correo específico, el propietario legítimo de esa cuenta quedará bloqueado temporalmente con HTTP `429` (`Retry-After`) durante hasta **15 minutos** hasta que expire la ventana.
  - **Seguimiento con usuarios reales**: una vez desplegado el sistema con tráfico real, monitorear incidencias de `429` por cuenta y evaluar alternativas sin bloqueo al dueño legítimo (p. ej., reto CAPTCHA adaptativo o desbloqueo por enlace de un solo uso por correo) si aparecen ataques dirigidos.

## 10. Tareas futuras identificadas fuera de la Fase 1

Las siguientes mejoras fueron detectadas al validar la Fase 1 y quedan registradas como **tareas futuras fuera del alcance de la Fase 1** (sin implementar todavía).

### F-1: Contenido útil en notificaciones editoriales y sección "Mis sugerencias" en `/profile`

- **Ubicación**: [notificationService.js](../src/services/notificationService.js#L203-L230), [cropWorkflowService.js](../src/services/cropWorkflowService.js#L115-L120), [plagueWorkflowService.js](../src/services/plagueWorkflowService.js#L110-L118), [productWorkflowService.js](../src/services/productWorkflowService.js#L98-L108), [profileService.js](../src/services/profileService.js#L38-L61), [profile.hbs](../src/views/shared/profile.hbs#L561-L651), [notifications-hub.js](../public/js/shared/notifications-hub.js#L85-L121).
- **Problema observado**:
  - Hoy el rol `agricultor` no tiene ninguna vista ni pestaña donde consultar el estado de sus sugerencias enviadas (`POST /suggestions/:catalog`) ni leer el motivo cuando un revisor solicita cambios o rechaza/archiva la ficha; al abrir la notificación, solo es redirigido al catálogo o ficha correspondiente.
  - **Verificación del flujo editorial**: los tres servicios de workflow (`cropWorkflowService.js`, `plagueWorkflowService.js`, `productWorkflowService.js`) **sí exigen y persisten el motivo en BD** (`review_notes` obligatorio en `request_changes` bajo error `REVIEW_NOTES_REQUIRED`, `archive_reason` en `request_archive`, `archive_approval_notes` en `approve_archive` y `review_notes` en `reject_archive`), pero `notifyAuthorOnWorkflowChange` hoy no recibe ni incluye ese motivo y muestra el código interno (`changes_requested`, `verified`, etc.) sin etiqueta legible.
- **Alcance propuesto para F-1**:
  1. **Enriquecer las notificaciones editoriales**: incluir explícitamente el catálogo y nombre de la ficha, el nuevo estado en español legible (p. ej. _En revisión_, _Cambios solicitados_, _Verificada_, _Publicada_, _Archivada_) y el motivo/observaciones (`review_notes` o `archive_reason`) cuando existan.
  2. **Agregar pestaña/sección "Mis sugerencias" en `/profile`**: listar las propuestas enviadas por el usuario (`Crops`, `Plagues` y `Products` filtrados por `created_by_user_id = user.id`) con estado actual, fecha de actualización, observaciones de revisión/rechazo si existen y enlace directo a la ficha pública cuando esté publicada.
  3. **Ajustar redirección en `resolveNotificationActionUrl`**: una vez exista `/profile#tab-suggestions` (o ruta equivalente), redirigir allí las notificaciones de sugerencias no publicadas del agricultor en lugar del listado general del catálogo.

### F-2: Alinear contraseñas de usuarios por defecto con la política de seguridad y revisar pruebas

- **Ubicación**: [seedDefaultUsers.js](../src/scripts/seedDefaultUsers.js#L9-L93), [20260615190144-demo-users.js](../src/seeders/20260615190144-demo-users.js#L7-L8), [validators.js](../src/utils/validators.js#L77-L101), [app.js](../app.js#L499).
- **Problema observado**:
  - La política de contraseñas en `validatePasswordPolicy` ([validators.js](../src/utils/validators.js#L77-L101)) exige **8–72 caracteres, al menos 1 mayúscula, 1 minúscula y 1 número** (y `profileService.js` exige ≥8 caracteres).
  - En `main`, tanto `seedDefaultUsers.js` como el seeder `20260615190144-demo-users.js` crean 5 cuentas demo (`investigador@agrosystem.com`, `tecnico@agrosystem.com`, `juan@agricultor.com`, `agricultor@agrosystem.com`, `farmer_expediente@agrosystem.com`) con contraseña `'123456'` (6 caracteres, sin letras) y `admin@agrosystem.com` con `'admin123'` (8 caracteres sin mayúscula).
  - Además, `seedDefaultUsers()` sobrescribe `password_hash` en cada arranque para los correos sembrados y hoy `app.js` lo ejecuta cuando `NODE_ENV !== 'test'` (incluyendo `production`).
- **Verificación preliminar de tests existentes**:
  - Ninguna suite de Jest depende de `'123456'` ni `'admin123'`: [rbacManagement.test.js](../tests/private/rbacManagement.test.js#L31-L107) y [usersManagement.test.js](../tests/users/usersManagement.test.js#L19-L80) reemplazan explícitamente el hash en `beforeAll` con `'Admin@1234'` y `'Farmer@1234'`, y [loadtestsConfig.test.js](../tests/loadtests/loadtestsConfig.test.js#L220) prohíbe `admin123|123456` en `loadtests/`.
- **Alcance propuesto para F-2**:
  1. Cambiar todas las contraseñas demo en `seedDefaultUsers.js` y `20260615190144-demo-users.js` para que cumplan `validatePasswordPolicy` (≥8 caracteres, mayúscula, minúscula y número) y añadir prueba unitaria que valide las credenciales de desarrollo contra dicha política.
  2. Revisar tests, scripts y documentación local (`docs/`) por si algún flujo manual o automatizado asume las contraseñas anteriores.
  3. Confirmar en coordinación con **`1.A8`** que `seedDefaultUsers()` nunca corre en `NODE_ENV=production` ni sobrescribe contraseñas ya existentes.

### F-3: Vista agregada por estado o región de distribución de cultivos sin exponer predios individuales

- **Ubicación**: [cropDetailController.js](../src/controllers/private/crops/cropDetailController.js), [cropFarmSummaryService.js](../src/services/cropFarmSummaryService.js), [cropDetailService.js](../src/services/cropDetailService.js) y [crop-detail.hbs](../src/views/shared/crop-detail.hbs#L855-L1025).
- **Contexto**:
  - En **`1.A11`** se aplicó la misma política de privacidad de [landAuthorizationService.js](../src/services/landAuthorizationService.js#L10-L28): en `/private/crops/:id`, `admin` e `inifap` ven el conteo nacional agregado (`farmsCount`), pero las tarjetas y pines SVG muestran únicamente los predios propios del usuario autenticado (tope `12`).
- **Alcance propuesto para F-3**:
  - Añadir una vista agregada por **entidad federativa o región** (p. ej., conteo de predios activos y superficie total agrupados por `Regions.name` / estado, con umbral mínimo de anonimización si aplica) que permita a investigadores INIFAP y administradores ver dónde se siembra un cultivo a nivel territorial sin exponer nombres, propietarios ni coordenadas exactas de predios individuales.

### F-4: Script CLI explícito `bootstrap:admin` para producción (baja prioridad)

- **Ubicación**: [seedDefaultUsers.js](../src/scripts/seedDefaultUsers.js) y [app.js](../app.js#L506-L509).
- **Contexto**:
  - En **`H-1`** se desactivó `seedDefaultUsers()` en `NODE_ENV=production` y pasó a modo insert-only para evitar sobrescribir usuarios existentes.
- **Alcance propuesto para F-4 (baja prioridad, sin implementar)**:
  - Crear un comando CLI one-shot (`pnpm run bootstrap:admin` / `node src/scripts/bootstrapAdmin.js`), jamás invocado al arrancar `app.js`, que exija variables explícitas sin contraseñas por defecto (`BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` validada con `validatePasswordPolicy`, `BOOTSTRAP_ADMIN_NAME` opcional), aborte si faltan o son inseguras y no sobrescriba si ya existe un administrador activo.

### R-1: Autobloqueo en el `down()` de `20261111000001` (`describeTable` fuera de la transacción)

- **Ubicación**: [20261111000001-add-dual-approval-deactivation-workflow.js](../src/migrations/20261111000001-add-dual-approval-deactivation-workflow.js#L128-L144).
- **Problema observado**:
  - En el bloque `down()` de la migración `20261111000001-add-dual-approval-deactivation-workflow.js` (última migración de la Fase 0), se abre una transacción explícita (`const transaction = await queryInterface.sequelize.transaction()`), se ejecutan llamadas `removeColumn('ActiveIngredients', ..., { transaction })` que adquieren un bloqueo `ACCESS EXCLUSIVE` sobre `"ActiveIngredients"` en la conexión de la transacción y, a continuación, en la línea 144 se invoca `await queryInterface.describeTable('ActiveIngredients')` **sin pasar `{ transaction }`**.
  - Eso hace que Sequelize solicite una segunda conexión del pool para consultar los metadatos de `"ActiveIngredients"`, quedando bloqueada indefinidamente esperando el lock `ACCESS EXCLUSIVE` retenido por la primera conexión.
  - No afecta la reversión de las migraciones de la Fase 1 (`db:migrate:undo:all --to 20261118000001-add-farms-user-status-created-id-index.js`, tras lo cual `SequelizeMeta` termina en `20261111000001-add-dual-approval-deactivation-workflow.js`).
- **Alcance propuesto para R-1 (tarea aparte)**:
  - Pasar `{ transaction }` a `queryInterface.describeTable('ActiveIngredients', { transaction })` (o consultar las columnas antes de iniciar los `removeColumn`) en `20261111000001-add-dual-approval-deactivation-workflow.js` y verificar `db:migrate:undo:all` completo desde la última migración hasta cero.

### R-2: Regresión de la tarjeta "Sesiones Activas" en `profile.hbs` (eliminada en `397c9b2`)

- **Ubicación**: [profile.hbs](../src/views/shared/profile.hbs#L446-L551), [profileController.js](../src/controllers/private/profileController.js#L65-L66), [privateRoutes.js](../src/routes/privateRoutes.js#L33-L49), [profile.js](../public/js/shared/profile.js#L180-L192).
- **Problema observado (auditoría de `397c9b2`)**:
  - La tarjeta **`Tarjeta B: Sesiones Activas en PostgreSQL`** (introducida en `c0a2cf3`) y el badge `{{sessionCount}}` de la pestaña de seguridad fueron eliminados en `397c9b2`, dejando huérfanos en el backend/JS `activeSessions`, `sessionCount`, las rutas `POST /profile/sessions/revoke-others` y `POST /private/profile/sessions/revoke-others`, el listener `initRevokeConfirmation()` (`#revoke-sessions-form`) y el mensaje flash `sesiones_cerradas`.
  - **Otras eliminaciones revisadas en `397c9b2`** (sin restaurar sin aprobación): en [profileService.js](../src/services/profileService.js#L155-L201) se eliminó temporalmente `recordSafeAuditLog({ action: 'PROFILE_UPDATE', ... })` dentro de `updateUserProfileDetails`, aunque fue restaurado en `fd69d0f` (verificado en `R-2` con prueba de auditoría sin contraseñas ni hashes; `AVATAR_UPDATE`/`AVATAR_REMOVE` se omiten intencionalmente por bajo impacto). En el resto de vistas modificadas en `397c9b2`, las ocultaciones (`code`/`job_title`/`shift` para `agricultor` y enlace `Ascenso INIFAP` para no autenticados) sí se alinearon con el backend.
- **Alcance propuesto para R-2 (PR aparte)**:
  - Restaurar la tarjeta de sesiones activas en [profile.hbs](../src/views/shared/profile.hbs) adaptada a **`1.A6`** (sin copiar a ciegas el bloque de `c0a2cf3`): con nota visible de retraso de hasta 5 minutos en última actividad/expiración, datos coherentes con la nueva granularidad, formulario `#revoke-sessions-form` para `/profile` y `/private/profile`, y test de renderizado que falle si la tarjeta vuelve a desaparecer.
- **Seguimiento CSRF (`2.A1`)**:
  - Incluir los formularios `POST /profile/sessions/revoke-others` y `POST /private/profile/sessions/revoke-others` (`#revoke-sessions-form` en [profile.hbs](../src/views/shared/profile.hbs)) dentro del inventario de rutas mutadoras protegidas con token CSRF en la tarea **`2.A1`**.

## 11. Verificación de índices de `1.A3` al cierre de la Fase 1

- **Ubicación**: [20261121000001-add-core-performance-indexes.js](../src/migrations/20261121000001-add-core-performance-indexes.js), [concurrentIndexHelper.js](../src/utils/concurrentIndexHelper.js).
- **Auditoría pendiente al cierre de Fase 1**:
  - Después de ejecutar la corrida final de `k6` de cierre de Fase 1 contra la BD migrada, consultar `pg_stat_user_indexes` y **reportar explícitamente cualquier índice con `idx_scan = 0`** para confirmar que ningún índice creado en Fase 1 queda sin uso bajo carga real (distinguiendo rutas de administración/baja poco frecuentes como `getPlagueDeactivationImpact` o `getProductDeactivationImpact`).
- **Índices descartados/diferidos en `1.A3` con evidencia**:
  - `AuditLogs (table_name, "createdAt" DESC)`: descartado porque el planificador de PostgreSQL no lo eligió en la consulta real `table_name IN (7 valores) ORDER BY "createdAt" DESC` (ya resuelta en `0.05–1.03 ms` con `idx_audit_logs_created_at_desc`, evitando `6.5 MB` extra y sobrecarga de escritura).
  - `FarmLots (farm_id)`: no requerido porque la restricción única existente `farm_lots_farm_id_name_unique (farm_id, name)` ya cubre la FK `FarmLots_farm_id_fkey` y resuelve `WHERE farm_id = $1 AND status = true` sobre `50k` lotes en `0.02–0.05 ms` (`4` buffers).
  - `Plagues` (`workflow_status`, `created_by_user_id`): diferidos al Grupo B (tabla con `8` filas).
  - FKs restantes sin índice en tablas grandes (`> 1 MB`) tras `1.A3` (sin consultas de lectura medidas que los justifiquen aún): `FarmApplications (farm_crop_id, created_by_user_id)`, `FarmHealthReports (farm_crop_id, created_by_user_id)`, `Notifications (actor_id)` y `Farms (region_id)`. Se reevaluarán si aparecen borrados masivos de `Users`/`FarmCrops`/`Regions` o consultas por esas columnas.

## 12. Riesgo latente de producto cartesiano en `landDetailController.js` (`GET /private/lands/:id/expediente`)

- **Ubicación**: [landDetailController.js](../src/controllers/private/lands/landDetailController.js#L38-L84).
- **Qué se observó y midió en `agrosystem_load`**:
  - `landDetail` ejecuta un único `Farm.findOne` con cuatro `hasMany` encadenados sin `separate: true`: `farmCrops` (con `stages`), `healthReports`, `applications` y `lots`.
  - **Medición actual sobre `agrosystem_load`**: en el dataset de carga actual cada predio tiene pocos registros operativos propios; el predio con mayor producto (`id = 6`: `1` ciclo × `2` reportes sanitarios × `3` aplicaciones × `2` lotes = **`12` filas**) se resolvió en **`27.19 ms` totales** (`24.71 ms` SQL), por lo que hoy no es un cuello de botella real y se dejó fuera de `1.A11`.
  - **Riesgo a futuro**: si un predio de larga trayectoria acumula múltiples ciclos, etapas fenológicas, decenas de reportes y aplicaciones (p. ej. `10 × 5 × 20 × 30 × 10`), el join único sin `separate: true` crecerá de forma multiplicativa. Cuando se atienda en optimizaciones posteriores (`3.A4`), separar esas asociaciones en `separate: true` o consultas paralelas acotadas eliminará el riesgo.

## 13. H-1: `seedDefaultUsers()` sobrescribe rol, contraseña y perfil de usuarios existentes en cada reinicio

- **Ubicación**: [app.js](../app.js#L496-L505) y [seedDefaultUsers.js](../src/scripts/seedDefaultUsers.js#L102-L149).
- **Qué se observó (reproducido en BD real)**:
  - Al iniciar el servidor, [app.js](../app.js#L496-L505) ejecuta `await seedDefaultUsers()` siempre que `process.env.NODE_ENV !== 'test'` (incluye tanto `development` como **`production`**). No existe otro código de arranque que modifique `Users`.
  - En [seedDefaultUsers.js](../src/scripts/seedDefaultUsers.js#L112-L127), cuando el correo ya existe en `"Users"`, ejecuta `existing.update({...})` sobrescribiendo **incondicionalmente** `role`, `password_hash`, `full_name`, `code`, `phone`, `address`, `job_title`, `shift`, `photo_url` y `status` con los valores de `DEFAULT_USERS` (sin tocar `rbac_role_id`).
  - **Consecuencia reproducida**: al ascender a `agricultor@agrosystem.com` (`id = 270`) a INIFAP mediante `/auth/inifap-upgrade` (canje de código `InifapCodes.id = 317` con `rbac_role_id = 3`), el siguiente reinicio del servidor revirtió `role` de `'inifap'` a `'agricultor'` (dejando `rbac_role_id = 3` huérfano) y restableció `password_hash` y los campos de perfil al seed. En producción, además, restablecería la contraseña del administrador y los roles modificados en cada reinicio.
- **Arreglo propuesto (coordinar con `1.A8` y `F-2`)**:
  1. En `seedDefaultUsers()`, cambiar el comportamiento a **solo creación si no existe** (`if (existing) continue;` o `findOrCreate`), sin sobrescribir jamás `role`, `rbac_role_id`, `password_hash` ni datos de perfil de usuarios ya existentes.
  2. En [app.js](../app.js#L496-L505), **no ejecutar `seedDefaultUsers()` en `NODE_ENV=production`** (restringirlo a entorno de desarrollo o ejecución manual explícita por CLI/variable dedicada, en coordinación con `1.A8`).
  3. Añadir prueba automatizada que verifique que re-ejecutar `seedDefaultUsers()` tras un ascenso a `inifap` o un cambio de contraseña **preserva intactos** `role`, `rbac_role_id` y `password_hash`.

## 14. H-3: Degradar un usuario desde `/private/users` conserva el sub-rol seleccionado y es rechazado con `subrol_solo_inifap`

- **Ubicación**: [usersController.js](../src/controllers/private/usersController.js#L147-L155), [usersController.js](../src/controllers/private/usersController.js#L440-L450), [rbacController.js](../src/controllers/private/rbacController.js#L81-L103), [users.hbs](../src/views/private/admin/users.hbs#L946-L971), [users.hbs](../src/views/private/admin/users.hbs#L1062-L1102), [users.js](../public/js/private/users.js#L98-L107).
- **Qué se observó**:
  - Al degradar un usuario `inifap` con sub-rol asignado desde `/private/users` (por ejemplo, hacia `agricultor`), el selector de sub-rol (`rbac_role_id`) no se vacía automáticamente en el formulario y el servidor rechaza la operación con `subrol_solo_inifap`.
- **Propuesta**:
  1. Al degradar desde `inifap` a un nivel base distinto, **retirar el sub-rol automáticamente** en el servidor (revocar privilegios nunca debe bloquearse).
  2. Deshabilitar y limpiar el selector de sub-rol en la interfaz cuando el nivel base seleccionado no sea `inifap`.
  3. Mostrar un modal de confirmación que liste explícitamente qué se retira (cambio de nivel base, sub-rol removido y privilegios asociados).
  4. Seguir rechazando con `subrol_solo_inifap` cualquier **asignación explícita** de sub-rol a una cuenta cuyo nivel base no sea `inifap`.

## 15. H-4: La auditoría de cambios de rol omite el sub-rol y los permisos concedidos (prioridad alta tras la demo)

- **Ubicación**: [usersController.js](../src/controllers/private/usersController.js#L74-L94), [usersController.js](../src/controllers/private/usersController.js#L452-L473), [rbacController.js](../src/controllers/private/rbacController.js#L25-L37), [rbacController.js](../src/controllers/private/rbacController.js#L335-L346), [auditController.js](../src/controllers/private/auditController.js), [audit.hbs](../src/views/private/admin/audit.hbs).
- **Qué se observó**:
  - La auditoría de cambios de rol muestra el puesto/nivel del usuario, pero no deja rastro claro del sub-rol RBAC ni de los permisos concedidos o retirados.
- **Propuesta (prioridad alta tras la demo)**:
  - Registrar explícitamente **nivel base y sub-rol antes y después** del cambio, además de los permisos concedidos/retirados, **quién** realizó la acción (actor) y **a quién** afectó (usuario objetivo), y reflejarlo de forma legible en `/private/audit`.

## 16. H-5: La pantalla de roles muestra claves técnicas de permisos en lugar de etiquetas legibles

- **Ubicación**: [users.hbs](../src/views/private/admin/users.hbs#L505-L518), [users.hbs](../src/views/private/admin/users.hbs#L568-L583) y [rbacService.js](../src/services/rbacService.js#L79-L120).
- **Qué se observó**:
  - La pantalla de administración de roles y sub-roles en `/private/users` muestra claves técnicas crudas de permisos (p. ej. `crops.create`) en las tarjetas de sub-roles y en la matriz de permisos.
- **Propuesta**:
  - Sustituir las claves técnicas visibles por **etiquetas legibles en español**, agrupadas por módulo (reutilizando y completando las definiciones de `PERMISSION_DEFINITIONS`).

## 17. H-6: Limpieza de `rbac_role_id` en canje y serialización, y verificación de auditoría en ascensos directos

- **Ubicación**: [authController.js](../src/controllers/authController.js#L30-L43), [app.js](../app.js#L458-L464), [profileController.js](../src/controllers/private/profileController.js#L22-L43), [usersController.js](../src/controllers/private/usersController.js#L422-L479), [rbacController.js](../src/controllers/private/rbacController.js#L295-L359).
- **Qué se observó**:
  - **(a)** `applyUpgradeTransaction` en [authController.js](../src/controllers/authController.js#L30-L43) solo actualiza `user.rbac_role_id` si `inifapCode.rbac_role_id` tiene valor, por lo que **conserva un `rbac_role_id` huérfano** preexistente si el código canjeado no trae sub-rol.
  - **(b)** [app.js](../app.js#L458-L464) y [profileController.js](../src/controllers/private/profileController.js#L22-L43) dejan `rbac_role_id` crudo en `safeUser` sin depurarlo cuando el usuario no tiene rol `inifap`.
  - **(c)** Un administrador puede ascender una cuenta a `inifap` directamente desde la administración sin canjear un código INIFAP: comprobar que dicha promoción queda debidamente auditada (ver **H-4**).

## 18. H-7: Permisos de sub-roles casi decorativos y desalineación con la interfaz de ingredientes

- **Ubicación**: [authMiddleware.js](../src/middlewares/authMiddleware.js#L15-L77), [adminRoutes.js](../src/routes/private/adminRoutes.js#L59), [catalogRoutes.js](../src/routes/private/catalogRoutes.js#L203-L223), [ingredientsController.js](../src/controllers/private/ingredientsController.js#L92), [ingredients.hbs](../src/views/private/catalog/ingredients.hbs#L11-L24), [app.js](../app.js#L465-L466), [profile.hbs](../src/views/shared/profile.hbs#L788), [cropAuthorizationService.js](../src/services/cropAuthorizationService.js).
- **Qué se observó**:
  - Los permisos de los sub-roles son hoy casi decorativos: `effectivePermissions` solo se muestra en vistas; **ninguna ruta** usa el middleware `requirePermission`; `/private/audit` exige `requireRole('admin')`.
  - El único permiso delegado que realmente abre una ruta es `ingredients.manage`, mediante una excepción acoplada por path (`/ingredients`) dentro de `hasSpecificDelegatedPermission` en [authMiddleware.js](../src/middlewares/authMiddleware.js#L15-L28).
  - En la interfaz de ingredientes, [ingredientsController.js](../src/controllers/private/ingredientsController.js#L92) calcula `canManage: user?.role === 'admin'`, por lo que los botones de creación/edición/eliminación no aparecen para personal `inifap` con el sub-rol aunque el servidor permita la operación.
- **Decisión pendiente y verificación**:
  - **Decidir**: conectar los permisos granulares a las rutas con `requirePermission` y alinear la interfaz (incluido `canManage` en ingredientes), **o** dejar de mostrarlos en la UI como concesión efectiva de acceso.
  - Verificar cómo aplican autorización [cropAuthorizationService.js](../src/services/cropAuthorizationService.js) y los controladores y servicios de autorización de **plagas** y **productos**.

## 19. H-8: `normalizePublicImageUrl` sin llamadores y revisión de rutas de entrada de URLs de imagen (después de la demo)

- **Ubicación**: [upload.js](../src/middlewares/upload.js#L30-L42).
- **Qué se observó**:
  - `normalizePublicImageUrl` no se usa en ninguna parte del código (**0 llamadores** en el repositorio).
- **Alcance propuesto (para atender después de la demo)**:
  - Auditar por qué rutas y campos entran las URLs de imagen en la plataforma (**formularios de cultivos, plagas y productos, y avatares**) y verificar si alguna ruta acepta URLs arbitrarias.
  - Implementar la validación y protección real en el punto donde se guarda/persiste el valor (y eliminar o conectar `normalizePublicImageUrl` según corresponda).
