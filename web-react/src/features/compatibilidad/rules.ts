import type { Inventario } from '../../types/api';
import type { Comprobacion } from '../../lib/estados';
import { plural, unir } from '../../lib/formato';

export interface GrupoCompatibilidad {
  id: string;
  titulo: string;
  comprobaciones: Comprobacion[];
}

const distintos = <T,>(l: T[]) => [...new Set(l.filter((x) => x != null && x !== ''))];

function memoria(inv: Inventario): Comprobacion[] {
  const m = inv.memoria;
  const modulos = m?.modulos ?? [];
  const tipos = distintos(modulos.map((x) => x.tipo));
  const formatos = distintos(modulos.map((x) => x.formato));
  const velocidades = distintos(modulos.map((x) => x.velocidadMHz));
  const r: Comprobacion[] = [];

  if (tipos.length === 1) {
    r.push({
      id: 'ram-tipo',
      titulo: 'Tipo de memoria',
      estado: 'ok',
      detalle: `Admite módulos ${unir([tipos[0], formatos.length === 1 && `en formato ${formatos[0]}`])}${formatos[0] === 'SODIMM' ? ' (portátil)' : formatos[0] === 'DIMM' ? ' (escritorio)' : ''}.`,
    });
  } else if (tipos.length > 1) {
    r.push({ id: 'ram-tipo', titulo: 'Tipo de memoria', estado: 'aviso', detalle: `Se detectaron tipos distintos (${tipos.join(', ')}).` });
  } else {
    r.push({ id: 'ram-tipo', titulo: 'Tipo de memoria', estado: 'desconocido', detalle: 'Los módulos no informan su tipo (habitual en memoria soldada).' });
  }

  if (m?.ranurasTotales != null && m.ranurasUsadas != null) {
    const libres = m.ranurasTotales - m.ranurasUsadas;
    r.push({
      id: 'ram-ranuras',
      titulo: 'Ranuras libres',
      estado: libres > 0 ? 'ok' : 'aviso',
      detalle:
        libres > 0
          ? `${libres} de ${m.ranurasTotales} disponibles para ampliar.`
          : `Las ${m.ranurasTotales} ranuras están ocupadas; para ampliar hay que reemplazar módulos.`,
    });
  } else {
    r.push({ id: 'ram-ranuras', titulo: 'Ranuras libres', estado: 'desconocido', detalle: 'La placa no informa el número de ranuras.' });
  }

  if (velocidades.length > 1) {
    r.push({
      id: 'ram-velocidad',
      titulo: 'Velocidad',
      estado: 'aviso',
      detalle: `Módulos a distinta velocidad (${velocidades.join(', ')} MHz); todos funcionan a la más baja.`,
    });
  } else if (velocidades.length === 1) {
    r.push({ id: 'ram-velocidad', titulo: 'Velocidad', estado: 'ok', detalle: `Todos los módulos funcionan a ${velocidades[0]} MHz.` });
  }

  r.push({
    id: 'ram-maxima',
    titulo: 'Capacidad máxima',
    estado: 'desconocido',
    detalle: 'No disponible: esta versión de ScanGP no reporta el límite de la placa.',
  });
  return r;
}

function almacenamiento(inv: Inventario): Comprobacion[] {
  const internos = (inv.discos ?? []).filter((d) => !d.externo);
  const interfaces = distintos(internos.map((d) => d.interfaz));
  return [
    interfaces.length
      ? {
          id: 'disco-interfaces',
          titulo: 'Interfaces en uso',
          estado: 'ok',
          detalle: `${interfaces.join(' y ')} (${plural(internos.length, 'disco interno', 'discos internos')}).`,
        }
      : { id: 'disco-interfaces', titulo: 'Interfaces en uso', estado: 'desconocido', detalle: 'Los discos no informan su interfaz.' },
    {
      id: 'disco-m2',
      titulo: 'Ranuras M.2 libres',
      estado: 'desconocido',
      detalle: 'No disponible: Windows no informa las ranuras M.2 vacías.',
    },
  ];
}

const SOCKET_GENERICO = /^(cpu|socket|proc|u\d|fp\d|bga|\d+$)/i;

function procesador(inv: Inventario): Comprobacion[] {
  const cpu = inv.procesadores?.[0];
  const socket = cpu?.socket?.trim();
  if (!socket || SOCKET_GENERICO.test(socket)) {
    return [
      {
        id: 'cpu-socket',
        titulo: 'Socket',
        estado: 'desconocido',
        detalle: 'El fabricante no informa un socket estándar (habitual en procesadores soldados de laptops y All-in-One).',
      },
    ];
  }
  return [{ id: 'cpu-socket', titulo: 'Socket', estado: 'ok', detalle: `${socket}: solo admite procesadores del mismo socket y chipset compatible.` }];
}

function sistema(inv: Inventario): Comprobacion[] {
  const modo = inv.bios?.modoArranque;
  const r: Comprobacion[] = [
    modo === 'UEFI'
      ? { id: 'uefi', titulo: 'Arranque UEFI', estado: 'ok', detalle: 'Cumple el requisito de arranque de Windows 11.' }
      : modo
        ? { id: 'uefi', titulo: 'Arranque UEFI', estado: 'aviso', detalle: 'El equipo arranca en modo heredado (Legacy); Windows 11 requiere UEFI.' }
        : { id: 'uefi', titulo: 'Arranque UEFI', estado: 'desconocido', detalle: 'No se pudo determinar el modo de arranque.' },
  ];
  const arq = inv.sistemaOperativo?.arquitectura;
  if (arq) {
    r.push({
      id: 'arquitectura',
      titulo: 'Arquitectura',
      estado: /64/.test(arq) ? 'ok' : 'aviso',
      detalle: /64/.test(arq) ? 'Sistema de 64 bits.' : 'Sistema de 32 bits: limita la memoria utilizable a unos 4 GB.',
    });
  }
  return r;
}

/** Compatibilidad calculada a partir de los componentes detectados. */
export function evaluarCompatibilidad(inv: Inventario): GrupoCompatibilidad[] {
  return [
    { id: 'memoria', titulo: 'Memoria', comprobaciones: memoria(inv) },
    { id: 'almacenamiento', titulo: 'Almacenamiento', comprobaciones: almacenamiento(inv) },
    { id: 'procesador', titulo: 'Procesador', comprobaciones: procesador(inv) },
    { id: 'sistema', titulo: 'Sistema', comprobaciones: sistema(inv) },
  ];
}
