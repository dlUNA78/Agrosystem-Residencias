# Entorno de Pruebas Tipo Producción y Corrida de 50 / 200 / 500 VUs

Guía paso a paso para levantar la aplicación junto con **PostgreSQL 16 (`pg_stat_statements`)** en contenedores con recursos acotados y ejecutar los tres niveles de carga acordados con `k6`.

---

## 1. Recomendación de máquina para tu PC (`7.79 GB RAM`, `8 CPU`, WSL 2)

En esta PC cuentas con **WSL 2 (`Ubuntu`)** y `7.79 GB` de RAM total (sin Docker instalado aún). Considera dos formas de correr este stack ([docker-compose.loadtest.yml](../docker-compose.loadtest.yml)):

1. **Correrlo en esta misma PC (vía WSL 2 o Docker Desktop)**:
   - **Opción más ligera**: instalar **Docker Engine dentro de Ubuntu (WSL 2)** (evita la interfaz de Docker Desktop y ahorra ~500–800 MB de RAM), **o** usar Docker Desktop limitando WSL 2 en `%UserProfile%\.wslconfig`:
     ```ini
     [wsl2]
     memory=4GB
     processors=4
     ```
   - La configuración por defecto en [docker-compose.loadtest.yml](../docker-compose.loadtest.yml) asigna **`2.0 CPUs` / `1536m`** a `postgres` y **`2.0 CPUs` / `1536m`** a `app` (`~3 GB` totales para contenedores), dejando margen para Windows y `k6`.
   - _Limitación al correr en un solo equipo_: a partir de `200–500 VUs`, `k6` competirá parcialmente por CPU/RAM con Node y PostgreSQL; sigue siendo útil para detectar cuellos SQL/HTML y saturación, teniendo presente ese sesgo en `p95`.
2. **Alternativa sin interferencia (si después dispones de una VM/VPS Linux)**:
   - Levantas exactamente el mismo `docker-compose.loadtest.yml` en una VM Linux (p. ej. 4 vCPU / 4 GB RAM) y ejecutas `k6` desde esta PC Windows apuntando a `BASE_URL=http://<IP_DEL_SERVIDOR>:3000`.

---

## 2. Preparación de variables y arranque del entorno Docker

### 2.1 Banderas habilitadas en modo carga controlada (Opción A)

El contenedor `app` corre con `NODE_ENV=production` (cacheo de vistas Handlebars, compresión y Helmet activos) y habilita explícitamente por variables de entorno en [docker-compose.loadtest.yml](../docker-compose.loadtest.yml) (sin alterar los valores seguros por defecto cuando no se definen):

- `COOKIE_SECURE=false`: permite emitir la cookie `connect.sid` sobre `http://localhost:3000` sin TLS/proxy (`app.js`).
- `DISABLE_RATE_LIMIT=true`: evita el bloqueo por `429` de `publicRateLimiter` (`30 req/min` por IP) y `authLimiter` al ejecutar múltiples VUs desde un mismo equipo (`src/middlewares/rateLimiter.js`).

> **Advertencia:** Nunca uses `COOKIE_SECURE=false` ni `DISABLE_RATE_LIMIT=true` en producción real.

### 2.2 Archivos de entorno y levantamiento

1. Crea tu archivo `.env.loadtest` (ignorado por Git) a partir de la plantilla:

   ```powershell
   Copy-Item .env.loadtest.example .env.loadtest
   ```

2. Edita `.env.loadtest` y reemplaza **todos** los marcadores `<CAMBIAR_...>` con contraseñas locales de prueba y un `SESSION_SECRET` largo. Deja `ADMIN_EMAIL=admin@agrosystem.com` y `FARMER_EMAIL=agricultor@agrosystem.com` para coincidir con los usuarios demo sembrados.

3. Construye las imágenes, migra, siembra los datos (`50k` terrenos / `50k` ciclos / `500k` logs / `50k` notificaciones / `100k` sesiones) y levanta PostgreSQL 16 + App:

   ```powershell
   docker compose -f docker-compose.loadtest.yml --env-file .env.loadtest up -d --build
   ```

4. Espera a que `migrate-seed` termine y `app` reporte estado `healthy`:

   ```powershell
   docker compose -f docker-compose.loadtest.yml --env-file .env.loadtest ps
   docker compose -f docker-compose.loadtest.yml --env-file .env.loadtest logs -f migrate-seed
   ```

5. Verifica que `pg_stat_statements` esté activo:

   ```powershell
   docker compose -f docker-compose.loadtest.yml --env-file .env.loadtest exec postgres psql -U $env:DB_USER -d agrosystem_loadtest -c "SELECT count(*) FROM pg_stat_statements;"
   ```

   _(Sustituye `$env:DB_USER` por el valor que definiste en `.env.loadtest`, p. ej. `agrosystem_load`.)_

---

## 3. Niveles de carga y umbrales acordados

| Escalón              | VUs (`K6_VUS`) | Rampa / Duración                            | Error HTTP (`http_req_failed`)         | Checks (`checks`) | `p95` Catálogo (`catalog.js`) |     `p95` Panel (`auth-panel.js`) |             `p95` PDFs (`pdf.js`) |
| -------------------- | -------------: | ------------------------------------------- | -------------------------------------- | ----------------- | ----------------------------: | --------------------------------: | --------------------------------: |
| **Nivel 1 (Normal)** |           `50` | `15s` rampa + `2m` sostenido + `10s` bajada | `< 1%` (`0.01`)                        | `> 99%` (`0.99`)  |                  `< 1,500 ms` |                      `< 2,000 ms` |                      `< 3,000 ms` |
| **Nivel 2 (Pico)**   |          `200` | `20s` rampa + `2m` sostenido + `10s` bajada | `< 2%` (`0.02`) _(meta `< 1%`)_        | `> 98%` (`0.98`)  |                  `< 2,000 ms` |                      `< 3,000 ms` |                      `< 5,000 ms` |
| **Nivel 3 (Estrés)** |          `500` | `30s` rampa + `2m` sostenido + `15s` bajada | `< 5%` (`0.05`) _(o punto de quiebre)_ | `> 98%` (`0.98`)  |                  `< 3,000 ms` | `< 5,000 ms` _(punto de quiebre)_ | `< 5,000 ms` _(punto de quiebre)_ |

> Como el código base actual todavía no incluye las optimizaciones de Fase 1–3 (y `GET /private/lands` genera ~37 MB de HTML con `50k` terrenos), es normal que `200` o `500` VUs superen los umbrales en el panel o fallen por saturación. Aunque `k6` termine con código distinto de `0` al cruzar un umbral, `--summary-export` guardará igualmente el archivo JSON del baseline.

---

## 4. Cómo ejecutar los 3 niveles y recolectar evidencia

Crea una carpeta temporal fuera de Git (por ejemplo `C:\temp\k6-baseline`) para guardar los JSON y reportes SQL sin ensuciar el repositorio:

```powershell
New-Item -ItemType Directory -Force -Path C:\temp\k6-baseline | Out-Null
$env:BASE_URL = "http://localhost:3000"
$env:LOADTEST_EMAIL = "admin@agrosystem.com"
$env:LOADTEST_PASSWORD = "<TU_ADMIN_PASSWORD_DE_.env.loadtest>"
```

En una **segunda terminal**, mientras corre cada escalón, puedes observar uso real de CPU/RAM:

```powershell
docker stats --no-stream
```

### Nivel 1 — 50 VUs

```powershell
# 1) Reiniciar estadísticas SQL antes del nivel 1
docker compose -f docker-compose.loadtest.yml --env-file .env.loadtest exec -T postgres psql -U agrosystem_load -d agrosystem_loadtest -c "SELECT pg_stat_statements_reset();"

# 2) Correr los 3 flujos en secuencia
k6 run -e K6_VUS=50 -e K6_RAMP_UP=15s -e K6_DURATION=2m -e K6_RAMP_DOWN=10s -e K6_P95_MS=1500 -e K6_ERROR_RATE=0.01 -e K6_CHECK_RATE=0.99 --summary-export C:\temp\k6-baseline\catalog-50vus.json loadtests/catalog.js
k6 run -e K6_VUS=50 -e K6_RAMP_UP=15s -e K6_DURATION=2m -e K6_RAMP_DOWN=10s -e K6_P95_MS=2000 -e K6_ERROR_RATE=0.01 -e K6_CHECK_RATE=0.99 --summary-export C:\temp\k6-baseline\auth-panel-50vus.json loadtests/auth-panel.js
k6 run -e K6_VUS=50 -e K6_RAMP_UP=15s -e K6_DURATION=2m -e K6_RAMP_DOWN=10s -e K6_P95_MS=3000 -e K6_ERROR_RATE=0.01 -e K6_CHECK_RATE=0.99 --summary-export C:\temp\k6-baseline\pdf-50vus.json loadtests/pdf.js

# 3) Guardar top 20 consultas SQL acumuladas en 50 VUs
docker compose -f docker-compose.loadtest.yml --env-file .env.loadtest exec -T postgres psql -U agrosystem_load -d agrosystem_loadtest -c "SELECT calls, round(total_exec_time::numeric, 2) AS total_ms, round(mean_exec_time::numeric, 2) AS mean_ms, rows, left(regexp_replace(query, '\s+', ' ', 'g'), 140) AS query FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'agrosystem_loadtest') ORDER BY total_exec_time DESC LIMIT 20;" > C:\temp\k6-baseline\pg-stat-50vus.txt
```

### Nivel 2 — 200 VUs

```powershell
docker compose -f docker-compose.loadtest.yml --env-file .env.loadtest exec -T postgres psql -U agrosystem_load -d agrosystem_loadtest -c "SELECT pg_stat_statements_reset();"

k6 run -e K6_VUS=200 -e K6_RAMP_UP=20s -e K6_DURATION=2m -e K6_RAMP_DOWN=10s -e K6_P95_MS=2000 -e K6_ERROR_RATE=0.02 -e K6_CHECK_RATE=0.98 --summary-export C:\temp\k6-baseline\catalog-200vus.json loadtests/catalog.js
k6 run -e K6_VUS=200 -e K6_RAMP_UP=20s -e K6_DURATION=2m -e K6_RAMP_DOWN=10s -e K6_P95_MS=3000 -e K6_ERROR_RATE=0.02 -e K6_CHECK_RATE=0.98 --summary-export C:\temp\k6-baseline\auth-panel-200vus.json loadtests/auth-panel.js
k6 run -e K6_VUS=200 -e K6_RAMP_UP=20s -e K6_DURATION=2m -e K6_RAMP_DOWN=10s -e K6_P95_MS=5000 -e K6_ERROR_RATE=0.02 -e K6_CHECK_RATE=0.98 --summary-export C:\temp\k6-baseline\pdf-200vus.json loadtests/pdf.js

docker compose -f docker-compose.loadtest.yml --env-file .env.loadtest exec -T postgres psql -U agrosystem_load -d agrosystem_loadtest -c "SELECT calls, round(total_exec_time::numeric, 2) AS total_ms, round(mean_exec_time::numeric, 2) AS mean_ms, rows, left(regexp_replace(query, '\s+', ' ', 'g'), 140) AS query FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'agrosystem_loadtest') ORDER BY total_exec_time DESC LIMIT 20;" > C:\temp\k6-baseline\pg-stat-200vus.txt
```

### Nivel 3 — 500 VUs

> Si en `200 VUs` `auth-panel.js` o `pdf.js` ya colapsan por memoria o timeouts (>50% error o caída del contenedor), detén ese flujo específico tras `~45s` o corre primero `catalog.js` solo para identificar por separado el límite público frente al privado (`docker compose -f docker-compose.loadtest.yml --env-file .env.loadtest restart app` si necesitas recuperar el proceso Node).

```powershell
docker compose -f docker-compose.loadtest.yml --env-file .env.loadtest exec -T postgres psql -U agrosystem_load -d agrosystem_loadtest -c "SELECT pg_stat_statements_reset();"

k6 run -e K6_VUS=500 -e K6_RAMP_UP=30s -e K6_DURATION=2m -e K6_RAMP_DOWN=15s -e K6_P95_MS=3000 -e K6_ERROR_RATE=0.05 -e K6_CHECK_RATE=0.98 --summary-export C:\temp\k6-baseline\catalog-500vus.json loadtests/catalog.js
k6 run -e K6_VUS=500 -e K6_RAMP_UP=30s -e K6_DURATION=2m -e K6_RAMP_DOWN=15s -e K6_P95_MS=5000 -e K6_ERROR_RATE=0.05 -e K6_CHECK_RATE=0.98 --summary-export C:\temp\k6-baseline\auth-panel-500vus.json loadtests/auth-panel.js
k6 run -e K6_VUS=500 -e K6_RAMP_UP=30s -e K6_DURATION=2m -e K6_RAMP_DOWN=15s -e K6_P95_MS=5000 -e K6_ERROR_RATE=0.05 -e K6_CHECK_RATE=0.98 --summary-export C:\temp\k6-baseline\pdf-500vus.json loadtests/pdf.js

docker compose -f docker-compose.loadtest.yml --env-file .env.loadtest exec -T postgres psql -U agrosystem_load -d agrosystem_loadtest -c "SELECT calls, round(total_exec_time::numeric, 2) AS total_ms, round(mean_exec_time::numeric, 2) AS mean_ms, rows, left(regexp_replace(query, '\s+', ' ', 'g'), 140) AS query FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'agrosystem_loadtest') ORDER BY total_exec_time DESC LIMIT 20;" > C:\temp\k6-baseline\pg-stat-500vus.txt
```

---

## 5. Cierre y entrega de resultados al agente

Al terminar, comparte:

1. Los archivos JSON de `C:\temp\k6-baseline\*-*.json` (o la tabla final de consola de `k6`).
2. Los archivos `pg-stat-*vus.txt` y el pico de CPU/RAM visto en `docker stats`.

Con esos datos interpretaré los cuellos reales bajo concurrencia y documentaré el resultado en [carga-baseline.md](carga-baseline.md). Para apagar el entorno sin perder los datos sembrados usa `docker compose -f docker-compose.loadtest.yml --env-file .env.loadtest down` (o agrega `-v` si quieres borrar también el volumen de PostgreSQL).
