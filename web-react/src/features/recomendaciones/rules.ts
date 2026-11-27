import type { Inventario } from '../../types/api';
import { espacio, memoria as fmtMemoria, plural } from '../../lib/formato';
import { porcentajeLibre } from '../diagnostico/rules';
import { UMBRALES as U } from '../diagnostico/umbrales';

export type Prioridad = 'alta' | 'media' | 'baja';

export interface Recomendacion {
  id: string;
  prioridad: Prioridad;
  titulo: string;
  detalle: string;
  /** Dato real en el que se basa la recomendación. */
  basadoEn: string;
}

const ORDEN: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 };
const GIB = 1024 ** 3;

/** Recomendaciones de actualización a partir del inventario real. */
export function recomendar(inv: Inventario, ahora = Date.now()): Recomendacion[] {
  const r: Recomendacion[] = [];

  for (const v of inv.volumenes ?? []) {
    const libre = porcentajeLibre(v);
    if (libre != null && libre < U.espacioLibreAviso) {
      r.push({
        id: `espacio-${v.letra}`,
        prioridad: 'alta',
        titulo: `Liberar espacio en la unidad ${v.letra}`,
        detalle: `Quedan ${espacio(v.libreBytes)} libres (${Math.round(libre)} %). Con poco espacio Windows se vuelve lento y puede fallar al actualizarse.`,
        basadoEn: 'Almacenamiento › volúmenes',
      });
    }
  }

  const antivirusActivo = inv.antivirus?.some((a) => a.activo);
  if (inv.antivirus && !antivirusActivo) {
    r.push({
      id: 'antivirus',
      prioridad: 'alta',
      titulo: 'Activar un antivirus',
      detalle: 'No se detectó ningún antivirus activo en el equipo.',
      basadoEn: 'Información general › antivirus',
    });
  }

  const ram = inv.memoria?.instaladaBytes;
  if (ram && ram < U.memoriaMinimaGB * GIB) {
    const libres = (inv.memoria?.ranurasTotales ?? 0) - (inv.memoria?.ranurasUsadas ?? 0);
    r.push({
      id: 'ram',
      prioridad: 'alta',
      titulo: 'Ampliar la memoria RAM',
      detalle:
        `Tiene ${fmtMemoria(ram)}; se recomiendan al menos ${U.memoriaMinimaGB} GB. ` +
        (inv.memoria?.ranurasTotales == null
          ? 'No se pudo determinar si hay ranuras libres.'
          : libres > 0
            ? `Hay ${plural(libres, 'ranura libre', 'ranuras libres')}.`
            : 'Todas las ranuras están ocupadas: habría que reemplazar módulos.'),
      basadoEn: 'Memoria › capacidad instalada y ranuras',
    });
  }

  for (const d of inv.discos ?? []) {
    if (d.tipo === 'HDD' && !d.externo) {
      r.push({
        id: `hdd-${d.numeroSerie ?? d.modelo}`,
        prioridad: 'media',
        titulo: 'Reemplazar el disco mecánico por un SSD',
        detalle: `El disco "${d.modelo ?? 'sin modelo'}" es un disco duro mecánico (HDD). Un SSD reduce notablemente los tiempos de arranque y de carga.`,
        basadoEn: 'Almacenamiento › tipo de disco',
      });
    }
  }

  const salud = inv.bateria?.saludPorcentaje;
  if (salud != null && salud < U.bateriaAviso) {
    r.push({
      id: 'bateria',
      prioridad: 'media',
      titulo: 'Reemplazar la batería',
      detalle: `Conserva el ${salud} % de su capacidad original, por lo que la autonomía es menor.`,
      basadoEn: 'Batería › capacidad de diseño y actual',
    });
  }

  if (/windows 10/i.test(inv.sistemaOperativo?.nombre ?? '')) {
    r.push({
      id: 'windows10',
      prioridad: 'media',
      titulo: 'Planificar la migración a Windows 11',
      detalle: 'Windows 10 dejó de recibir soporte gratuito de Microsoft el 14 de octubre de 2025.',
      basadoEn: 'Información general › sistema operativo',
    });
  }

  const fechaBios = Date.parse(inv.bios?.fecha ?? '');
  if (!Number.isNaN(fechaBios) && (ahora - fechaBios) / (365.25 * 86_400_000) > U.aniosBiosRevisar) {
    r.push({
      id: 'bios',
      prioridad: 'baja',
      titulo: 'Revisar actualizaciones de BIOS',
      detalle: `La BIOS es de ${new Date(fechaBios).getFullYear()}. Consulte el sitio del fabricante de la placa por versiones más recientes.`,
      basadoEn: 'Placa madre y BIOS › fecha de la BIOS',
    });
  }

  return r.sort((a, b) => ORDEN[a.prioridad] - ORDEN[b.prioridad]);
}
