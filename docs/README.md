# Documentación del proyecto

Este directorio conserva únicamente documentación vigente o referencias que
siguen siendo necesarias para el desarrollo y la presentación del sistema.

## Normativa vigente

- [Reglas de ingeniería y colaboración](./RULES.MD): arquitectura, seguridad,
  calidad y flujo de trabajo.
- [Matriz RBAC](./RBAC.MD): permisos y responsabilidades por rol.

## Flujos de trabajo y aprobación técnica

- [Flujo de Plagas](./workflows/plagas.md): ciclo editorial, revisión por pares y publicación.
- [Flujo de Cultivos](./workflows/cultivos.md): validación agronómica, readiness y habilitación para parcelas.
- [Flujo de Productos](./workflows/productos.md): verificación sanitaria, dosis y registro fitosanitario.
- [Flujo de Terrenos](./workflows/terrenos.md): ciclo de vida del predio, integración de catálogos y expediente fenológico.

## Referencias de dominio

- [`referencias/relaciones-agricolas-catalogos.pdf`](./referencias/relaciones-agricolas-catalogos.pdf):
  documento de referencia para las relaciones entre los catálogos agrícolas.

## Entregables para asesores

La carpeta `entrega-asesores/` contiene los documentos de avance separados por
desarrollador. No representa documentación técnica normativa.

## Criterio de conservación

No se deben agregar borradores temporales, documentos generados para revisión
local ni guías correspondientes a arquitecturas que ya no utiliza el proyecto.
Cuando una decisión cambie, debe actualizarse el documento vigente en lugar de
crear variantes sin una finalidad definida.
