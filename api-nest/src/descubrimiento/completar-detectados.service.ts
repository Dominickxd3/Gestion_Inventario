import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DispositivoDetectado } from './descubrimiento.entities';
import { resumir } from './ingesta.service';
import type { InventarioPayload } from './inventario.types';
import { registroAutomaticoActivo, RegistroAutomaticoService } from './registro-automatico.service';

/** Completa inventarios anteriores sin simular escaneos ni trasladar piezas con datos históricos. */
@Injectable()
export class CompletarDetectadosService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CompletarDetectadosService.name);
  constructor(@InjectDataSource() private readonly db: DataSource, private readonly automatico: RegistroAutomaticoService) {}

  async onApplicationBootstrap() {
    if (!registroAutomaticoActivo()) return;
    const equipos = await this.db.getRepository(DispositivoDetectado).find({ where: { archivado: false } });
    for (const equipo of equipos) {
      try {
        await this.db.transaction(async (em) => {
          await em.query(`DECLARE @r int; EXEC @r = sys.sp_getapplock @Resource = 'ScanGP:registro-automatico', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000; IF @r < 0 THROW 51000, 'No se pudo bloquear el registro automático', 1;`);
          const d = await em.findOneByOrFail(DispositivoDetectado, { id: equipo.id });
          if (d.archivado || !d.ultimoInventario) return;
          const p = d.ultimoInventario as InventarioPayload;
          await this.automatico.sincronizar(em, d, p, resumir(p), true);
        });
      } catch (e) {
        this.logger.error('No se pudo completar ' + equipo.nombreEquipo + ': ' + (e as Error).message);
      }
    }
  }
}
