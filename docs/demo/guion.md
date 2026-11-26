# Guion de Demostración y Lista de Ensayo — AgroSystem INIFAP

**Fecha objetivo de presentación:** Viernes 27 de noviembre de 2026  
**Base de datos dedicada:** `agrosystem_demo` (aislada de `agrosystem_db`, `agrosystem_test*` y `agrosystem_load`)  
**Puerto recomendado de demo:** `http://localhost:3005`

> **Seguridad crítica:** El archivo `.env.demo` y los respaldos generados en `scripts/demo/backups/*.dump` contienen configuración/estado local y **NUNCA deben commitearse** al repositorio (ambos patrones están protegidos en `.gitignore`).

---

## 1. Preparación rápida del entorno (Windows PowerShell 5.1)

Todos los scripts dentro de `scripts/demo/` aplican **dos bloqueos obligatorios**:

1. Abortan con código de salida distinto de cero si `NODE_ENV=production`.
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
  - **8 insumos/productos publicados**, **9 ingredientes activos**, **4 proveedores** y relaciones cruzadas (`CropPlagues`, `PlagueProducts`, `CropProducts`).
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

| Perfil                          | Correo (`@demo.agrosystem.invalid`)        | Contraseña por defecto | Rol base     | Subrol RBAC                     | Uso en la demo                                             |
| ------------------------------- | ------------------------------------------ | ---------------------- | ------------ | ------------------------------- | ---------------------------------------------------------- |
| **Administrador General**       | `admin.demo@demo.agrosystem.invalid`       | `AgroDemoAdmin2026`    | `admin`      | N/A (control total)             | Gobernanza, usuarios, RBAC, auditoría, reportes y catálogo |
| **Técnico INIFAP (sin subrol)** | `tecnico.demo@demo.agrosystem.invalid`     | `AgroDemoTecnico2026`  | `inifap`     | Ninguno (`rbac_role_id = null`) | Panel técnico base, consulta/edición y envío a revisión    |
| **Técnico INIFAP (con subrol)** | `coordinador.demo@demo.agrosystem.invalid` | `AgroDemoEditor2026`   | `inifap`     | `Coordinador Editorial`         | Revisión editorial, verificación y publicación de fichas   |
| **Productor Agrícola**          | `productor.demo@demo.agrosystem.invalid`   | `AgroDemoCampo2026`    | `agricultor` | Ninguno (`rbac_role_id = null`) | Consulta pública, bloqueo `403`, sugerencias y ascenso     |

- **Código INIFAP disponible para canje en vivo:** `AGS-DEMO-2026-INIF-AP01` (vigente 90 días, `is_used = false`, `revoked_at = null`).

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
   - **Acción negativa 2 (bloqueo de panel privado):** Intentar navegar manualmente a **`/dashboard`**, **`/private/lands`**, **`/private/plagues`** y **`/private/users`**.
   - **Resultado esperado:** Página **HTTP `403 Forbidden`** (_Acceso Denegado_) en todas las rutas `/dashboard` y `/private/...`.
3. Abrir **`/profile`** como productor para confirmar que el perfil propio sí es accesible para cuentas autenticadas.

### Bloque C — Colaboración ciudadana (sugerencias pendientes) (2 min)

1. Aún con sesión de **`productor.demo@demo.agrosystem.invalid`**, navegar a **`/plagues`**.
   - Explicar que el productor puede enviar una propuesta ciudadana (`POST /suggestions/plagues`) sin alterar el catálogo público hasta validación técnica del INIFAP.
   - _(Opcional en vivo)_ Enviar una propuesta corta o mostrar directamente las propuestas precargadas (`Mosca Blanca del Algodonero` y `Aguacate Hass (Propuesta Ciudadana)`), que generan notificación editorial y registro en `AuditLogs`.
2. Cerrar sesión (botón `POST /auth/logout`).

### Bloque D — Diferenciación de permisos INIFAP y flujo editorial (4 min)

1. Iniciar sesión como **`tecnico.demo@demo.agrosystem.invalid`** / `AgroDemoTecnico2026` (`inifap` **sin subrol**).
   - Abrir **`/dashboard`**: mostrar KPIs reales (validaciones pendientes, alertas críticas abiertas, hectáreas monitoreadas, top de plagas del mes y distribución de cultivos).
   - Abrir **`/private/suggestions`** (redirige a **`/private/plagues?workflow=in_review`**): mostrar las dos fichas pendientes:
     - **`Barrenador del Tallo de Maíz`** (en revisión editorial técnica).
     - **`Mosca Blanca del Algodonero`** (propuesta ciudadana enviada por el productor).
   - Intentar entrar a **`/private/users`** o **`/private/audit`**: confirmar respuesta **`403 Forbidden`** (exclusivo de administrador).
   - Cerrar sesión.
2. Iniciar sesión como **`coordinador.demo@demo.agrosystem.invalid`** / `AgroDemoEditor2026` (`inifap` **con subrol `Coordinador Editorial`**).
   - Mostrar insignia del subrol **`Coordinador Editorial`** en perfil/cabecera y notificaciones editoriales en la campana.
   - Abrir **`/private/plagues?workflow=in_review`**, ingresar al detalle de **`Barrenador del Tallo de Maíz`**, ejecutar transición **`Verificar`** y luego **`Publicar`**.
   - Comprobar en **`/plagues`** que la plaga recién publicada ahora aparece en el catálogo público.
   - Revisar también **`/private/crops?workflow=in_review`** donde espera **`Aguacate Hass (Propuesta Ciudadana)`**.

### Bloque E — Predios, ciclos fenológicos y bitácora operativa (3 min)

1. Desde el panel privado (con `coordinador.demo` o `admin.demo`), navegar a **`/private/lands`**.
   - **Pantalla esperada:** Padrón de **10 predios** distribuidos en Sinaloa, Michoacán, Sonora, El Bajío, Colima, Veracruz, Puebla, Estado de México y Chiapas, con estadísticas de hectáreas y exportación CSV/GeoJSON.
2. Abrir el expediente de **`Parcela Valle Verde Norte`** (`/private/lands/<id>/expediente`).
   - **Mostrar:**
     - **Lotes (`FarmLots`):** `Lote A - Maíz Grano` y `Lote B - Hortaliza`.
     - **Ciclos activos (`FarmCrops`):** Maíz y Jitomate con barra de progreso y **5 etapas fenológicas (`FarmCropStages`)**.
     - **Reportes sanitarios (`FarmHealthReports`):** alerta alta abierta por _Gusano Cogollero_.
     - **Aplicaciones (`FarmApplications`):** aplicación registrada de _Coragen_ (`125 mL/ha`).

### Bloque F — Gobernanza administrativa y auditoría (2 min)

1. Cerrar sesión e iniciar como **`admin.demo@demo.agrosystem.invalid`** / `AgroDemoAdmin2026`.
2. Recorrer brevemente:
   - **`/private/users`**: tabla de usuarios, subroles RBAC (`Coordinador Editorial`, `Curador de Insumos y Proveedores`, `Auditor Fitosanitario`, `Moderador Institucional`) y pestaña de códigos INIFAP mostrando `AGS-DEMO-****-****-AP01` en estado **Disponible**.
   - **`/private/ingredients`** y **`/private/suppliers`**: 9 ingredientes activos y 4 proveedores.
   - **`/private/reports`**: resumen analítico y exportación PDF.
   - **`/private/audit`**: trazabilidad cronológica incluyendo propuestas ciudadanas y publicaciones recién realizadas en vivo.
3. Cerrar sesión.

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

El script valida los guardrails (`agrosystem_demo*` y no producción), cierra conexiones abiertas sobre `agrosystem_demo`, restaura el `.dump` más reciente en pocos segundos e imprime el conteo verificado (incluyendo `InifapCodesDisponibles=1` y `productor.demo` nuevamente como `agricultor`).

---

## 4. Checklist de ensayo previo (D-1 y D-0)

> **IMPORTANTE — Re-verificación obligatoria tras merges de `H-2` y `1.A5`:**  
> Una vez que los PRs de **`H-2`** (aplicación estricta de subroles RBAC únicamente para `role === 'inifap'`) y **`1.A5`** (endurecimiento de seguridad/autenticación) sean fusionados a `main`, **se debe re-ejecutar `setupDemoDb.js` y volver a verificar inicio de sesión, sesiones activas, badges de rol y bloqueos `403` sobre `agrosystem_demo`** antes de la presentación del viernes 27 de noviembre de 2026.

- [ ] `.env.demo` creado localmente desde `scripts/demo/.env.demo.example` con `DB_NAME=agrosystem_demo` y `NODE_ENV=development` (y verificado con `git status` que NO está rastreado).
- [ ] `node scripts/demo/setupDemoDb.js --env-file .env.demo` ejecutado **dos veces seguidas** con salida `0` y conteos de filas idénticos en ambas corridas.
- [ ] Guardrails probados manualmente: el script aborta con código `1` si `DB_NAME=agrosystem_test` o `NODE_ENV=production`.
- [ ] Respaldo limpio tomado con `node scripts/demo/backupDemoDb.js --env-file .env.demo` en **menos de 60 segundos** (y confirmado en `.gitignore`).
- [ ] Restauración probada en seco con `node scripts/demo/restoreDemoDb.js --env-file .env.demo --latest` en **menos de 60 segundos**.
- [ ] Portada `/` revisada: mapa SVG interactivo, boletines regionales y contadores sin valores rotos.
- [ ] Catálogos `/plagues`, `/crops`, `/products` y `/lands` revisados: **cero imágenes rotas** (todas existen en `public/images/`) y descarga de PDF `/products/<id>/hds.pdf` operativa.
- [ ] **Prueba negativa de login:** contraseña incorrecta en `/auth/login` devuelve `401` con mensaje genérico `Credenciales incorrectas.`.
- [ ] **Prueba negativa RBAC (`403`):** `productor.demo@demo.agrosystem.invalid` (`agricultor`) recibe **`403 Forbidden`** al intentar acceder a `/dashboard`, `/private/lands`, `/private/plagues`, `/private/ingredients` y `/private/users`.
- [ ] **Re-verificación post-merge (`H-2` y `1.A5`):** confirmar nuevamente login, permisos de `tecnico.demo` (sin subrol) vs `coordinador.demo` (subrol `Coordinador Editorial`), bloqueo `403` de `agricultor` en `/private/...` y tarjetas de rol sobre `agrosystem_demo` después de integrar ambos PRs en `main`.
- [ ] Flujo editorial probado: `Barrenador del Tallo de Maíz` verificado y publicado; sugerencias `Mosca Blanca del Algodonero` y `Aguacate Hass (Propuesta Ciudadana)` visibles en bandeja `in_review`.
- [ ] Expediente de predio probado (`/private/lands/<id>/expediente`): lotes, ciclos activos con etapas fenológicas, reportes sanitarios y aplicaciones visibles.
- [ ] Canje de código INIFAP (`AGS-DEMO-2026-INIF-AP01`) probado en `/auth/inifap-upgrade` y revertido exitosamente con `restoreDemoDb.js --latest`.
- [ ] Antes de cerrar la presentación o hacer commit, verificar `git status` limpio (sin `.env.demo` ni archivos `.dump` rastreados).
