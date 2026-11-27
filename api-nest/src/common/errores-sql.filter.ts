import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { OptimisticLockVersionMismatchError, QueryFailedError } from 'typeorm';

/** Mensajes de índices únicos para errores 2601/2627 (el resto usa un mensaje genérico). */
const UNICOS: Record<string, string> = {
  UQ_activo_codigo_patrimonial: 'Ya existe un activo con ese código patrimonial',
  UQ_componente_huella: 'Ya existe un componente con ese tipo y número de serie',
  UQ_componente_codigo: 'Ya existe un componente con ese código',
  UQ_asignacion_vigente: 'El activo ya tiene una asignación vigente',
  UQ_instalacion_vigente: 'El componente ya está instalado en un equipo',
  UQ_orden_abierta: 'El activo ya tiene una orden de mantenimiento abierta',
  UQ_dispositivo_activo: 'El activo ya está vinculado a otro equipo detectado',
  UQ_persona_documento: 'Ya existe una persona con ese documento',
  UQ_marca_nombre: 'Ya existe una marca con ese nombre',
  UQ_modelo_marca_nombre: 'Ya existe ese modelo para la marca',
  UQ_sede_nombre: 'Ya existe una sede con ese nombre',
  UQ_area_nombre: 'Ya existe un área con ese nombre',
  UQ_ubicacion_sede_nombre: 'Ya existe una ubicación con ese nombre en la sede',
  UQ_articulo_nombre: 'Ya existe un artículo con ese nombre',
  UQ_usuario_nombre_usuario: 'Ya existe ese usuario',
};

/** Traduce errores de SQL Server a respuestas HTTP comprensibles (409 duplicado, 400 referencia, 409 versión). */
@Catch(QueryFailedError, OptimisticLockVersionMismatchError)
export class ErroresSqlFilter implements ExceptionFilter {
  private readonly logger = new Logger('SQL');

  catch(e: QueryFailedError | OptimisticLockVersionMismatchError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (e instanceof OptimisticLockVersionMismatchError) {
      return res.status(HttpStatus.CONFLICT).json({ statusCode: 409, message: 'Otro usuario modificó el registro. Recarga e intenta de nuevo' });
    }
    const numero = (e.driverError as { number?: number } | undefined)?.number;
    const texto = String(e.driverError?.message ?? e.message);
    if (numero === 2601 || numero === 2627) {
      const indice = Object.keys(UNICOS).find((k) => texto.includes(k));
      return res.status(HttpStatus.CONFLICT).json({ statusCode: 409, message: indice ? UNICOS[indice] : 'Ya existe un registro con esos datos' });
    }
    if (numero === 547) {
      return res.status(HttpStatus.BAD_REQUEST).json({ statusCode: 400, message: 'Referencia inválida: uno de los registros indicados no existe' });
    }
    this.logger.error(texto);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'Error interno al guardar los datos' });
  }
}
