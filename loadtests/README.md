# Pruebas de Carga con k6 (`loadtests/`)

Scripts de carga reproducibles para medir la línea base de rendimiento de **AgroSystem INIFAP** con [k6](https://k6.io/).

## Scripts disponibles

| Script                    | Alcance                                                                                                                                | Requiere credenciales |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------- | :-------------------- |
| `loadtests/catalog.js`    | Home (`/`), listados (`/crops`, `/plagues`, `/products`) y detalle de fichas públicas (`/crops/:id`, `/plagues/:id`, `/products/:id`). | No                    |
| `loadtests/auth-panel.js` | Login (`POST /auth/login`), `/dashboard`, listados privados (`/private/*`) y `/api/notifications`.                                     | Sí                    |
| `loadtests/pdf.js`        | Descarga binaria de PDF de cultivo (`/crops/:id?format=pdf&download=1`) y reporte operativo (`/private/reports?format=pdf`).           | Sí                    |

## Variables de entorno

Ningún script guarda credenciales ni secretos en el repositorio. Pásalos en tiempo de ejecución mediante `-e` o variables de entorno del shell:

| Variable                               | Uso                                                                    | Default                             |
| :------------------------------------- | :--------------------------------------------------------------------- | :---------------------------------- |
| `BASE_URL`                             | URL base del servidor bajo prueba                                      | `http://localhost:3000`             |
| `LOADTEST_EMAIL`                       | Correo de usuario para `auth-panel.js` y `pdf.js`                      | _(obligatoria en scripts privados)_ |
| `LOADTEST_PASSWORD`                    | Contraseña de usuario para `auth-panel.js` y `pdf.js`                  | _(obligatoria en scripts privados)_ |
| `LOADTEST_ROLE`                        | `admin` (incluye `/private/audit` y `/private/users`) o `inifap`       | `admin`                             |
| `K6_VUS`                               | Número de usuarios virtuales simultáneos                               | `2`                                 |
| `K6_ITERATIONS`                        | Iteraciones compartidas cuando no se define `K6_DURATION`              | `3` / `2` / `4`                     |
| `K6_DURATION`                          | Duración sostenida (ej. `30s`, `2m`); anula `K6_ITERATIONS`            | _(vacío)_                           |
| `K6_RAMP_UP` / `K6_RAMP_DOWN`          | Rampa progresiva de subida/bajada en etapas (`stages` de k6)           | _(vacío)_                           |
| `K6_P95_MS` / `K6_P99_MS`              | Sobreescribe el umbral `p(95)` / `p(99)` en ms de cada script          | Según script                        |
| `K6_ERROR_RATE` / `K6_CHECK_RATE`      | Sobreescribe `http_req_failed` (`rate<...`) y `checks` (`rate>...`)    | `0.01` / `0.99`                     |
| `K6_SLEEP`                             | Pausa entre iteraciones en segundos                                    | `0.2`                               |
| `K6_ACCEPT_ENCODING`                   | Cabecera `Accept-Encoding` enviada por k6 (negocia compresión HTTP)    | `gzip`                              |
| `CROP_ID` / `PLAGUE_ID` / `PRODUCT_ID` | IDs específicos de catálogo (si se omiten, se resuelven vía `/api/*`)  | _(auto)_                            |
| `PDF_CROP_SCOPE`                       | `public` (`/crops/:id`) o `private` (`/private/crops/:id`) en `pdf.js` | `public`                            |
| `REPORT_PERIOD`                        | `semanal`, `mensual`, `trimestral` o `anual` en `pdf.js`               | `mensual`                           |

## Base de datos de carga (`agrosystem_load`)

El script `src/scripts/seedLoadTestData.js` trabaja sobre una base de datos separada (`agrosystem_load` por defecto, o la definida en `LOADTEST_DB_NAME`) para que `agrosystem_test` permanezca limpia para Jest. Si `.env` apunta a `agrosystem_db` o `agrosystem_test`, el script redirige automáticamente a `agrosystem_load` y lo informa en consola; cualquier otro nombre que no inicie con `agrosystem_load` (salvo `LOADTEST_DB_NAME` explícito) se rechaza.

Antes de sembrar volumen local por primera vez, crea y migra `agrosystem_load`:

```bash
# 1) Crear la base de datos de carga en PostgreSQL local
psql -U postgres -h localhost -c "CREATE DATABASE agrosystem_load;"

# 2) Aplicar migraciones y catálogos base en agrosystem_load
DB_NAME=agrosystem_load pnpm exec sequelize-cli db:migrate
DB_NAME=agrosystem_load pnpm exec sequelize-cli db:seed:all

# 3) Sembrar el volumen sintético (50k terrenos, 50k ciclos, 500k logs, 50k notificaciones, 100k sesiones)
node src/scripts/seedLoadTestData.js
```

En PowerShell:

```powershell
$env:DB_NAME = "agrosystem_load"
pnpm exec sequelize-cli db:migrate
pnpm exec sequelize-cli db:seed:all
Remove-Item Env:DB_NAME
node src/scripts/seedLoadTestData.js
```

## Comandos de ejecución

1. Levanta el servidor local apuntando a tu base de datos local o de pruebas (sin producción):

```bash
node app.js
```

2. En otra terminal, ejecuta los scripts:

```bash
# 1) Catálogo público (línea base por defecto: 24 peticiones <= 30 req/min)
k6 run -e BASE_URL=http://localhost:3000 loadtests/catalog.js

# 2) Panel autenticado
k6 run -e BASE_URL=http://localhost:3000 -e LOADTEST_EMAIL="$LOADTEST_EMAIL" -e LOADTEST_PASSWORD="$LOADTEST_PASSWORD" loadtests/auth-panel.js

# 3) Generación y descarga de PDFs
k6 run -e BASE_URL=http://localhost:3000 -e LOADTEST_EMAIL="$LOADTEST_EMAIL" -e LOADTEST_PASSWORD="$LOADTEST_PASSWORD" loadtests/pdf.js
```

Para pruebas de estrés sostenido (en entornos donde el rate limiter permita mayor tráfico desde la misma IP):

```bash
k6 run -e BASE_URL=http://localhost:3000 -e K6_VUS=10 -e K6_DURATION=30s loadtests/catalog.js
```

### Notas sobre rate limiting local

- **`authLimiter` (`POST /auth/login`):** permite 5 intentos cada 15 minutos por IP. Por eso `auth-panel.js` y `pdf.js` inician sesión una sola vez en `setup()`, validan el `302` + cookie `agrosystem.sid`, comparten la sesión entre los VUs y cierran sesión en `teardown()`.
- **`publicRateLimiter` (`publicRouter` montado en `'/'`):** permite 30 peticiones por minuto por IP. Al estar montado en `'/'` dentro de `app.js`, también contabiliza peticiones hacia `/dashboard`, `/private/*` y `/api/notifications`. Por ello los perfiles por defecto (`catalog.js`: 24 req, `auth-panel.js`: 22 req y `pdf.js`: 9 req) se mantienen debajo de 30 req/min; espera ~60 s (o reinicia el servidor local) al ejecutar scripts seguidos desde la misma IP.

## Cómo leer los resultados de k6

Al terminar cada corrida, k6 imprime métricas agregadas y el estado de los **thresholds** (`✓` aprobado / `✗` fallido):

- **`http_req_failed`:** proporción de peticiones HTTP fallidas (`status >= 400` o error de red). El umbral exige `< 1%` (`rate<0.01`). Si sube en `catalog.js` al incrementar `K6_VUS`/`K6_DURATION`, revisa si `publicRateLimiter` devolvió `429`.
- **`checks`:** porcentaje de aserciones funcionales aprobadas (HTML esperado, sesión mantenida sin redirección a `/auth/login`, cabecera `application/pdf` y firma binaria `%PDF`). El umbral exige `> 99%`.
- **`http_req_duration` (`avg`, `med`, `p(90)`, `p(95)`, `p(99)`):** latencia total de las peticiones HTTP:
  - `p(95)`: 95% de las peticiones respondieron en este tiempo o menos (métrica principal contra regresiones).
  - `p(99)`: cola de latencia lenta (1% peor).
- **Métricas personalizadas por flujo:**
  - `catalog_home_duration`, `catalog_list_duration`, `catalog_detail_duration`
  - `auth_login_duration`, `private_dashboard_duration`, `private_list_duration`
  - `pdf_crop_duration`, `pdf_report_duration`

Si cualquier umbral marcado con `✗` falla, `k6` termina con código de salida distinto de `0`.

Para ejecutar escalones completos (`50`, `200` y `500` VUs) en el entorno Docker con PostgreSQL 16 y `pg_stat_statements`, consulta [entorno-carga.md](../docs/entorno-carga.md). Los tres scripts limpian `setup_data.cookieHeader` vía `handleSummary` antes de exportar resultados; si guardas reportes JSON en `loadtests/results/`, esa carpeta está ignorada por Git en `.gitignore`.
