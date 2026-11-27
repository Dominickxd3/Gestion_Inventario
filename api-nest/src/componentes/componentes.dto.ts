import { Transform } from 'class-transformer';
import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ESTADOS_TECNICOS, type EstadoTecnico } from '../activos/activo.entity';
import { MOTIVOS, type Motivo } from '../mantenimiento/orden-mantenimiento.entity';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class DatosComponenteDto {
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(80) marca?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(160) modelo?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(120) numeroSerie?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(40) capacidad?: string | null;
  @IsOptional() @IsObject() atributos?: Record<string, unknown> | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(1000) observaciones?: string | null;
}

export class CrearComponenteDto extends DatosComponenteDto {
  @IsUUID() tipoComponenteId: string;
  @IsOptional() @IsIn(ESTADOS_TECNICOS) estadoTecnico?: EstadoTecnico;
  /** Almacén donde entra. Obligatorio si no se instala de inmediato. */
  @IsOptional() @IsUUID() ubicacionId?: string | null;
  /** Instalar directamente en este activo. */
  @IsOptional() @IsUUID() activoId?: string | null;
  @IsOptional() @IsIn(MOTIVOS) motivo?: Motivo;
}

export class InstalarDto {
  @IsUUID() activoId: string;
  @IsOptional() @IsIn(MOTIVOS) motivo?: Motivo;
  @IsOptional() @IsUUID() ordenMantenimientoId?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(1000) observacion?: string | null;
}

export const DESTINOS_RETIRO = ['ALMACEN', 'MANTENIMIENTO', 'BAJA'] as const;
export type DestinoRetiro = (typeof DESTINOS_RETIRO)[number];

export class RetirarDto {
  @IsIn(DESTINOS_RETIRO) destino: DestinoRetiro;
  /** Almacén de destino (obligatorio si destino = ALMACEN). */
  @IsOptional() @IsUUID() ubicacionId?: string | null;
  @IsIn(MOTIVOS) motivo: Motivo;
  @IsOptional() @IsUUID() ordenMantenimientoId?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(1000) observacion?: string | null;
}

export class ReemplazarDto {
  @IsUUID() componenteRetiradoId: string;
  @IsUUID() componenteNuevoId: string;
  @IsIn(DESTINOS_RETIRO) destino: DestinoRetiro;
  @IsOptional() @IsUUID() ubicacionId?: string | null;
  @IsIn(MOTIVOS) motivo: Motivo;
  @IsOptional() @IsUUID() ordenMantenimientoId?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(1000) observacion?: string | null;
}

export class ReingresarDto {
  @IsUUID() ubicacionId: string;
  @IsIn(ESTADOS_TECNICOS) estadoTecnico: EstadoTecnico;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(1000) observacion?: string | null;
}

export class BajaComponenteDto {
  @IsIn(MOTIVOS) motivo: Motivo;
  @Transform(recortar) @IsString() @MinLength(3) @MaxLength(1000) observacion: string;
}
