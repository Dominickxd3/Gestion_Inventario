# Compila ScanGP con el compilador de C# incluido en Windows (.NET Framework 4.8).
# No necesita Visual Studio ni el SDK de .NET. Resultado: dist\ScanGP.exe
#
# Logo: si existe assets\scangp.png se convierte en el icono del .exe y se muestra en la ventana.
$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { throw "No se encontró csc.exe en $csc" }

$dist = Join-Path $raiz 'dist'
$obj = Join-Path $raiz 'obj'
New-Item -ItemType Directory -Force $dist, $obj | Out-Null

$fuentes = Get-ChildItem (Join-Path $raiz 'src') -Filter *.cs | ForEach-Object { $_.FullName }
$opciones = @('/nologo', '/target:winexe', '/platform:anycpu', '/optimize+', '/codepage:65001',
    "/out:$dist\ScanGP.exe",
    "/win32manifest:$raiz\app.manifest",
    '/r:System.Management.dll', '/r:System.Web.Extensions.dll', '/r:System.Windows.Forms.dll', '/r:System.Drawing.dll')

$logo = Join-Path $raiz 'assets\scangp.png'
if (Test-Path $logo) {
    $ico = Join-Path $obj 'scangp.ico'
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $raiz 'tools\png-a-ico.ps1') -Origen $logo -Destino $ico
    $opciones += "/win32icon:$ico"
    $opciones += "/resource:$logo,ScanGP.logo.png"
} else {
    Write-Warning "No se encontró assets\scangp.png: el ejecutable se compila sin logo."
}

# /target:winexe = sin consola. Con doble clic muestra su ventana; con --silencioso no muestra nada.
& $csc @opciones $fuentes
if ($LASTEXITCODE -ne 0) { throw "La compilación falló" }

# agente.ini solo sirve para pruebas locales: el .exe que se descarga desde la web ya trae su configuración.
Copy-Item (Join-Path $raiz 'agente.ini') $dist -Force
Remove-Item (Join-Path $dist 'AgenteInventario.exe'), (Join-Path $dist 'prueba.json') -ErrorAction SilentlyContinue
Write-Host "Listo: $dist\ScanGP.exe"
