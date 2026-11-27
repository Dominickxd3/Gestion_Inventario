import { Transform, Type } from 'class-transformer';
import {
  IsArray, IsDateString, IsIn, IsInt, IsNumberString, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { MOTIVOS, type Motivo } from '../mantenimiento/orden-mantenimiento.entity';
import { ESTADOS_TECNICOS, type EstadoTecnico } from './activo.entity';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class ComponenteDetectadoDto {
  @IsString() @MaxLength(32) tipo: string;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(80) marca?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(160) modelo?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(120) numeroSerie?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(40) capacidad?: string | null;
}

export class DatosActivoDto {
  @IsOptional() @Transform(recortar) @IsString() @MinLength(1) @MaxLength(128) nombre?: string;
  @IsOptional() @IsUUID() modeloId?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(80) numeroSerie?: string | null;
  @IsOptional() @IsUUID() ubicacionId?: string | null;
  @IsOptional() @IsDateString() fechaAdquisicion?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(160) proveedor?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(64) numeroFactura?: string | null;
  @IsOptional() @IsNumberString() costo?: string | null;
  @IsOptional() @IsObject() especificaciones?: Record<string, unknown> | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(2000) observaciones?: string | null;
}

export class CrearActivoDto extends DatosActivoDto {
  @Transform(recortar) @IsString() @MinLength(1) @MaxLength(128) declare nombre: string;
  @IsUUID() tipoActivoId: string;
  /** Opcional: si el equipo ya tiene etiqueta física. Si no, se genera (TI-000001). */
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() || null : value))
  @Matches(/^[A-Z0-9._/-]{1,32}$/, { message: 'Código patrimonial: letras, números, punto, guion o barra (máx. 32)' })
  codigoPatrimonial?: string | null;
  /** Alternativa a modeloId: busca o crea la marca y el modelo en el catálogo. */
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(80) marcaNombre?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(120) modeloNombre?: string | null;
  @IsOptional() @IsIn(ESTADOS_TECNICOS) estadoTecnico?: EstadoTecnico;
  /** Vincular con el equipo detectado por ScanGP. */
  @IsOptional() @IsString() @MaxLength(16) dispositivoId?: string | null;
  /** Componentes rastreables a registrar e instalar en el alta (vienen de la detección). */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ComponenteDetectadoDto) componentes?: ComponenteDetectadoDto[];
}

export class EstadoTecnicoDto {
  @IsIn(ESTADOS_TECNICOS) estadoTecnico: EstadoTecnico;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(1000) observacion?: string | null;
}

export class CicloDto {
  @IsIn(['EN_SERVICIO', 'FUERA_DE_SERVICIO']) cicloVida: 'EN_SERVICIO' | 'FUERA_DE_SERVICIO';
  @IsOptional() @IsIn(MOTIVOS) motivo?: Motivo;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(1000) observacion?: string | null;
}

export class UbicacionDto {
  @IsUUID() ubicacionId: string;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(1000) observacion?: string | null;
}

export class BajaDto {
  @IsIn(MOTIVOS) motivo: Motivo;
  @Transform(recortar) @IsString() @MinLength(3, { message: 'Explica el motivo de la baja' }) @MaxLength(1000) observacion: string;
}

export class VincularDto {
  @IsString() @MaxLength(16) dispositivoId: string;
}

export class FiltroActivosDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() @MaxLength(32) tipo?: string;
  @IsOptional() @IsString() @MaxLength(32) cicloVida?: string;
  @IsOptional() @IsString() @MaxLength(32) estadoTecnico?: string;
  @IsOptional() @IsUUID() ubicacionId?: string;
  @IsOptional() @IsUUID() personaId?: string;
  @IsOptional() @IsIn(['ASIGNADO', 'DISPONIBLE', 'EN_MANTENIMIENTO', 'CON_DISCREPANCIAS', 'SIN_REPORTE', 'SIN_VINCULAR']) situacion?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) porPagina = 50;
}
