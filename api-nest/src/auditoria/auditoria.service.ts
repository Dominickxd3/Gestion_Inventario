import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { uuid7 } from '../common/uuid7';
import { RegistroAuditoria, ResultadoAuditoria } from './registro-auditoria.entity';

export interface Actor {
  id: string | null;
  nombreUsuario: string | null;
  ip: string | null;
}

export interface EntradaAuditoria {
  actor: Actor;
  accion: string;
  entidad?: string | null;
  entidadId?: string | null;
  resultado?: ResultadoAuditoria;
  antes?: unknown;
  despues?: unknown;
  detalle?: string | null;
}

/** Campos que nunca se guardan en la auditoría. */
const SENSIBLES = /password|hash|token|apikey|api_key|secret/i;

export function sinSensibles(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sinSensibles);
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, SENSIBLES.test(k) ? '[omitido]' : sinSensibles(x)]),
    );
  }
  return v;
}

@Injectable()
export class AuditoriaService {
  constructor(@InjectRepository(RegistroAuditoria) private readonly repo: Repository<RegistroAuditoria>) {}

  /**
   * Registra una operación. Si se pasa `em`, se escribe en la misma transacción que la operación:
   * si la operación falla, tampoco queda el registro, y viceversa.
   */
  async registrar(e: EntradaAuditoria, em?: EntityManager): Promise<void> {
    const repo = em ? em.getRepository(RegistroAuditoria) : this.repo;
    // insert() no ejecuta @BeforeInsert: id y fecha se asignan aquí. Nunca se usa save() (evita UPDATE).
    await repo.insert(
      repo.create({
        id: uuid7(),
        fecha: new Date(),
        usuarioId: e.actor.id,
        usuarioNombre: e.actor.nombreUsuario,
        ip: e.actor.ip,
        accion: e.accion,
        entidad: e.entidad ?? null,
        entidadId: e.entidadId ?? null,
        resultado: e.resultado ?? 'OK',
        antes: e.antes == null ? null : (sinSensibles(e.antes) as object),
        despues: e.despues == null ? null : (sinSensibles(e.despues) as object),
        detalle: e.detalle?.slice(0, 1000) ?? null,
      }),
    );
  }

  async listar(f: { pagina: number; porPagina: number; usuarioId?: string; entidad?: string; entidadId?: string; accion?: string }) {
    const q = this.repo.createQueryBuilder('a').orderBy('a.fecha', 'DESC').addOrderBy('a.id', 'DESC');
    if (f.usuarioId) q.andWhere('a.usuarioId = :usuarioId', { usuarioId: f.usuarioId });
    if (f.entidad) q.andWhere('a.entidad = :entidad', { entidad: f.entidad });
    if (f.entidadId) q.andWhere('a.entidadId = :entidadId', { entidadId: f.entidadId });
    if (f.accion) q.andWhere('a.accion LIKE :accion', { accion: `${f.accion.replace(/[%_[]/g, '[$&]')}%` });
    const [items, total] = await q.skip((f.pagina - 1) * f.porPagina).take(f.porPagina).getManyAndCount();
    return { items, total, pagina: f.pagina, porPagina: f.porPagina };
  }
}
