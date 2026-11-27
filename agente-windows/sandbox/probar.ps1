# Se ejecuta DENTRO de Windows Sandbox (Windows limpio, sin Node ni SDK).
# Copia ScanGP, lo ejecuta contra la API del equipo anfitrión y muestra el resultado.
$ErrorActionPreference = 'Continue'
$origen = 'C:\Users\WDAGUtilityAccount\Desktop\agente-windows\dist'
$destino = 'C:\ScanGP'

# El anfitrión es la puerta de enlace de la red del Sandbox.
$anfitrion = (Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -First 1).NextHop
$url = "http://${anfitrion}:3000/api/inventario"

New-Item -ItemType Directory -Force $destino | Out-Null
Copy-Item "$origen\ScanGP.exe", "$origen\agente.ini" $destino -Force

# Se abre con su ventana, como lo haría un usuario; se cierra sola al terminar.
$p = Start-Process "$destino\ScanGP.exe" -ArgumentList '--url', $url -Wait -PassThru

$resultado = switch ($p.ExitCode) {
    0 { "OK: inventario enviado a $url. Revisa la web: aparecerá como equipo nuevo." }
    1 { "NO se pudo enviar a $url. ¿Está corriendo la API? ¿El firewall permite Node.js?" }
    default { "Error inesperado (código $($p.ExitCode))." }
}

$reporte = "$destino\RESULTADO.txt"
@(
    "=== Prueba de ScanGP en Windows limpio ==="
    "Equipo sandbox: $env:COMPUTERNAME"
    "Nada instalado: Node = $([bool](Get-Command node -ErrorAction SilentlyContinue)), dotnet SDK = $([bool](Get-Command dotnet -ErrorAction SilentlyContinue))"
    ""
    $resultado
    ""
    "--- scangp.log ---"
    (Get-Content 'C:\ProgramData\ScanGP\scangp.log' -ErrorAction SilentlyContinue)
) | Set-Content $reporte -Encoding UTF8

notepad $reporte
