import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DataSource, ILike } from 'typeorm';
import { CrudSimple } from '../common/crud-simple';
import { ActorActual, Roles } from '../identidad/decoradores';
import type { Actor } from '../common/dominio';
import { Area, OrganizacionConfig, Persona, Sede, TIPOS_UBICACION, type TipoUbicacion, Ubicacion } from './organizacion.entities';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

class SedeDto {
  @Transform(recortar) @IsString() @MinLength(1) @MaxLength(120) nombre: string;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(250) direccion?: string | null;
  @IsOptional() @Transform(recortar) @Matches(/^[0-9a-fA-F.:]{1,45}$/, { message: 'Prefijo de red inválido (p. ej. 192.168.1.)' }) prefijoRed?: string | null;
  @IsOptional() @IsBoolean() activo?: boolean;
}
class SedeParcial extends PartialType(SedeDto) {}

class AreaDto {
  @Transform(recortar) @IsString() @MinLength(1) @MaxLength(120) nombre: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}
class AreaParcial extends PartialType(AreaDto) {}

class UbicacionDto {
  @Transform(recortar) @IsString() @MinLength(1) @MaxLength(120) nombre: string;
  @IsIn(TIPOS_UBICACION) tipo: TipoUbicacion;
  @IsUUID() sedeId: string;
  @IsOptional() @IsUUID() areaId?: string | null;
  @IsOptional() @IsBoolean() activo?: boolean;
}
class UbicacionParcial extends PartialType(UbicacionDto) {}

class PersonaDto {
  @Transform(recortar) @IsString() @MinLength(1) @MaxLength(160) nombre: string;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(32) documento?: string | null;
  @IsOptional() @Transform(recortar) @IsEmail() @MaxLength(256) correo?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(120) cargo?: string | null;
  @IsOptional() @IsUUID() areaId?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(128) usuarioWindows?: string | null;
  @IsOptional() @IsBoolean() activo?: boolean;
}
class PersonaParcial extends PartialType(PersonaDto) {}

class ConfigDto {
  @IsOptional() @Transform(recortar) @IsString() @MinLength(1) @MaxLength(160) nombre?: string;
  @IsOptional() @Matches(/^[A-Z0-9-]{1,12}$/, { message: 'Prefijo: mayúsculas, números o guion (máx. 12)' }) prefijoActivo?: string;
  @IsOptional() @Matches(/^[A-Z0-9-]{1,12}$/) prefijoComponente?: string;
  @IsOptional() @Matches(/^[A-Z0-9-]{1,12}$/) prefijoOrden?: string;
  @IsOptional() @IsInt() @Min(3) @Max(10) digitosCodigo?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) diasSinReporte?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) diasAvisoGarantia?: number;
}

/** Estructura de la organización y trabajadores. Lectura: todos; escritura: ADMIN y TECNICO; configuración: ADMIN. */
@Controller('organizacion')
export class OrganizacionController {
  private readonly sedes: CrudSimple<Sede>;
  private readonly areas: CrudSimple<Area>;
  private readonly ubicaciones: CrudSimple<Ubicacion>;
  private readonly personas: CrudSimple<Persona>;

  constructor(@InjectDataSource() private readonly db: DataSource) {
    this.sedes = new CrudSimple(db, Sede, 'Sede');
    this.areas = new CrudSimple(db, Area, 'Área');
    this.ubicaciones = new CrudSimple(db, Ubicacion, 'Ubicación');
    this.personas = new CrudSimple(db, Persona, 'Persona');
  }

  @Get('sedes') listarSedes() {
    return this.sedes.listar({ order: { nombre: 'ASC' } });
  }
  @Roles('ADMIN', 'TECNICO') @Post('sedes') crearSede(@Body() d: SedeDto, @ActorActual() a: Actor) {
    return this.sedes.crear(d, a.id);
  }
  @Roles('ADMIN', 'TECNICO') @Patch('sedes/:id') editarSede(@Param('id', ParseUUIDPipe) id: string, @Body() d: SedeParcial) {
    return this.sedes.actualizar(id, d);
  }

  @Get('areas') listarAreas() {
    return this.areas.listar({ order: { nombre: 'ASC' } });
  }
  @Roles('ADMIN', 'TECNICO') @Post('areas') crearArea(@Body() d: AreaDto, @ActorActual() a: Actor) {
    return this.areas.crear(d, a.id);
  }
  @Roles('ADMIN', 'TECNICO') @Patch('areas/:id') editarArea(@Param('id', ParseUUIDPipe) id: string, @Body() d: AreaParcial) {
    return this.areas.actualizar(id, d);
  }

  @Get('ubicaciones') listarUbicaciones(@Query('tipo') tipo?: TipoUbicacion) {
    return this.ubicaciones.listar({
      where: tipo ? { tipo } : {},
      relations: { sede: true, area: true },
      order: { nombre: 'ASC' },
    });
  }
  @Roles('ADMIN', 'TECNICO') @Post('ubicaciones') crearUbicacion(@Body() d: UbicacionDto, @ActorActual() a: Actor) {
    return this.ubicaciones.crear(d, a.id);
  }
  @Roles('ADMIN', 'TECNICO') @Patch('ubicaciones/:id') editarUbicacion(@Param('id', ParseUUIDPipe) id: string, @Body() d: UbicacionParcial) {
    return this.ubicaciones.actualizar(id, d);
  }

  @Get('personas') listarPersonas(@Query('q') q?: string) {
    const t = q?.trim();
    return this.personas.listar({
      where: t ? [{ nombre: ILike(`%${t}%`) }, { documento: ILike(`%${t}%`) }, { usuarioWindows: ILike(`%${t}%`) }] : {},
      relations: { area: true },
      order: { nombre: 'ASC' },
    });
  }
  @Get('personas/:id') obtenerPersona(@Param('id', ParseUUIDPipe) id: string) {
    return this.personas.obtener(id, ['area']);
  }
  @Roles('ADMIN', 'TECNICO') @Post('personas') crearPersona(@Body() d: PersonaDto, @ActorActual() a: Actor) {
    return this.personas.crear(d, a.id);
  }
  @Roles('ADMIN', 'TECNICO') @Patch('personas/:id') editarPersona(@Param('id', ParseUUIDPipe) id: string, @Body() d: PersonaParcial) {
    return this.personas.actualizar(id, d);
  }

  @Get('config') config() {
    return this.db.getRepository(OrganizacionConfig).findOneByOrFail({ id: 1 });
  }
  @Roles('ADMIN') @Patch('config') async editarConfig(@Body() d: ConfigDto) {
    const repo = this.db.getRepository(OrganizacionConfig);
    const actual = await repo.findOneByOrFail({ id: 1 });
    return repo.save(repo.merge(actual, Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined))));
  }
}

@Module({ controllers: [OrganizacionController] })
export class OrganizacionModule {}
