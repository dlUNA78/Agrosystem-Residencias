# GUÍA MAESTRA DE AUDITORÍA INTEGRAL — SISTEMA AGROSYSTEM INIFAP

**Versión:** 2.0 (Edición de Auditoría Exhaustiva de Calidad, Seguridad y UX)  
**Destinatario:** Equipo de Auditoría y Control de Calidad (QA / Seguridad / UI-UX)  
**Fecha de Emisión:** Noviembre 2026  
**Alcance:** 100% de la plataforma (Portal Público, Panel Administrativo, Base de Datos, RBAC, Seguridad y Experiencia Móvil)

---

## 1. INTRODUCCIÓN Y METODOLOGÍA DE EVALUACIÓN

Esta guía está diseñada como un protocolo riguroso paso a paso para auditar la plataforma **Agrosystem INIFAP**. No se limita a verificar el código fuente, sino que evalúa la aplicación en ejecución: experiencia visual, consistencia gráfica, lógica de negocio, integridad referencial, flujos editoriales y posibles vectores de vulnerabilidad.

### 1.1 Niveles de Severidad para el Registro de Hallazgos

Cada incidencia o discrepancia detectada durante la auditoría debe clasificarse bajo la siguiente taxonomía:

| Nivel  | Clasificación            | Criterio de Impacto                                                                                                                                                                      |
| :----- | :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** | **Crítica (Bloqueante)** | Caída del servidor (Error 500), brecha de seguridad (vulneración de roles/RBAC, IDOR), pérdida o corrupción de datos agronómicos, o imposibilidad total de completar un flujo crítico.   |
| **S2** | **Alta**                 | Falla funcional grave en una acción (ej. un formulario no guarda datos válidos, un archivo PDF no se descarga o se genera roto, un cálculo fenológico es incorrecto).                    |
| **S3** | **Media**                | Inconsistencia de validación, error de bloqueo de scroll en modales, desalineación o comportamiento defectuoso en dispositivos móviles, falta de feedback visual en acciones asíncronas. |
| **S4** | **Baja**                 | Error tipográfico, discrepancia menor de márgenes, colores o contrastes que no impiden el uso pero degradan la sobriedad institucional.                                                  |
| **S5** | **Mejora / Observación** | Sugerencia de usabilidad, mejora en microinteracciones o recomendaciones agronómicas para enriquecer la experiencia de usuario.                                                          |

---

## 2. MATRIZ DE CUENTAS Y AMBIENTES DE PRUEBA (RBAC)

Para ejecutar las pruebas se requiere contar con credenciales activas en cada uno de los siguientes perfiles. **Nunca auditar con un solo rol**, ya que el sistema posee comportamiento dinámico condicional por perfil:

```
[Visitante Anónimo]  ──>  [Agricultor Registrado]  ──>  [Personal INIFAP (Investigador)]  ──>  [Administrador del Sistema]
(Sin sesión activa)       (Rol: agricultor)            (Rol: inifap / técnico)             (Rol: admin)
```

### Credenciales Base de Laboratorio:

1. **Administrador General:** `admin@agrosystem.test` / Contraseña de pruebas.
2. **Investigador INIFAP 1 (Solicitante):** `inifap-investigador@agrosystem.test`
3. **Investigador INIFAP 2 (Revisor/Dictaminador):** `inifap-revisor@agrosystem.test` _(Crucial para probar la regla de los 4 ojos)_.
4. **Agricultor / Productor Rural:** `agricultor-predio@agrosystem.test`
5. **Navegador en Modo Incógnito:** Para la perspectiva de visitante no autenticado.

---

## 3. PROTOCOLO DE AUDITORÍA DETALLADO POR MÓDULOS

---

### MÓDULO 1: PORTAL PÚBLICO Y NAVEGACIÓN EXTERNA

#### 1.1 Navbar Público y Encabezado Global

- [ ] **Acceso Anónimo vs Autenticado:**
  - Sin iniciar sesión: Debe mostrar enlaces a _Inicio_, _Cultivos_, _Plagas_, _Productos_, _Regiones_, y el botón destacado _Iniciar Sesión_.
  - Con sesión de **Agricultor**: Debe mostrar su menú de usuario, acceso a _Mi Perfil_, y el enlace **"Ascenso INIFAP"** (para solicitar incorporación institucional).
  - Con sesión de **Personal INIFAP / Admin**: El enlace "Ascenso INIFAP" **NO debe aparecer**. En su lugar, debe mostrarse el acceso directo al _Panel Administrativo_.
- [ ] **Ergonomía Móvil (< 768px):**
  - Al presionar el botón hamburguesa, el menú drawer debe abrirse con animación fluida.
  - **Bloqueo de fondo:** Mientras el menú móvil esté abierto, el fondo de la página no debe permitir scroll.
  - Al presionar cualquier enlace o el botón de cierre, el menú debe replegarse y restaurar el scroll natural.
  - Verificar que los elementos no se traslapen con la barra de navegación del navegador móvil.

#### 1.2 Página de Inicio (`/`)

- [ ] **Buscador Predictivo Principal (Hero Search):**
  - **Superposición y Z-Index:** Escribir una palabra en el buscador (ej. _"Maíz"_). El desplegable de resultados debe mostrarse con fondo totalmente opaco (`bg-white` o tema oscuro institucional) y con sombra/borde nítido. **Verificar que los textos de abajo no se traslapen ni se transparenten.**
  - **Búsqueda Insensible a Acentos y Mayúsculas:**
    - Buscar `maiz` (minúscula y sin acento) -> Debe encontrar `Maíz`.
    - Buscar `JITOMATE` (mayúsculas) -> Debe encontrar `Jitomate`.
    - Buscar términos parciales (ej. `fungi`) -> Debe sugerir productos fungicidas.
  - **Navegación por Teclado:** Utilizar las flechas `↓` y `↑` para navegar entre las sugerencias y presionar `Enter` para ingresar directamente a la ficha. Presionar `Escape` debe cerrar el desplegable.
  - **Depuración visual:** Confirmar que la antigua sección de _"Consultas frecuentes"_ haya sido eliminada por completo.
- [ ] **Tarjetas y Secciones Informativas:**
  - _Alertas Fitosanitarias por Entidad:_ Verificar badges de severidad (Alta/Media/Baja), estado de la alerta y enlace directo a la plaga correspondiente.
  - _Avisos de la Semana / Ciclo Agrícola 2026:_ Comprobar que no haya imágenes rotas ni enlaces vacíos (`href="#"`).

#### 1.3 Regiones Agrícolas (`/regions` y `/regions/:id`)

- [ ] **Mapa Interactivo y Zonas Agroclimáticas:**
  - Carga fluida del mapa (Leaflet o SVG regional).
  - Verificar que al hacer clic en una región (ej. _El Bajío_, _Valles Altos_, _Noroeste_), cargue la información de altitud, tipo de suelo y precipitaciones.
  - Comprobar la visualización de boletines técnicos y alertas fitosanitarias asociadas a la región seleccionada.

#### 1.4 Catálogos Públicos de Cultivos, Plagas y Productos Químicos

- [ ] **Filtros Facetados y Búsqueda en Catálogo:**
  - **Plagas (`/plagues`):** Probar el filtro por _Familia / Grupo de Cultivo hospedero_ (ej. Solanáceas, Gramíneas, Frutales) y por _Tipo de agente_ (Hongo, Insecto, Bacteria, Virus).
  - **Cultivos (`/crops`):** Probar filtros por _Ciclo vegetativo_, _Requerimiento hídrico_ y _Rango altitudinal_.
  - **Productos (`/products`):** Probar filtros por _Categoría toxicológica_, _Tipo de acción_ (Herbicida, Insecticida, Fungicida) y _Grupo químico_.
  - **Estado Vacío (Empty State):** Aplicar una combinación imposible de filtros (ej. un cultivo que requiera altitud extrema con clima tropical desértico). Debe mostrar una ilustración o mensaje amigable: _"No se encontraron registros con los criterios seleccionados"_, con un botón para limpiar filtros.
- [ ] **Formulario de Colaboración Ciudadana / Científica:**
  - En cada catálogo, ubicar el botón _"Sugerir nueva especie / producto / cultivo"_.
  - Si el usuario no ha iniciado sesión, debe solicitar login amablemente.
  - Con sesión iniciada: Enviar una propuesta de prueba. Verificar que valide campos obligatorios y muestre feedback inmediato de envío a bandeja de revisión.

#### 1.5 Fichas Técnicas Públicas y Descarga de PDF

- [ ] **Ficha Técnica de Cultivo (`/crops/:id`):**
  - Calendario agrícola interactivo (meses de siembra y cosecha destacados visualmente).
  - Requisitos edafoclimáticos (pH, drenaje, temperaturas óptimas).
  - Plagas comunes vinculadas (al hacer clic debe navegar a la ficha de la plaga).
  - Botón **"Descargar Ficha en PDF"**: Abrir el documento generado. **Verificar que el PDF tenga diseño editorial limpio, sin páginas en blanco al final, con encabezado oficial y fecha de emisión.**
- [ ] **Ficha Técnica de Plaga (`/plagues/:id`):**
  - Sintomatología visual, umbrales de daño y ciclo biológico.
  - Productos recomendados autorizados.
  - Descarga de PDF fitosanitario: validar diagramación y que no exceda las páginas necesarias.
- [ ] **Ficha Científica de Producto Agroquímico (`/products/:id`):**
  - **Estándar de la Industria (Estilo Syngenta):** Debe presentar una estructura técnica sobria: Ingrediente Activo, Concentración, Formulación, Grupo Químico, Número de Registro Oficial.
  - **Semáforo Toxicológico:** La franja o banda de toxicidad debe coincidir con la norma oficial mexicana (Banda Verde = Clase IV/V Precaución, Banda Azul = Clase III Moderadamente Peligroso, Banda Amarilla = Clase II Tóxico, Banda Roja = Clase I Muy Tóxico).
  - **Descarga de Hoja de Seguridad (HDS / MSDS):** Comprobar que el enlace o botón de descarga del archivo HDS funcione correctamente y abra el documento PDF de seguridad.

---

### MÓDULO 2: AUTENTICACIÓN, REGISTRO, PERFIL Y ASCENSO INIFAP

#### 2.1 Pantalla de Login (`/auth/login`)

- [ ] **Validación y Enlaces:**
  - Probar el enlace _"Crear una cuenta aquí"_: Confirmar que lleve a `/auth/register` y **NO** recargue el mismo login.
  - Ingresar un correo inválido (ej. `usuarioSinArroba`) -> Debe mostrar error en tiempo real indicando formato de correo inválido.
  - Contraseña vacía o de longitud inválida -> Bloqueo antes del submit.
  - Intento con credenciales erróneas -> Debe mostrar alerta visual clara sin filtrar si lo que falló fue el correo o la contraseña (prevención de enumeración de cuentas).

#### 2.2 Pantalla de Registro (`/auth/register`)

- [ ] **Diseño y Requisitos de Seguridad:**
  - La pantalla debe lucir consistente con el diseño moderno institucional (Geist UI / Agrosystem).
  - **Checklist dinámico de contraseña:** Conforme el usuario escribe, los requisitos deben marcarse en verde en tiempo real:
    - [ ] Al menos 8 caracteres.
    - [ ] Al menos una letra mayúscula.
    - [ ] Al menos una letra minúscula.
    - [ ] Al menos un número.
    - [ ] Al menos un carácter especial (`!@#$%^&*`).
  - Confirmación de contraseña: Si no coincide, el botón de registrarse debe permanecer deshabilitado o mostrar error inmediato.
  - Sanitización: Intentar registrarse con espacios en blanco al inicio o final del correo; el sistema debe recortarlos (`trim`).

#### 2.3 Perfil de Usuario (`/profile` y `/private/profile`)

- [ ] **Lógica Condicional por Rol:**
  - **Usuario General / Agricultor:**
    - Abrir el perfil. **Verificar rigurosamente que NO aparezcan los campos internos de INIFAP:** _"Turno Operativo"_, _"Puesto y Cargo"_ ni _"Identificador Institucional"_.
  - **Personal INIFAP / Administrador:**
    - Los campos de Puesto, Cargo y Turno deben mostrarse habilitados o en modo informativo institucional.
- [ ] **Seguridad y Sesiones Activas:**
  - Confirmar que el bloque redundante de _"Dispositivos y Sesiones Activas"_ se encuentre debidamente gestionado y no cause confusión visual.
  - Probar el formulario de **Cambio de Contraseña**:
    - Exigir contraseña actual correcta.
    - Validar que la nueva contraseña cumpla la política estricta.
    - Al cambiarla exitosamente, emitir mensaje de confirmación sin recarga abrupta de pantalla.
- [ ] **Carga y Recorte de Avatar (Foto de Perfil):**
  - Subir una imagen JPG/PNG.
  - Verificar que el avatar se actualice de inmediato en la cabecera/navbar sin requerir F5 manual.
  - Intentar subir un archivo malicioso (ej. un `.txt` o un archivo de 10 MB) -> El sistema debe rechazarlo con mensaje claro de formato o tamaño máximo permitido (5 MB).

#### 2.4 Flujo de Ascenso y Validación INIFAP

- [ ] **Solicitud de Ascenso Institucional:**
  - Con un usuario recién registrado (Agricultor), ingresar a la pantalla de solicitud de ascenso.
  - Verificar que el formulario solicite la justificación institucional, centro de investigación o código de invitación INIFAP.
  - Probar ingreso de un código válido vs. código expirado o falso: debe validar adecuadamente.
  - Una vez enviada la solicitud, el perfil debe reflejar el estado _"Solicitud de Validación en Trámite"_.

#### 2.5 Plantillas de Error Personalizadas (404 y 403)

- [ ] **Error 404 (Ruta Inexistente):**
  - Escribir en la barra de direcciones una URL inexistente: `http://localhost:3000/esta-pagina-no-existe`.
  - **Resultado esperado:** Debe renderizar una vista personalizada 404 con diseño editorial institucional, mensaje amigable y un botón visible de _"Volver al Inicio"_. **Bajo ninguna circunstancia debe devolver texto plano ni pantalla en blanco.**
- [ ] **Error 403 (Acceso Denegado / Falta de Permisos):**
  - Iniciar sesión como Agricultor e intentar acceder manualmente a una ruta administrativa: `/private/crops` o `/private/users`.
  - **Resultado esperado:** Debe renderizar una vista 403 amigable que explique que la cuenta no cuenta con permisos suficientes, con un enlace para volver a su perfil o inicio.

---

### MÓDULO 3: PANEL ADMINISTRATIVO INIFAP — GESTIÓN EDITORIAL DE CATÁLOGOS

---

#### 3.1 Estandarización Visual y KPIs de Encabezado

- [ ] **Consistencia entre Módulos:**
  - Comparar visualmente las pantallas de **Cultivos** (`/private/crops`), **Plagas** (`/private/plagues`), **Productos** (`/private/products`) e **Ingredientes Activos** (`/private/ingredients`).
  - Las 4 vistas deben compartir el mismo patrón estructural:
    - Cabecera con título del catálogo, botón de acción primaria _"Nuevo Registro"_ y métricas clave (KPIs).
    - Barra de filtros rápidos y búsqueda textual en tiempo real.
    - Pestañas organizadas por estado del flujo editorial (_Publicados_, _En Revisión_, _Baja en Trámite_, _Archivados_).
    - Selector de vista: Tabla detallada vs. Cuadrícula de tarjetas.

---

#### 3.2 Flujo Editorial y Ciclo de Vida del Expediente (Draft -> In Review -> Verified -> Published)

Ejecutar la siguiente secuencia de validación paso a paso:

```
[Borrador (Draft)] ──(submit_review)──> [En Revisión] ──(request_changes)──> [Cambios Solicitados]
                                              │                                       │
                                          (verify)                               (submit_review)
                                              ▼                                       │
                                        [Verificado] ◄────────────────────────────────┘
                                              │
                                          (publish)
                                              ▼
                                         [Publicado]
```

- [ ] **Paso A: Creación de Borrador (`draft`):**
  - Como Investigador 1, crear un nuevo cultivo/plaga/producto con datos mínimos válidos.
  - El registro debe guardarse con `workflow_status: draft` y quedar visible solo en la pestaña de borradores o en revisión del autor.
- [ ] **Paso B: Envío a Revisión (`submit_review`):**
  - En la ficha técnica, presionar _"Enviar a Revisión"_.
  - El estado debe pasar a `in_review`. A partir de este momento, **los campos de edición deben quedar bloqueados** para evitar modificaciones mientras está bajo dictamen.
- [ ] **Paso C: Solicitud de Cambios (`request_changes`):**
  - Iniciar sesión como Investigador 2 (Revisor).
  - Abrir el expediente y presionar _"Solicitar Correcciones"_.
  - El modal debe obligar a ingresar observaciones técnicas. Si se deja en blanco o con menos caracteres del mínimo, debe impedir el envío.
  - El estado debe pasar a `changes_requested` y el autor original debe poder editar nuevamente para corregir.
- [ ] **Paso D: Verificación Técnica (`verify`):**
  - El revisor dictamina favorablemente y presiona _"Verificar Expediente"_.
  - El registro pasa a `verified`. **Aún no debe ser visible en el portal público.**
- [ ] **Paso E: Publicación Oficial (`publish`):**
  - Solo un usuario con rol `admin` debe tener habilitado el botón _"Publicar en Portal Oficial"_.
  - Tras publicar, el registro adquiere estado público (`status: aprobado / true`) y se visualiza inmediatamente en los catálogos públicos.

---

#### 3.3 Auditoría de Baja Justificada y Principio de los 4 Ojos (Aprobación Dual)

_Esta es una de las reglas de seguridad agronómica más críticas del sistema para evitar que registros oficiales se den de baja de manera arbitraria._

- [ ] **Prueba 1: Eliminación física bloqueada:**
  - Ubicar un registro publicado o verificado en la tabla.
  - **Verificar que NO exista ícono de bote de basura ni botón de eliminación directa.** La eliminación física solo está permitida para borradores propios (`draft`).
- [ ] **Prueba 2: Solicitud de Baja (`request_archive`):**
  - Como Investigador 1, ingresar al expediente publicado y presionar _"Solicitar Baja"_.
  - El modal debe solicitar obligatoriamente:
    - _Categoría del motivo:_ Obsolescencia técnica, Reclasificación taxonómica, Prohibición regulatoria/COFEPRIS, Riesgo toxicológico, etc.
    - _Justificación técnica detallada:_ Escribir menos de 20 caracteres (ej. _"Ya no sirve"_) -> **El sistema DEBE rechazar la solicitud exigiendo un argumento técnico sólido de al menos 20 caracteres.**
    - Escribir una justificación técnica formal (ej. _"Variedad discontinuada por susceptibilidad severa comprobada ante nuevas cepas de roya"_).
    - Enviar la solicitud. El estado cambia a `archive_pending`.
- [ ] **Prueba 3: Banner Institucional Informativo:**
  - Recargar la ficha. Debe desplegarse un banner ámbar superior que informe claramente:
    - Nombre del especialista solicitante y fecha de solicitud.
    - Categoría y justificación técnica completa.
    - Mensaje indicando que el expediente se encuentra en trámite de baja y requiere dictamen de un segundo revisor.
- [ ] **Prueba 4: Bloqueo de Auto-Aprobación (Principio de 4 Ojos):**
  - Estando logueado con el **mismo Investigador 1** que solicitó la baja, intentar aprobar el dictamen.
  - El sistema no debe mostrar los botones de aprobación para el solicitante o, si intenta forzar la petición HTTP, el servidor debe responder con código **403 Forbidden** indicando: _"Principio de aprobación dual: la baja debe ser dictaminada y aprobada por un especialista distinto al solicitante."_
- [ ] **Prueba 5: Dictamen por Segundo Revisor e Impacto Operativo:**
  - Cerrar sesión e ingresar con el **Investigador 2 (o Administrador)**.
  - Abrir el expediente en `archive_pending`. Ahora los botones de _"Aprobar Baja"_ y _"Rechazar Solicitud"_ deben estar habilitados.
  - **Prevalidación de Impacto en Cultivos:** Si el cultivo está sembrado en parcelas activas de productores, al presionar _"Aprobar Baja"_, el sistema debe frenar la acción con código **409 Conflict** alertando: _"No se puede dar de baja este cultivo: actualmente se encuentra sembrado en X lote(s) activo(s)."_
  - **Prevalidación en Plagas:** Si la plaga tiene reportes sanitarios abiertos (`status: open`) en predios, debe frenar con **409 Conflict**.
  - **Prevalidación en Ingredientes Activos:** Si el ingrediente está formulado en productos comerciales vigentes, debe frenar con **409 Conflict**.
  - Si no existen dependencias activas, aprobar la baja -> El expediente pasa a `archived`, se retira del catálogo público y se guarda la trazabilidad en la bitácora de auditoría.
- [ ] **Prueba 6: Rechazo de Baja:**
  - En otro expediente con solicitud de baja, presionar _"Rechazar Solicitud"_, agregando observaciones.
  - El expediente debe regresar a su estado original (`published`) y reactivar su visibilidad pública.

---

#### 3.4 Gestor Multimedia y Créditos de Imágenes

- [ ] **Carga Múltiple y Galería:**
  - En la ficha técnica, abrir el gestor de fotografías. Subir 2 o 3 imágenes simultáneamente.
  - Verificar que permita designar cuál es la **Imagen Principal** (`is_primary`) y alternar el orden de visualización.
- [ ] **Créditos y Atribución Institucional de Imágenes:**
  - En cada imagen cargada, verificar la existencia del campo **"Crédito / Fuente Institucional"** (ej. _"Fotografía: M.C. Juan Pérez - Campo Experimental Bajío"_ o _"Banco de Imágenes SENASICA"_).
  - Guardar los cambios.
  - Comprobar que en el visor/carrusel tanto público como privado, el crédito aparezca visible en la esquina inferior o pie de foto, otorgando la debida atribución de autoría.

---

### MÓDULO 4: GESTIÓN DE PARCELAS, LOTES Y REGISTRO AGRÍCOLA (`/private/lands`)

#### 4.1 Padrón de Parcelas y Granjas

- [ ] **Listado y Búsqueda:**
  - Filtrar por nombre de predio, nombre del productor y municipio.
  - Verificar la paginación y ordenamiento por fecha de registro o superficie.
- [ ] **Exportación del Padrón:**
  - Presionar el botón _"Exportar Padrón"_ (CSV / Excel).
  - Abrir el archivo descargado y verificar que las columnas contengan datos legibles, sin errores de codificación de caracteres acentuados (UTF-8 con BOM) y con totales exactos de superficie.
- [ ] **Eliminación y Archivado de Predios:**
  - _Archivar:_ Debe mover la parcela a la pestaña de inactivas sin destruir sus registros históricos.
  - _Eliminación física definitiva:_ Solo debe estar permitida si la parcela NO posee ciclos de cultivo, lotes activos ni reportes sanitarios registrados. Si tiene historial, el sistema debe prohibir la eliminación permanente.

#### 4.2 Expediente Operativo de Parcela (`/private/lands/:id/expediente`)

- [ ] **Mapeo Geoespacial (Leaflet):**
  - Carga correcta del mapa en el contenedor sin desbordamientos de CSS.
  - Verificar que las coordenadas latitud/longitud posicionen el marcador en la ubicación real en México.
  - Probar el cambio de capa: Mapa de calles vs. Vista satelital.
- [ ] **Gestión de Lotes de Cultivo:**
  - Crear un nuevo lote especificando nombre/código y superficie en hectáreas.
  - **Validación de superficie:** Intentar crear un lote con una superficie que sumada a los demás supere la superficie total de la parcela -> El sistema debe alertar y bloquear la creación.
- [ ] **Ciclo Fenológico del Cultivo (Etapas Biológicas):**
  - Iniciar un nuevo ciclo seleccionando un cultivo oficial del catálogo.
  - Verificar la barra de progreso fenológico interactivo:
    1. _Siembra / Establecimiento_
    2. _Desarrollo Vegetativo_
    3. _Floración / Llenado de Fruto_
    4. _Maduración y Cosecha_
  - Presionar _"Avanzar Etapa Fenológica"_: Debe solicitar fecha de cambio y notas de campo. La barra debe actualizar su porcentaje y color en tiempo real.
  - Presionar _"Revertir Etapa"_: En caso de error de captura del técnico, debe permitir regresar a la etapa inmediata anterior, registrando la justificación.
  - Presionar _"Finalizar Ciclo"_: Solicitar rendimiento obtenido (toneladas) y archivar el ciclo histórico en el expediente.
- [ ] **Reportes Fitosanitarios de Campo (`FarmHealthReport`):**
  - Registrar un reporte fitosanitario seleccionando una plaga del catálogo.
  - Marcar el nivel de severidad (_Leve_, _Moderado_, _Crítico_), porcentaje de incidencia y lote afectado.
  - El reporte debe figurar con estatus `open`.
  - Probar el botón _"Cerrar / Controlar Alerta"_, indicando la efectividad del tratamiento.
- [ ] **Bitácora de Aplicaciones de Agroquímicos (`FarmApplication`):**
  - Registrar una aplicación seleccionando un producto químico del catálogo.
  - Ingresar dosis por hectárea, equipo utilizado (aspersora manual, tractor, dron) y fecha de aplicación.
  - Comprobar que el sistema calcule o muestre el **Periodo de Carencia / Intervalo de Seguridad** antes de la cosecha.

---

### MÓDULO 5: PROVEEDORES, REPORTES Y AUDITORÍA GLOBAL

#### 5.1 Directorio de Proveedores (`/private/suppliers`)

- [ ] **Formulario Seccionado:**
  - Probar la captura: Razón Social, RFC, Nombre de Contacto, Teléfono, Correo y Dirección.
  - **Validación estricta de RFC:** Intentar guardar un RFC con formato inválido -> Debe ser rechazado.
  - **Validación de teléfono:** Debe exigir formato válido de 10 dígitos.

#### 5.2 Reportes Operativos y Analítica (`/private/reports`)

- [ ] **Gráficos SVG Interactivos:**
  - Verificar que los gráficos estadísticos (distribución de cultivos, plagas más reportadas, avance de siembras) se rendericen nítidamente sin dependencias rotas.
  - Probar los filtros por rango de fechas (última semana, último mes, ciclo actual).
- [ ] **Generación de Reporte Ejecutivo en PDF:**
  - Presionar _"Descargar Reporte Ejecutivo PDF"_.
  - Comprobar que el documento contenga logotipo institucional, tablas resumen consolidadas y métricas calculadas sin cortes de página desordenados.

#### 5.3 Módulo de Auditoría Global (`/private/audit`)

- [ ] **Trazabilidad Inmutable:**
  - Realizar una modificación cualquiera en un cultivo o parcela.
  - Ingresar inmediatamente a `/private/audit`.
  - La bitácora debe reflejar en la primera fila:
    - Fecha y hora exacta.
    - Nombre y correo del usuario que realizó la acción.
    - Acción efectuada (ej. `crop.update`, `workflow.request_archive`, `farm.create`).
    - Tabla afectada e ID del registro.
  - **Visor de Diferencias (Diff):** Presionar _"Ver Detalle"_ en el registro de auditoría. Debe desplegar un comparador claro entre los valores anteriores (`old_values`) y los nuevos valores (`new_values`).
  - Probar la exportación de la bitácora a formato CSV.

---

### MÓDULO 6: CONTROL DE ACCESO BASADO EN ROLES (RBAC) Y SEGURIDAD

#### 6.1 Matriz de Permisos Efectivos

Ejecutar la siguiente batería de comprobación de privilegios:

| Acción en el Sistema                                    |    Visitante    |     Agricultor     |     Técnico / INIFAP      |       Administrador       |
| :------------------------------------------------------ | :-------------: | :----------------: | :-----------------------: | :-----------------------: |
| Consultar fichas públicas (Cultivos, Plagas, Productos) |       ✅        |         ✅         |            ✅             |            ✅             |
| Descargar PDFs públicos y Hojas de Seguridad            |       ✅        |         ✅         |            ✅             |            ✅             |
| Enviar propuesta de nuevo cultivo/plaga (Colaboración)  | ❌ (Pide login) |         ✅         |            ✅             |            ✅             |
| Acceder al Panel Administrativo (`/private/*`)          | ❌ (302 Login)  | ❌ (403 Forbidden) |            ✅             |            ✅             |
| Crear y editar parcelas propias                         |       ❌        |         ✅         |            ✅             |            ✅             |
| Crear borradores de fichas científicas                  |       ❌        |         ❌         |            ✅             |            ✅             |
| Dictaminar revisión técnica de expedientes              |       ❌        |         ❌         |    ✅ (Si no es autor)    |            ✅             |
| Publicar expediente oficialmente en portal              |       ❌        |         ❌         |            ❌             |            ✅             |
| Solicitar baja justificada de expediente                |       ❌        |         ❌         |            ✅             |            ✅             |
| Aprobar baja de expediente (Dual Approval)              |       ❌        |         ❌         | ✅ (Si no es solicitante) | ✅ (Si no es solicitante) |
| Gestión de Usuarios y Roles RBAC                        |       ❌        |         ❌         |            ❌             |            ✅             |
| Visualizar Bitácora de Auditoría Global                 |       ❌        |         ❌         |            ❌             |            ✅             |

#### 6.2 Pruebas de Resistencia y Seguridad (Brechas y Vectores de Ataque)

- [ ] **Inyección de Scripts (XSS Almacenado y Reflejado):**
  - En cualquier formulario (ej. nombre de predio, nombre común de plaga, notas de cultivo), ingresar el payload:  
    `<script>alert('XSS-TEST')</script>` o `"><img src=x onerror=alert('XSS')>`
  - Guardar el registro y abrir la vista de detalle y la tabla.
  - **Resultado esperado:** El texto debe mostrarse sanitizado/escapado como texto literal plano. **Jamás debe ejecutarse una ventana emergente de JavaScript.**
- [ ] **Control de Acceso Horizontal (IDOR - Insecure Direct Object References):**
  - Como Usuario Agricultor A, identificar el ID de una de sus parcelas (ej. ID `101`).
  - Abrir otra sesión como Usuario Agricultor B (con parcela ID `102`).
  - Desde la sesión del Usuario B, intentar forzar la URL o petición de edición de la parcela del Usuario A:  
    `POST /private/lands/101/lots` o `GET /private/lands/101/expediente`
  - **Resultado esperado:** El servidor debe denegar el acceso inmediatamente con código **403 Forbidden** o **404 Not Found**. No debe permitir ver ni alterar datos de otro productor.
- [ ] **Elevación Vertical de Privilegios:**
  - Desde la cuenta de Agricultor, intentar enviar mediante cURL o la consola de desarrollo una petición POST reservada a administradores (ej. `POST /private/users/create` o `POST /private/crops/1/workflow`).
  - **Resultado esperado:** Respuesta estricta **403 Forbidden** sin procesar la lógica de negocio.

---

### MÓDULO 7: AUDITORÍA VISUAL, COMPONENTES UI Y RESPONSIVIDAD MÓVIL

#### 7.1 Modales y Bloqueo de Desplazamiento de Fondo (Scroll Lock)

- [ ] **Prueba de Interacción de Modales:**
  - En cualquier pantalla (ej. modal de _Solicitar Baja_, modal de _Nuevo Lote_, modal de _Editar Relaciones_), abrir la ventana modal.
  - Colocar el cursor fuera del modal sobre el fondo oscuro (`backdrop`).
  - Girar la rueda del ratón hacia arriba y hacia abajo: **El fondo de la página web (`body`) NO debe moverse en lo absoluto.**
  - Ahora colocar el cursor dentro de un input o textarea del modal y usar la rueda del ratón: **El contenido que está detrás del modal no debe desplazarse.** Solo el contenedor interno del modal debe tener scroll si su contenido excede la altura de la pantalla.
  - Cerrar el modal: El scroll natural de la página debe restaurarse de inmediato sin saltos bruscos.

#### 7.2 Estados de Carga (Loadings) y Prevención de Doble Envío

- [ ] **Feedback en Acciones Asíncronas:**
  - En cualquier formulario con botón de envío (_Guardar_, _Enviar a Revisión_, _Aprobar Baja_), presionar el botón.
  - **Comportamiento esperado:**
    - El botón debe deshabilitarse de inmediato para evitar que un usuario impaciente haga doble clic y duplique registros.
    - Debe mostrar un indicador visual de carga (spinner o texto dinámico: _"Guardando..."_, _"Procesando..."_).
    - Tras finalizar, debe desplegar un mensaje flotante (Toast o alerta) indicando éxito o el motivo específico del fallo.

#### 7.3 Verificación de Responsividad Móvil (Viewport 375px a 414px)

- [ ] **Inspección en Smartphone (o emulador de Chrome DevTools):**
  - **Desbordamiento Horizontal:** Desplazar la pantalla con el dedo de izquierda a derecha. **No debe existir ningún espacio blanco lateral ni scroll horizontal accidental.** Todo el ancho debe coincidir con el 100% del viewport.
  - **Zonas de Toque (Touch Targets):** Todos los botones primarios, íconos de acción y pestañas deben tener una superficie mínima de toque táctil de al menos **44 x 44 píxeles**, evitando que el usuario presione accidentalmente un botón adyacente.
  - **Tablas de Datos en Pantalla Estrecha:**
    - Verificar que las tablas complejas cuenten con scroll horizontal interno suave (`overflow-x: auto`) con indicador visual de desplazamiento, o se transformen en tarjetas verticales responsivas.
  - **Formularios en Móvil:** Los inputs deben tener un tamaño de fuente de al menos 16px para evitar que los navegadores iOS/Safari hagan zoom involuntario al enfocar un campo.

---

## 4. PLANTILLA PARA EL REPORTE DE INCIDENCIAS

Cuando tu compañera detecte cualquier anomalía, debe documentarla siguiendo este formato estándar para que el equipo de desarrollo pueda reproducirla y resolverla con precisión quirúrgica:

```markdown
### [ID-HALLAZGO] - Título breve y descriptivo del problema

- **Severidad:** [S1 - Crítica | S2 - Alta | S3 - Media | S4 - Baja | S5 - Observación]
- **Módulo Afectado:** [ej. Portal Público / Ficha de Plagas / Panel INIFAP / Parcelas]
- **Rol Utilizado:** [Visitante / Agricultor / Investigador INIFAP / Administrador]
- **Dispositivo y Navegador:** [ej. Windows 11 - Chrome 124 / iPhone 13 - Safari]
- **URL o Ruta:** [ej. /private/crops/15]

#### Pasos para Reproducir:

1. Iniciar sesión como usuario 'inifap-investigador@agrosystem.test'.
2. Navegar a '/private/crops/15'.
3. Hacer clic en el botón 'Solicitar Baja'.
4. Ingresar una justificación de 10 caracteres y presionar enviar.

#### Comportamiento Observado:

El sistema muestra una pantalla de error genérica 500 en lugar de validar en el modal el límite mínimo de 20 caracteres.

#### Comportamiento Esperado:

El modal debe resaltar el campo en rojo indicando que la justificación requiere al menos 20 caracteres y deshabilitar el botón de envío.

#### Evidencia:

_(Adjuntar captura de pantalla, video o log de la consola si aplica)_
```

---

## 5. RESUMEN EJECUTIVO Y CRITERIOS DE ACEPTACIÓN FINAL

La plataforma se considerará formalmente lista para pase a producción y entrega a asesores cuando:

1. **Cero incidencias S1 (Críticas) y S2 (Altas)** activas en el registro.
2. Todas las rutas respondan con códigos HTTP limpios (`200`, `302`, `403` amigable, `404` amigable, `409` con mensaje de impacto claro).
3. El flujo editorial de aprobación dual (regla de los 4 ojos) funcione sin fisuras en las 4 entidades del catálogo.
4. El comportamiento visual y responsivo en dispositivos móviles garantice ergonomía total y ausencia de scrollbars horizontales no deseadas.
