import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { Activo } from '../activos/activo.entity';
import { TipoComponente } from '../catalogo/catalogo.entities';
import { Actor, enTransaccion, etiqueta, limpio, mismoId, obtenerOFallar, regla, siguienteCodigo } from '../common/dominio';
import { huellaComponente } from '../common/identificacion';
import { Ubicacion } from '../organizacion/organizacion.entities';
import { TrazabilidadService } from '../trazabilidad/trazabilidad.service';
import {
  BajaComponenteDto, CrearComponenteDto, DatosComponenteDto, InstalarDto, ReemplazarDto, ReingresarDto, RetirarDto,
} from './componentes.dto';
import { Componente, Instalacion } from './componentes.entities';

const SELECT_COMPONENTES = `
  SELECT c.id, c.codigo, c.marca, c.modelo, c.numero_serie, c.capacidad, c.situacion, c.estado_tecnico,
         tc.codigo AS tipo_codigo, tc.nombre AS tipo_nombre,
         u.id AS ubicacion_id, u.nombre AS ubicacion, s.nombre AS sede,
         a.id AS activo_id, a.codigo_patrimonial AS activo_codigo, a.nombre AS activo_nombre,
         i.desde AS instalado_desde, i.confirmada_en,
         COUNT(*) OVER () AS total
  FROM [itam].[componente] c
  JOIN [itam].[tipo_componente] tc ON tc.id = c.tipo_componente_id
  LEFT JOIN [itam].[ubicacion] u ON u.id = c.ubicacion_id
  LEFT JOIN [itam].[sede] s ON s.id = u.sede_id
  LEFT JOIN [itam].[instalacion] i ON i.componente_id = c.id AND i.hasta IS NULL
  LEFT JOIN [itam].[activo] a ON a.id = i.activo_id`;

export interface FiltroComponentes {
  q?: string;
  tipo?: string;
  situacion?: string;
  ubicacionId?: string;
  activoId?: string;
  pagina?: number;
  porPagina?: number;
}

const ref = (tipo: string, id?: string | null) => (id ? { tipo, id } : null);

@Injectable()
export class ComponentesService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly trazabilidad: TrazabilidadService,
  ) {}

  // ------------------------------------------------------------------ Consultas

  async listar(f: FiltroComponentes) {
    const pagina = f.pagina ?? 1;
    const porPagina = Math.min(f.porPagina ?? 100, 500);
    const cond: string[] = [];
    const p: unknown[] = [];
    const par = (v: unknown) => `@${p.push(v) - 1}`;
    if (f.q?.trim()) {
      const q = par(`%${f.q.trim().replace(/[%_[]/g, '[$&]')}%`);
      cond.push(`(c.codigo LIKE ${q} OR c.numero_serie LIKE ${q} OR c.modelo LIKE ${q} OR c.marca LIKE ${q} OR a.codigo_patrimonial LIKE ${q})`);
    }
    if (f.tipo) cond.push(`tc.codigo = ${par(f.tipo)}`);
    if (f.situacion) cond.push(`c.situacion = ${par(f.situacion)}`);
    else cond.push(`c.situacion <> 'DADO_DE_BAJA'`);
    if (f.ubicacionId) cond.push(`c.ubicacion_id = ${par(f.ubicacionId)}`);
    if (f.activoId) cond.push(`a.id = ${par(f.activoId)}`);
    const filas: Record<string, unknown>[] = await this.db.query(
      `${SELECT_COMPONENTES} WHERE ${cond.join(' AND ')}
       ORDER BY c.codigo OFFSET ${par((pagina - 1) * porPagina)} ROWS FETCH NEXT ${par(porPagina)} ROWS ONLY`,
      p,
    );
    return { items: filas.map((r) => this.vista(r)), total: Number(filas[0]?.total ?? 0), pagina, porPagina };
  }

  private vista(r: Record<string, unknown>) {
    return {
      id: r.id as string,
      codigo: r.codigo as string,
      tipo: { codigo: r.tipo_codigo as string, nombre: r.tipo_nombre as string },
      marca: r.marca as string | null,
      modelo: r.modelo as string | null,
      numeroSerie: r.numero_serie as string | null,
      capacidad: r.capacidad as string | null,
      situacion: r.situacion as string,
      estadoTecnico: r.estado_tecnico as string,
      ubicacion: r.ubicacion_id ? { id: r.ubicacion_id as string, nombre: `${r.sede} › ${r.ubicacion}` } : null,
      activo: r.activo_id
        ? { id: r.activo_id as string, codigoPatrimonial: r.activo_codigo as string, nombre: r.activo_nombre as string }
        : null,
      instaladoDesde: r.instalado_desde as Date | null,
      confirmadoPorScanGP: !!r.confirmada_en,
    };
  }

  async obtener(id: string) {
    const [fila] = await this.db.query(`${SELECT_COMPONENTES} WHERE c.id = @0`, [id]);
    regla(!!fila, 'Componente no encontrado');
    const [componente, instalaciones, historial] = await Promise.all([
      this.db.getRepository(Componente).findOneByOrFail({ id }),
      this.db.getRepository(Instalacion).find({ where: { componenteId: id }, relations: { activo: true }, order: { desde: 'DESC' } }),
      this.trazabilidad.historial('COMPONENTE', id),
    ]);
    return {
      ...componente,
      ...this.vista(fila),
      instalaciones: instalaciones.map((i) => ({
        id: i.id,
        desde: i.desde,
        hasta: i.hasta,
        motivoInstalacion: i.motivoInstalacion,
        motivoRetiro: i.motivoRetiro,
        confirmadaEn: i.confirmadaEn,
        activo: i.activo ? { id: i.activo.id, codigoPatrimonial: i.activo.codigoPatrimonial, nombre: i.activo.nombre } : null,
      })),
      historial,
    };
  }

  /** Instalaciones de un activo: vigentes y (opcional) retiradas. */
  instalacionesDe(activoId: string, incluirRetirados = false) {
    return this.db.getRepository(Instalacion).find({
      where: { activoId, ...(incluirRetirados ? {} : { hasta: IsNull() }) },
      relations: { componente: { tipoComponente: true } },
      order: { desde: 'DESC' },
    });
  }

  // ------------------------------------------------------------------ Operaciones

  async crear(actor: Actor, dto: CrearComponenteDto, emExterno?: EntityManager) {
    return enTransaccion(this.db, emExterno, async (em) => {
      const tipo = await obtenerOFallar(em, TipoComponente, { id: dto.tipoComponenteId }, 'Tipo de componente');
      regla(!!dto.ubicacionId || !!dto.activoId, 'Indica el almacén donde entra o el activo donde se instala');
      if (dto.ubicacionId) await obtenerOFallar(em, Ubicacion, { id: dto.ubicacionId }, 'Ubicación');

      const c = em.create(Componente, {
        codigo: await siguienteCodigo(em, 'componente'),
        tipoComponenteId: tipo.id,
        marca: limpio(dto.marca),
        modelo: limpio(dto.modelo),
        numeroSerie: limpio(dto.numeroSerie),
        huella: huellaComponente(tipo.codigo, dto.numeroSerie),
        capacidad: limpio(dto.capacidad),
        atributos: dto.atributos ?? null,
        situacion: 'EN_ALMACEN',
        estadoTecnico: dto.estadoTecnico ?? 'OPERATIVO',
        ubicacionId: dto.activoId ? null : (dto.ubicacionId ?? null),
        observaciones: limpio(dto.observaciones),
        creadoPor: actor.id,
      });
      await em.save(c);
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'COMPONENTE',
        entidadId: c.id,
        tipo: 'ALTA',
        descripcion: `Alta de ${tipo.nombre} ${[c.marca, c.modelo, c.capacidad].filter(Boolean).join(' ')}`.trim(),
      });
      if (dto.activoId) await this.instalar(actor, c.id, { activoId: dto.activoId, motivo: dto.motivo ?? 'ACTUALIZACION' }, em);
      return c;
    });
  }

  async editar(actor: Actor, id: string, dto: DatosComponenteDto) {
    return this.db.transaction(async (em) => {
      const c = await obtenerOFallar(em, Componente, { id }, 'Componente', ['tipoComponente']);
      const antes = { marca: c.marca, modelo: c.modelo, numeroSerie: c.numeroSerie, capacidad: c.capacidad, observaciones: c.observaciones };
      if (dto.marca !== undefined) c.marca = limpio(dto.marca);
      if (dto.modelo !== undefined) c.modelo = limpio(dto.modelo);
      if (dto.numeroSerie !== undefined) {
        c.numeroSerie = limpio(dto.numeroSerie);
        c.huella = huellaComponente(c.tipoComponente!.codigo, c.numeroSerie);
      }
      if (dto.capacidad !== undefined) c.capacidad = limpio(dto.capacidad);
      if (dto.atributos !== undefined) c.atributos = dto.atributos;
      if (dto.observaciones !== undefined) c.observaciones = limpio(dto.observaciones);
      c.tipoComponente = undefined;
      await em.save(c);
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'COMPONENTE', entidadId: id, tipo: 'EDICION', descripcion: 'Datos del componente actualizados',
        detalle: { antes, despues: { marca: c.marca, modelo: c.modelo, numeroSerie: c.numeroSerie, capacidad: c.capacidad, observaciones: c.observaciones } },
      });
      return c;
    });
  }

  async instalar(actor: Actor, id: string, dto: InstalarDto, emExterno?: EntityManager) {
    return enTransaccion(this.db, emExterno, async (em) => {
      const c = await obtenerOFallar(em, Componente, { id }, 'Componente', ['tipoComponente']);
      regla(c.situacion !== 'DADO_DE_BAJA', 'El componente está dado de baja');
      regla(c.situacion !== 'INSTALADO', 'El componente ya está instalado en otro equipo: primero retíralo');
      regla(c.situacion !== 'EN_MANTENIMIENTO', 'El componente está en mantenimiento: primero reingrésalo al almacén');
      const a = await obtenerOFallar(em, Activo, { id: dto.activoId }, 'Activo');
      regla(a.cicloVida !== 'DADO_DE_BAJA', 'No se pueden instalar componentes en un activo dado de baja');

      await em.save(
        em.create(Instalacion, {
          componenteId: c.id,
          activoId: a.id,
          desde: new Date(),
          hasta: null,
          motivoInstalacion: dto.motivo ?? null,
          motivoRetiro: null,
          ordenMantenimientoId: dto.ordenMantenimientoId ?? null,
          confirmadaEn: null,
          creadoPor: actor.id,
        }),
      );
      c.situacion = 'INSTALADO';
      c.ubicacionId = null;
      c.tipoComponente = undefined;
      await em.save(c);

      const nombre = `${c.codigo} (${[c.marca, c.modelo, c.capacidad].filter(Boolean).join(' ') || 'sin modelo'})`;
      const referencia = ref('ORDEN', dto.ordenMantenimientoId);
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'COMPONENTE', entidadId: c.id, tipo: 'INSTALACION', motivo: dto.motivo ?? null,
        descripcion: `Instalado en ${a.codigoPatrimonial} ${a.nombre}`, observacion: dto.observacion, referencia: referencia ?? { tipo: 'ACTIVO', id: a.id },
      });
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'ACTIVO', entidadId: a.id, tipo: 'INSTALACION', motivo: dto.motivo ?? null,
        descripcion: `Se instaló el componente ${nombre}`, observacion: dto.observacion, referencia: referencia ?? { tipo: 'COMPONENTE', id: c.id },
      });
      return c;
    });
  }

  async retirar(actor: Actor, id: string, dto: RetirarDto, emExterno?: EntityManager) {
    return enTransaccion(this.db, emExterno, async (em) => {
      const c = await obtenerOFallar(em, Componente, { id }, 'Componente');
      regla(c.situacion === 'INSTALADO', 'El componente no está instalado');
      const inst = await em.findOne(Instalacion, { where: { componenteId: id, hasta: IsNull() }, relations: { activo: true } });
      regla(!!inst, 'No se encontró la instalación vigente del componente');
      if (dto.destino === 'ALMACEN') {
        regla(!!dto.ubicacionId, 'Indica el almacén donde queda el componente');
        await obtenerOFallar(em, Ubicacion, { id: dto.ubicacionId! }, 'Almacén');
      }

      inst!.hasta = new Date();
      inst!.motivoRetiro = dto.motivo;
      const activo = inst!.activo!;
      inst!.activo = undefined;
      await em.save(inst!);

      c.situacion = dto.destino === 'ALMACEN' ? 'EN_ALMACEN' : dto.destino === 'MANTENIMIENTO' ? 'EN_MANTENIMIENTO' : 'DADO_DE_BAJA';
      c.ubicacionId = dto.destino === 'ALMACEN' ? dto.ubicacionId! : null;
      if (dto.motivo === 'FALLA_TECNICA' || dto.motivo === 'DANO_FISICO') c.estadoTecnico = c.estadoTecnico === 'IRREPARABLE' ? 'IRREPARABLE' : 'CON_FALLAS';
      await em.save(c);

      const destino = dto.destino === 'ALMACEN' ? 'almacén' : dto.destino === 'MANTENIMIENTO' ? 'mantenimiento' : 'baja';
      const referencia = ref('ORDEN', dto.ordenMantenimientoId);
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'COMPONENTE', entidadId: c.id, tipo: 'RETIRO', motivo: dto.motivo,
        descripcion: `Retirado de ${activo.codigoPatrimonial} ${activo.nombre} (${etiqueta(dto.motivo)}) → ${destino}`,
        observacion: dto.observacion, referencia: referencia ?? { tipo: 'ACTIVO', id: activo.id },
      });
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'ACTIVO', entidadId: activo.id, tipo: 'RETIRO', motivo: dto.motivo,
        descripcion: `Se retiró el componente ${c.codigo} ${[c.marca, c.modelo, c.capacidad].filter(Boolean).join(' ')} (${etiqueta(dto.motivo)}) → ${destino}`,
        observacion: dto.observacion, referencia: referencia ?? { tipo: 'COMPONENTE', id: c.id },
      });
      return c;
    });
  }

  /** Pasa un componente instalado directamente a otro equipo (p. ej. ScanGP lo vio en otro equipo y TI lo confirma). */
  async trasladar(actor: Actor, id: string, activoDestinoId: string, observacion: string | null, emExterno?: EntityManager) {
    return enTransaccion(this.db, emExterno, async (em) => {
      const c = await obtenerOFallar(em, Componente, { id }, 'Componente');
      const inst = await em.findOne(Instalacion, { where: { componenteId: id, hasta: IsNull() }, relations: { activo: true } });
      if (inst) {
        regla(!mismoId(inst.activoId, activoDestinoId), 'El componente ya está instalado en ese activo');
        const origen = inst.activo!;
        inst.hasta = new Date();
        inst.motivoRetiro = 'REASIGNACION';
        inst.activo = undefined;
        await em.save(inst);
        await this.trazabilidad.registrar(em, actor, {
          entidad: 'ACTIVO', entidadId: origen.id, tipo: 'RETIRO', motivo: 'REASIGNACION',
          descripcion: `El componente ${c.codigo} pasó a otro equipo`, observacion, referencia: { tipo: 'COMPONENTE', id: c.id },
        });
        c.situacion = 'EN_ALMACEN';
        await em.save(c);
      }
      return this.instalar(actor, id, { activoId: activoDestinoId, motivo: 'REASIGNACION', observacion }, em);
    });
  }

  /** Retira un componente e instala otro en el mismo equipo, en una sola operación. */
  async reemplazar(actor: Actor, activoId: string, dto: ReemplazarDto) {
    return this.db.transaction(async (em) => {
      const inst = await em.findOneBy(Instalacion, { componenteId: dto.componenteRetiradoId, hasta: IsNull() });
      regla(mismoId(inst?.activoId, activoId), 'El componente a retirar no está instalado en este activo');
      await this.retirar(actor, dto.componenteRetiradoId, { ...dto }, em);
      await this.instalar(actor, dto.componenteNuevoId, { activoId, motivo: dto.motivo, ordenMantenimientoId: dto.ordenMantenimientoId, observacion: dto.observacion }, em);
      return { ok: true };
    });
  }

  /** Vuelve del mantenimiento al almacén con su estado técnico. */
  async reingresar(actor: Actor, id: string, dto: ReingresarDto) {
    return this.db.transaction(async (em) => {
      const c = await obtenerOFallar(em, Componente, { id }, 'Componente');
      regla(c.situacion === 'EN_MANTENIMIENTO', 'El componente no está en mantenimiento');
      await obtenerOFallar(em, Ubicacion, { id: dto.ubicacionId }, 'Almacén');
      c.situacion = 'EN_ALMACEN';
      c.ubicacionId = dto.ubicacionId;
      c.estadoTecnico = dto.estadoTecnico;
      await em.save(c);
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'COMPONENTE', entidadId: id, tipo: 'REINGRESO',
        descripcion: `Volvió de mantenimiento al almacén (${etiqueta(dto.estadoTecnico)})`, observacion: dto.observacion,
      });
      return c;
    });
  }

  async darDeBaja(actor: Actor, id: string, dto: BajaComponenteDto) {
    return this.db.transaction(async (em) => {
      const c = await obtenerOFallar(em, Componente, { id }, 'Componente');
      regla(c.situacion !== 'INSTALADO', 'Primero retira el componente del equipo (destino: baja)');
      regla(c.situacion !== 'DADO_DE_BAJA', 'El componente ya está dado de baja');
      c.situacion = 'DADO_DE_BAJA';
      c.ubicacionId = null;
      await em.save(c);
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'COMPONENTE', entidadId: id, tipo: 'BAJA', motivo: dto.motivo,
        descripcion: `Dado de baja (${etiqueta(dto.motivo)})`, observacion: dto.observacion,
      });
      return c;
    });
  }
}
