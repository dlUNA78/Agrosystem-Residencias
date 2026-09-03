# Matriz de acceso y responsabilidades (RBAC)

**Estado:** política objetivo para el área privada

**Documento normativo relacionado:** [RULES.MD](./RULES.MD)

## 1. Roles

| Rol            | Propósito                                                               |
| -------------- | ----------------------------------------------------------------------- |
| Público        | Consulta información publicada sin acceder al panel.                    |
| Agricultor     | Usa el sitio público y administra su perfil. No accede al panel INIFAP. |
| INIFAP autor   | Crea y mantiene sus propios registros técnicos mientras sean editables. |
| INIFAP revisor | Revisa registros de otra persona; no puede revisar su propio trabajo.   |
| Administrador  | Publica, archiva, elimina y administra usuarios y configuración.        |

Una misma cuenta INIFAP actúa como autor o revisor según la propiedad del registro. La autorización se calcula por petición.

## 2. Estados del catálogo técnico

Los módulos de plagas, cultivos y productos convergerán en este flujo. Los valores persistidos son los identificadores en inglés; la interfaz puede traducirlos:

```text
draft → in_review → verified → published → archived
             ↓
    changes_requested → in_review
```

- Sólo `draft` y `changes_requested` son editables por el autor.
- Un INIFAP distinto del autor puede verificar o solicitar cambios.
- Sólo un administrador puede publicar, archivar, restaurar o eliminar.
- Un registro público debe estar activo y publicado.
- Las transiciones inválidas se rechazan en backend aunque el cliente construya manualmente la petición.

## 3. Catálogos técnicos

| Acción                                  | Público | Agricultor | INIFAP autor | INIFAP revisor  | Administrador |
| --------------------------------------- | :-----: | :--------: | :----------: | :-------------: | :-----------: |
| Ver listado/detalle publicado           |   Sí    |     Sí     |      Sí      |       Sí        |      Sí       |
| Acceder al listado privado              |   No    |     No     |      Sí      |       Sí        |      Sí       |
| Ver borradores y estados internos       |   No    |     No     |      Sí      |       Sí        |      Sí       |
| Crear registro                          |   No    |     No     |      Sí      |       Sí        |      Sí       |
| Editar registro propio editable         |   No    |     No     |      Sí      |       No        |      Sí       |
| Editar registro ajeno                   |   No    |     No     |      No      |       No        |      Sí       |
| Gestionar imágenes y relaciones propias |   No    |     No     |      Sí      |       No        |      Sí       |
| Enviar registro propio a revisión       |   No    |     No     |      Sí      |       No        |      Sí       |
| Solicitar cambios                       |   No    |     No     |      No      | Sí, si es ajeno |      No       |
| Verificar                               |   No    |     No     |      No      | Sí, si es ajeno |      No       |
| Publicar                                |   No    |     No     |      No      |       No        |      Sí       |
| Archivar o restaurar                    |   No    |     No     |      No      |       No        |      Sí       |
| Eliminar definitivamente                |   No    |     No     |      No      |       No        |      Sí       |

Esta matriz ya debe conservarse en plagas y se aplicará gradualmente a cultivos y productos. La eliminación definitiva debería sustituirse por archivado cuando exista valor histórico o relaciones activas.

## 4. Otros módulos privados

| Módulo / acción           |     Agricultor     |         INIFAP          |              Administrador              |
| ------------------------- | :----------------: | :---------------------: | :-------------------------------------: |
| Dashboard operativo       |         No         |           Ver           |                   Ver                   |
| Reportes operativos       |         No         |           Ver           |              Ver/exportar               |
| Auditoría                 |         No         |           No            |              Ver/exportar               |
| Usuarios                  |   Perfil propio    |      Perfil propio      |             CRUD y estados              |
| Ingredientes activos      |         No         |           Ver           |          Crear/editar/archivar          |
| Proveedores               |         No         |           Ver           |          Crear/editar/archivar          |
| Terrenos asignados        | No en panel actual | Ver y gestionar propios | Ver todos; gestión excepcional auditada |
| Configuración del sistema |         No         |           No            |                Gestionar                |

Antes de ampliar el panel a agricultores se debe aprobar una matriz específica para terrenos; no se debe conceder acceso implícitamente reutilizando permisos INIFAP.

## 5. Reglas de implementación

1. La ruta aplica autenticación y un permiso de módulo.
2. El controlador carga el registro y aplica propiedad y estado.
3. La consulta pública incluye el estado publicado; no se filtra después de recuperar el registro.
4. El backend construye un objeto `permissions` para la vista.
5. Handlebars muestra acciones usando `permissions.canCreate`, `canEdit`, `canVerify`, `canPublish`, etc.
6. Cada transición vuelve a validarse dentro de la operación que persiste el cambio.
7. Toda denegación se prueba y las acciones sensibles generan un registro de auditoría.

## 6. Respuestas esperadas

| Situación                                            | HTML                | JSON/API |
| ---------------------------------------------------- | ------------------- | -------- |
| Sin sesión                                           | Redirección a login | `401`    |
| Rol sin permiso                                      | `403`               | `403`    |
| Registro ajeno no editable                           | `403`               | `403`    |
| Registro inexistente o no publicable en zona pública | `404`               | `404`    |
| Entrada inválida                                     | `400`               | `400`    |
| Transición incompatible con el estado                | `409`               | `409`    |

## 7. Casos mínimos de prueba por módulo

- El público sólo ve registros publicados.
- Un agricultor no puede abrir rutas del panel.
- INIFAP puede crear y editar su borrador.
- INIFAP no puede editar un registro ajeno.
- El autor no puede verificar su propio registro.
- Otro INIFAP puede revisar un registro en revisión.
- INIFAP no puede publicar, archivar ni eliminar.
- Administrador puede publicar un registro verificado.
- Una acción fabricada manualmente se rechaza igual que una acción no mostrada en la interfaz.
