import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

/** Solo los agentes con la clave correcta pueden registrar inventario. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const esperada = this.config.get<string>('API_KEY') ?? '';
    const recibida = ctx.switchToHttp().getRequest<Request>().header('x-api-key') ?? '';

    const a = Buffer.from(esperada);
    const b = Buffer.from(recibida);
    if (!esperada || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('API key inválida');
    }
    return true;
  }
}
