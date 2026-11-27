import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { ipCliente, RequestConSesion } from '../identidad/decoradores';
import { AuditoriaService } from './auditoria.service';

const CLAVE_AUDITORIA_PROPIA = 'auditoria:propia';
const METODOS_QUE_MODIFICAN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * El caso de uso registra su propia auditoría (con antes/después y dentro de su transacción).
 * El interceptor genérico no la duplica.
 */
export const AuditoriaPropia = () => SetMetadata(CLAVE_AUDITORIA_PROPIA, true);

/**
 * Red de seguridad: toda petición que modifica datos y no registra su propia auditoría
 * queda registrada aquí con ruta, resultado y usuario. Así ninguna operación nueva escapa de la auditoría.
 */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditoriaInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditoria: AuditoriaService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<RequestConSesion>();
    const propia = this.reflector.getAllAndOverride<boolean>(CLAVE_AUDITORIA_PROPIA, [ctx.getHandler(), ctx.getClass()]);
    if (propia || !METODOS_QUE_MODIFICAN.has(req.method) || !req.usuario) return next.handle();

    const ruta: string = req.route?.path ?? req.path;
    const [, , entidad] = ruta.split('/'); // /api/<entidad>/...
    const registrar = (resultado: 'OK' | 'ERROR' | 'DENEGADO', detalle?: string) =>
      this.auditoria
        .registrar({
          actor: { id: req.usuario!.id, nombreUsuario: req.usuario!.nombreUsuario, ip: ipCliente(req) },
          accion: `${req.method} ${ruta}`.slice(0, 64),
          entidad: entidad ?? null,
          entidadId: (req.params?.id as string | undefined) ?? null,
          resultado,
          detalle,
        })
        .catch((e) => this.logger.error(`No se pudo registrar la auditoría de ${req.method} ${ruta}: ${e}`));

    return next.handle().pipe(
      tap({
        next: () => void registrar('OK'),
        error: (e: unknown) => {
          const status = e instanceof HttpException ? e.getStatus() : 500;
          void registrar(status === 403 ? 'DENEGADO' : 'ERROR', e instanceof Error ? e.message : String(e));
        },
      }),
    );
  }
}
