import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { Actor } from '../common/dominio';
import { uuid7 } from '../common/uuid7';
import { EntidadTrazable, Movimiento } from './movimiento.entity';

export interface NuevoMovimiento {
  entidad: EntidadTrazable;
  entidadId: string;
  tipo: string;
  descripcion: string;
  motivo?: string | null;
  observacion?: string | null;
  detalle?: Record<string, unknown> | null;
  referencia?: { tipo: string; id: string } | null;
}

/** Historial inmutable de activos y componentes. Siempre se escribe dentro de la transacción de la operación. */
@Injectable()
export class TrazabilidadService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async registrar(em: EntityManager, actor: Actor | null, m: NuevoMovimiento, fecha = new Date()) {
    await em.insert(Movimiento, {
      id: uuid7(),
      entidad: m.entidad,
      entidadId: m.entidadId,
      tipo: m.tipo,
      descripcion: m.descripcion.slice(0, 500),
      motivo: m.motivo ?? null,
      observacion: m.observacion?.slice(0, 1000) ?? null,
      detalle: m.detalle ?? null,
      referenciaTipo: m.referencia?.tipo ?? null,
      referenciaId: m.referencia?.id ?? null,
      fecha,
      creadoPor: actor?.id ?? null,
      usuarioNombre: actor?.nombreUsuario ?? 'ScanGP',
    });
  }

  historial(entidad: EntidadTrazable, entidadId: string) {
    return this.db.getRepository(Movimiento).find({ where: { entidad, entidadId }, order: { fecha: 'DESC', id: 'DESC' } });
  }

  recientes(limite = 20) {
    return this.db.getRepository(Movimiento).find({ order: { fecha: 'DESC', id: 'DESC' }, take: limite });
  }
}
