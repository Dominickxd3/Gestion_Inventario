# ScanGP — Sistema de diseño y propuesta de pantallas

Estado: **implementado** (noviembre 2026). Las decisiones de la sección 11 indican qué quedó resuelto y qué sigue pendiente.

Plataforma web para identificar, diagnosticar y evaluar la compatibilidad de equipos Windows
(escritorio, laptop, All-in-One, Mini PC, estación de trabajo) a partir de los datos que envía el
detector portable **ScanGP.exe** (C#) a la API NestJS.

---

## 1. Análisis del proyecto actual

### Tecnologías que se mantienen
| Capa | Actual | Decisión |
|---|---|---|
| Framework | React 18 + TypeScript + Vite | Se mantiene |
| Componentes | PrimeReact 10 (tema Lara) | Se mantiene para DataTable, Dialog, Toast, Tooltip. El tema se neutraliza con tokens propios (sección 4) |
| Iconos | PrimeIcons | **Se reemplaza por Lucide** (`lucide-react`) |
| Navegación | Ninguna (una sola pantalla + modales) | **Se agrega `react-router-dom`** para módulos con URL propia |
| Estilos | `styles.css` único | Se divide en tokens + base + overrides de PrimeReact + CSS por componente |
| API | `/api/equipos`, `/api/equipos/:id`, `/api/estadisticas`, `/api/scangp/*`, `POST /api/inventario` | **Sin cambios** de lógica ni contratos |

### Problemas del frontend actual que el rediseño corrige
- `App.tsx` y `DetalleEquipo.tsx` mezclan datos, polling, formato y presentación.
- La ficha del equipo vive en un modal: no se puede enlazar, compartir ni navegar con "atrás".
- Colores por tipo de equipo (azul, verde, morado...) sin significado: ruido visual.
- Tarjetas con borde + radio + sombra en todas partes (lo que se pide evitar).
- Valores ausentes se muestran como "—" sin explicar si el dato no existe, no se pudo leer o requiere permisos.

### Qué datos son reales hoy (regla: nada ficticio)
Cada módulo solicitado contra lo que el detector **ya envía**:

| Módulo | Datos reales disponibles | No disponible hoy (no se mostrará como si existiera) |
|---|---|---|
| Información general | nombre, usuario, dominio, fabricante, modelo, serie, UUID, tipo y método de detección, SO, build, instalación, último arranque, antivirus | — |
| Procesador | modelo, fabricante, núcleos, hilos, frecuencia base, socket, caché L2/L3, virtualización | temperatura, uso, frecuencia turbo, TDP |
| Placa madre y BIOS | fabricante, modelo, versión, serie; BIOS: fabricante, versión, fecha, UEFI/Legacy, SMBIOS | chipset, RAM máxima soportada, ranuras PCIe/M.2 |
| Memoria RAM | total instalada/utilizable, ranuras usadas/totales, por módulo: tipo DDR, velocidad, formato DIMM/SODIMM, fabricante, n.º parte, serie | latencias, voltaje, canal dual |
| Tarjetas gráficas | modelo, fabricante, VRAM real, driver, resolución y Hz actuales | temperatura, uso |
| Almacenamiento | por disco: modelo, tipo HDD/SSD/NVMe, interfaz, capacidad, serie, firmware, salud de Windows, externo; volúmenes con espacio libre | atributos SMART, horas de uso, temperatura |
| Batería | presencia, carga actual, capacidad de diseño vs. actual y salud (solo si se ejecutó como administrador) | ciclos de carga |
| Monitores | fabricante (EDID), modelo, código, serie, año | tamaño en pulgadas, resolución nativa |
| Compatibilidad | se **deriva** de datos reales: tipo/formato de RAM, ranuras libres, interfaces de disco presentes, socket, UEFI | lista de piezas compatibles por modelo (requiere base de datos externa tipo PCPartPicker) |
| Recomendaciones | reglas sobre datos reales (sección 8) | precios, enlaces de compra |
| Diagnóstico | salud de discos, espacio libre, salud de batería, antivirus, tiempo encendido, lecturas fallidas del detector | pruebas de estrés, benchmarks |
| Historial | cambios detectados entre reportes (campo, antes, ahora, fecha), n.º de reportes, primer/último reporte | **instantáneas completas de cada análisis** (la API guarda solo el último inventario) |

**Tipos de equipo.** El detector envía `LAPTOP · ESCRITORIO · ALL_IN_ONE · TABLET · SERVIDOR · VIRTUAL`.
- **Mini PC** se puede distinguir en el frontend sin tocar la API: `equipo.chasisCodigos` incluye 35 (Mini PC) o 36 (Stick PC). Es un dato real de la BIOS.
- **Estación de trabajo** no tiene un indicador fiable en SMBIOS. Se estima en el frontend (ver sección 11).

---

## 2. Principios

1. **Lo importante primero.** Cada pantalla responde primero la pregunta del usuario ("¿qué equipo es?, ¿está bien?, ¿se puede mejorar?"); el detalle técnico queda en secciones expandibles.
2. **Honestidad de datos.** Todo valor viene del detector o se calcula a partir de él y lo dice ("Calculado a partir de…"). Nunca hay valores de ejemplo en la interfaz.
3. **Lenguaje para no técnicos, precisión para técnicos.** Etiqueta en lenguaje claro y término técnico como apoyo: "Memoria (RAM)", "Almacenamiento (discos)".
4. **Estructura sobre decoración.** Jerarquía por tipografía, espacio y líneas divisorias; no por cajas, sombras ni color.
5. **Un solo color de acento.** El color se reserva para acción (acento) y estado (correcto, advertencia, problema).

### Referencias y qué se toma de cada una
| Referencia | Se toma | No se toma |
|---|---|---|
| Linear | barra lateral sobria, densidad, tipografía pequeña y precisa, atajos, estados vacíos discretos | modo oscuro por defecto |
| NZXT CAM | cifra principal grande + unidad pequeña; medidores lineales para capacidad/uso | fondos oscuros, gráficos animados de tiempo real |
| Speccy | lista de componentes con un resumen de una línea, árbol "componente → detalle" | densidad sin jerarquía, todo expandido |
| PCPartPicker | lista de comprobaciones de compatibilidad con estado por línea y explicación | catálogo de compras |

---

## 3. Tokens de diseño

Se centralizan en `src/design/tokens.css` como variables CSS. Ningún componente usa valores literales.

### Color
Base neutra (gris frío, poco saturado). Fondo predominantemente blanco.

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#FFFFFF` | fondo de página y contenido |
| `--color-bg-subtle` | `#F7F8FA` | barra lateral, cabecera de tablas, fila seleccionada |
| `--color-bg-muted` | `#EFF1F4` | pista de medidores, código en línea |
| `--color-border` | `#E3E6EA` | divisores y bordes de controles |
| `--color-border-strong` | `#CDD2D9` | bordes en hover, separador de secciones principales |
| `--color-text` | `#14171C` | texto principal |
| `--color-text-secondary` | `#4A5260` | etiquetas, texto de apoyo |
| `--color-text-tertiary` | `#6B7380` | metadatos, "No disponible" (contraste 4.8:1 sobre blanco) |
| `--color-accent` | `#3A55C4` | acción principal, enlaces, foco, elemento activo |
| `--color-accent-hover` | `#2F47A8` | hover de acción principal |
| `--color-accent-subtle` | `#EEF1FB` | fondo de elemento activo en navegación |
| `--color-success` | `#2F7D4A` | correcto |
| `--color-success-subtle` | `#EDF6F0` | fondo de aviso correcto |
| `--color-warning` | `#9A6212` | advertencia |
| `--color-warning-subtle` | `#FBF4E8` | fondo de advertencia |
| `--color-danger` | `#B42E2E` | problema / error |
| `--color-danger-subtle` | `#FBEEEE` | fondo de error |

Reglas:
- Todos los textos cumplen WCAG AA (≥ 4.5:1; ≥ 3:1 para texto ≥ 18 px y componentes de interfaz).
- El estado nunca se comunica solo con color: siempre icono + texto.
- Los tipos de equipo **no** tienen color propio; se distinguen por icono y nombre.
- Prohibido: degradados, transparencias tipo vidrio (glassmorphism), colores saturados decorativos.

### Tipografía
| Token | Valor |
|---|---|
| `--font-sans` | `"Inter", system-ui, "Segoe UI", sans-serif` (Inter ya viene con PrimeReact) |
| `--font-mono` | `"JetBrains Mono", "Cascadia Mono", Consolas, monospace` — series, MAC, versiones, UUID |
| Cifras | `font-variant-numeric: tabular-nums` en tablas, medidores y valores técnicos |

| Estilo | Tamaño / interlineado | Peso | Uso |
|---|---|---|---|
| `display` | 28 / 34 | 600 | cifra principal (32 GB, 1.0 TB) |
| `title` | 20 / 28 | 600 | título de página |
| `heading` | 15 / 22 | 600 | título de sección |
| `body` | 14 / 20 | 400 | texto general (tamaño base) |
| `label` | 13 / 18 | 500 | etiquetas de dato, cabeceras de tabla |
| `caption` | 12 / 16 | 400 | metadatos, notas, unidades |

Sin MAYÚSCULAS sostenidas salvo cabeceras de tabla muy cortas; `letter-spacing` 0 salvo `caption` en mayúsculas (+0.02em).

### Espaciado (rejilla de 4 px)
`--space-1: 4px · --space-2: 8px · --space-3: 12px · --space-4: 16px · --space-5: 24px · --space-6: 32px · --space-7: 48px · --space-8: 64px`

- Separación entre secciones de una página: `--space-7`.
- Entre título de sección y contenido: `--space-3`.
- Filas de tabla: 40 px de alto (densa) / 48 px (cómoda, en móvil).

### Forma y elevación
| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 4px | botones, campos, insignias |
| `--radius-md` | 6px | menús, diálogos |
| `--shadow-overlay` | `0 8px 24px rgb(20 23 28 / 0.12)` | **solo** elementos flotantes: diálogo, menú, toast |
| `--border-hairline` | `1px solid var(--color-border)` | divisores |

Las secciones de contenido **no** son tarjetas: se separan con título + línea divisoria. No hay sombras en contenido estático.

### Movimiento
- `--duration-fast: 120ms`, `--duration-base: 180ms`, `--ease: cubic-bezier(0.2, 0, 0, 1)`.
- Solo transiciones de opacidad/color y despliegue de secciones. Con `prefers-reduced-motion: reduce` se desactivan.

### Puntos de quiebre
`sm 640px · md 768px · lg 1024px · xl 1280px`. Contenido con ancho máximo de 1200 px.

---

## 4. PrimeReact dentro del sistema

- Se conserva PrimeReact para componentes complejos (DataTable, Dialog, Toast, Tooltip, Dropdown).
- `src/design/primereact.css` sobrescribe el tema Lara con los tokens: radios 4 px, sin sombras en tablas ni paneles, foco con `--color-accent`, cabeceras de tabla en `--color-bg-subtle`.
- Los iconos de PrimeReact (paginador, ordenar, cerrar) se reemplazan por Lucide mediante sus props de iconos (`sortIcon`, `closeIcon`, etc.).
- Los componentes de presentación propios (sección 6) no dependen de PrimeReact.

---

## 5. Navegación y estructura de pantallas

### Mapa
```
/                         Inicio
/equipos                  Lista de equipos
/equipos/:id              Ficha del equipo  → Resumen (por defecto)
/equipos/:id/procesador
/equipos/:id/placa        Placa madre y BIOS
/equipos/:id/memoria
/equipos/:id/graficos
/equipos/:id/almacenamiento
/equipos/:id/bateria      (solo si el equipo tiene batería)
/equipos/:id/monitores
/equipos/:id/compatibilidad
/equipos/:id/recomendaciones
/equipos/:id/diagnostico
/equipos/:id/historial    Historial de análisis
/detectar                 Asistente de detección automática
```

### Estructura general (escritorio ≥ 1024 px)
```
┌──────────────┬────────────────────────────────────────────────────────────┐
│ ScanGP       │  [Aviso de desconexión, solo si aplica]                    │
│              ├────────────────────────────────────────────────────────────┤
│ ⌂ Inicio     │  Equipos / PC-EJEMPLO                       (migas)   │
│ ▤ Equipos    │                                                            │
│ ⊕ Detectar   │  Contenido de la página (máx. 1200 px)                     │
│              │                                                            │
│              │                                                            │
│              │                                                            │
│ ──────────── │                                                            │
│ ● Conectado  │                                                            │
│   API v1     │                                                            │
└──────────────┴────────────────────────────────────────────────────────────┘
  232 px, fondo --color-bg-subtle, línea divisoria a la derecha
```
- Barra lateral: 3 destinos principales, estado de conexión al pie (punto + texto).
- Móvil (< 768 px): la barra lateral se convierte en barra superior con botón de menú; el menú se abre como panel a pantalla completa.

### Pantalla 1 — Inicio
Responde: "¿cuántos equipos hay y cuáles necesitan atención?"
```
Inicio                                                    [Detectar equipo]

12 equipos        5 laptops     4 escritorio   1 All-in-One   1 Mini PC   1 otros
──────────────────────────────────────────────────────────────────────────────
(fila de cifras, sin tarjetas: número 28 px + etiqueta 13 px, separadas por espacio)

Requieren atención                                             Ver todos →
──────────────────────────────────────────────────────────────────────────────
 ⚠  LAPTOP-VENTAS02     Disco C: con 4% libre                  hace 2 h    ›
 ✕  PC-RECEPCION        Disco reporta estado "Advertencia"      hace 1 día  ›
 ⚠  LAPTOP-GERENCIA     Batería al 58% de su capacidad original hace 3 días ›

Registrados recientemente
──────────────────────────────────────────────────────────────────────────────
 ▭  PC-EJEMPLO     PC de escritorio · ASUS · Ryzen 7 5800XT  hace 9 min ›
```
(Los nombres de este esquema son ilustrativos del diseño; en la aplicación solo se listan equipos reales.)
- Estado vacío (0 equipos): texto breve + botón "Detectar el primer equipo" que lleva al asistente.
- "Requieren atención" usa las mismas reglas del módulo Diagnóstico.

### Pantalla 2 — Lista de equipos
```
Equipos                                                   [Detectar equipo]

[Buscar por nombre, usuario, serie…]  [Tipo ▾]  [Estado ▾]          12 equipos
──────────────────────────────────────────────────────────────────────────────
Equipo              Tipo           Modelo              Procesador     RAM    Estado     Último reporte
PC-EJEMPLO     Escritorio     ASUS (ensamblada)   Ryzen 7 5800XT 32 GB  Correcto   hace 9 min
ejemplo
```
- Tabla densa (PrimeReact DataTable), columnas numéricas alineadas a la derecha con unidad.
- Fila completa clicable → ficha. Enlace real (`<a>`) para abrir en pestaña nueva.
- Móvil: la tabla pasa a lista de dos líneas (nombre + tipo / modelo + estado).

### Pantalla 3 — Asistente de detección automática (`/detectar`)
Página completa (no modal), centrada, 640 px.
```
Detectar un equipo
Paso 2 de 3                                                    ───●───○

  ✓ 1  Descargar ScanGP
       ScanGP-Registrar-Equipo.exe · 48 KB · configurado para este servidor

  ● 2  Abrir el archivo en el equipo
       Doble clic. Se abrirá una ventana que muestra el avance.
       ▸ ¿Windows muestra "Windows protegió su PC"?        (expandible)

  ○ 3  Vincular
       Esperando que el equipo envíe sus datos…  (indicador discreto)

──────────────────────────────────────────────────────────────
▸ Registrar muchos equipos a la vez (área de TI)             (expandible)
```
- Paso 3 completado: muestra el equipo recibido (nombre, tipo, modelo) y botón "Ver equipo".
- Estados: archivo no disponible en servidor, API desconectada (el paso 3 lo indica y sigue reintentando), tiempo de espera largo (> 2 min: sugerencias de solución).

### Pantalla 4 — Ficha del equipo (Resumen)
Estructura tipo Speccy: navegación de componentes a la izquierda, contenido a la derecha.
```
Equipos / PC-EJEMPLO

▭  PC-EJEMPLO                                           ✓ Sin problemas
   PC de escritorio · ASUS (ensamblada) · Usuario ejemplo · Reportó hace 9 min
──────────────────────────────────────────────────────────────────────────────
Resumen           │  Lo esencial
                  │  Procesador        AMD Ryzen 7 5800XT · 8 núcleos / 16 hilos
COMPONENTES       │  Memoria           32 GB DDR4 · 2 de 4 ranuras ocupadas
Procesador        │  Almacenamiento    3.25 TB en 4 discos (2 NVMe, 1 SSD, 1 HDD)
Placa y BIOS      │  Gráficos          AMD Radeon RX 6650 XT · 8 GB
Memoria           │  Sistema           Windows 11 Pro 25H2 · 64 bits
Gráficos          │
Almacenamiento    │  Identificación                                    ▸ expandir
Monitores         │  Fabricante, modelo, n.º de serie, UUID, dominio, red
                  │
ANÁLISIS          │  Diagnóstico                      ✓ 5 correctos · 0 avisos
Compatibilidad    │  Recomendaciones                  1 sugerencia        ›
Recomendaciones   │
Diagnóstico       │
Historial         │
```
- La navegación lateral interna muestra solo los componentes con datos (ej. "Batería" no aparece en un escritorio).
- Móvil: la navegación interna pasa a un selector horizontal desplazable bajo la cabecera.

### Pantalla 5 — Módulo de componente (ejemplo: Memoria)
Patrón común para Procesador, Placa, Memoria, Gráficos, Almacenamiento, Batería y Monitores.
```
Memoria (RAM)

32 GB          2 de 4 ranuras       DDR4 · 3200 MHz
instalados     ocupadas             tipo y velocidad
─────────────────────────────────────────────────────
(cifras principales estilo NZXT CAM: número grande + texto pequeño)

Módulos instalados
Ranura    Capacidad   Tipo   Velocidad   Formato   Fabricante
DIMM_A2   16 GB       DDR4   3200 MHz    DIMM      Team Group
DIMM_B2   16 GB       DDR4   3200 MHz    DIMM      Team Group

▸ Detalles técnicos                     (cerrado por defecto)
  n.º de parte, n.º de serie, memoria utilizable por Windows, velocidad máxima del módulo
```
- Almacenamiento añade medidores lineales por volumen (pista gris + relleno acento; rojo solo > 90 %).
- Todo valor nulo se muestra con el componente `Unavailable` (sección 7).

### Pantalla 6 — Compatibilidad (estilo PCPartPicker)
```
Compatibilidad
Calculado a partir de los componentes detectados. No reemplaza la ficha técnica del fabricante.

Memoria
  ✓  Tipo compatible            DDR4 en formato DIMM (escritorio)
  ✓  Ranuras libres             2 de 4 disponibles
  –  Capacidad máxima           No disponible: el detector no reporta el límite de la placa
Almacenamiento
  ✓  Interfaces presentes       NVMe y SATA detectadas en uso
  –  Ranuras M.2 libres         No disponible
Procesador
  ✓  Socket                     AM4 — solo procesadores del mismo socket
Sistema
  ✓  Arranque UEFI              Compatible con Windows 11 y arranque seguro
```
- Cada línea: estado (icono + texto), comprobación, explicación. "–" = no se puede determinar con los datos actuales, nunca se supone.

### Pantalla 7 — Recomendaciones de actualización
```
Recomendaciones                                              1 sugerencia

  Prioridad media
  Reemplazar el disco duro HDD por un SSD
  El disco "TOSHIBA MQ04ABF100" es mecánico (HDD). Un SSD reduce los tiempos de carga.
  Basado en: Almacenamiento › tipo de disco
```
- Sin recomendaciones: "No hay recomendaciones para este equipo" + qué se revisó.

### Pantalla 8 — Diagnóstico de hardware
```
Diagnóstico                                     Último análisis: hace 9 min

  ✓  Estado de los discos           4 discos con estado "Correcto"
  ✓  Espacio libre                  Todos los volúmenes por encima del 10 %
  –  Batería                        No aplica: equipo sin batería
  ✓  Antivirus                      Windows Defender activo y actualizado
  ✓  Tiempo encendido               Reiniciado hace 9 h
  ✓  Lectura del detector           Todas las secciones se leyeron correctamente
```
- Fuente: datos del último reporte. No hay pruebas activas (estrés, benchmark) y la página lo aclara.

### Pantalla 9 — Historial de análisis
```
Historial                       Primer registro 27 nov 2026 · 3 reportes

27 nov 2026, 01:25   Memoria: 16 GB → 32 GB
26 nov 2026, 18:02   Usuario: usuario1 → usuario2
─────────────────────────────────────────────
Primer registro      27 nov 2026, 01:09
```
- Limitación actual de la API: guarda el último inventario completo y la lista de cambios, no una instantánea por análisis. Ver sección 10.

---

## 6. Componentes

Componentes de presentación propios en `src/components/ui/`. Cada uno con una sola responsabilidad.

| Componente | Responsabilidad |
|---|---|
| `PageHeader` | título, subtítulo, acciones de página, migas |
| `Section` | título de sección + divisor + contenido; opcional `collapsible` |
| `Disclosure` | bloque expandible accesible (`button[aria-expanded]` + región) |
| `KeyValueList` | lista etiqueta/valor alineada en dos columnas (una en móvil) |
| `StatFigure` | cifra principal + unidad + etiqueta (estilo NZXT CAM) |
| `StatusLine` | fila de comprobación: icono de estado + título + explicación |
| `StatusBadge` | insignia de estado (correcto/advertencia/problema/no aplica) con icono y texto |
| `Meter` | medidor lineal accesible (`role="meter"`, valor y máximo) |
| `SpecTable` | envoltorio de DataTable con estilo técnico, alineación numérica y vacío propio |
| `Unavailable` | valor ausente con motivo (`no-detectado`, `requiere-admin`, `no-soportado`, `no-aplica`) |
| `EmptyState` / `ErrorState` / `LoadingState` | estados de página y sección |
| `ConnectionBanner` | aviso fijo de desconexión de la API |
| `Icon` | envoltorio de Lucide con tamaño (16/20) y grosor (1.75) uniformes |
| `DeviceTypeIcon` | icono Lucide según tipo de equipo |

Iconografía Lucide (tamaño 16 px en texto, 20 px en navegación, `strokeWidth` 1.75):
`laptop` Laptop · `monitor` Escritorio · `monitor-smartphone` All-in-One · `box` Mini PC · `server` Servidor/estación · `tablet` Tablet · `cloud` Virtual · `cpu` Procesador · `circuit-board` Placa · `memory-stick` Memoria · `gpu` / `monitor-cog` Gráficos · `hard-drive` Almacenamiento · `battery` Batería · `monitor` Monitores · `puzzle` Compatibilidad · `trending-up` Recomendaciones · `stethoscope` Diagnóstico · `history` Historial · `scan-search` Detectar · `check-circle-2` / `alert-triangle` / `x-circle` / `minus-circle` estados.

---

## 7. Estados

| Estado | Comportamiento |
|---|---|
| Carga inicial | esqueleto con la forma final (filas de tabla, líneas de `KeyValueList`), sin spinners de página completa. Aparece tras 150 ms para no parpadear |
| Recarga en segundo plano | sin indicador intrusivo; el pie de la barra lateral muestra "Actualizado hace X s" |
| Error de una sección | `ErrorState` dentro de la sección con mensaje claro y botón "Reintentar"; el resto de la página sigue funcionando |
| Desconexión de la API | `ConnectionBanner` fijo: "Sin conexión con el servidor. Se muestran los últimos datos recibidos (hace 3 min). Reintentando…". Los datos ya cargados se mantienen visibles |
| Equipo no encontrado | página `EmptyState` con enlace a la lista |
| Dato no disponible | `Unavailable` con motivo: **No detectado** (el detector no pudo leerlo), **Requiere administrador** (ej. salud de batería), **No soportado por esta versión del detector**, **No aplica** (ej. batería en escritorio) |
| Lista vacía | mensaje + acción principal (ej. "Detectar el primer equipo") |

---

## 8. Lógica de negocio en el frontend (sin cambios en la API)

Reglas puras y testeables en `src/features/<modulo>/rules.ts`, a partir del inventario real:

| Regla | Condición (datos reales) | Resultado |
|---|---|---|
| Disco con problema | `discos[].salud` ≠ "Correcto" | Diagnóstico: problema |
| Poco espacio | volumen con libre < 10 % | Diagnóstico: advertencia · Recomendación: liberar espacio |
| Disco mecánico | disco interno con `tipo` = HDD | Recomendación: SSD |
| Poca memoria | `memoria.instaladaBytes` < 8 GB | Recomendación: ampliar RAM (si hay ranuras libres, se indica) |
| Batería desgastada | `bateria.saludPorcentaje` < 70 | Diagnóstico: advertencia · Recomendación: reemplazo |
| Antivirus | ningún antivirus activo o desactualizado | Diagnóstico: problema |
| Encendido prolongado | último arranque > 14 días | Diagnóstico: advertencia |
| Lecturas fallidas | `advertencias` no vacío | Diagnóstico: aviso con las secciones afectadas |
| Mini PC | `chasisCodigos` contiene 35 o 36 | tipo mostrado "Mini PC" |

Umbrales centralizados en `src/features/diagnostico/umbrales.ts`.

---

## 9. Arquitectura del frontend

```
src/
  app/            App.tsx, router.tsx, AppLayout.tsx
  design/         tokens.css, base.css, primereact.css
  components/
    ui/           componentes de presentación (sección 6), un archivo por componente
    layout/       Sidebar, MobileNav, Breadcrumbs, ConnectionBanner
  features/
    inicio/       InicioPage, AtencionList, RecientesList
    equipos/      EquiposPage, EquiposTable, filtros
    equipo/       EquipoLayout, EquipoHeader, EquipoNav, ResumenPage
    componentes/  ProcesadorPage, PlacaPage, MemoriaPage, GraficosPage,
                  AlmacenamientoPage, BateriaPage, MonitoresPage
    compatibilidad/  CompatibilidadPage, rules.ts
    recomendaciones/ RecomendacionesPage, rules.ts
    diagnostico/     DiagnosticoPage, rules.ts, umbrales.ts
    historial/       HistorialPage
    detectar/        DetectarPage, pasos
  services/       http.ts (cliente fetch + errores), equipos.service.ts, scangp.service.ts
  hooks/          usePolling, useApiStatus, useEquipos, useEquipo
  types/          api.ts (contratos tal como los devuelve la API), dominio.ts
  lib/            formato.ts (bytes, fechas), tipoEquipo.ts
```
Reglas:
- Las páginas componen; los componentes `ui/` no conocen la API.
- Los servicios son la única capa que llama a `fetch`.
- Los hooks encapsulan polling y estado de conexión; un solo `usePolling` compartido.
- Reglas de negocio en funciones puras, sin React.
- Archivos de menos de ~200 líneas; si crecen, se dividen.

---

## 10. Accesibilidad

- WCAG 2.2 nivel AA.
- `lang="es"`; títulos de página con jerarquía real (`h1` único por página, `h2` por sección).
- Foco visible: contorno de 2 px `--color-accent` con separación de 2 px; nunca `outline: none` sin reemplazo.
- Navegación completa con teclado; enlace "Saltar al contenido".
- Objetivos táctiles de al menos 32 × 32 px (24 px es el mínimo AA).
- Botones de solo icono con `aria-label`; iconos decorativos con `aria-hidden`.
- Tablas con `<th scope>` y título accesible; números alineados a la derecha con unidad.
- Estados y avisos dinámicos (conexión, equipo detectado) anunciados con `aria-live="polite"`.
- `prefers-reduced-motion` respetado.

---

## 11. Decisiones pendientes

1. **Estación de trabajo** (resuelto): se estima en el frontend por procesador Xeon/Threadripper/EPYC o GPU profesional y siempre se muestra como "estimado" (`lib/tipoEquipo.ts`). Mini PC se muestra como formato de chasis en la ficha.
2. **Historial completo de análisis**: guardar una instantánea por reporte requiere un cambio en la API, que queda fuera de este rediseño.
3. **Capacidad máxima de RAM y ranuras M.2**: el detector puede leer `Win32_PhysicalMemoryArray.MaxCapacity`; requiere actualizar ScanGP.exe (el contrato de la API acepta campos adicionales sin cambios).
4. **Nuevas dependencias** (resuelto): `react-router-dom` y `lucide-react` instaladas; `primeicons` eliminada.
5. **Diagnóstico en listas**: la lista de la API no trae el inventario; `useDetalles` pide el detalle de cada equipo solo cuando cambia su último reporte. Adecuado hasta unos cientos de equipos; para más, conviene que la API devuelva el estado calculado.
