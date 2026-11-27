import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsBoolean, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DataSource } from 'typeorm';
import { CrudSimple } from '../common/crud-simple';
import { ActorActual, Roles } from '../identidad/decoradores';
import type { Actor } from '../common/dominio';
import { Marca, Modelo, TipoActivo, TipoComponente } from './catalogo.entities';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class MarcaDto {
  @Transform(recortar) @IsString() @MinLength(1) @MaxLength(80) nombre: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

class ModeloDto {
  @IsUUID() marcaId: string;
  @IsUUID() tipoActivoId: string;
  @Transform(recortar) @IsString() @MinLength(1) @MaxLength(120) nombre: string;
  @IsOptional() @IsObject() especificaciones?: Record<string, unknown> | null;
  @IsOptional() @IsBoolean() activo?: boolean;
}

class MarcaDtoParcial extends PartialType(MarcaDto) {}
class ModeloDtoParcial extends PartialType(ModeloDto) {}

/** Catálogo independiente de marcas, modelos y tipos. Lectura: todos; escritura: ADMIN y TECNICO. */
@Controller('catalogo')
export class CatalogoController {
  private readonly marcas: CrudSimple<Marca>;
  private readonly modelos: CrudSimple<Modelo>;

  constructor(@InjectDataSource() private readonly db: DataSource) {
    this.marcas = new CrudSimple(db, Marca, 'Marca');
    this.modelos = new CrudSimple(db, Modelo, 'Modelo');
  }

  @Get('tipos-activo')
  tiposActivo() {
    return this.db.getRepository(TipoActivo).find({ order: { nombre: 'ASC' } });
  }

  @Get('tipos-componente')
  tiposComponente() {
    return this.db.getRepository(TipoComponente).find({ order: { nombre: 'ASC' } });
  }

  @Get('marcas')
  listarMarcas() {
    return this.marcas.listar({ order: { nombre: 'ASC' } });
  }

  @Roles('ADMIN', 'TECNICO')
  @Post('marcas')
  crearMarca(@Body() dto: MarcaDto, @ActorActual() a: Actor) {
    return this.marcas.crear(dto, a.id);
  }

  @Roles('ADMIN', 'TECNICO')
  @Patch('marcas/:id')
  editarMarca(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MarcaDtoParcial) {
    return this.marcas.actualizar(id, dto);
  }

  @Get('modelos')
  listarModelos(@Query('marcaId') marcaId?: string, @Query('tipoActivoId') tipoActivoId?: string) {
    return this.modelos.listar({
      where: { ...(marcaId && { marcaId }), ...(tipoActivoId && { tipoActivoId }) },
      relations: { marca: true, tipoActivo: true },
      order: { nombre: 'ASC' },
    });
  }

  @Roles('ADMIN', 'TECNICO')
  @Post('modelos')
  crearModelo(@Body() dto: ModeloDto, @ActorActual() a: Actor) {
    return this.modelos.crear(dto, a.id);
  }

  @Roles('ADMIN', 'TECNICO')
  @Patch('modelos/:id')
  editarModelo(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ModeloDtoParcial) {
    return this.modelos.actualizar(id, dto);
  }
}

@Module({ controllers: [CatalogoController] })
export class CatalogoModule {}
