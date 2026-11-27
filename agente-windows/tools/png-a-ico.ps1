# Convierte un PNG (logo) en un .ico con varios tamaños para el ejecutable.
# Uso: powershell -ExecutionPolicy Bypass -File png-a-ico.ps1 -Origen logo.png -Destino logo.ico
#
# Formato: los tamaños < 256 px se guardan como mapa de bits clásico (BMP/DIB de 32 bits) y solo el de
# 256 px en PNG. Algunas funciones de Windows (y programas como Chrome en su lista de descargas)
# no leen iconos pequeños en PNG y muestran el icono genérico.
param(
    [Parameter(Mandatory = $true)][string]$Origen,
    [Parameter(Mandatory = $true)][string]$Destino
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class IcoBuilder
{
    static Bitmap Escalar(Image fuente, int t)
    {
        Bitmap bmp = new Bitmap(t, t, PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(bmp))
        {
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.Clear(Color.Transparent);
            double escala = Math.Min((double)t / fuente.Width, (double)t / fuente.Height);
            int w = (int)Math.Round(fuente.Width * escala), h = (int)Math.Round(fuente.Height * escala);
            g.DrawImage(fuente, (t - w) / 2, (t - h) / 2, w, h);
        }
        return bmp;
    }

    /// <summary>Entrada DIB: BITMAPINFOHEADER + píxeles BGRA de abajo hacia arriba + máscara AND.</summary>
    static byte[] ComoDib(Bitmap bmp)
    {
        int t = bmp.Width;
        int filaMascara = ((t + 31) / 32) * 4;
        using (MemoryStream ms = new MemoryStream())
        using (BinaryWriter w = new BinaryWriter(ms))
        {
            w.Write(40); w.Write(t); w.Write(t * 2);           // tamaño, ancho, alto (imagen + máscara)
            w.Write((short)1); w.Write((short)32);             // planos, bits por píxel
            w.Write(0); w.Write(t * t * 4 + filaMascara * t);  // sin compresión, tamaño de datos
            w.Write(0); w.Write(0); w.Write(0); w.Write(0);
            for (int y = t - 1; y >= 0; y--)
                for (int x = 0; x < t; x++)
                {
                    Color c = bmp.GetPixel(x, y);
                    w.Write(c.B); w.Write(c.G); w.Write(c.R); w.Write(c.A);
                }
            for (int y = t - 1; y >= 0; y--)
            {
                byte[] fila = new byte[filaMascara];
                for (int x = 0; x < t; x++)
                    if (bmp.GetPixel(x, y).A == 0) fila[x / 8] |= (byte)(0x80 >> (x % 8));
                w.Write(fila);
            }
            w.Flush();
            return ms.ToArray();
        }
    }

    static byte[] ComoPng(Bitmap bmp)
    {
        using (MemoryStream ms = new MemoryStream()) { bmp.Save(ms, ImageFormat.Png); return ms.ToArray(); }
    }

    public static void Crear(string origen, string destino, int[] tamanos)
    {
        List<KeyValuePair<int, byte[]>> entradas = new List<KeyValuePair<int, byte[]>>();
        using (Image fuente = Image.FromFile(origen))
        {
            foreach (int t in tamanos)
                using (Bitmap bmp = Escalar(fuente, t))
                    entradas.Add(new KeyValuePair<int, byte[]>(t, t >= 256 ? ComoPng(bmp) : ComoDib(bmp)));
        }
        using (FileStream fs = File.Create(destino))
        using (BinaryWriter w = new BinaryWriter(fs))
        {
            w.Write((short)0); w.Write((short)1); w.Write((short)entradas.Count);
            int offset = 6 + 16 * entradas.Count;
            foreach (KeyValuePair<int, byte[]> e in entradas)
            {
                byte lado = (byte)(e.Key >= 256 ? 0 : e.Key);
                w.Write(lado); w.Write(lado); w.Write((byte)0); w.Write((byte)0);
                w.Write((short)1); w.Write((short)32);
                w.Write(e.Value.Length); w.Write(offset);
                offset += e.Value.Length;
            }
            foreach (KeyValuePair<int, byte[]> e in entradas) w.Write(e.Value);
        }
    }
}
'@
[IcoBuilder]::Crear((Resolve-Path $Origen).Path, $Destino, [int[]](16, 20, 24, 32, 40, 48, 64, 128, 256))
Write-Host "Icono generado: $Destino"
