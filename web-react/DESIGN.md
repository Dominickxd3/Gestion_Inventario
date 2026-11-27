# ScanGP — Sistema de diseño v2 (plataforma de gestión de activos)

Estado: **propuesta** (27 nov 2026). Arquitectura y modelo de datos en [`docs/ARQUITECTURA.md`](../docs/ARQUITECTURA.md).
La versión anterior, centrada en el diagnóstico de equipos detectados, se conserva en
[`docs/DESIGN-v1-diagnostico.md`](docs/DESIGN-v1-diagnostico.md): sus pantallas técnicas pasan a la pestaña **Detección** de la ficha del activo y siguen sus reglas.

---

## 1. Para quién y para qué

Usuarios: personal de TI que registra, asigna, mueve y repara activos a diario, y responsables que consultan.
La interfaz es una **herramienta de trabajo**: se valora la densidad, la velocidad de lectura, la consistencia y que cada acción deje rastro. No es un panel de marketing.

### Principios
1. **La tabla es la pantalla.** La mayor parte del trabajo ocurre en listas filtradas. Todo lo demás (ficha, formularios) se abre desde ellas y vuelve a ellas.
2. **Densidad con jerarquía.** Mucha información por pantalla, ordenada por tipografía, alineación y líneas finas; no por cajas ni color.
3. **El estado se lee en un vistazo y nunca solo por color**: icono + texto.
4. **Validado ≠ detectado.** Lo que dijo ScanGP se distingue visualmente de lo que TI validó (ver §4.4).
5. **Toda acción es reversible o confirmada, y siempre auditada.** Las acciones que crean historia (baja, retiro, transferencia) piden motivo.
6. **Nada ficticio.** Sin datos de ejemplo, sin cifras inventadas; un valor ausente se explica (`Unavailable`).

### Lo que no se hace
Tarjetas para envolver contenido estático · degradados · sombras en contenido · colores saturados decorativos · iconos de colores por categoría · ilustraciones en estados vacíos · emojis · textos de relleno ("¡Bienvenido de nuevo!") · métricas gigantes sin acción asociada · bordes redondeados grandes · animaciones decorativas · glassmorphism.

---

## 2. Tokens

Se mantienen los de v1 (`src/design/tokens.css`), que ya cumplen las reglas: fondo blanco, superficies neutras, un acento, estados desaturados con contraste AA. Se **añaden**:

| Token | Valor | Uso |
|---|---|---|
| `--row-height-compact` | `32px` | tablas administrativas (densidad por defecto) |
| `--row-height` | `40px` | tablas con dos líneas o en modo cómodo |
| `--header-height` | `48px` | cabecera de página compacta |
| `--toolbar-height` | `40px` | barra de búsqueda/filtros sobre tablas |
| `--sidebar-width` | `224px` (antes 232) | navegación con grupos |
| `--sidebar-width-collapsed` | `56px` | navegación contraída (solo iconos + tooltip) |
| `--content-max` | `none` en listas · `1200px` en ficha y formularios | las tablas usan todo el ancho |
| `--color-detected` | `#6B7380` (= `text-tertiary`) | marca de dato detectado |
| `--color-selected` | `#F2F4FC` | fila seleccionada (más tenue que `accent-subtle`) |
| `--text-table` | `400 13px/18px var(--font-sans)` | celdas de tabla |

Tipografía: Inter (ya incluida). Mono para código patrimonial, serie, MAC, UUID. `tabular-nums` en toda cifra.

Radios: `4px` en controles, `6px` en menús y diálogos. Nada mayor.
Sombras: **solo** `--shadow-overlay` en menús, diálogos, panel lateral deslizante y toasts.

---

## 3. Estructura general

```
┌───────────────┬──────────────────────────────────────────────────────────────────────────┐
│ ▣ ScanGP      │ Activos                                    [⌕ Buscar  Ctrl K]  [+ Nuevo] │ ← cabecera 48 px
│               ├──────────────────────────────────────────────────────────────────────────┤
│ ⌂ Inicio      │ [⌕ Buscar en activos…] [Tipo ▾] [Estado ▾] [Ubicación ▾] [+ Filtro]      │ ← barra 40 px
│               │                               1.284 activos  [▥ Columnas] [⤓ Exportar]  │
│ INVENTARIO    ├──────────────────────────────────────────────────────────────────────────┤
│ ▤ Activos     │ ☐ Código     Equipo        Tipo     Marca   Modelo     Responsable  …    │
│ ◫ Componentes │ ☐ TI-000123  LAP-SISTEMAS  Laptop   Dell    Inspiron…  A. Pérez     …  ⋯ │
│               │ ☐ …                                                                       │
│ OPERACIONES   │                                                                           │
│ ⇄ Asignaciones│                                                                           │
│ ⚒ Mantenim.   │                                                                           │
│ ⛨ Garantías   │                                                                           │
│ ALMACÉN  …    │                                                                           │
│ DESCUBRIM.    │                                                                           │
│ ⚠ Discrep. 12 │                                                                           │
│ …             │                                                                           │
│ ───────────── │                                                                           │
│ ● Conectado   │                                                                           │
│ U  Usuario ▾  │                                                                           │
└───────────────┴──────────────────────────────────────────────────────────────────────────┘
```

### Navegación lateral
- Fondo `--color-bg-subtle`, línea divisoria derecha. Grupos con etiqueta `caption` en mayúsculas (`INVENTARIO`, `OPERACIONES`…), sin iconos en la etiqueta.
- Elemento: icono Lucide 16 px + texto 13 px, alto 32 px. Activo: fondo `--color-accent-subtle`, texto `--color-accent`, sin barra lateral de color.
- Contadores (discrepancias pendientes, préstamos vencidos) alineados a la derecha, texto `caption`, sin pastilla de color; en rojo solo si hay vencidos.
- Contraíble a 56 px (preferencia guardada por usuario). Pie: estado de conexión + menú del usuario.
- Móvil (< 768 px): barra superior + panel a pantalla completa (como v1).

### Cabecera de página
48 px. Título `title` (20 px) a la izquierda; a la derecha, búsqueda global (`Ctrl K`) y una sola acción primaria. Las migas aparecen solo en páginas de detalle, encima del título, en `caption`.

---

## 4. Patrones

### 4.1 Tabla administrativa (`DataTable` de PrimeReact sobre tokens)
| Regla | Detalle |
|---|---|
| Densidad | filas de 32 px; texto 13 px; padding horizontal 12 px; sin rayado alterno; divisor de 1 px entre filas |
| Cabecera | fondo `bg-subtle`, `label` 12–13 px, peso 500, fija al hacer scroll; icono de orden solo en la columna ordenada o al pasar el ratón |
| Alineación | texto a la izquierda; cifras a la derecha con unidad; fechas relativas ("hace 2 d") con la absoluta en tooltip |
| Primera columna | código patrimonial en mono, enlace a la ficha |
| Selección | casilla en la primera columna; al seleccionar, la barra de herramientas se sustituye por la barra de acciones en lote ("3 seleccionados · Asignar · Transferir · Exportar · ✕") |
| Acciones por fila | botón `⋯` (Lucide `MoreHorizontal`) visible al pasar el ratón o con foco, y clic derecho → mismo menú contextual |
| Filtros | chips en la barra: `Tipo: Laptop, Escritorio ✕`. "+ Filtro" abre un menú con todas las columnas filtrables. Filtros y orden se reflejan en la URL (compartibles) |
| Búsqueda | una caja que busca en código, nombre, serie, responsable y modelo; resalta la coincidencia |
| Columnas | menú "Columnas" con casillas y reordenar arrastrando; preferencia guardada por usuario y por tabla; botón "Restablecer" |
| Paginación | servidor; 50 filas por defecto; total siempre visible ("1.284 activos") |
| Vacío | una línea de texto + acción ("No hay activos. Registrar activo · Importar desde detectados"). Vacío por filtros: "Ningún activo coincide con los filtros · Limpiar filtros" |
| Carga | esqueleto de filas con la altura final, tras 150 ms |

**Columnas por defecto de Activos**: Código patrimonial · Equipo · Tipo · Marca · Modelo · Responsable · Ubicación · Estado.
Opcionales: N.º de serie · Área · Estado técnico · Asignación · Sincronización · Último reporte · Garantía hasta · Fecha de adquisición.
Las especificaciones técnicas (CPU, RAM, disco) **no** van en la tabla principal: están en la ficha.

### 4.2 Estados (cuatro ejes, un lenguaje)
Cada eje tiene su propio conjunto de valores (ver ARQUITECTURA §3) y **nunca se mezclan en una sola insignia**.

| Elemento | Representación |
|---|---|
| Columna **Estado** en la tabla | ciclo de vida como texto con punto de 6 px (`● En servicio`) + iconos de 14 px a la derecha solo cuando hay algo que atender: `Wrench` en mantenimiento, `AlertTriangle` discrepancias, `Clock` préstamo vencido, `CloudOff` sin reporte. Cada icono con tooltip y texto accesible |
| Cabecera de la ficha | fila de pares etiqueta/valor: `Ciclo de vida  ● En servicio · Técnico  ● Operativo · Asignación  Asignado a A. Pérez · Ubicación  Sede Central › Sistemas · Sincronización  ✓ Sincronizado hace 1 h` |

Colores de punto: `success` (En servicio, Operativo, Sincronizado), `warning` (Fuera de servicio, Con fallas, Con discrepancias, Sin reporte), `danger` (Averiado, Irreparable), `text-tertiary` (Alta pendiente, Dado de baja, Sin evaluar, No aplica). El acento **no** se usa para estados.

### 4.3 Ficha del activo (`/activos/:id`)
```
Activos / TI-000123
LAP-SISTEMAS   TI-000123                                  [Asignar] [Mantenimiento] [⋯]
Laptop · Dell Inspiron 16 7630 2-in-1 · Serie 1R0HYW3
Ciclo de vida ● En servicio   Técnico ● Operativo   Asignado a A. Pérez   Sede Central › Sistemas   ✓ Sincronizado
─────────────────────────────────────────────────────────────────────────────────────────
General  Componentes 4  Asignaciones  Mantenimientos 1  Garantías  Documentos 2  Historial  Detección
─────────────────────────────────────────────────────────────────────────────────────────
```
- Pestañas con subrayado de 2 px en el acento para la activa; contador `caption` cuando aporta. Cada pestaña tiene URL propia (`/activos/:id/componentes`).
- **General**: dos columnas de `KeyValueList` — Identificación (código, nombre, serie, modelo, tipo) · Adquisición (fecha, proveedor, costo, factura) · Ubicación y responsable · Especificaciones validadas (según plantilla del tipo) · Observaciones. Edición en línea por sección ("Editar" a la derecha del título de sección).
- **Componentes**: tabla de instalados (código, tipo, modelo, serie, capacidad, desde) + acciones Instalar / Retirar / Reemplazar; debajo, "Componentes integrados (no rastreables)" en solo lectura. Interruptor "Mostrar retirados" para ver instalaciones cerradas.
- **Asignaciones / Mantenimientos / Garantías / Documentos**: tabla cronológica + acción principal de la pestaña.
- **Historial**: línea de tiempo vertical unificada (movimientos, asignaciones, mantenimientos, discrepancias resueltas, ediciones). Cada entrada: fecha · usuario · acción · detalle `antes → después` · enlace a la referencia. Filtro por tipo de evento.
- **Detección**: navegación de componentes de v1 (Resumen, Procesador, Memoria…, Compatibilidad, Diagnóstico) sobre el último escaneo, con aviso superior en `caption`: "Datos detectados por ScanGP el 27 nov 2026 10:15. Pueden diferir del inventario validado." + selector de escaneo anterior.

### 4.4 Validado frente a detectado
- Un dato **detectado** que difiere del validado muestra el valor validado y, debajo en `caption` `--color-detected`, `ScanGP detectó: 32 GB` con icono `ScanSearch` 12 px y enlace "Revisar discrepancia".
- Las pantallas técnicas de la pestaña Detección llevan siempre el aviso de origen.
- Nunca se muestra un dato detectado como si fuera validado.

### 4.5 Bandeja de discrepancias
Tabla agrupada por activo: tipo de discrepancia, componente, valor validado, valor detectado, fecha de escaneo. Panel lateral derecho (480 px) al seleccionar una fila con el detalle y las acciones **Aceptar** (dice exactamente qué operación ejecutará: "Retirar RAM TI-C-0042 y moverla a Almacén central") y **Rechazar** (pide motivo). Aceptación en lote solo para discrepancias del mismo tipo.

### 4.6 Formularios y acciones
- Crear/editar entidades largas (activo, orden de mantenimiento): página propia, una columna de 640 px, secciones con título, botones al pie fijos ("Cancelar" secundario, "Guardar" primario).
- Operaciones cortas (asignar, transferir, retirar, dar de baja): **panel lateral** de 480 px desde la derecha, no modal centrado; mantiene visible la tabla o la ficha.
- Etiqueta encima del campo; ayuda en `caption` debajo; error en `danger` con icono, debajo del campo, al salir del campo y al enviar.
- Campos de referencia (persona, ubicación, modelo) con autocompletado y opción "Crear nuevo…" para catálogos.
- Operaciones que crean historia: el campo **Motivo** es obligatorio. Baja: confirmación escribiendo el código patrimonial.
- Tras guardar: toast discreto abajo a la derecha (4 s) con "Deshacer" cuando la operación lo admite.

### 4.7 Panel de inicio
Sin métricas decorativas. Tres bloques en columnas, cada uno una lista accionable:
**Pendientes** (discrepancias, préstamos vencidos, órdenes abiertas > N días, garantías que vencen en 30 días, activos sin reporte) · **Actividad reciente** (últimas 20 operaciones de la auditoría) · **Resumen** (fila de cifras: activos en servicio, asignados, en mantenimiento, en almacén — cada cifra es un enlace a la tabla filtrada).

---

## 5. Componentes nuevos (`src/components/`)

| Componente | Responsabilidad |
|---|---|
| `AppShell` · `SideNav` · `SideNavGroup` | estructura y navegación agrupada y contraíble |
| `PageHeader` (ampliado) | variante compacta 48 px, migas opcionales |
| `DataGrid` | envoltorio de `DataTable`: densidad, selección, menú contextual, columnas configurables, estado en URL, paginación de servidor |
| `Toolbar` · `FilterChips` · `ColumnPicker` · `BulkActionBar` | barra superior de tablas |
| `RowActions` | botón `⋯` + menú contextual compartido con clic derecho |
| `Tabs` | pestañas con URL propia y contador |
| `StateDot` · `StateIcons` · `StateBar` | representación de los ejes de estado (§4.2) |
| `SidePanel` | panel lateral de operaciones con pie de acciones |
| `FormField` · `RefSelect` · `ReasonField` | campos de formulario consistentes |
| `Timeline` | historial unificado |
| `DetectedHint` | marca "ScanGP detectó…" (§4.4) |
| `CommandPalette` | búsqueda global `Ctrl K` (activos, personas, componentes, páginas) |

Se conservan los de v1: `Section`, `Disclosure`, `KeyValueList`, `StatFigure`, `StatusLine`, `Meter`, `SpecTable`, `Unavailable`, estados, `Icon`, `DeviceTypeIcon`.

---

## 6. Iconografía (Lucide, 16 px en texto y navegación, `strokeWidth` 1.75)

| Área | Icono |
|---|---|
| Inicio | `House` |
| Activos | `Boxes` |
| Componentes | `Cpu` |
| Asignaciones | `ArrowLeftRight` |
| Mantenimiento | `Wrench` |
| Garantías | `ShieldCheck` |
| Almacén / Existencias | `Warehouse` · `PackageOpen` |
| Discrepancias | `GitCompareArrows` |
| Detectados | `ScanSearch` |
| Desplegar ScanGP | `Download` |
| Catálogo | `Library` |
| Organización / Personas / Ubicaciones | `Building2` · `Users` · `MapPin` |
| Auditoría | `ScrollText` |
| Configuración | `Settings` |
| Tipos de activo | v1 (`Laptop`, `Monitor`, `Server`…) + `Smartphone` celular · `Printer` impresora · `Router` red · `Keyboard`/`Mouse` periféricos · `MonitorSpeaker` monitor suelto |

---

## 7. Accesibilidad
Se mantienen las reglas de v1 (WCAG 2.2 AA, foco visible, teclado completo, `aria-live` para avisos). Además:
- Tablas: navegación con flechas entre filas; `Enter` abre la ficha; `Espacio` selecciona; `Shift+F10`/tecla menú abre el menú contextual.
- Panel lateral: atrapa el foco, `Esc` cierra, devuelve el foco al disparador.
- Los iconos de estado en la tabla tienen texto oculto para lectores de pantalla.
