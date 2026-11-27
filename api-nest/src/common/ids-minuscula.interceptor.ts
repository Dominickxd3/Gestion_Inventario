import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

const GUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
/** Claves que contienen identificadores internos (id, activoId, persona_id…). No incluye `uuid` del BIOS. */
const CLAVE_ID = /(^id$|Id$|_id$)/;

function normalizar(v: unknown, clave = ''): unknown {
  if (typeof v === 'string') return CLAVE_ID.test(clave) && GUID.test(v) ? v.toLowerCase() : v;
  if (Array.isArray(v)) return v.map((x) => normalizar(x, clave));
  if (v && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v) && v.constructor !== Object && typeof (v as { pipe?: unknown }).pipe === 'function') return v;
  if (v && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v)) {
    for (const k of Object.keys(v)) (v as Record<string, unknown>)[k] = normalizar((v as Record<string, unknown>)[k], k);
  }
  return v;
}

/**
 * SQL Server devuelve los UNIQUEIDENTIFIER en mayúsculas en consultas directas y la aplicación los genera en
 * minúsculas. Para que la web pueda compararlos, todas las respuestas usan minúsculas en las claves de id.
 */
@Injectable()
export class IdsMinusculaInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((r) => normalizar(r)));
  }
}
