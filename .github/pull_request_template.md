## Resumen

<!-- Explica qué cambia y por qué. -->

## Alcance

- [ ] El PR contiene una sola funcionalidad, corrección o cambio de gobernanza.
- [ ] Revisé el diff y no hay cambios ajenos al alcance.
- [ ] No incluye secretos, `.env`, archivos temporales ni lockfiles distintos de `pnpm-lock.yaml`.

## Arquitectura y datos

- [ ] La lógica está separada entre controlador, servicio, middleware, modelo y vista según corresponda.
- [ ] No agregué JavaScript ejecutable ni manejadores inline en archivos `.hbs`.
- [ ] Validé y normalicé `body`, `params` y `query` en backend mediante campos permitidos.
- [ ] Las operaciones relacionadas usan transacción o compensación.
- [ ] No aplica; el PR no modifica lógica ni persistencia.

## Seguridad y RBAC

- [ ] Las rutas privadas aplican autorización en servidor y no dependen de botones ocultos.
- [ ] Probé rol, propiedad y estado del workflow.
- [ ] Las consultas públicas excluyen borradores, rechazados y archivados, incluido el detalle por ID.
- [ ] Las mutaciones incluyen protección CSRF o documentan el bloqueo para incorporarla.
- [ ] No aplica; el PR no afecta autenticación, autorización ni exposición de datos.

## Base de datos, archivos y dependencias

- [ ] Todo cambio estructural tiene migración Sequelize con `up` y `down`.
- [ ] Actualicé `.env.example` si agregué variables.
- [ ] Documenté dependencias nuevas y scripts de instalación autorizados.
- [ ] Validé límites, tipo, firma, destino y limpieza de archivos cargados.
- [ ] No aplica; el PR no modifica estos elementos.

## Verificación automática

```text
pnpm run test
pnpm run lint -- --max-warnings=0
pnpm exec prettier --check .
```

- [ ] Pruebas aprobadas.
- [ ] ESLint aprobado sin advertencias.
- [ ] Prettier aprobado.
- [ ] Migraciones verificadas cuando aplica.

## Validación manual

<!-- Enumera roles, rutas y escenarios comprobados, o explica por qué no aplica. -->

## Riesgos y reversión

<!-- Indica riesgos conocidos y cómo revertir el cambio. -->

## Revisión cruzada

- [ ] El PR fue revisado y aprobado por una persona distinta al autor.
- [ ] Todas las conversaciones quedaron resueltas.
- [ ] Las verificaciones requeridas finalizaron correctamente.
- [ ] La persona revisora, no la autora, realizará el merge.
