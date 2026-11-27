import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, EntityTarget, FindOptionsWhere, ObjectLiteral } from 'typeorm';
import type { Actor } from '../auditoria/auditoria.service';

export type { Actor };

/** Ejecuta `fn` en la transacción recibida o en una nueva. Permite componer casos de uso en una sola transacción. */
export function enTransaccion<T>(db: DataSource, em: EntityManager | undefined, fn: (em: EntityManager) => Promise<T>): Promise<T> {
  return em ? fn(em) : db.transaction(fn);
}

/** Busca o lanza 404 con un mensaje legible. */
export async function obtenerOFallar<T extends ObjectLiteral>(
  em: EntityManager,
  entidad: EntityTarget<T>,
  where: FindOptionsWhere<T>,
  nombre: string,
  relaciones?: string[],
): Promise<T> {
  const r = await em.findOne(entidad, { where, relations: relaciones });
  if (!r) throw new NotFoundException(`${nombre} no encontrado`);
  return r;
}

export const regla = (cumple: boolean, mensaje: string) => {
  if (!cumple) throw new BadRequestException(mensaje);
};

export const conflicto = (mensaje: string) => new ConflictException(mensaje);

/** Siguiente código correlativo con el prefijo configurado (TI-000001, C-000001, OT-000001). */
export async function siguienteCodigo(em: EntityManager, tipo: 'activo' | 'componente' | 'orden'): Promise<string> {
  const [cfg] = await em.query(
    `SELECT prefijo_activo, prefijo_componente, prefijo_orden, digitos_codigo FROM [itam].[organizacion_config] WHERE id = 1`,
  );
  const [{ n }] = await em.query(`SELECT NEXT VALUE FOR [itam].[seq_${tipo}] AS n`);
  const prefijo = tipo === 'activo' ? cfg.prefijo_activo : tipo === 'componente' ? cfg.prefijo_componente : cfg.prefijo_orden;
  return `${prefijo}${String(n).padStart(cfg.digitos_codigo, '0')}`;
}

/** Texto vacío → null; recorta espacios. */
export const limpio = (v: string | null | undefined) => (v == null ? null : v.trim() || null);

/** Etiquetas legibles de los valores de dominio, para los textos del historial. */
export const ETIQUETAS: Record<string, string> = {
  EN_SERVICIO: 'En servicio',
  FUERA_DE_SERVICIO: 'Fuera de servicio',
  DADO_DE_BAJA: 'Dado de baja',
  SIN_EVALUAR: 'Sin evaluar',
  OPERATIVO: 'Operativo',
  CON_FALLAS: 'Con fallas',
  AVERIADO: 'Averiado',
  IRREPARABLE: 'Irreparable',
  FALLA_TECNICA: 'Falla técnica',
  PREVENTIVO: 'Preventivo',
  CORRECTIVO: 'Correctivo',
  GARANTIA: 'Garantía',
  ACTUALIZACION: 'Actualización',
  DANO_FISICO: 'Daño físico',
  REASIGNACION: 'Reasignación',
  OTRO: 'Otro',
  PERMANENTE: 'Asignación permanente',
  PRESTAMO: 'Préstamo',
  TEMPORAL_REEMPLAZO: 'Reemplazo temporal',
  INSTALADO: 'Instalado',
  EN_ALMACEN: 'En almacén',
  EN_MANTENIMIENTO: 'En mantenimiento',
};
export const etiqueta = (v: string | null | undefined) => (v ? (ETIQUETAS[v] ?? v) : '');

/** Compara identificadores sin distinguir mayúsculas (SQL Server devuelve los GUID en mayúsculas). */
export const mismoId = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
