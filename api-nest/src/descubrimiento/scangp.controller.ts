import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { existsSync, promises as fs, statSync } from 'fs';
import { networkInterfaces } from 'os';
import * as path from 'path';
import { Roles } from '../identidad/decoradores';

const NOMBRE_DESCARGA = 'ScanGP.exe';

/**
 * Entrega ScanGP.exe ya configurado: se le agrega al final un bloque con la URL del servidor
 * y la clave, así el usuario solo hace doble clic.
 * Requiere sesión: la descarga contiene la API key, por eso solo ADMIN y TECNICO pueden descargarlo.
 */
@Controller('scangp')
export class ScanGpController {
  constructor(private readonly config: ConfigService) {}

  @Get('info')
  info() {
    const exe = this.rutaExe();
    const disponible = existsSync(exe);
    return {
      disponible,
      nombreArchivo: NOMBRE_DESCARGA,
      urlServidor: this.urlServidor(),
      tamanoBytes: disponible ? statSync(exe).size : null,
      actualizado: disponible ? statSync(exe).mtime.toISOString() : null,
    };
  }

  @Roles('ADMIN', 'TECNICO')
  @Get('descargar')
  async descargar(@Res() res: Response) {
    const exe = this.rutaExe();
    if (!existsSync(exe)) {
      throw new NotFoundException('ScanGP.exe no está compilado. Ejecuta agente-windows/build.ps1');
    }
    const plantilla = await fs.readFile(exe);
    const ini = [`url=${this.urlServidor()}`, `apikey=${this.config.get<string>('API_KEY') ?? ''}`, 'timeout=30'].join('\n');
    const bloque = Buffer.from(
      `\r\n##SCANGP-CONFIG##${Buffer.from(ini, 'utf8').toString('base64')}##SCANGP-FIN##\r\n`,
      'ascii',
    );
    const archivo = Buffer.concat([plantilla, bloque]);

    res.set({
      'Content-Type': 'application/vnd.microsoft.portable-executable',
      'Content-Disposition': `attachment; filename="${NOMBRE_DESCARGA}"`,
      'Content-Length': String(archivo.length),
      'Cache-Control': 'no-store',
    });
    res.send(archivo);
  }

  private rutaExe() {
    return path.resolve(this.config.get<string>('SCANGP_EXE') ?? '../agente-windows/dist/ScanGP.exe');
  }

  /** URL que usarán los equipos para enviar su inventario. */
  private urlServidor() {
    const configurada = this.config.get<string>('SCANGP_URL_SERVIDOR');
    if (configurada) return configurada;
    const puerto = this.config.get<string>('PORT') ?? '3000';
    return `http://${ipLocal()}:${puerto}/api/inventario`;
  }
}

/** IP de la red local de este servidor (prefiere 192.168.x / 10.x sobre adaptadores virtuales). */
function ipLocal(): string {
  const ips = Object.entries(networkInterfaces())
    .filter(([nombre]) => !/vethernet|virtual|vmware|vbox|hyper-v|wsl|docker|loopback/i.test(nombre))
    .flatMap(([, lista]) => lista ?? [])
    .filter((i) => i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.'))
    .map((i) => i.address);
  return (
    ips.find((ip) => ip.startsWith('192.168.')) ??
    ips.find((ip) => ip.startsWith('10.')) ??
    ips[0] ??
    'localhost'
  );
}
