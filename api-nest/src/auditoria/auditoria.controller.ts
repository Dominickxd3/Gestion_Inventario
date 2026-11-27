import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Roles } from '../identidad/decoradores';
import { AuditoriaService } from './auditoria.service';

class FiltroAuditoria {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) porPagina = 50;
  @IsOptional() @IsUUID() usuarioId?: string;
  @IsOptional() @IsString() @MaxLength(64) entidad?: string;
  @IsOptional() @IsString() @MaxLength(64) entidadId?: string;
  @IsOptional() @IsString() @MaxLength(64) accion?: string;
}

@Controller('auditoria')
@Roles('ADMIN')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  listar(@Query() f: FiltroAuditoria) {
    return this.auditoria.listar(f);
  }
}
