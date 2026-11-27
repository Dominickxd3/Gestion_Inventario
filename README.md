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

Requisitos: Node.js 20+ y Windows 10/11 (para compilar ScanGP no hace falta nada más).

```powershell
cd agente-windows; powershell -ExecutionPolicy Bypass -File .\build.ps1
```
```powershell
cd api-nest; copy .env.example .env; npm install; npm run start:dev
```
```powershell
cd web-react; npm install; npm run dev      # http://localhost:5173
```

En `api-nest/.env` cambia `API_KEY` por una clave propia.

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

| Método | Ruta | Uso |
|---|---|---|
| POST | `/api/inventario` | ScanGP (cabecera `X-Api-Key`) |
| GET | `/api/equipos` | Lista resumida |
| GET | `/api/equipos/:id` | Inventario completo + historial |
| DELETE | `/api/equipos/:id` | Dar de baja |
| GET | `/api/estadisticas` | Totales por tipo, fabricante y SO |
| GET | `/api/scangp/info` | Disponibilidad del detector y URL del servidor |
| GET | `/api/scangp/descargar` | ScanGP.exe preconfigurado |

## Pendiente para producción
- Reemplazar `equipos.repository.ts` (archivo JSON) por TypeORM/Prisma con PostgreSQL o MySQL.
- Proteger los endpoints de lectura y la descarga con el login de la web (la descarga incluye la API key).
- Firmar `ScanGP.exe` con un certificado de firma de código (evita el aviso de SmartScreen).
- Servir la API por HTTPS.
