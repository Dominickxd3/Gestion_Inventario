# ScanGP — Inventario, diagnóstico y compatibilidad de equipos

```
[ScanGP.exe]  --POST JSON + X-Api-Key-->  [API NestJS :3000]  <--  [Web React :5173]
 (cada PC, se abre,                         /api/inventario         inventario, ficha por
  escanea y se cierra)                      /api/scangp/descargar   componente, diagnóstico
```

| Carpeta | Qué es |
|---|---|
| `agente-windows/` | **ScanGP.exe**, detector en C# (.NET Framework 4.8, incluido en Windows 10/11). No se instala: se abre, escanea, envía y se cierra solo. |
| `api-nest/` | API NestJS 11. Recibe el inventario, identifica el equipo (UUID → serie → MAC), guarda historial de cambios y entrega ScanGP.exe preconfigurado. |
| `web-react/` | Plataforma web: React 18 + TypeScript + PrimeReact + React Router + Lucide. Sistema de diseño en [`web-react/DESIGN.md`](web-react/DESIGN.md). |

## Puesta en marcha (desarrollo)

Requisitos: Node.js 22+, Windows 10/11 y SQL Server 2019+ (Express sirve) con **autenticación mixta** (SQL Server y Windows).
Arquitectura y plan por fases: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

**1. Detector**
```powershell
cd agente-windows; powershell -ExecutionPolicy Bypass -File .\build.ps1
```

**2. Base de datos** (una vez por servidor, con una cuenta sysadmin). Crea la base `ScanGP` (intercalación `Modern_Spanish_CI_AI`), el esquema `itam` y dos inicios de sesión: `scangp_migraciones` (dueño del esquema) y `scangp_app` (el de la API, sin permiso para modificar ni borrar la auditoría).
```powershell
cd api-nest; copy .env.example .env
```
Completa en `api-nest/.env`: `API_KEY`, `JWT_SECRET` (≥ 32 caracteres aleatorios) y las contraseñas `DB_APP_PASSWORD` / `DB_MIGRATIONS_PASSWORD`. Luego:
```powershell
sqlcmd -S .\SQLEXPRESS -E -C -i db\setup.sql -v DB_NAME="ScanGP" MIGRATIONS_PASSWORD="<la de .env>" APP_PASSWORD="<la de .env>"
```
```powershell
npm install; npm run db:migrate
```

**3. Primer administrador** (muestra una contraseña temporal una sola vez; se cambia al entrar)
```powershell
npm run admin:crear -- admin "Nombre Apellido"
```

**4. API y web**
```powershell
npm run start:dev      # en api-nest, http://localhost:3000/api
```
```powershell
cd web-react; npm install; npm run dev      # http://localhost:5173
```

**Datos de la versión anterior** (`data/equipos.json`): `npm run importar:json` simula e informa; `npm run importar:json -- --aplicar` los pasa a SQL Server. Se puede repetir sin duplicar y no modifica el archivo.

**Pruebas** (en `api-nest`):
- `npm test`: unitarias.
- `npm run test:e2e`: API completa contra una base **aparte**, `ScanGP_Pruebas`, que se vacía y migra en cada ejecución. Créala una vez con `db/setup.sql` y `DB_NAME="ScanGP_Pruebas"`.
- `npm run db:check`: falla si las entidades no coinciden con la base.

### Trazabilidad
- **Detectado ≠ validado.** ScanGP alimenta *Equipos detectados*; TI registra cada uno como **activo** (código patrimonial `TI-000001`). Desde ahí, los cambios que detecta ScanGP aparecen como **discrepancias** (componente nuevo, de otro equipo o ausente; serie distinta; otra persona usando el equipo) y solo cambian el inventario si TI las acepta.
- **Componentes con identidad** (`C-000001`): se instalan, retiran (a almacén, mantenimiento o baja, con motivo), reemplazan y reingresan. Cada instalación queda con fecha de inicio y fin, y ScanGP la **confirma** cuando ve la pieza en el equipo.
- **Estados separados**: ciclo de vida, estado técnico, asignación, ubicación y sincronización con ScanGP.
- **Asignaciones**: permanente, préstamo con fecha o reemplazo temporal durante un mantenimiento; transferencias sin pasar por el almacén.
- **Historia inmutable**: el usuario de la API no puede modificar ni borrar movimientos, escaneos, kardex ni auditoría, y no puede borrar activos, componentes, asignaciones ni instalaciones (se dan de baja o se cierran).
- **Vínculo automático**: si se graba el código patrimonial como etiqueta de activo (Asset Tag) en la BIOS, ScanGP vincula el equipo solo.

### Usuarios y roles
| Rol | Puede |
|---|---|
| Administrador | todo, incluidos usuarios, auditoría y dar de baja equipos |
| Técnico | consultar el inventario y descargar ScanGP |
| Consulta | solo consultar |

Las contraseñas se guardan con scrypt. Cinco intentos fallidos bloquean el usuario 15 minutos. Cambiar o restablecer una contraseña, o desactivar al usuario, cierra sus sesiones abiertas.

## Cómo se registra un equipo

1. En la web: **Detectar equipo** → **Descargar ScanGP**. La API agrega al `.exe` la URL del servidor y la clave, así que no hay nada que configurar.
2. En el equipo: doble clic en **ScanGP.exe**. Si el usuario es administrador, Windows pide permiso (con él ScanGP también lee la salud de la batería); si no, se ejecuta igual.
3. La ventana muestra el avance, envía los datos y **se cierra automáticamente**. La web detecta el equipo en vivo.

### Despliegue masivo (área de TI)
`ScanGP.exe --silencioso` no muestra ventana. Usarlo en GPO (scripts de inicio), Intune, PDQ o una tarea programada. Los comandos están en la web, en Detectar equipo → *Registrar muchos equipos a la vez*.

### Parámetros de ScanGP
| Parámetro | Efecto |
|---|---|
| *(ninguno)* | Ventana con progreso; se cierra sola al terminar |
| `--silencioso` | Sin ventana |
| `--url <url>` / `--apikey <clave>` | Sobrescriben la configuración |
| `--solo-local --salida inv.json` | No envía; guarda el JSON para revisión |

Log: `C:\ProgramData\ScanGP\scangp.log`. Códigos de salida: 0 enviado · 1 no enviado · 2 error.

### Logo / icono
Guarda el logo en `agente-windows/assets/scangp.png` y vuelve a ejecutar `build.ps1`: se convierte en el icono del `.exe` y en el logo de la ventana.

### Probar en un Windows limpio
`agente-windows/sandbox/Probar-Agente.wsb` abre Windows Sandbox (Windows 11 Pro; activar "Espacio aislado de Windows") y ejecuta ScanGP contra la API del equipo anfitrión. Ajusta la ruta `HostFolder` del `.wsb` a tu carpeta.

## API

Todas las rutas requieren sesión (`Authorization: Bearer <token>`) salvo `POST /api/inventario` (API key) y el login.

| Método | Ruta | Uso | Rol |
|---|---|---|---|
| POST | `/api/inventario` | ScanGP (cabecera `X-Api-Key`). **Contrato sin cambios** | — |
| POST | `/api/auth/login` | Iniciar sesión → `{ token, usuario }` | — |
| GET | `/api/auth/yo` | Usuario de la sesión | todos |
| POST | `/api/auth/cambiar-password` | Cambiar la contraseña propia → token nuevo | todos |
| GET | `/api/equipos` | Lista resumida | todos |
| GET | `/api/equipos/:id` | Inventario completo + historial | todos |
| POST | `/api/equipos/:id/archivar` | Ocultar de la lista (conserva escaneos) | ADMIN |
| GET | `/api/equipos/:id/sugerencia-activo` · POST `/api/equipos/alta-activo` | Registrar lo detectado como activo | ADMIN, TECNICO |
| GET | `/api/estadisticas` | Totales por tipo, fabricante y SO | todos |
| GET | `/api/scangp/info` | Disponibilidad del detector y URL del servidor | todos |
| GET | `/api/scangp/descargar` | ScanGP.exe preconfigurado | ADMIN, TECNICO |
| GET/POST | `/api/usuarios` | Listar / crear usuarios | ADMIN |
| PATCH | `/api/usuarios/:id` | Editar nombre, correo, rol, activo | ADMIN |
| POST | `/api/usuarios/:id/restablecer-password` | Contraseña temporal nueva | ADMIN |
| GET | `/api/auditoria` | Registro de operaciones (filtros y paginación) | ADMIN |
| GET/POST/PATCH | `/api/activos` · `/:id` · `/:id/historial` · `/:id/componentes` | Activos | lectura: todos · escritura: ADMIN, TECNICO |
| POST | `/api/activos/:id/{estado-tecnico,ciclo,ubicacion,vincular,desvincular,reemplazar-componente}` | Operaciones del activo | ADMIN, TECNICO |
| POST | `/api/activos/:id/baja` | Baja definitiva | ADMIN |
| GET/POST/PATCH | `/api/componentes` · `/:id/{instalar,retirar,reingresar,baja}` | Componentes | ADMIN, TECNICO |
| GET/POST | `/api/asignaciones` · `/:id/{devolver,transferir}` | Asignaciones | ADMIN, TECNICO |
| GET/POST/PATCH | `/api/mantenimiento` · `/:id/{cerrar,cancelar}` | Órdenes de mantenimiento | ADMIN, TECNICO |
| GET/POST | `/api/discrepancias` · `/:id/{aceptar,rechazar}` | Bandeja de discrepancias | ADMIN, TECNICO |
| GET/POST/PATCH | `/api/catalogo/*` · `/api/organizacion/*` · `/api/almacen/*` · `/api/garantias` · `/api/documentos` | Maestros, almacén, garantías y adjuntos | ADMIN, TECNICO (config: ADMIN) |
| GET | `/api/panel` | Cifras y pendientes del inicio | todos |

## Pendiente para producción
- Pulir el diseño de las pantallas nuevas (funcionales, con el sistema de diseño v1).
- Firmar `ScanGP.exe` con un certificado de firma de código (evita el aviso de SmartScreen).
- Servir la API por HTTPS.
