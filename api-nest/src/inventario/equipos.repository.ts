import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { EquipoRegistrado } from './inventario.types';

/**
 * Almacenamiento de la DEMO en un archivo JSON.
 * Para producción se reemplaza esta clase por una con TypeORM/Prisma (PostgreSQL, MySQL o SQL Server)
 * manteniendo los mismos métodos; el servicio y el controlador no cambian.
 */
@Injectable()
export class EquiposRepository implements OnModuleInit {
  private readonly logger = new Logger(EquiposRepository.name);
  private readonly equipos = new Map<string, EquipoRegistrado>();
  private readonly archivo: string;
  private escritura: Promise<void> = Promise.resolve();

  constructor(config: ConfigService) {
    this.archivo = path.resolve(config.get<string>('DATA_FILE') ?? 'data/equipos.json');
  }

  async onModuleInit() {
    try {
      const lista: EquipoRegistrado[] = JSON.parse(await fs.readFile(this.archivo, 'utf8'));
      lista.forEach((e) => this.equipos.set(e.id, e));
      this.logger.log(`${lista.length} equipos cargados desde ${this.archivo}`);
    } catch {
      this.logger.log(`Sin datos previos, se creará ${this.archivo}`);
    }
  }

  obtener(id: string) {
    return this.equipos.get(id);
  }

  listar() {
    return [...this.equipos.values()];
  }

  async guardar(e: EquipoRegistrado) {
    this.equipos.set(e.id, e);
    await this.persistir();
  }

  async eliminar(id: string) {
    const ok = this.equipos.delete(id);
    if (ok) await this.persistir();
    return ok;
  }

  /** Escrituras en serie + archivo temporal para no corromper el JSON. */
  private persistir() {
    this.escritura = this.escritura.then(async () => {
      await fs.mkdir(path.dirname(this.archivo), { recursive: true });
      const tmp = `${this.archivo}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(this.listar(), null, 2), 'utf8');
      await fs.rename(tmp, this.archivo);
    });
    return this.escritura;
  }
}
