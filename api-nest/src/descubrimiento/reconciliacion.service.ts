import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { Activo } from '../activos/activo.entity';
import { Asignacion } from '../asignaciones/asignacion.entity';
import { TipoComponente } from '../catalogo/catalogo.entities';
import { Actor, obtenerOFallar, regla } from '../common/dominio';
import { serieValida } from '../common/identificacion';
import { DESTINOS_RETIRO, type DestinoRetiro } from '../componentes/componentes.dto';
import { Componente, Instalacion } from '../componentes/componentes.entities';
import { ComponentesService } from '../componentes/componentes.service';
import { MOTIVOS, type Motivo } from '../mantenimiento/orden-mantenimiento.entity';
import { Persona } from '../organizacion/organizacion.entities';
import { TrazabilidadService } from '../trazabilidad/trazabilidad.service';
import { componentesDetectados, TIPOS_CON_AUSENCIA, type ComponenteDetectado } from './componentes-detectados';
import { Discrepancia, type TipoDiscrepancia } from './descubrimiento.entities';
import type { InventarioPayload } from './inventario.types';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class AceptarDiscrepanciaDto {
  /** Solo para COMPONENTE_AUSENTE: a dónde va el componente que ya no está en el equipo. */
  @IsOptional() @IsIn(DESTINOS_RETIRO) destino?: DestinoRetiro;
  @IsOptional() @IsUUID() ubicacionId?: string | null;
  @IsOptional() @IsIn(MOTIVOS) motivo?: Motivo;
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(1000) observacion?: string | null;
}

export class RechazarDiscrepanciaDto {
  @Transform(recortar) @IsString() @MinLength(3, { message: 'Explica por qué se rechaza' }) @MaxLength(1000) motivo: string;
}

const normalizarUsuario = (u: string) => u.trim().toLowerCase();
const mismoUsuario = (a: string, b: string) => {
  const x = normalizarUsuario(a);
  const y = normalizarUsuario(b);
  return x === y || x.split('\\').pop() === y.split('\\').pop();
};

/**
 * Compara lo que detecta ScanGP con el inventario validado. Nunca cambia el inventario:
 * confirma instalaciones, crea discrepancias pendientes y cierra solas las que dejaron de aplicar.
 */
@Injectable()
export class ReconciliacionService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly componentes: ComponentesService,
    private readonly trazabilidad: TrazabilidadService,
  ) {}

  async reconciliar(activoId: string, dispositivoId: string, escaneoId: string, p: InventarioPayload) {
    await this.db.transaction(async (em) => {
      const activo = await em.findOneBy(Activo, { id: activoId });
      if (!activo || activo.cicloVida === 'DADO_DE_BAJA') return;
      const ahora = new Date();

      const detectados = componentesDetectados(p).filter((c): c is ComponenteDetectado & { huella: string } => !!c.huella);
      const huellasDetectadas = new Set(detectados.map((d) => d.huella));
      const instalados = await em.find(Instalacion, { where: { activoId, hasta: IsNull() }, relations: { componente: { tipoComponente: true } } });
      const pendientes = await em.findBy(Discrepancia, { activoId, estado: 'PENDIENTE' });
      const rechazadas = new Set(
        (await em.findBy(Discrepancia, { activoId, estado: 'RECHAZADA' })).map((d) => `${d.tipo}|${d.clave}`),
      );

      const abrir = async (tipo: TipoDiscrepancia, clave: string, descripcion: string, detalle: Record<string, unknown>) => {
        if (pendientes.some((d) => d.tipo === tipo && d.clave === clave) || rechazadas.has(`${tipo}|${clave}`)) return;
        const d = em.create(Discrepancia, { activoId, dispositivoId, escaneoId, tipo, clave, descripcion, detalle, estado: 'PENDIENTE', resueltaEn: null, resueltaPor: null, resolucion: null, creadoPor: null });
        await em.save(d);
        pendientes.push(d);
      };
      const cerrarSolas = async (filtro: (d: Discrepancia) => boolean, motivo: string) => {
        for (const d of pendientes.filter((x) => x.estado === 'PENDIENTE' && filtro(x))) {
          d.estado = 'RESUELTA_AUTO';
          d.resueltaEn = ahora;
          d.resueltaPor = 'ScanGP';
          d.resolucion = motivo;
          await em.save(d);
        }
      };

      // 1) Componentes que ScanGP ve en el equipo.
      for (const det of detectados) {
        const inst = instalados.find((i) => i.componente?.huella === det.huella);
        if (inst) {
          if (!inst.confirmadaEn) {
            await em.update(Instalacion, inst.id, { confirmadaEn: ahora });
            await this.trazabilidad.registrar(em, null, {
              entidad: 'COMPONENTE', entidadId: inst.componenteId, tipo: 'CONFIRMACION',
              descripcion: `ScanGP confirmó que está instalado en ${activo.codigoPatrimonial}`, referencia: { tipo: 'ACTIVO', id: activoId },
            });
          }
          await cerrarSolas((d) => d.clave === det.huella, 'ScanGP lo detecta instalado en el equipo');
          continue;
        }
        const comp = await em.findOneBy(Componente, { huella: det.huella });
        const enOtro = comp?.situacion === 'INSTALADO'
          ? await em.findOne(Instalacion, { where: { componenteId: comp.id, hasta: IsNull() }, relations: { activo: true } })
          : null;
        const nombre = `${det.tipo === 'DISCO' ? 'Disco' : det.tipo === 'RAM' ? 'Memoria' : 'Monitor'} ${[det.modelo, det.capacidad].filter(Boolean).join(' ')} (serie ${det.numeroSerie})`;
        if (enOtro) {
          await abrir('COMPONENTE_MOVIDO', det.huella, `${nombre}: registrado en ${enOtro.activo!.codigoPatrimonial}, pero ScanGP lo ve en este equipo`, {
            componenteId: comp!.id, codigo: comp!.codigo, desdeActivoId: enOtro.activoId, desdeCodigo: enOtro.activo!.codigoPatrimonial, detectado: det,
          });
        } else {
          await abrir('COMPONENTE_NUEVO', det.huella, comp ? `${nombre}: está como ${comp.situacion === 'EN_ALMACEN' ? 'en almacén' : comp.situacion.toLowerCase()} (${comp.codigo}), pero ScanGP lo ve en este equipo` : `${nombre}: no registrado en el inventario`, {
            componenteId: comp?.id ?? null, codigo: comp?.codigo ?? null, situacion: comp?.situacion ?? null, detectado: det,
          });
        }
      }
      // Lo que ya no se detecta deja de ser "nuevo" o "movido".
      await cerrarSolas((d) => (d.tipo === 'COMPONENTE_NUEVO' || d.tipo === 'COMPONENTE_MOVIDO') && !huellasDetectadas.has(d.clave), 'ScanGP ya no lo detecta en el equipo');

      // 2) Componentes registrados que ScanGP ya no ve.
      for (const i of instalados) {
        const c = i.componente!;
        if (!c.huella || !TIPOS_CON_AUSENCIA.has(c.tipoComponente!.codigo) || huellasDetectadas.has(c.huella)) continue;
        await abrir('COMPONENTE_AUSENTE', c.huella, `${c.tipoComponente!.nombre} ${c.codigo} (${[c.modelo, c.capacidad].filter(Boolean).join(' ')}, serie ${c.numeroSerie}) está registrado en el equipo, pero ScanGP no lo detecta`, {
          componenteId: c.id, codigo: c.codigo,
        });
      }
      const instaladasAhora = new Set(instalados.map((i) => i.componente?.huella).filter(Boolean));
      await cerrarSolas((d) => d.tipo === 'COMPONENTE_AUSENTE' && !instaladasAhora.has(d.clave), 'El componente ya se retiró del equipo en el inventario');

      // 3) Número de serie del equipo.
      const serie = p.equipo.numeroSerie;
      if (serieValida(serie) && activo.numeroSerie?.trim().toUpperCase() !== serie.trim().toUpperCase()) {
        await abrir('ATRIBUTO_DIFERENTE', `SERIE:${serie.trim().toUpperCase()}`, activo.numeroSerie
          ? `Número de serie: registrado ${activo.numeroSerie}, ScanGP detecta ${serie}`
          : `El activo no tiene número de serie registrado; ScanGP detecta ${serie}`, { campo: 'numeroSerie', registrado: activo.numeroSerie, detectado: serie.trim() });
      }
      await cerrarSolas((d) => d.tipo === 'ATRIBUTO_DIFERENTE' && d.clave.startsWith('SERIE:') && activo.numeroSerie?.trim().toUpperCase() === d.clave.slice(6), 'El número de serie ya coincide');

      // 4) ¿Lo usa la persona a la que está asignado?
      const usuario = p.equipo.usuario;
      const asignacion = await em.findOne(Asignacion, { where: { activoId, hasta: IsNull() }, relations: { persona: true } });
      const esperado = asignacion?.persona?.usuarioWindows;
      if (usuario && esperado && !mismoUsuario(usuario, esperado)) {
        const quien = await em.findOneBy(Persona, { usuarioWindows: usuario.trim() });
        await abrir('USUARIO_DISTINTO', `USUARIO:${normalizarUsuario(usuario)}`, `Asignado a ${asignacion!.persona!.nombre} (${esperado}), pero la sesión abierta es de ${usuario}${quien ? ` (${quien.nombre})` : ''}`, {
          esperado, detectado: usuario, personaAsignada: asignacion!.persona!.nombre, personaDetectada: quien?.nombre ?? null,
        });
      }
    });
  }

  // ------------------------------------------------------------------ Bandeja

  listar(estado = 'PENDIENTE', activoId?: string) {
    return this.db.query(
      `SELECT d.id, d.tipo, d.clave, d.descripcion, d.detalle, d.estado, d.creado_en AS creadoEn, d.resuelta_en AS resueltaEn,
              d.resuelta_por AS resueltaPor, d.resolucion, d.dispositivo_id AS dispositivoId,
              a.id AS activoId, a.codigo_patrimonial AS activoCodigo, a.nombre AS activoNombre
       FROM [itam].[discrepancia] d JOIN [itam].[activo] a ON a.id = d.activo_id
       WHERE ${estado === 'TODAS' ? '1 = 1' : 'd.estado = @0'} ${activoId ? 'AND d.activo_id = @1' : ''}
       ORDER BY d.creado_en DESC`,
      [estado, activoId ?? null],
    ).then((filas: Record<string, unknown>[]) => filas.map((f) => ({ ...f, detalle: f.detalle ? JSON.parse(f.detalle as string) : null })));
  }

  /** Acepta lo detectado: ejecuta la operación de inventario que corresponde, en una transacción. */
  async aceptar(actor: Actor, id: string, dto: AceptarDiscrepanciaDto) {
    return this.db.transaction(async (em) => {
      const d = await obtenerOFallar(em, Discrepancia, { id }, 'Discrepancia');
      regla(d.estado === 'PENDIENTE', 'La discrepancia ya fue resuelta');
      const det = d.detalle as Record<string, unknown> & { componenteId?: string; detectado?: ComponenteDetectado };
      const obs = dto.observacion ?? `Discrepancia aceptada: ${d.descripcion}`;
      let resolucion: string;

      switch (d.tipo) {
        case 'COMPONENTE_NUEVO': {
          if (det.componenteId) {
            const c = await obtenerOFallar(em, Componente, { id: det.componenteId }, 'Componente');
            regla(c.situacion !== 'EN_MANTENIMIENTO', 'El componente figura en mantenimiento: reingrésalo antes de instalarlo');
            regla(c.situacion !== 'DADO_DE_BAJA', 'El componente figura dado de baja');
            await this.componentes.instalar(actor, c.id, { activoId: d.activoId, motivo: dto.motivo ?? 'ACTUALIZACION', observacion: obs }, em);
            resolucion = `Instalado ${c.codigo} en el equipo`;
          } else {
            const x = det.detectado!;
            const tipo = await obtenerOFallar(em, TipoComponente, { codigo: x.tipo }, 'Tipo de componente');
            const c = await this.componentes.crear(actor, {
              tipoComponenteId: tipo.id, marca: x.marca, modelo: x.modelo, numeroSerie: x.numeroSerie, capacidad: x.capacidad,
              activoId: d.activoId, motivo: dto.motivo ?? 'ACTUALIZACION', observaciones: 'Registrado desde la detección de ScanGP',
            }, em);
            resolucion = `Registrado como ${c.codigo} e instalado en el equipo`;
          }
          break;
        }
        case 'COMPONENTE_MOVIDO':
          await this.componentes.trasladar(actor, det.componenteId!, d.activoId, obs, em);
          resolucion = `Trasladado desde ${String(det.desdeCodigo)}`;
          break;
        case 'COMPONENTE_AUSENTE':
          regla(!!dto.destino, 'Indica a dónde fue el componente (almacén, mantenimiento o baja)');
          await this.componentes.retirar(actor, det.componenteId!, { destino: dto.destino!, ubicacionId: dto.ubicacionId, motivo: dto.motivo ?? 'OTRO', observacion: obs }, em);
          resolucion = `Retirado del equipo → ${dto.destino}`;
          break;
        case 'ATRIBUTO_DIFERENTE': {
          const a = await obtenerOFallar(em, Activo, { id: d.activoId }, 'Activo');
          const anterior = a.numeroSerie;
          a.numeroSerie = String(det.detectado);
          await em.save(a);
          await this.trazabilidad.registrar(em, actor, {
            entidad: 'ACTIVO', entidadId: a.id, tipo: 'EDICION', descripcion: `Número de serie: ${anterior ?? 'vacío'} → ${a.numeroSerie} (según ScanGP)`,
            referencia: { tipo: 'DISCREPANCIA', id: d.id },
          });
          resolucion = 'Número de serie actualizado';
          break;
        }
        default:
          resolucion = 'Revisado';
      }

      d.estado = 'ACEPTADA';
      d.resueltaEn = new Date();
      d.resueltaPor = actor.nombreUsuario;
      d.resolucion = dto.observacion ? `${resolucion}. ${dto.observacion}` : resolucion;
      return em.save(d);
    });
  }

  async rechazar(actor: Actor, id: string, dto: RechazarDiscrepanciaDto, em?: EntityManager) {
    const repo = (em ?? this.db.manager).getRepository(Discrepancia);
    const d = await repo.findOneBy({ id });
    regla(!!d, 'Discrepancia no encontrada');
    regla(d!.estado === 'PENDIENTE', 'La discrepancia ya fue resuelta');
    d!.estado = 'RECHAZADA';
    d!.resueltaEn = new Date();
    d!.resueltaPor = actor.nombreUsuario;
    d!.resolucion = dto.motivo;
    return repo.save(d!);
  }
}
