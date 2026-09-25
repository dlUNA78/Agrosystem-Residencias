# Agrosystem Residencias

Sistema web para administrar y consultar información agrícola del INIFAP. La
plataforma separa el catálogo público de las herramientas privadas destinadas a
personal autorizado.

## Módulos actuales

- Catálogos de plagas, cultivos y productos.
- Gestión operativa de terrenos y ciclos agrícolas.
- Administración de usuarios, proveedores y relaciones agrícolas.
- Flujos editoriales y permisos por rol para contenido técnico.
- Vistas públicas limitadas a información publicada.

## Tecnologías

- Node.js 22 y Express 5.
- Handlebars y Tailwind CSS 4.
- PostgreSQL y Sequelize.
- Jest para pruebas automatizadas.

## Ejecución local

1. Instala Node.js y pnpm en las versiones indicadas en `package.json`.
2. Instala las dependencias:

   ```bash
   pnpm install
   ```

3. Copia `.env.example` como `.env` y configura una base de datos local de
   desarrollo. No utilices credenciales de producción.
4. Ejecuta las migraciones:

   ```bash
   pnpm exec sequelize-cli db:migrate
   ```

5. Inicia el servidor y el compilador de estilos:

   ```bash
   pnpm dev
   ```

La aplicación estará disponible normalmente en `http://localhost:3000`.

## Verificaciones

Ejecuta únicamente la prueba del módulo en el que estés trabajando durante el
desarrollo. Antes de abrir un pull request se encuentran disponibles:

```bash
pnpm run lint
pnpm run format:check
pnpm run test
```

## Documentación

- [Índice de documentación](./docs/README.md)
- [Reglas de ingeniería y colaboración](./docs/RULES.MD)
- [Matriz de roles y permisos](./docs/RBAC.MD)

Los secretos, archivos `.env`, resultados de pruebas y archivos temporales no
deben añadirse al repositorio.
