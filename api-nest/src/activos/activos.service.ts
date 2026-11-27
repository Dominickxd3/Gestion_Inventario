import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Marca, Modelo, TipoActivo } from '../catalogo/catalogo.entities';
import { Actor, enTransaccion, etiqueta, limpio, mismoId, obtenerOFallar, regla, siguienteCodigo } from '../common/dominio';
import { DispositivoDetectado } from '../descubrimiento/descubrimiento.entities';
import { Ubicacion } from '../organizacion/organizacion.entities';
import { TrazabilidadService } from '../trazabilidad/trazabilidad.service';
import { Activo } from './activo.entity';
import { BajaDto, CicloDto, CrearActivoDto, DatosActivoDto, EstadoTecnicoDto, FiltroActivosDto } from './activos.dto';

const ORDEN_ABIERTA = `('ABIERTA', 'EN_CURSO', 'EN_ESPERA')`;

/** Columnas de la vista de activos: datos propios + responsable, mantenimiento y sincronización calculados. */
const SELECT_ACTIVOS = `
  SELECT a.id, a.codigo_patrimonial, a.nombre, a.numero_serie, a.ciclo_vida, a.estado_tecnico, a.ubicacion_id,
         t.codigo AS tipo_codigo, t.nombre AS tipo_nombre, t.detectable,
         ma.nombre AS marca, mo.nombre AS modelo,
         u.nombre AS ubicacion, s.nombre AS sede,
         asg.id AS asignacion_id, asg.tipo AS tipo_asignacion, asg.hasta_previsto, p.id AS persona_id, p.nombre AS responsable,
         ar.nombre AS area_asignada,
         om.id AS orden_id, om.codigo AS orden_codigo,
         d.id AS dispositivo_id, d.ultimo_reporte,
         (SELECT COUNT(*) FROM [itam].[discrepancia] x WHERE x.activo_id = a.id AND x.estado = 'PENDIENTE') AS discrepancias,
         COUNT(*) OVER () AS total
  FROM [itam].[activo] a
  JOIN [itam].[tipo_activo] t ON t.id = a.tipo_activo_id
  LEFT JOIN [itam].[modelo] mo ON mo.id = a.modelo_id
  LEFT JOIN [itam].[marca] ma ON ma.id = mo.marca_id
  LEFT JOIN [itam].[ubicacion] u ON u.id = a.ubicacion_id
  LEFT JOIN [itam].[sede] s ON s.id = u.sede_id
  LEFT JOIN [itam].[asignacion] asg ON asg.activo_id = a.id AND asg.hasta IS NULL
  LEFT JOIN [itam].[persona] p ON p.id = asg.persona_id
  LEFT JOIN [itam].[area] ar ON ar.id = asg.area_id
  LEFT JOIN [itam].[orden_mantenimiento] om ON om.activo_id = a.id AND om.estado IN ${ORDEN_ABIERTA}
  LEFT JOIN [itam].[dispositivo_detectado] d ON d.activo_id = a.id`;

export type Sincronizacion = 'NO_APLICA' | 'SIN_VINCULAR' | 'SINCRONIZADO' | 'CON_DISCREPANCIAS' | 'SIN_REPORTE';

@Injectable()
export class ActivosService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly trazabilidad: TrazabilidadService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ------------------------------------------------------------------ Consultas

  async listar(f: FiltroActivosDto) {
    const dias = await this.diasSinReporte();
    const cond: string[] = [];
    const p: unknown[] = [];
    const par = (v: unknown) => `@${p.push(v) - 1}`;

    if (f.q?.trim()) {
      const q = par(`%${f.q.trim().replace(/[%_[]/g, '[$&]')}%`);
      cond.push(`(a.codigo_patrimonial LIKE ${q} OR a.nombre LIKE ${q} OR a.numero_serie LIKE ${q} OR p.nombre LIKE ${q} OR mo.nombre LIKE ${q} OR ma.nombre LIKE ${q})`);
    }
    if (f.tipo) cond.push(`t.codigo = ${par(f.tipo)}`);
    if (f.cicloVida) cond.push(`a.ciclo_vida = ${par(f.cicloVida)}`);
    else cond.push(`a.ciclo_vida <> 'DADO_DE_BAJA'`);
    if (f.estadoTecnico) cond.push(`a.estado_tecnico = ${par(f.estadoTecnico)}`);
    if (f.ubicacionId) cond.push(`a.ubicacion_id = ${par(f.ubicacionId)}`);
    if (f.personaId) cond.push(`p.id = ${par(f.personaId)}`);
    switch (f.situacion) {
      case 'ASIGNADO': cond.push('asg.id IS NOT NULL'); break;
      case 'DISPONIBLE': cond.push(`asg.id IS NULL AND om.id IS NULL AND a.ciclo_vida = 'EN_SERVICIO'`); break;
      case 'EN_MANTENIMIENTO': cond.push('om.id IS NOT NULL'); break;
      case 'CON_DISCREPANCIAS': cond.push(`EXISTS (SELECT 1 FROM [itam].[discrepancia] x WHERE x.activo_id = a.id AND x.estado = 'PENDIENTE')`); break;
      case 'SIN_REPORTE': cond.push(`d.id IS NOT NULL AND d.ultimo_reporte < DATEADD(day, -${par(dias)}, SYSUTCDATETIME())`); break;
      case 'SIN_VINCULAR': cond.push('t.detectable = 1 AND d.id IS NULL'); break;
    }

    const filas: Record<string, unknown>[] = await this.db.query(
      `${SELECT_ACTIVOS} ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
       ORDER BY a.codigo_patrimonial OFFSET ${par((f.pagina - 1) * f.porPagina)} ROWS FETCH NEXT ${par(f.porPagina)} ROWS ONLY`,
      p,
    );
    return {
      items: filas.map((r) => this.vista(r, dias)),
      total: Number(filas[0]?.total ?? 0),
      pagina: f.pagina,
      porPagina: f.porPagina,
    };
  }

  async obtener(id: string) {
    const dias = await this.diasSinReporte();
    const [fila] = await this.db.query(`${SELECT_ACTIVOS} WHERE a.id = @0`, [id]);
    regla(!!fila, 'Activo no encontrado');
    const activo = await this.db.getRepository(Activo).findOneOrFail({
      where: { id },
      relations: { tipoActivo: true, modelo: { marca: true }, ubicacion: { sede: true, area: true } },
    });
    return { ...activo, ...this.vista(fila, dias) };
  }

  private vista(r: Record<string, unknown>, diasSinReporte: number) {
    const ultimo = r.ultimo_reporte ? new Date(r.ultimo_reporte as string) : null;
    const discrepancias = Number(r.discrepancias ?? 0);
    const sincronizacion: Sincronizacion = !r.dispositivo_id
      ? r.detectable ? 'SIN_VINCULAR' : 'NO_APLICA'
      : discrepancias > 0 ? 'CON_DISCREPANCIAS'
      : ultimo && Date.now() - ultimo.getTime() > diasSinReporte * 86_400_000 ? 'SIN_REPORTE'
      : 'SINCRONIZADO';
    return {
      id: r.id as string,
      codigoPatrimonial: r.codigo_patrimonial as string,
      nombre: r.nombre as string,
      numeroSerie: r.numero_serie as string | null,
      cicloVida: r.ciclo_vida as string,
      estadoTecnico: r.estado_tecnico as string,
      tipo: { codigo: r.tipo_codigo as string, nombre: r.tipo_nombre as string },
      marca: r.marca as string | null,
      modelo: r.modelo as string | null,
      ubicacionId: r.ubicacion_id as string | null,
      ubicacionNombre: r.ubicacion ? `${r.sede} › ${r.ubicacion}` : null,
      asignacion: r.asignacion_id
        ? {
            id: r.asignacion_id as string,
            tipo: r.tipo_asignacion as string,
            personaId: r.persona_id as string | null,
            responsable: (r.responsable ?? r.area_asignada) as string | null,
            hastaPrevisto: r.hasta_previsto as string | null,
          }
        : null,
      ordenAbierta: r.orden_id ? { id: r.orden_id as string, codigo: r.orden_codigo as string } : null,
      dispositivoId: r.dispositivo_id as string | null,
      ultimoReporte: ultimo,
      discrepanciasPendientes: discrepancias,
      sincronizacion,
    };
  }

  private async diasSinReporte(): Promise<number> {
    const [c] = await this.db.query(`SELECT dias_sin_reporte FROM [itam].[organizacion_config] WHERE id = 1`);
    return c?.dias_sin_reporte ?? 7;
  }

  historial(id: string) {
    return this.trazabilidad.historial('ACTIVO', id);
  }

  // ------------------------------------------------------------------ Operaciones

  async crear(actor: Actor, dto: CrearActivoDto, emExterno?: EntityManager) {
    return enTransaccion(this.db, emExterno, async (em) => {
      const tipo = await obtenerOFallar(em, TipoActivo, { id: dto.tipoActivoId }, 'Tipo de activo');
      const modeloId = dto.modeloId ?? (await this.modeloPorNombre(em, actor, tipo.id, dto.marcaNombre, dto.modeloNombre));
      if (dto.ubicacionId) await obtenerOFallar(em, Ubicacion, { id: dto.ubicacionId }, 'Ubicación');

      const activo = em.create(Activo, {
        codigoPatrimonial: dto.codigoPatrimonial || (await siguienteCodigo(em, 'activo')),
        nombre: dto.nombre,
        tipoActivoId: tipo.id,
        modeloId,
        numeroSerie: limpio(dto.numeroSerie),
        ubicacionId: dto.ubicacionId ?? null,
        cicloVida: 'EN_SERVICIO',
        estadoTecnico: dto.estadoTecnico ?? 'SIN_EVALUAR',
        fechaAdquisicion: dto.fechaAdquisicion ?? null,
        proveedor: limpio(dto.proveedor),
        numeroFactura: limpio(dto.numeroFactura),
        costo: dto.costo ?? null,
        especificaciones: dto.especificaciones ?? null,
        observaciones: limpio(dto.observaciones),
        fechaBaja: null,
        creadoPor: actor.id,
      });
      await em.save(activo);
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'ACTIVO',
        entidadId: activo.id,
        tipo: 'ALTA',
        descripcion: `Alta como ${tipo.nombre} ${activo.codigoPatrimonial}${dto.dispositivoId ? ' desde la detección de ScanGP' : ''}`,
      });
      if (dto.dispositivoId) await this.vincular(actor, activo.id, dto.dispositivoId, em);
      return activo;
    });
  }

  /** Busca o crea marca y modelo en el catálogo a partir de los nombres (p. ej. los que detectó ScanGP). */
  private async modeloPorNombre(em: EntityManager, actor: Actor, tipoActivoId: string, marcaNombre?: string | null, modeloNombre?: string | null) {
    if (!marcaNombre || !modeloNombre) return null;
    let marca = await em.findOneBy(Marca, { nombre: marcaNombre });
    if (!marca) marca = await em.save(em.create(Marca, { nombre: marcaNombre, activo: true, creadoPor: actor.id }));
    let modelo = await em.findOneBy(Modelo, { marcaId: marca.id, nombre: modeloNombre });
    if (!modelo) {
      modelo = await em.save(
        em.create(Modelo, { marcaId: marca.id, tipoActivoId, nombre: modeloNombre, especificaciones: null, activo: true, creadoPor: actor.id }),
      );
    }
    return modelo.id;
  }

  async editar(actor: Actor, id: string, dto: DatosActivoDto) {
    return this.db.transaction(async (em) => {
      const a = await obtenerOFallar(em, Activo, { id }, 'Activo');
      regla(a.cicloVida !== 'DADO_DE_BAJA', 'No se puede editar un activo dado de baja');
      if (dto.ubicacionId && !mismoId(dto.ubicacionId, a.ubicacionId)) {
        regla(false, 'Para cambiar la ubicación usa "Transferir ubicación" (queda en el historial)');
      }
      const antes = { ...a };
      const cambios = Object.entries(dto).filter(([k, v]) => v !== undefined && k !== 'ubicacionId');
      for (const [k, v] of cambios) (a as unknown as Record<string, unknown>)[k] = typeof v === 'string' ? limpio(v) : v;
      const modificados = cambios
        .filter(([k]) => JSON.stringify((antes as unknown as Record<string, unknown>)[k] ?? null) !== JSON.stringify((a as unknown as Record<string, unknown>)[k] ?? null))
        .map(([k]) => k);
      if (!modificados.length) return a;

      await em.save(a);
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'ACTIVO',
        entidadId: id,
        tipo: 'EDICION',
        descripcion: `Datos actualizados: ${modificados.join(', ')}`,
        detalle: Object.fromEntries(modificados.map((k) => [k, { antes: (antes as unknown as Record<string, unknown>)[k] ?? null, despues: (a as unknown as Record<string, unknown>)[k] ?? null }])),
      });
      await this.auditoria.registrar({ actor, accion: 'activos.editar', entidad: 'activo', entidadId: id, antes, despues: a }, em);
      return a;
    });
  }

  async cambiarEstadoTecnico(actor: Actor, id: string, dto: EstadoTecnicoDto, emExterno?: EntityManager, referencia?: { tipo: string; id: string }) {
    return enTransaccion(this.db, emExterno, async (em) => {
      const a = await obtenerOFallar(em, Activo, { id }, 'Activo');
      if (a.estadoTecnico === dto.estadoTecnico) return a;
      const anterior = a.estadoTecnico;
      a.estadoTecnico = dto.estadoTecnico;
      await em.save(a);
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'ACTIVO',
        entidadId: id,
        tipo: 'ESTADO_TECNICO',
        descripcion: `Estado técnico: ${etiqueta(anterior)} → ${etiqueta(dto.estadoTecnico)}`,
        observacion: dto.observacion,
        referencia,
      });
      return a;
    });
  }

  async cambiarCiclo(actor: Actor, id: string, dto: CicloDto) {
    return this.db.transaction(async (em) => {
      const a = await obtenerOFallar(em, Activo, { id }, 'Activo');
      regla(a.cicloVida !== 'DADO_DE_BAJA', 'El activo está dado de baja');
      if (a.cicloVida === dto.cicloVida) return a;
      const anterior = a.cicloVida;
      a.cicloVida = dto.cicloVida;
      await em.save(a);
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'ACTIVO',
        entidadId: id,
        tipo: 'CICLO_VIDA',
        motivo: dto.motivo ?? null,
        descripcion: `${etiqueta(anterior)} → ${etiqueta(dto.cicloVida)}${dto.motivo ? ` (${etiqueta(dto.motivo)})` : ''}`,
        observacion: dto.observacion,
      });
      return a;
    });
  }

  async transferirUbicacion(actor: Actor, id: string, ubicacionId: string | null, observacion?: string | null, emExterno?: EntityManager, referencia?: { tipo: string; id: string }) {
    return enTransaccion(this.db, emExterno, async (em) => {
      const a = await obtenerOFallar(em, Activo, { id }, 'Activo', ['ubicacion']);
      regla(a.cicloVida !== 'DADO_DE_BAJA', 'El activo está dado de baja');
      if (a.ubicacionId === ubicacionId || mismoId(a.ubicacionId, ubicacionId)) return a;
      const destino = ubicacionId ? await obtenerOFallar(em, Ubicacion, { id: ubicacionId }, 'Ubicación', ['sede']) : null;
      const origen = a.ubicacion ? a.ubicacion.nombre : 'sin ubicación';
      const origenId = a.ubicacionId;
      a.ubicacionId = ubicacionId;
      a.ubicacion = undefined;
      await em.save(a);
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'ACTIVO',
        entidadId: id,
        tipo: 'TRASLADO',
        descripcion: `Ubicación: ${origen} → ${destino ? `${destino.sede?.nombre} › ${destino.nombre}` : 'sin ubicación'}`,
        observacion,
        detalle: { desde: origenId, hacia: ubicacionId },
        referencia,
      });
      return a;
    });
  }

  async darDeBaja(actor: Actor, id: string, dto: BajaDto, emExterno?: EntityManager) {
    return enTransaccion(this.db, emExterno, async (em) => {
      const a = await obtenerOFallar(em, Activo, { id }, 'Activo');
      regla(a.cicloVida !== 'DADO_DE_BAJA', 'El activo ya está dado de baja');
      const [{ asignaciones, ordenes }] = await em.query(
        `SELECT (SELECT COUNT(*) FROM [itam].[asignacion] WHERE activo_id = @0 AND hasta IS NULL) AS asignaciones,
                (SELECT COUNT(*) FROM [itam].[orden_mantenimiento] WHERE activo_id = @0 AND estado IN ${ORDEN_ABIERTA}) AS ordenes`,
        [id],
      );
      regla(asignaciones === 0, 'Primero registra la devolución del activo (tiene una asignación vigente)');
      // Al cerrar una orden como irreparable, la propia orden ya está cerrada dentro de esta transacción.
      regla(ordenes === 0, 'Primero cierra o cancela la orden de mantenimiento abierta');
      a.cicloVida = 'DADO_DE_BAJA';
      a.fechaBaja = new Date();
      await em.save(a);
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'ACTIVO',
        entidadId: id,
        tipo: 'BAJA',
        motivo: dto.motivo,
        descripcion: `Dado de baja (${etiqueta(dto.motivo)})`,
        observacion: dto.observacion,
      });
      return a;
    });
  }

  async vincular(actor: Actor, activoId: string, dispositivoId: string, emExterno?: EntityManager, automatico = false) {
    return enTransaccion(this.db, emExterno, async (em) => {
      const d = await obtenerOFallar(em, DispositivoDetectado, { id: dispositivoId }, 'Equipo detectado');
      regla(!d.activoId || mismoId(d.activoId, activoId), 'Ese equipo detectado ya está vinculado a otro activo');
      if (mismoId(d.activoId, activoId)) return d;
      d.activoId = activoId;
      await em.save(d);
      await this.trazabilidad.registrar(em, automatico ? null : actor, {
        entidad: 'ACTIVO',
        entidadId: activoId,
        tipo: 'VINCULACION',
        descripcion: `Vinculado al equipo detectado ${d.nombreEquipo}${automatico ? ' (etiqueta de activo de la BIOS)' : ''}`,
        detalle: { dispositivoId },
      });
      return d;
    });
  }

  async desvincular(actor: Actor, activoId: string) {
    return this.db.transaction(async (em) => {
      const d = await em.findOneBy(DispositivoDetectado, { activoId });
      regla(!!d, 'El activo no está vinculado a ningún equipo detectado');
      d!.activoId = null;
      await em.save(d!);
      await this.trazabilidad.registrar(em, actor, {
        entidad: 'ACTIVO',
        entidadId: activoId,
        tipo: 'DESVINCULACION',
        descripcion: `Desvinculado del equipo detectado ${d!.nombreEquipo}`,
        detalle: { dispositivoId: d!.id },
      });
      return { ok: true };
    });
  }
}
