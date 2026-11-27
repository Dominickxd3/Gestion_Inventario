import { Body, Controller, Get, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { DataSource } from 'typeorm';
import { CrudSimple } from '../common/crud-simple';
import { Actor, limpio, obtenerOFallar, regla } from '../common/dominio';
import { uuid7 } from '../common/uuid7';
import { ActorActual, Roles } from '../identidad/decoradores';
import { Ubicacion } from '../organizacion/organizacion.entities';
import { Articulo, Existencia, MovimientoAlmacen, TIPOS_MOVIMIENTO_ALMACEN, type TipoMovimientoAlmacen } from './almacen.entities';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

class ArticuloDto {
  @Transform(recortar) @IsString() @MinLength(1) @MaxLength(160) nombre: string;
  @Transform(recortar) @IsString() @MinLength(1) @MaxLength(20) unidad: string;
  @IsOptional() @IsInt() @Min(0) stockMinimo?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}
class ArticuloParcial extends PartialType(ArticuloDto) {}

class MovimientoDto {
  @IsUUID() articuloId: string;
  @IsUUID() ubicacionId: string;
  @IsIn(TIPOS_MOVIMIENTO_ALMACEN) tipo: TipoMovimientoAlmacen;
  /** Entrada/salida: unidades que entran o salen. Ajuste: existencia contada (nuevo saldo). */
  @IsInt() @Min(0) cantidad: number;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(500) motivo?: string | null;
  @IsOptional() @IsUUID() ordenMantenimientoId?: string | null;
  @IsOptional() @IsUUID() activoId?: string | null;
}

@Injectable()
export class AlmacenService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  existencias(ubicacionId?: string) {
    return this.db.query(
      `SELECT ar.id AS articuloId, ar.nombre, ar.unidad, ar.stock_minimo AS stockMinimo,
              u.id AS ubicacionId, u.nombre AS ubicacion, s.nombre AS sede, ISNULL(e.cantidad, 0) AS cantidad,
              SUM(ISNULL(e.cantidad, 0)) OVER (PARTITION BY ar.id) AS totalArticulo
       FROM [itam].[articulo] ar
       LEFT JOIN [itam].[existencia] e ON e.articulo_id = ar.id
       LEFT JOIN [itam].[ubicacion] u ON u.id = e.ubicacion_id
       LEFT JOIN [itam].[sede] s ON s.id = u.sede_id
       WHERE ar.activo = 1 ${ubicacionId ? 'AND e.ubicacion_id = @0' : ''}
       ORDER BY ar.nombre, u.nombre`,
      ubicacionId ? [ubicacionId] : [],
    );
  }

  movimientos(articuloId?: string) {
    return this.db.query(
      `SELECT TOP 300 m.id, m.fecha, m.tipo, m.cantidad, m.saldo, m.motivo, m.usuario_nombre AS usuarioNombre,
              ar.nombre AS articulo, ar.unidad, u.nombre AS ubicacion, a.codigo_patrimonial AS activo, o.codigo AS orden
       FROM [itam].[movimiento_almacen] m
       JOIN [itam].[articulo] ar ON ar.id = m.articulo_id
       JOIN [itam].[ubicacion] u ON u.id = m.ubicacion_id
       LEFT JOIN [itam].[activo] a ON a.id = m.activo_id
       LEFT JOIN [itam].[orden_mantenimiento] o ON o.id = m.orden_mantenimiento_id
       ${articuloId ? 'WHERE m.articulo_id = @0' : ''}
       ORDER BY m.fecha DESC`,
      articuloId ? [articuloId] : [],
    );
  }

  /** Registra una entrada, salida o ajuste. Bloquea la fila de existencia para evitar saldos inconsistentes. */
  async mover(actor: Actor, dto: MovimientoDto) {
    return this.db.transaction(async (em) => {
      const articulo = await obtenerOFallar(em, Articulo, { id: dto.articuloId }, 'Artículo');
      await obtenerOFallar(em, Ubicacion, { id: dto.ubicacionId }, 'Almacén');
      regla(dto.tipo === 'AJUSTE' || dto.cantidad > 0, 'La cantidad debe ser mayor que cero');
      const [fila] = await em.query(
        `SELECT id, cantidad FROM [itam].[existencia] WITH (UPDLOCK, HOLDLOCK) WHERE articulo_id = @0 AND ubicacion_id = @1`,
        [dto.articuloId, dto.ubicacionId],
      );
      const actual: number = fila?.cantidad ?? 0;
      const nuevo = dto.tipo === 'ENTRADA' ? actual + dto.cantidad : dto.tipo === 'SALIDA' ? actual - dto.cantidad : dto.cantidad;
      regla(nuevo >= 0, `No hay suficiente ${articulo.nombre}: quedan ${actual} ${articulo.unidad}`);
      regla(dto.tipo !== 'AJUSTE' || !!limpio(dto.motivo), 'Indica el motivo del ajuste');

      if (fila) await em.update(Existencia, fila.id, { cantidad: nuevo });
      else await em.save(em.create(Existencia, { articuloId: dto.articuloId, ubicacionId: dto.ubicacionId, cantidad: nuevo, creadoPor: actor.id }));

      await em.insert(MovimientoAlmacen, {
        id: uuid7(),
        articuloId: dto.articuloId,
        ubicacionId: dto.ubicacionId,
        tipo: dto.tipo,
        cantidad: nuevo - actual,
        saldo: nuevo,
        fecha: new Date(),
        motivo: limpio(dto.motivo),
        ordenMantenimientoId: dto.ordenMantenimientoId ?? null,
        activoId: dto.activoId ?? null,
        usuarioNombre: actor.nombreUsuario,
        creadoPor: actor.id,
      });
      return { articuloId: dto.articuloId, ubicacionId: dto.ubicacionId, saldo: nuevo };
    });
  }
}

@Controller('almacen')
export class AlmacenController {
  private readonly articulos: CrudSimple<Articulo>;

  constructor(@InjectDataSource() db: DataSource, private readonly almacen: AlmacenService) {
    this.articulos = new CrudSimple(db, Articulo, 'Artículo');
  }

  @Get('articulos') listarArticulos() {
    return this.articulos.listar({ order: { nombre: 'ASC' } });
  }
  @Roles('ADMIN', 'TECNICO') @Post('articulos') crearArticulo(@Body() d: ArticuloDto, @ActorActual() a: Actor) {
    return this.articulos.crear(d, a.id);
  }
  @Roles('ADMIN', 'TECNICO') @Patch('articulos/:id') editarArticulo(@Param('id', ParseUUIDPipe) id: string, @Body() d: ArticuloParcial) {
    return this.articulos.actualizar(id, d);
  }

  @Get('existencias') existencias(@Query('ubicacionId') ubicacionId?: string) {
    return this.almacen.existencias(ubicacionId);
  }
  @Get('movimientos') movimientos(@Query('articuloId') articuloId?: string) {
    return this.almacen.movimientos(articuloId);
  }
  @Roles('ADMIN', 'TECNICO') @Post('movimientos') mover(@Body() d: MovimientoDto, @ActorActual() a: Actor) {
    return this.almacen.mover(a, d);
  }
}

@Module({ controllers: [AlmacenController], providers: [AlmacenService] })
export class AlmacenModule {}
