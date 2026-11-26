# Guion de Demostración y Lista de Ensayo — AgroSystem INIFAP

**Fecha objetivo de presentación:** Viernes 27 de noviembre de 2026  
**Base de datos dedicada:** `agrosystem_demo` (aislada de `agrosystem_db`, `agrosystem_test*` y `agrosystem_load`)  
**Puerto recomendado de demo:** `http://localhost:3005`

> **Seguridad crítica:** El archivo `.env.demo` y los respaldos generados en `scripts/demo/backups/*.dump` contienen configuración/estado local y **NUNCA deben commitearse** al repositorio (ambos patrones están protegidos en `.gitignore`).

---

## 1. Preparación rápida del entorno (Windows PowerShell 5.1)

Todos los scripts dentro de `scripts/demo/` aplican **dos bloqueos obligatorios**:

1. Abortan con código de salida distinto de cero si `NODE_ENV=production` (tanto en el proceso actual como dentro del archivo `--env-file`).
2. Abortan con código de salida distinto de cero si `DB_NAME` no inicia con `agrosystem_demo` (`!/^agrosystem_demo/i.test(dbName)`).

### 1.1 Crear `.env.demo` (sin commitear)

```powershell
Copy-Item scripts/demo/.env.demo.example .env.demo
```

Edita `.env.demo` en la raíz del proyecto y sustituye los marcadores `<CAMBIAR_...>` (`DB_USER`, `DB_PASS`, `SESSION_SECRET`). Mantén `NODE_ENV=development` y `DB_NAME=agrosystem_demo`.

### 1.2 Inicializar la base de datos demo (idempotente)

```powershell
node scripts/demo/setupDemoDb.js --env-file .env.demo
```

El script:

- Crea la base `agrosystem_demo` si aún no existe.
- Ejecuta las migraciones oficiales de Sequelize sobre `agrosystem_demo`.
- Verifica en disco que todas las imágenes sembradas existan bajo `public/images/`.
- Siembra un conjunto compacto, realista e idempotente (puede ejecutarse dos veces seguidas con conteos estables):
  - **4 usuarios ficticios** (`@demo.agrosystem.invalid`, sin datos personales ni correos repetidos de `src/scripts/seedDefaultUsers.js`).
  - **1 código INIFAP sin usar** (`AGS-DEMO-2026-INIF-AP01`).
  - **10 regiones agrícolas** con relaciones `PlagueRegions` y **5 boletines regionales** publicados para el mapa SVG y la portada.
  - **7 cultivos publicados** + **1 propuesta ciudadana pendiente** (`Aguacate Hass (Propuesta Ciudadana)`).
  - **8 plagas publicadas** + **1 plaga en revisión editorial** (`Barrenador del Tallo de Maíz`) + **1 sugerencia ciudadana pendiente** (`Mosca Blanca del Algodonero`).
  - **8 insumos/productos publicados**, **10 ingredientes activos** (incluyendo **`Clorpirifos Etil`**, `clase-i`, libre de productos activos para demostrar la solicitud y aprobación dual de baja), **4 proveedores** y relaciones cruzadas (`CropPlagues`, `PlagueProducts`, `CropProducts`).
  - **10 predios (`Farms`)** distribuidos entre los 4 usuarios con lotes (`FarmLots`), ciclos activos y finalizados (`FarmCrops` + `FarmCropStages`), reportes sanitarios (`FarmHealthReports`) y aplicaciones (`FarmApplications`).
  - **Notificaciones** y **bitácora de auditoría (`AuditLogs`)** recientes.

### 1.3 Tomar respaldo limpio antes de iniciar (meta `< 60 s`)

```powershell
node scripts/demo/backupDemoDb.js --env-file .env.demo
```

Guarda un archivo `.dump` comprimido en `scripts/demo/backups/` (ignorado por Git) en unos pocos segundos.

### 1.4 Levantar la aplicación apuntando a `agrosystem_demo`

Como `app.js` carga `.env` por defecto mediante `dotenv/config`, para levantar el servidor contra `.env.demo` sin modificar `.env`, inyecta las variables de `.env.demo` en tu sesión de PowerShell y ejecuta `node app.js`:

```powershell
Get-Content .env.demo | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
    [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
  }
}
$env:DB_NAME
node app.js
```

Confirma que `$env:DB_NAME` imprima `agrosystem_demo` y que la consola muestre:
`Servidor AgroSystem encendido en: http://localhost:3005`.

> **Nota sobre arranque en `development`:** Al iniciar `app.js` en `NODE_ENV=development`, el arranque invoca `seedDefaultUsers()` únicamente para cuentas faltantes de desarrollo. Durante la demo utiliza **exclusivamente** las cuentas `@demo.agrosystem.invalid` listadas abajo.

---

## 2. Credenciales de demostración y código INIFAP

Todas las cuentas usan el dominio ficticio `@demo.agrosystem.invalid`, cero datos personales reales y contraseñas validadas con `validatePasswordPolicy`.

| Perfil                          | Correo (`@demo.agrosystem.invalid`)      | Contraseña por defecto | Rol base     | Subrol RBAC                                            | Uso en la demo                                                                              |
| ------------------------------- | ---------------------------------------- | ---------------------- | ------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **Administrador General**       | `admin.demo@demo.agrosystem.invalid`     | `AgroDemoAdmin2026`    | `admin`      | N/A (control total)                                    | Gobernanza, usuarios, RBAC, auditoría (`/private/audit`), aprobación dual y publicar        |
| **Técnico INIFAP (sin subrol)** | `tecnico.demo@demo.agrosystem.invalid`   | `AgroDemoTecnico2026`  | `inifap`     | Ninguno (`rbac_role_id = null`)                        | Panel técnico base, consulta/edición y envío a revisión                                     |
| **Técnico INIFAP (con subrol)** | `curador.demo@demo.agrosystem.invalid`   | `AgroDemoCurador2026`  | `inifap`     | `Curador de Insumos y Proveedores` (`curador-insumos`) | Verificación técnica, proveedores, solicitud de baja de ingrediente (`ingredients.manage`)* |
| **Productor Agrícola**          | `productor.demo@demo.agrosystem.invalid` | `AgroDemoCampo2026`    | `agricultor` | Ninguno (`rbac_role_id = null`)                        | Consulta pública, bloqueo `403`, sugerencias y ascenso                                      |

- **Código INIFAP disponible para canje en vivo:** `AGS-DEMO-2026-INIF-AP01` (vigente 90 días, `is_used = false`, `revoked_at = null`).
- **Alcance real del subrol `Curador de Insumos y Proveedores` (`slug: curador-insumos`):** otorga permisos delegados `ingredients.manage`, `suppliers.manage` y `products.publish` además de los permisos base `inifap`. **NO** otorga acceso a `/private/audit` ni a `/private/users` (exclusivos de `admin`, responden `403 Forbidden`).

---

## 3. Guion paso a paso de la demostración (15–20 min)

### Bloque A — Portal público y mapa nacional de alertas (3 min)

1. Abrir **`http://localhost:3005/`**.
   - **Pantalla esperada:** Encabezado SNVF, buscador predictivo (Plagas / Cultivos / Insumos / Regiones) y tarjeta con métricas reales verificadas (`Registros verificados` calculado desde `Plagues` + `Crops` + `Products` publicados).
2. Desplazarse a **`#panorama-nacional`** (_Alertas fitosanitarias por entidad_).
   - **Acción:** Hacer clic en **Sinaloa**, **Michoacán** y **Sonora** en el mapa SVG interactivo.
   - **Pantalla esperada:** Actualización dinámica de la ficha lateral con incidencia, cultivo afectado y plaga prioritaria; debajo, el **Boletín Fitosanitario** muestra los avisos reales de `RegionalBulletins` (`DEMO-SNVF-2026-01` a `05`) y el calendario de cultivos de temporada.
3. Recorrer los catálogos públicos:
   - **`/plagues`**: 8 plagas publicadas con imágenes `.webp` cargando sin roturas; abrir detalle de **Gusano Cogollero** para mostrar ciclo biológico, control biológico y productos recomendados.
   - **`/crops`**: 7 cultivos publicados con imágenes `.webp`; abrir **Maíz** para ver ficha agronómica y plagas asociadas.
   - **`/products`**: 8 insumos autorizados con banda toxicológica; descargar una Hoja de Datos de Seguridad en **`/products/<id>/hds.pdf`**.
   - **`/lands`**: mapa nacional SVG de cobertura regional encendido con regiones activas (`Sinaloa`, `Michoacán`, `El Bajío`, `Sonora`, `Veracruz`, `Chiapas`, `Colima`, `Yucatán`, `Puebla`, `Estado de México`) y sección `#boletines-regionales`.

### Bloque B — Seguridad de autenticación y control de acceso `403` (2 min)

1. Ir a **`/auth/login`**.
   - **Acción negativa 1 (contraseña incorrecta):** Ingresar `productor.demo@demo.agrosystem.invalid` con contraseña errónea `ClaveIncorrecta99`.
   - **Resultado esperado:** HTTP `401`, alerta roja con el mensaje genérico **`Credenciales incorrectas.`** (sin revelar si falló correo o contraseña) y correo preservado en el campo.
2. Iniciar sesión correctamente con **`productor.demo@demo.agrosystem.invalid`** / `AgroDemoCampo2026`.
   - **Acción negativa 2 (bloqueo de panel privado):** Intentar navegar manualmente a **`/dashboard`**, **`/private/lands`**, **`/private/plagues`**, **`/private/ingredients`** y **`/private/users`**.
   - **Resultado esperado:** Página **HTTP `403 Forbidden`** (_Acceso Denegado_) en todas las rutas `/dashboard` y `/private/...`.
3. Abrir **`/profile`** como productor para confirmar que el perfil propio sí es accesible para cuentas autenticadas.

### Bloque C — Colaboración ciudadana (sugerencias pendientes) (2 min)

1. Aún con sesión de **`productor.demo@demo.agrosystem.invalid`**, navegar a **`/plagues`**.
   - Explicar que el productor puede enviar una propuesta ciudadana (`POST /suggestions/plagues`) sin alterar el catálogo público hasta validación técnica del INIFAP.
   - _(Opcional en vivo)_ Enviar una propuesta corta o mostrar directamente las propuestas precargadas (`Mosca Blanca del Algodonero` y `Aguacate Hass (Propuesta Ciudadana)`), que generan notificación editorial y registro en `AuditLogs`.
2. Cerrar sesión (botón `POST /auth/logout`).

### Bloque D — Permisos INIFAP, verificación editorial y solicitud de baja de ingrediente (4 min)

1. Iniciar sesión como **`tecnico.demo@demo.agrosystem.invalid`** / `AgroDemoTecnico2026` (`inifap` **sin subrol**).
   - Abrir **`/dashboard`**: mostrar KPIs reales (validaciones pendientes, alertas críticas abiertas, hectáreas monitoreadas, top de plagas del mes y distribución de cultivos).
   - Abrir **`/private/suggestions`** (redirige a **`/private/plagues?workflow=in_review`**): mostrar las dos fichas pendientes:
     - **`Barrenador del Tallo de Maíz`** (en revisión editorial técnica, redactada por este técnico).
     - **`Mosca Blanca del Algodonero`** (propuesta ciudadana enviada por el productor).
   - Intentar entrar a **`/private/users`** o **`/private/audit`**: confirmar respuesta **`403 Forbidden`** (exclusivo de administrador).
   - Cerrar sesión.
2. Iniciar sesión como **`curador.demo@demo.agrosystem.invalid`** / `AgroDemoCurador2026` (`inifap` **con subrol `Curador de Insumos y Proveedores`**).
   - Mostrar la insignia del subrol **`Curador de Insumos y Proveedores`** en cabecera/perfil y las notificaciones en la campana.
   - Confirmar que `/private/audit` y `/private/users` siguen respondiendo **`403 Forbidden`** para este subrol (la bitácora de auditoría y gestión de usuarios son exclusivas de `admin`).
   - **Verificación técnica editorial:** Abrir **`/private/plagues?workflow=in_review`**, ingresar al detalle de **`Barrenador del Tallo de Maíz`** (autor distinto) y ejecutar **`Verificar`** (pasa a estado `verified`, lista para publicación por `admin`). Revisar también **`/private/crops?workflow=in_review`** donde espera **`Aguacate Hass (Propuesta Ciudadana)`**.
   - **Solicitud de baja de ingrediente activo (aprobación dual — Paso 1):**
     - Navegar a **`/private/ingredients`**.
     - **Nota técnica importante (Hallazgo H-7):** En la interfaz de `/private/ingredients`, los botones de **Añadir**, **Editar** y **Eliminar** ingredientes **no aparecen para el subrol `Curador de Insumos y Proveedores`** porque la vista evalúa `canManage: user?.role === 'admin'` (`src/controllers/private/ingredientsController.js`), aunque el servidor sí autoriza el permiso delegado `ingredients.manage` en las rutas de mutación (`src/middlewares/authMiddleware.js`). Explicarlo con transparencia si alguien pregunta durante la sesión.
     - Localizar la molécula **`Clorpirifos Etil`** (`Clase I · OMS`, restringida y sin productos activos formulados) y hacer clic en el icono de escudo ámbar **`Solicitar baja justificada`** (abre el modal `#modal-request-archive-ingredient`, que envía `POST /private/ingredients/<id>/workflow` con `action=request_archive`).
     - Seleccionar causa **`Prohibición Regulatoria (CICOPLAFEST / OMS / Convenio de Róterdam)`**, escribir una justificación técnica de al menos 20 caracteres (ej. `"Retiro regulatorio por alta toxicidad OMS Clase I y actualización del catálogo oficial INIFAP."`) y enviar **`Tramitar Solicitud de Baja`**.
     - **Resultado esperado:** **`Clorpirifos Etil`** cambia a etiqueta **`Baja en trámite`** (`archive_pending`). Comprobar que `curador.demo` **no ve el botón de aprobar su propia solicitud** (principio de los 4 ojos / aprobación dual).
   - Mostrar también **`/private/suppliers`** (4 proveedores) y cerrar sesión.

### Bloque E — Privacidad de predios por propietario, ciclos fenológicos y bitácora operativa (3 min)

> **Regla de privacidad estricta (`landAuthorizationService.js`):** En `/private/lands`, cada usuario autenticado con acceso al panel (incluyendo `admin`) **ve y administra únicamente sus propios predios** (`where.user_id = req.user.id`). Los 10 predios del entorno demo están distribuidos entre las 4 cuentas (3 de `productor.demo`, 3 de `tecnico.demo`, 2 de `curador.demo` y 2 de `admin.demo`). Intentar abrir directamente el expediente de un predio de otro propietario (por ejemplo `Parcela Valle Verde Norte`, propiedad de `productor.demo`) responde `404`.

1. Aún con sesión de **`curador.demo@demo.agrosystem.invalid`**, navegar a **`/private/lands`**.
   - **Pantalla esperada:** Muestra exclusivamente sus **2 predios propios** (**`Huerto Centinela Colima Costa`** y **`Parcela Citricola Veracruz Golfo`**) con indicadores de hectáreas y exportación CSV/GeoJSON.
2. Abrir el expediente de **`Huerto Centinela Colima Costa`** (`/private/lands/<id>/expediente`).
   - **Mostrar:**
     - **Lotes (`FarmLots`):** `Cuadro Limón 1` (18 ha) y `Cuadro Limón 2` (12 ha).
     - **Ciclo activo (`FarmCrops`):** _Limón Mexicano_ con barra de progreso y **5 etapas fenológicas (`FarmCropStages`)**.
     - **Reporte sanitario (`FarmHealthReports`):** seguimiento de _Psílido Asiático de los Cítricos_ (estado `resolved`).
     - **Aplicación (`FarmApplications`):** registro fitosanitario de _Confidor 350 SC_ (`0.85 L/ha`).
3. _(En el Bloque F, con **`admin.demo`**)_ Abrir **`/private/lands`** para mostrar el aislamiento entre usuarios (ve solo sus **2 predios**: **`Campo Valles Altos Metepec`** y **`Estación Frontera Sur Soconusco`**) e ingresar al expediente de **`Campo Valles Altos Metepec`** (`/private/lands/<id>/expediente`):
   - **Lotes (`FarmLots`):** `Lote Papa Alpha 1` y `Lote Semilla`.
   - **Ciclos (`FarmCrops`):** ciclo activo de _Papa_ + ciclo finalizado de _Trigo_, cada uno con **5 etapas fenológicas (`FarmCropStages`)**.
   - **Reporte sanitario (`FarmHealthReports`):** alerta abierta de severidad alta por _Tizón Tardío_ (reflejada también en el KPI de alertas críticas de `/dashboard`).
   - **Aplicación (`FarmApplications`):** aplicación preventiva de _Ridomil Gold Bravo_ (`2.0 L/ha`).

### Bloque F — Gobernanza administrativa, aprobación dual y auditoría (3 min)

1. Cerrar sesión e iniciar como **`admin.demo@demo.agrosystem.invalid`** / `AgroDemoAdmin2026`.
2. **Aprobación dual de baja de ingrediente (Paso 2):**
   - Abrir **`/private/ingredients`**, localizar **`Clorpirifos Etil`** con etiqueta **`Baja en trámite`** y hacer clic en **`Aprobar dictamen de baja (Dual Approval)`** (`POST /private/ingredients/<id>/workflow` con `action=approve_archive`).
   - **Resultado esperado:** Al ser un usuario distinto al solicitante y no existir productos comerciales activos que dependan de `Clorpirifos Etil`, el ingrediente pasa limpiamente a estado **`Archivado`** (`archived`) y aparece la opción **`Restaurar a activo`** exclusiva de administrador.
3. **Publicación editorial final:**
   - Abrir **`/private/plagues`** (estado `verified`), ingresar a **`Barrenador del Tallo de Maíz`** y ejecutar **`Publicar`**; comprobar en **`/plagues`** que ya figura en el catálogo público.
4. Recorrer los módulos exclusivos de administración:
   - **`/private/users`**: tabla de usuarios, subroles RBAC (`Coordinador Editorial`, `Curador de Insumos y Proveedores`, `Auditor Fitosanitario`, `Moderador Institucional`) y pestaña de códigos INIFAP mostrando `AGS-DEMO-****-****-AP01` en estado **Disponible**.
   - **`/private/reports`**: resumen analítico y exportación PDF.
   - **`/private/audit`**: trazabilidad cronológica mostrando `workflow.request_archive` (por `curador.demo`), `workflow.approve_archive` (por `admin.demo`), las propuestas ciudadanas y la publicación recién realizada en vivo.
5. Cerrar sesión.

### Bloque G — Ascenso a Personal INIFAP con código único (2 min)

1. Iniciar sesión nuevamente como **`productor.demo@demo.agrosystem.invalid`** / `AgroDemoCampo2026`.
2. Navegar a **`/auth/inifap-upgrade`**.
3. Ingresar el código **`AGS-DEMO-2026-INIF-AP01`**, seleccionar puesto (`Especialista Agrónomo`) y turno (`Matutino`), y enviar.
4. **Resultado esperado:**
   - Redirección inmediata a **`/dashboard`** con sesión regenerada y rol actualizado a **`inifap`**.
   - El código queda quemado (`is_used = true`) y genera notificación de éxito para el usuario y aviso para administración.

### Bloque H — Reinicio rápido entre ensayos o post-demo (`< 1 min`)

Detener el servidor (`Ctrl + C`) y restaurar la instantánea limpia previa a la presentación:

```powershell
node scripts/demo/restoreDemoDb.js --env-file .env.demo --latest
```

El script valida los guardrails (`agrosystem_demo*` y no producción), cierra conexiones abiertas sobre `agrosystem_demo`, restaura el `.dump` más reciente en pocos segundos e imprime el conteo verificado (incluyendo `InifapCodesDisponibles=1`, `Clorpirifos Etil` nuevamente `active` y `productor.demo` nuevamente como `agricultor`).

---

## 4. Checklist de ensayo previo (D-1 y D-0)

> **IMPORTANTE — Re-verificación obligatoria tras merges de `H-2` y `1.A5`:**  
> Una vez que los PRs de **`H-2`** (aplicación estricta de subroles RBAC únicamente para `role === 'inifap'`) y **`1.A5`** (endurecimiento de seguridad/autenticación) sean fusionados a `main`, **se debe re-ejecutar `setupDemoDb.js` y volver a verificar inicio de sesión, sesiones activas, badges de rol y bloqueos `403` sobre `agrosystem_demo`** antes de la presentación del viernes 27 de noviembre de 2026.

- [ ] `.env.demo` creado localmente desde `scripts/demo/.env.demo.example` con `DB_NAME=agrosystem_demo` y `NODE_ENV=development` (y verificado con `git status` que NO está rastreado).
- [ ] `node scripts/demo/setupDemoDb.js --env-file .env.demo` ejecutado **dos veces seguidas** con salida `0` y conteos de filas idénticos en ambas corridas.
- [ ] Guardrails probados manualmente: los scripts abortan con código `1` si `DB_NAME=agrosystem_test` o si `NODE_ENV=production` (tanto en el proceso como en `--env-file`).
- [ ] Respaldo limpio tomado con `node scripts/demo/backupDemoDb.js --env-file .env.demo` en **menos de 60 segundos** (y confirmado en `.gitignore`).
- [ ] Restauración probada en seco con `node scripts/demo/restoreDemoDb.js --env-file .env.demo --latest` en **menos de 60 segundos**.
- [ ] Portada `/` revisada: mapa SVG interactivo, boletines regionales y contadores sin valores rotos.
- [ ] Catálogos `/plagues`, `/crops`, `/products` y `/lands` revisados: **cero imágenes rotas** (todas existen en `public/images/`) y descarga de PDF `/products/<id>/hds.pdf` operativa.
- [ ] **Prueba negativa de login:** contraseña incorrecta en `/auth/login` devuelve `401` con mensaje genérico `Credenciales incorrectas.`.
- [ ] **Prueba negativa RBAC (`403`):** `productor.demo@demo.agrosystem.invalid` (`agricultor`) recibe **`403 Forbidden`** al intentar acceder a `/dashboard`, `/private/lands`, `/private/plagues`, `/private/ingredients` y `/private/users`.
- [ ] **Prueba negativa de auditoría (`403`):** confirmar que tanto `tecnico.demo` como `curador.demo` (`Curador de Insumos y Proveedores`) reciben **`403 Forbidden`** en `/private/audit` y `/private/users`.
- [ ] **Flujo de aprobación dual de ingrediente + Hallazgo H-7:** confirmar que `curador.demo` ve **`Solicitar baja justificada`** en `/private/ingredients` (y **NO** ve botones de añadir/editar/eliminar por H-7), tramita la baja de **`Clorpirifos Etil`** (`POST /private/ingredients/<id>/workflow` con `action=request_archive`), no puede auto-aprobarla, y `admin.demo` aprueba la baja (`action=approve_archive`) dejándola en `Archivado` y visible en `/private/audit`.
- [ ] **Re-verificación post-merge (`H-2` y `1.A5`):** confirmar nuevamente login, permisos de `tecnico.demo` (sin subrol) vs `curador.demo` (subrol `Curador de Insumos y Proveedores`), bloqueo `403` de `agricultor` en `/private/...` y tarjetas de rol sobre `agrosystem_demo` después de integrar ambos PRs en `main`.
- [ ] Flujo editorial probado: `Barrenador del Tallo de Maíz` (ficha completa con 4 etapas de ciclo biológico, hospedero `Maíz` y regiones `Sinaloa`/`El Bajío`) verificado (`in_review` → `verified`) por `curador.demo` y publicado (`verified` → `published`) por `admin.demo`; sugerencias `Mosca Blanca del Algodonero` y `Aguacate Hass (Propuesta Ciudadana)` visibles en bandeja `in_review`.
- [ ] Privacidad y expediente de predios probados (`/private/lands` y `/private/lands/<id>/expediente`): confirmar que cada cuenta ve únicamente sus propios predios (`curador.demo` abre `Huerto Centinela Colima Costa`; `admin.demo` abre `Campo Valles Altos Metepec` con lotes, ciclos activos/finalizados con etapas fenológicas, reporte abierto de `Tizón Tardío` y aplicación de `Ridomil Gold Bravo`; el intento de abrir un predio de otro usuario responde `404`).
- [ ] Canje de código INIFAP (`AGS-DEMO-2026-INIF-AP01`) probado en `/auth/inifap-upgrade` y revertido exitosamente con `restoreDemoDb.js --latest`.
- [ ] Antes de cerrar la presentación o hacer commit, verificar `git status` limpio (sin `.env.demo` ni archivos `.dump` rastreados).
