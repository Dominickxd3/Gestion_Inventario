import { Check, Column, Entity, Index } from 'typeorm';
import { ColEnum, ColTexto } from '../common/columnas';
import { EntidadBase, EntidadConEstado } from '../common/entidad-base';

export const TIPOS_GARANTIA = ['FABRICANTE', 'EXTENDIDA', 'SOPORTE', 'OTRA'] as const;
export type TipoGarantia = (typeof TIPOS_GARANTIA)[number];

/** Garantía o contrato de soporte de un activo o de un componente. */
@Entity({ name: 'garantia' })
@Check('CK_garantia_objetivo', '[activo_id] IS NOT NULL OR [componente_id] IS NOT NULL')
@Index('IX_garantia_fin', ['fin'])
export class Garantia extends EntidadConEstado {
  @Column({ name: 'activo_id', type: 'uniqueidentifier', nullable: true })
  activoId: string | null;

  @Column({ name: 'componente_id', type: 'uniqueidentifier', nullable: true })
  componenteId: string | null;

  @ColEnum(TIPOS_GARANTIA)
  tipo: TipoGarantia;

  @ColTexto(160)
  proveedor: string;

  @Column({ name: 'numero_contrato', type: 'nvarchar', length: 80, nullable: true })
  numeroContrato: string | null;

  @Column({ type: 'date' })
  inicio: string;

  @Column({ type: 'date' })
  fin: string;

  @ColTexto(1000, { nullable: true })
  observaciones: string | null;

  @Column({ type: 'bit', default: true })
  vigente: boolean;
}

export const TIPOS_DOCUMENTO = ['FACTURA', 'ACTA_ENTREGA', 'INFORME_TECNICO', 'GARANTIA', 'FOTO', 'OTRO'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const ENTIDADES_CON_DOCUMENTOS = ['ACTIVO', 'COMPONENTE', 'ORDEN', 'ASIGNACION', 'GARANTIA', 'PERSONA'] as const;
export type EntidadConDocumentos = (typeof ENTIDADES_CON_DOCUMENTOS)[number];

/** Archivo adjunto. El contenido se guarda en disco (DOCUMENTOS_DIR) con nombre = id; aquí, los metadatos. */
@Entity({ name: 'documento' })
@Index('IX_documento_entidad', ['entidad', 'entidadId'])
export class Documento extends EntidadBase {
  @ColEnum(ENTIDADES_CON_DOCUMENTOS)
  entidad: EntidadConDocumentos;

  @Column({ name: 'entidad_id', type: 'uniqueidentifier' })
  entidadId: string;

  @ColEnum(TIPOS_DOCUMENTO)
  tipo: TipoDocumento;

  @ColTexto(255, { name: 'nombre_archivo' })
  nombreArchivo: string;

  @Column({ name: 'tipo_mime', type: 'varchar', length: 128 })
  tipoMime: string;

  @Column({ name: 'tamano_bytes', type: 'int' })
  tamanoBytes: number;

  @Column({ type: 'char', length: 64 })
  sha256: string;

  @ColTexto(500, { nullable: true })
  descripcion: string | null;

  @Column({ type: 'bit', default: false })
  anulado: boolean;
}
