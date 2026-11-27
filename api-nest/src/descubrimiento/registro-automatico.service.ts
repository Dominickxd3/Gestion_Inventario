import { Injectable } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { Activo } from '../activos/activo.entity';
import { ActivosService } from '../activos/activos.service';
import { TipoActivo, TipoComponente } from '../catalogo/catalogo.entities';
import { Actor, mismoId } from '../common/dominio';
import { serieValida } from '../common/identificacion';
import { Componente, Instalacion } from '../componentes/componentes.entities';
import { ComponentesService } from '../componentes/componentes.service';
import { componentesDetectados, type ComponenteDetectado } from './componentes-detectados';
import { DispositivoDetectado } from './descubrimiento.entities';
import type { InventarioPayload, ResumenEquipo } from './inventario.types';

const SCANGP: Actor = { id: null, nombreUsuario: 'ScanGP', ip: null };
export const registroAutomaticoActivo = () => process.env.SCANGP_REGISTRO_AUTOMATICO !== 'false';

/** Solo una lectura válida de la sección puede demostrar que la pieza ya no está. */
export function ausenciaConfirmada(p: InventarioPayload, tipo: ComponenteDetectado['tipo'], huella: string): boolean {
  const seccion = tipo === 'DISCO' ? p.discos : tipo === 'RAM' ? p.memoria?.modulos : p.monitores;
  return Array.isArray(seccion) && !componentesDetectados(p).some((c) => c.huella === huella);
}

/** Alta idempotente y despiece, dentro de la misma transacción del escaneo. */
@Injectable()
export class RegistroAutomaticoService {
  constructor(private readonly activos: ActivosService, private readonly componentes: ComponentesService) {}

  async sincronizar(em: EntityManager, d: DispositivoDetectado, p: InventarioPayload, resumen: ResumenEquipo, soloAltas = false) {
    if (!d.activoId) {
      // Reutilizar un activo administrativo preexistente si la serie es inequívoca.
      const candidatos = serieValida(p.equipo.numeroSerie)
        ? await em.findBy(Activo, { numeroSerie: p.equipo.numeroSerie.trim() }) : [];
      if (candidatos.length > 1) return;
      if (candidatos.length === 1) {
        const a = candidatos[0];
        if (a.cicloVida === 'DADO_DE_BAJA' || await em.existsBy(DispositivoDetectado, { activoId: a.id })) return;
        await this.activos.vincular(SCANGP, a.id, d.id, em);
        d.activoId = a.id;
      } else {
        const tipo = await em.findOneBy(TipoActivo, { codigo: p.equipo.tipo ?? 'OTRO' })
          ?? await em.findOneByOrFail(TipoActivo, { codigo: 'OTRO' });
        const a = await this.activos.crear(SCANGP, {
          nombre: p.equipo.nombreEquipo.trim().slice(0, 128), tipoActivoId: tipo.id, dispositivoId: d.id,
          marcaNombre: p.equipo.fabricante?.replace(/\s+(Inc\.?|Corporation|Corp\.?)$/i, '').trim().slice(0, 80),
          modeloNombre: p.equipo.modelo?.slice(0, 120),
          numeroSerie: serieValida(p.equipo.numeroSerie) ? p.equipo.numeroSerie.trim().slice(0, 80) : null,
          estadoTecnico: 'SIN_EVALUAR',
          especificaciones: {
            procesador: resumen.procesador, nucleos: resumen.nucleos, ramGB: resumen.ramGB,
            almacenamiento: resumen.discos, graficos: resumen.gpu, sistemaOperativo: resumen.sistemaOperativo,
          },
          observaciones: 'Registrado automáticamente desde ScanGP. Pendiente de completar responsable y ubicación.',
        }, em);
        d.activoId = a.id;
      }
    }
    const activo = await em.findOneByOrFail(Activo, { id: d.activoId });
    if (activo.cicloVida === 'DADO_DE_BAJA') return;
    const vistos = new Set<string>();
    for (const det of componentesDetectados(p)) {
      if (!det.huella || det.integrado || vistos.has(det.huella) || (det.numeroSerie?.length ?? 0) > 120) continue;
      vistos.add(det.huella);
      let c = await em.findOneBy(Componente, { huella: det.huella });
      if (!c) {
        const tipo = await em.findOneByOrFail(TipoComponente, { codigo: det.tipo });
        c = await this.componentes.crear(SCANGP, {
          tipoComponenteId: tipo.id, marca: det.marca?.slice(0, 80), modelo: det.modelo?.slice(0, 160),
          numeroSerie: det.numeroSerie, capacidad: det.capacidad, activoId: activo.id,
          estadoTecnico: 'SIN_EVALUAR', motivo: 'ACTUALIZACION', observaciones: 'Registrado automáticamente desde ScanGP',
        }, em);
      } else {
        if (soloAltas) continue;
        if (c.situacion === 'DADO_DE_BAJA' || c.situacion === 'EN_MANTENIMIENTO') continue;
        const inst = await em.findOneBy(Instalacion, { componenteId: c.id, hasta: IsNull() });
        if (inst && !mismoId(inst.activoId, activo.id)) {
          const origen = await em.findOneBy(DispositivoDetectado, { activoId: inst.activoId });
          // Si dos equipos afirman tener la misma pieza, la discrepancia requiere revisión.
          if (!origen?.ultimoInventario || (inst.desde && origen.ultimoReporte < inst.desde) || !ausenciaConfirmada(origen.ultimoInventario as InventarioPayload, det.tipo, det.huella)) continue;
          await this.componentes.trasladar(SCANGP, c.id, activo.id,
            'Traslado detectado por ScanGP: ausente del último escaneo de origen y presente en el destino.', em);
        } else if (!inst) {
          await this.componentes.instalar(SCANGP, c.id, { activoId: activo.id, motivo: 'ACTUALIZACION', observacion: 'Detectado automáticamente por ScanGP' }, em);
        }
      }
      // La propia lectura que originó el alta confirma la instalación.
      await em.update(Instalacion, { componenteId: c.id, activoId: activo.id, hasta: IsNull(), confirmadaEn: IsNull() }, { confirmadaEn: d.ultimoReporte });
    }
  }
}
