import {
  Body, Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PartialType } from '@nestjs/mapped-types';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectDataSource } from '@nestjs/typeorm';
import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { createHash } from 'crypto';
import type { Response } from 'express';
import { createReadStream, existsSync, promises as fs } from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { CrudSimple } from '../common/crud-simple';
import { Actor, limpio, regla } from '../common/dominio';
import { uuid7 } from '../common/uuid7';
import { ActorActual, Roles } from '../identidad/decoradores';
import {
  Documento, ENTIDADES_CON_DOCUMENTOS, type EntidadConDocumentos, Garantia, TIPOS_DOCUMENTO, TIPOS_GARANTIA, type TipoDocumento, type TipoGarantia,
} from './garantias.entities';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

class GarantiaDto {
  @IsOptional() @IsUUID() activoId?: string | null;
  @IsOptional() @IsUUID() componenteId?: string | null;
  @IsIn(TIPOS_GARANTIA) tipo: TipoGarantia;
  @Transform(recortar) @IsString() @MinLength(1) @MaxLength(160) proveedor: string;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(80) numeroContrato?: string | null;
  @IsDateString() inicio: string;
  @IsDateString() fin: string;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(1000) observaciones?: string | null;
}
class GarantiaParcial extends PartialType(GarantiaDto) {
  @IsOptional() vigente?: boolean;
}

class SubirDocumentoDto {
  @IsIn(ENTIDADES_CON_DOCUMENTOS) entidad: EntidadConDocumentos;
  @IsUUID() entidadId: string;
  @IsIn(TIPOS_DOCUMENTO) tipo: TipoDocumento;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(500) descripcion?: string | null;
}

const MAX_BYTES = 20 * 1024 * 1024;
const MIME_PERMITIDOS = /^(application\/pdf|image\/(png|jpeg|webp)|text\/plain|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|application\/msword|application\/vnd\.ms-excel)$/;

@Controller()
export class GarantiasController {
  private readonly garantias: CrudSimple<Garantia>;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly config: ConfigService,
  ) {
    this.garantias = new CrudSimple(db, Garantia, 'Garantía');
  }

  // ------------------------------------------------------------------ Garantías

  /** Con `porVencer=30`: vigentes que vencen en los próximos 30 días. Con `vencidas=true`: ya vencidas. */
  @Get('garantias')
  listar(
    @Query('activoId') activoId?: string,
    @Query('componenteId') componenteId?: string,
    @Query('porVencer') porVencer?: string,
    @Query('vencidas') vencidas?: string,
  ) {
    const cond: string[] = [];
    const p: unknown[] = [];
    const par = (v: unknown) => `@${p.push(v) - 1}`;
    if (activoId) cond.push(`g.activo_id = ${par(activoId)}`);
    if (componenteId) cond.push(`g.componente_id = ${par(componenteId)}`);
    if (porVencer) {
      cond.push(`g.vigente = 1 AND g.fin >= CAST(SYSUTCDATETIME() AS date) AND g.fin <= DATEADD(day, ${par(Number(porVencer) || 30)}, CAST(SYSUTCDATETIME() AS date))`);
    }
    if (vencidas === 'true') cond.push('g.vigente = 1 AND g.fin < CAST(SYSUTCDATETIME() AS date)');
    return this.db.query(
      `SELECT g.id, g.activo_id AS activoId, g.componente_id AS componenteId, g.tipo, g.proveedor, g.numero_contrato AS numeroContrato,
              CONVERT(varchar(10), g.inicio, 23) AS inicio, CONVERT(varchar(10), g.fin, 23) AS fin, g.observaciones, g.vigente,
              a.codigo_patrimonial AS activoCodigo, a.nombre AS activoNombre, c.codigo AS componenteCodigo
       FROM [itam].[garantia] g
       LEFT JOIN [itam].[activo] a ON a.id = g.activo_id
       LEFT JOIN [itam].[componente] c ON c.id = g.componente_id
       ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
       ORDER BY g.fin`,
      p,
    );
  }

  @Roles('ADMIN', 'TECNICO')
  @Post('garantias')
  crear(@Body() d: GarantiaDto, @ActorActual() a: Actor) {
    regla(!!d.activoId || !!d.componenteId, 'Indica el activo o el componente que cubre la garantía');
    regla(d.fin >= d.inicio, 'La fecha de fin debe ser posterior al inicio');
    return this.garantias.crear({ ...d, vigente: true }, a.id);
  }

  @Roles('ADMIN', 'TECNICO')
  @Patch('garantias/:id')
  editar(@Param('id', ParseUUIDPipe) id: string, @Body() d: GarantiaParcial) {
    return this.garantias.actualizar(id, d);
  }

  // ------------------------------------------------------------------ Documentos

  private get directorio() {
    return path.resolve(this.config.get<string>('DOCUMENTOS_DIR') ?? 'data/documentos');
  }

  @Get('documentos')
  documentos(@Query('entidad') entidad: EntidadConDocumentos, @Query('entidadId', ParseUUIDPipe) entidadId: string) {
    return this.db.getRepository(Documento).find({ where: { entidad, entidadId, anulado: false }, order: { creadoEn: 'DESC' } });
  }

  @Roles('ADMIN', 'TECNICO')
  @Post('documentos')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: MAX_BYTES, files: 1 } }))
  async subir(@UploadedFile() archivo: Express.Multer.File | undefined, @Body() d: SubirDocumentoDto, @ActorActual() a: Actor) {
    regla(!!archivo, 'Adjunta un archivo');
    regla(MIME_PERMITIDOS.test(archivo!.mimetype), 'Tipo de archivo no permitido (PDF, imagen, Word, Excel o texto)');
    const id = uuid7();
    await fs.mkdir(this.directorio, { recursive: true });
    await fs.writeFile(path.join(this.directorio, id), archivo!.buffer, { flag: 'wx' });
    const doc = this.db.getRepository(Documento).create({
      id,
      entidad: d.entidad,
      entidadId: d.entidadId,
      tipo: d.tipo,
      // multer entrega el nombre en latin1: se corrige para tildes y ñ.
      nombreArchivo: Buffer.from(archivo!.originalname, 'latin1').toString('utf8').slice(0, 255),
      tipoMime: archivo!.mimetype,
      tamanoBytes: archivo!.size,
      sha256: createHash('sha256').update(archivo!.buffer).digest('hex'),
      descripcion: limpio(d.descripcion),
      anulado: false,
      creadoPor: a.id,
    });
    return this.db.getRepository(Documento).save(doc);
  }

  @Get('documentos/:id/descargar')
  async descargar(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const doc = await this.db.getRepository(Documento).findOneBy({ id });
    regla(!!doc && !doc.anulado, 'Documento no encontrado');
    const ruta = path.join(this.directorio, id);
    regla(existsSync(ruta), 'El archivo no está en el servidor');
    res.set({
      'Content-Type': doc!.tipoMime,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc!.nombreArchivo)}`,
    });
    return new StreamableFile(createReadStream(ruta));
  }

  /** Los documentos no se borran: se anulan (el archivo se conserva). */
  @Roles('ADMIN', 'TECNICO')
  @Post('documentos/:id/anular')
  async anular(@Param('id', ParseUUIDPipe) id: string) {
    const repo = this.db.getRepository(Documento);
    const doc = await repo.findOneBy({ id });
    regla(!!doc, 'Documento no encontrado');
    doc!.anulado = true;
    return repo.save(doc!);
  }
}

@Module({ controllers: [GarantiasController] })
export class GarantiasModule {}
