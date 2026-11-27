# Convierte un PNG (logo) en un .ico con varios tamaños para el ejecutable.
# Uso: powershell -ExecutionPolicy Bypass -File png-a-ico.ps1 -Origen logo.png -Destino logo.ico
param(
    [Parameter(Mandatory = $true)][string]$Origen,
    [Parameter(Mandatory = $true)][string]$Destino
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$tamanos = 16, 20, 24, 32, 40, 48, 64, 128, 256
$fuente = [System.Drawing.Image]::FromFile((Resolve-Path $Origen))
$imagenes = @()
try {
    foreach ($t in $tamanos) {
        $bmp = New-Object System.Drawing.Bitmap $t, $t, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)
        # Mantiene la proporción y centra el logo.
        $escala = [Math]::Min($t / $fuente.Width, $t / $fuente.Height)
        $w = [int][Math]::Round($fuente.Width * $escala); $h = [int][Math]::Round($fuente.Height * $escala)
        $g.DrawImage($fuente, [int](($t - $w) / 2), [int](($t - $h) / 2), $w, $h)
        $g.Dispose()
        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        $imagenes += , @($t, $ms.ToArray())
    }
}
finally { $fuente.Dispose() }

# Formato ICO: cabecera + directorio + imágenes PNG (válido desde Windows Vista).
$salida = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $salida
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$imagenes.Count)
$offset = 6 + 16 * $imagenes.Count
foreach ($img in $imagenes) {
    $t = $img[0]; $datos = $img[1]
    $lado = if ($t -ge 256) { 0 } else { $t }
    $bw.Write([byte]$lado); $bw.Write([byte]$lado); $bw.Write([byte]0); $bw.Write([byte]0)
    $bw.Write([UInt16]1); $bw.Write([UInt16]32)
    $bw.Write([UInt32]$datos.Length); $bw.Write([UInt32]$offset)
    $offset += $datos.Length
}
foreach ($img in $imagenes) { $bw.Write([byte[]]$img[1]) }
$bw.Flush()
[System.IO.File]::WriteAllBytes($Destino, $salida.ToArray())
Write-Host "Icono generado: $Destino"
