
# División de Trabajo — Agrosystem Residencias

## 2 Desarrolladores · Sequelize + PostgreSQL

---

## 📐 Arquitectura General del Proyecto

| Capa          | Tecnología               | Descripción                        |
| ------------- | ------------------------- | ----------------------------------- |
| Backend       | Node.js + Express 5       | Servidor HTTP, rutas MVC            |
| Plantillas    | Handlebars (`.hbs`)     | Vistas server-side rendering        |
| Estilos       | TailwindCSS 4             | Compilado a`public/css/style.css` |
| Base de datos | PostgreSQL                | Motor relacional                    |
| ORM           | Sequelize + sequelize-cli | Modelos, migraciones y seeders      |
| Frontend JS   | Vanilla JS                | `public/js/main.js`               |

---

### Dependencias a ajustar en `package.json`

```diff
  "dependencies": {
-   "@supabase/supabase-js": "^2.100.0",
+   "sequelize": "^6.x.x",
+   "pg": "^8.x.x",
+   "pg-hstore": "^2.x.x",
    "dotenv": "^17.3.1",
    "express": "^5.2.1",
    "express-hbs": "^2.5.0"
  },
  "devDependencies": {
+   "sequelize-cli": "^6.x.x",
    "@tailwindcss/cli": "^4.2.2",
    "nodemon": "^3.1.14",
    "tailwindcss": "^4.2.4"
  }
```

### Variables de entorno a actualizar (`.env`)

```diff
+ DB_HOST=localhost
+ DB_PORT=5432
+ DB_NAME=agrosystem_db
+ DB_USER=postgres
+ DB_PASS=tu_contraseña
+ DB_DIALECT=postgres
```

---

## 🗂️ Nueva Estructura de Archivos del Proyecto

```
Agrosystem-Residencias/
├── app.js
├── package.json
├── .env / .env.example
├── .sequelizerc                        ← NUEVO: config paths para sequelize-cli
│
├── src/
│   ├── config/
│   │   └── database.js                 ← NUEVO: conexión Sequelize
│   │
│   ├── models/                         ← AHORA POBLADA con modelos Sequelize
│   │   ├── index.js                    ← NUEVO: inicializa Sequelize + asociaciones
│   │   ├── User.js                     ← NUEVO
│   │   ├── Plague.js                   ← NUEVO
│   │   ├── Crop.js                     ← NUEVO
│   │   ├── Land.js                     ← NUEVO
│   │   ├── Product.js                  ← NUEVO
│   │   ├── Ingredient.js               ← NUEVO
│   │   ├── Supplier.js                 ← NUEVO
│   │   ├── AuditLog.js                 ← NUEVO
│   │   ├── ForumThread.js              ← NUEVO
│   │   ├── ForumReply.js               ← NUEVO
│   │   ├── LandCrop.js                 ← NUEVO (tabla pivote)
│   │   └── ProductIngredient.js        ← NUEVO (tabla pivote)
│   │
│   ├── migrations/                     ← NUEVO: migraciones de BD
│   │   ├── 01-create-users.js
│   │   ├── 02-create-plagues.js
│   │   ├── 03-create-crops.js
│   │   ├── 04-create-lands.js
│   │   ├── 05-create-products.js
│   │   ├── 06-create-ingredients.js
│   │   ├── 07-create-suppliers.js
│   │   ├── 08-create-audit-logs.js
│   │   ├── 09-create-forum-threads.js
│   │   ├── 10-create-forum-replies.js
│   │   ├── 11-create-land-crops.js
│   │   └── 12-create-product-ingredients.js
│   │
│   ├── seeders/                        ← NUEVO: datos de prueba
│   │   ├── 01-seed-users.js
│   │   ├── 02-seed-plagues.js
│   │   ├── 03-seed-crops.js
│   │   ├── 04-seed-lands.js
│   │   ├── 05-seed-products.js
│   │   └── 06-seed-ingredients.js
│   │
│   ├── controllers/
│   │   ├── privateController.js        ← MODIFICAR: integrar Sequelize queries
│   │   └── publicController.js         ← MODIFICAR: integrar Sequelize queries
│   │
│   ├── routes/
│   │   ├── privateRoutes.js
│   │   └── publicRoutes.js
│   │
│   └── views/
│       ├── layouts/
│       ├── partials/
│       ├── private/
│       └── public/
│
└── public/
    ├── css/
    ├── js/
    └── uploads/
```

---

## 📦 Inventario de Archivos Existentes

### Vistas Privadas (`src/views/private/`)

| Vista                  | Tamaño | Módulo                  |
| ---------------------- | ------- | ------------------------ |
| `dashboard.hbs`      | 19.9 KB | Panel principal          |
| `plagues.hbs`        | 25.7 KB | Listado de plagas        |
| `pest-detail.hbs`    | 29.6 KB | Detalle de plaga         |
| `crops.hbs`          | 35.9 KB | Listado de cultivos      |
| `crop-detail.hbs`    | 14.4 KB | Detalle de cultivo       |
| `lands.hbs`          | 28.4 KB | Listado de terrenos      |
| `land-detail.hbs`    | 42.3 KB | Expediente de terreno    |
| `products.hbs`       | 45.6 KB | Listado de productos     |
| `product-detail.hbs` | 18.0 KB | Detalle de producto      |
| `ingredients.hbs`    | 45.1 KB | Ingredientes activos     |
| `suppliers.hbs`      | 27.8 KB | Proveedores              |
| `users.hbs`          | 42.1 KB | Usuarios                 |
| `reports.hbs`        | 27.8 KB | Reportes y estadísticas |
| `audit.hbs`          | 22.4 KB | Auditoría               |

### Vistas Públicas (`src/views/public/`)

| Vista            | Tamaño | Módulo             |
| ---------------- | ------- | ------------------- |
| `home.hbs`     | 9.9 KB  | Página de inicio   |
| `plagues.hbs`  | 25.7 KB | Plagas públicas    |
| `crops.hbs`    | 23.0 KB | Cultivos públicos  |
| `products.hbs` | 26.7 KB | Productos públicos |
| `forum.hbs`    | 34.9 KB | Foro de discusión  |

---

## 👥 División de Trabajo

> Cada desarrollador es dueño de sus módulos **de punta a punta**: modelo Sequelize → migración → seeder → controlador → vista.

---

## 🔵 Desarrollador A — Infraestructura + Gestión Administrativa

### Dominio

Configuración base del proyecto, zona pública general, y los módulos de *gestión interna*: terrenos, usuarios, auditoría, reportes e ingredientes activos.

---

### 🔧 Infraestructura del Proyecto (semana 1 — base compartida)

| Archivo                     | Acción         | Descripción                                                                    |
| --------------------------- | --------------- | ------------------------------------------------------------------------------- |
| `app.js`                  | Modificar       | Integrar`src/config/database.js` (sync/authenticate)                          |
| `package.json`            | Modificar       | Quitar Supabase, agregar`sequelize`, `pg`, `pg-hstore`, `sequelize-cli` |
| `.env` / `.env.example` | Modificar       | Variables de PostgreSQL                                                         |
| `.sequelizerc`            | **Crear** | Apuntar`models-path`, `migrations-path`, `seeders-path` a `src/`        |
| `src/config/database.js`  | **Crear** | Instancia Sequelize con config desde`.env`                                    |
| `src/models/index.js`     | **Crear** | Inicializa todos los modelos y define asociaciones                              |

---

### 🗄️ Modelos y Migraciones — Dev A

| Modelo             | Archivo                      | Migración                   | Tabla BD        |
| ------------------ | ---------------------------- | ---------------------------- | --------------- |
| Usuario            | `src/models/User.js`       | `01-create-users.js`       | `users`       |
| Terreno            | `src/models/Land.js`       | `04-create-lands.js`       | `lands`       |
| Ingrediente Activo | `src/models/Ingredient.js` | `06-create-ingredients.js` | `ingredients` |
| Log de Auditoría  | `src/models/AuditLog.js`   | `08-create-audit-logs.js`  | `audit_logs`  |
| Terreno-Cultivo    | `src/models/LandCrop.js`   | `11-create-land-crops.js`  | `land_crops`  |

#### Esquema de referencia `User.js`

```js
// src/models/User.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
  name:        { type: DataTypes.STRING,  allowNull: false },
  email:       { type: DataTypes.STRING,  allowNull: false, unique: true },
  role:        { type: DataTypes.ENUM('admin','investigador','tecnico','agricultor') },
  status:      { type: DataTypes.ENUM('activo','pendiente','suspendido') },
  institution: { type: DataTypes.STRING },
}, { tableName: 'users', timestamps: true });

export default User;
```

---

### 🌐 Zona Pública — Dev A

| Archivo                                  | Acción                                                     |
| ---------------------------------------- | ----------------------------------------------------------- |
| `src/controllers/publicController.js`  | Modificar: reemplazar datos hardcoded por queries Sequelize |
| `src/views/public/home.hbs`            | Adaptar para datos dinámicos (stats, foro reciente)        |
| `src/views/public/plagues.hbs`         | Adaptar para datos dinámicos                               |
| `src/views/public/crops.hbs`           | Adaptar para datos dinámicos                               |
| `src/views/public/products.hbs`        | Adaptar para datos dinámicos                               |
| `src/views/partials/public/navbar.hbs` | Revisar/ajustar                                             |
| `src/views/partials/public/footer.hbs` | Revisar/ajustar                                             |
| `src/views/layouts/public.hbs`         | Revisar/ajustar                                             |

---

### 🏠 Dashboard y Partials Admin — Dev A

| Archivo                                       | Acción                                |
| --------------------------------------------- | -------------------------------------- |
| `src/views/private/dashboard.hbs`           | Adaptar para stats dinámicos desde BD |
| `src/views/layouts/private.hbs`             | Mantener/ajustar                       |
| `src/views/partials/private/sidebar.hbs`    | Mantener/ajustar                       |
| `src/views/partials/private/navbar.hbs`     | Mantener/ajustar                       |
| `src/views/partials/private/footer.hbs`     | Mantener/ajustar                       |
| `src/views/partials/private/search-bar.hbs` | Mantener/ajustar                       |

---

### 📋 Módulos Admin — Dev A (punta a punta)

#### Terrenos

- `src/models/Land.js` + migración + `seeders/04-seed-lands.js`
- Controller: `landsPrivate`, `landDetail` → queries a `Land.findAll()`, `Land.findByPk()`
- Vistas: `lands.hbs`, `land-detail.hbs`

#### Usuarios

- `src/models/User.js` + migración + seeder
- Controller: `usersPrivate`
- Vista: `users.hbs`

#### Ingredientes Activos

- `src/models/Ingredient.js` + migración + seeder
- Controller: `ingredientsPrivate`
- Vista: `ingredients.hbs`

#### Auditoría

- `src/models/AuditLog.js` + migración
- Controller: `auditPrivate`
- Vista: `audit.hbs`

#### Reportes

- No requiere modelo propio (usa agregaciones sobre otros modelos)
- Controller: `reportsPrivate` → queries con `COUNT`, `GROUP BY` vía Sequelize
- Vista: `reports.hbs`

---

### Seeders — Dev A

| Seeder                     | Datos                                              |
| -------------------------- | -------------------------------------------------- |
| `01-seed-users.js`       | 10 usuarios de prueba con distintos roles          |
| `04-seed-lands.js`       | 4 predios (los DEMO_LANDS actuales del controller) |
| `06-seed-ingredients.js` | 8-10 ingredientes activos de ejemplo               |

---

### Resumen de Carga — Desarrollador A

| Categoría                         | Cantidad      |
| ---------------------------------- | ------------- |
| Archivos de infraestructura nuevos | 4             |
| Modelos Sequelize                  | 5             |
| Migraciones                        | 5             |
| Seeders                            | 3             |
| Vistas a adaptar                   | 13            |
| **Total archivos**           | **~30** |

---

## 🟢 Desarrollador B — Catálogos Técnicos + Foro

### Dominio

Módulos del catálogo científico-técnico (plagas, cultivos, productos, proveedores) y el foro de discusión.

---

### 🗄️ Modelos y Migraciones — Dev B

| Modelo               | Archivo                             | Migración                           | Tabla BD                |
| -------------------- | ----------------------------------- | ------------------------------------ | ----------------------- |
| Plaga                | `src/models/Plague.js`            | `02-create-plagues.js`             | `plagues`             |
| Cultivo              | `src/models/Crop.js`              | `03-create-crops.js`               | `crops`               |
| Producto             | `src/models/Product.js`           | `05-create-products.js`            | `products`            |
| Proveedor            | `src/models/Supplier.js`          | `07-create-suppliers.js`           | `suppliers`           |
| Hilo de Foro         | `src/models/ForumThread.js`       | `09-create-forum-threads.js`       | `forum_threads`       |
| Respuesta de Foro    | `src/models/ForumReply.js`        | `10-create-forum-replies.js`       | `forum_replies`       |
| Producto-Ingrediente | `src/models/ProductIngredient.js` | `12-create-product-ingredients.js` | `product_ingredients` |

#### Esquema de referencia `Plague.js`

```js
// src/models/Plague.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Plague = sequelize.define('Plague', {
  commonName:    { type: DataTypes.STRING, allowNull: false },
  scientificName:{ type: DataTypes.STRING },
  species:       { type: DataTypes.STRING },
  affectedCrops: { type: DataTypes.ARRAY(DataTypes.STRING) },
  status:        { type: DataTypes.ENUM('aprobado','pendiente') },
  description:   { type: DataTypes.TEXT },
  imageUrl:      { type: DataTypes.STRING },
}, { tableName: 'plagues', timestamps: true });

export default Plague;
```

---

### 🌐 Zona Pública — Dev B

| Archivo                        | Acción                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `src/views/public/forum.hbs` | Adaptar para datos dinámicos (hilos, respuestas)            |
| Función`renderForumPublic`  | Modificar:`ForumThread.findAll({ include: [ForumReply] })` |

---

### 🐛 Módulo Plagas — Dev B (punta a punta)

- `src/models/Plague.js` + migración + `seeders/02-seed-plagues.js`
- Controller: `plaguesPrivate`, `getPestDetail` → queries a `Plague.findAll()`, `Plague.findOne()`
- Vistas: `plagues.hbs`, `pest-detail.hbs`

### 🌽 Módulo Cultivos — Dev B (punta a punta)

- `src/models/Crop.js` + migración + `seeders/03-seed-crops.js`
- Controller: `cropsPrivate`, `getCropDetail`
- Vistas: `crops.hbs`, `crop-detail.hbs`

### 🧴 Módulo Productos — Dev B (punta a punta)

- `src/models/Product.js` + `ProductIngredient.js` + migraciones + `seeders/05-seed-products.js`
- Controller: `productsPrivate`, `getGlyphomaxDetail`
- Vistas: `products.hbs`, `product-detail.hbs`

### 🏢 Módulo Proveedores — Dev B (punta a punta)

- `src/models/Supplier.js` + migración
- Controller: `suppliersPrivate`
- Vista: `suppliers.hbs`

### 💬 Foro — Dev B (punta a punta)

- `src/models/ForumThread.js` + `ForumReply.js` + migraciones
- Controller: `renderForumPublic`
- Vista: `forum.hbs`

---

### Seeders — Dev B

| Seeder                  | Datos                                    |
| ----------------------- | ---------------------------------------- |
| `02-seed-plagues.js`  | 6-8 plagas representativas               |
| `03-seed-crops.js`    | 6-8 cultivos (maíz, sorgo, mango, etc.) |
| `05-seed-products.js` | 5-8 productos agroquímicos de ejemplo   |

---

### Resumen de Carga — Desarrollador B

| Categoría               | Cantidad      |
| ------------------------ | ------------- |
| Modelos Sequelize        | 7             |
| Migraciones              | 7             |
| Seeders                  | 3             |
| Vistas a adaptar         | 9             |
| **Total archivos** | **~26** |

---

## 🔗 Archivos Coordinados (ambos tocan)

| Archivo                                  | Responsable       | Forma de coordinar                                           |
| ---------------------------------------- | ----------------- | ------------------------------------------------------------ |
| `src/controllers/privateController.js` | **Dividir** | Crear`controllerA.js` y `controllerB.js` desde el inicio |
| `src/routes/privateRoutes.js`          | Dev A integra     | Dev B hace PR con sus rutas                                  |
| `src/models/index.js`                  | Dev A crea base   | Dev B agrega`import` de sus modelos y asociaciones         |
| `public/js/main.js`                    | Coordinado        | Feature branches por módulo                                 |

### Asociaciones a definir en `models/index.js`

```js
// Relaciones (las define el dueño del modelo "más fuerte")
Product.belongsToMany(Ingredient, { through: ProductIngredient }); // Dev B
Ingredient.belongsToMany(Product,  { through: ProductIngredient }); // Dev B
Land.belongsToMany(Crop,    { through: LandCrop });                 // Dev A
Crop.belongsToMany(Land,    { through: LandCrop });                 // Dev A
ForumThread.hasMany(ForumReply);                                    // Dev B
ForumReply.belongsTo(ForumThread);                                  // Dev B
AuditLog.belongsTo(User);                                           // Dev A
```

---

## 🌿 Flujo de Trabajo con Git

```
main
├── feature/devA-infra-sequelize          ← Setup DB, config, models/index.js
├── feature/devA-public-zone              ← Zona pública + home
├── feature/devA-dashboard-layouts        ← Dashboard + partials admin
├── feature/devA-lands                    ← Modelo + vistas terrenos
├── feature/devA-users                    ← Modelo + vistas usuarios
├── feature/devA-ingredients              ← Modelo + vistas ingredientes
├── feature/devA-audit-reports            ← Auditoría + reportes
│
├── feature/devB-plagues                  ← Modelo + vistas plagas
├── feature/devB-crops                    ← Modelo + vistas cultivos
├── feature/devB-products-suppliers       ← Modelos + vistas productos/proveedores
└── feature/devB-forum                    ← Modelo + vista foro
```

> **Regla**: Ningún developer hace merge directo a `main`. Pull Requests con revisión cruzada.

---

## 📅 Cronograma Sugerido (4 semanas)

| Semana      | Desarrollador A                                                                                                            | Desarrollador B                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **1** | Setup Sequelize,`config/database.js`, `models/index.js`, User + Land models, zona pública (sin datos dinámicos aún) | Plague, Crop, Product, Supplier models + migraciones                                        |
| **2** | `landsPrivate`/`landDetail` con queries reales, dashboard con stats dinámicos, Ingredient model                       | `plaguesPrivate`/`getPestDetail`, `cropsPrivate`/`getCropDetail` con queries reales |
| **3** | `usersPrivate`, `ingredientsPrivate`, zona pública con datos reales                                                   | `productsPrivate`/`getGlyphomaxDetail`, `suppliersPrivate`, Forum models              |
| **4** | `auditPrivate`, `reportsPrivate` (queries de agregación), seeders, pruebas                                            | `renderForumPublic`, forum.hbs dinámico, seeders, pruebas                                |

---

## ⚠️ Tareas Pendientes Globales

> Ninguno de los dos las resuelve solo — requieren decisión en equipo:

| Tarea                               | Prioridad | Nota                                                                                          |
| ----------------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| **Sistema de autenticación** | 🔴 Alta   | `isAdmin: true` hardcoded en `landsPrivate`. Definir sesiones (`express-session`) o JWT |
| **Rutas dinámicas por ID**   | 🟡 Media  | Pest-detail, crop-detail y product-detail usan slugs fijos. Cambiar a`/:id` real            |
| **Subida de archivos**        | 🟡 Media  | `public/uploads/` existe pero no hay endpoint (`multer`)                                  |
| **Autorización por rol**     | 🔴 Alta   | Middleware para proteger rutas privadas                                                       |
| **Paginación**               | 🟢 Baja   | `findAll` sin `limit/offset` puede traer toda la tabla                                    |

---

## 📊 Balance Final

|                             | Desarrollador A                                      | Desarrollador B         |
| --------------------------- | ---------------------------------------------------- | ----------------------- |
| **Modelos Sequelize** | 5                                                    | 7                       |
| **Migraciones**       | 5                                                    | 7                       |
| **Seeders**           | 3                                                    | 3                       |
| **Vistas**            | 13                                                   | 9                       |
| **Zona**              | Pública completa + Admin gestión + Infraestructura | Admin catálogos + Foro |
| **Archivos totales**  | ~30                                                  | ~26                     |

> Dev A tiene más vistas pero lleva toda la carga de infraestructura base (que Dev B hereda lista).
> Dev B tiene más modelos y relaciones complejas (tablas pivote, asociaciones del catálogo).
> **La carga de trabajo real es equivalente.**
