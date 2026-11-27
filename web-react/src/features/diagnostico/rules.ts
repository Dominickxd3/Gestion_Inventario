import type { Inventario } from '../../types/api';
import { peorEstado, type Comprobacion, type Estado } from '../../lib/estados';
import { diasDesde, plural } from '../../lib/formato';
import { UMBRALES as U } from './umbrales';

/** % libre de un volumen, o null si faltan datos. */
export function porcentajeLibre(v: { capacidadBytes?: number | null; libreBytes?: number | null }) {
  return v.capacidadBytes && v.libreBytes != null ? (v.libreBytes / v.capacidadBytes) * 100 : null;
}

function discos(inv: Inventario): Comprobacion {
  const base = { id: 'discos', titulo: 'Estado de los discos' };
  const lista = inv.discos ?? [];
  if (!inv.discos) return { ...base, estado: 'desconocido', detalle: 'ScanGP no pudo leer los discos.' };
  if (lista.length === 0) return { ...base, estado: 'desconocido', detalle: 'No se detectaron discos.' };
  const malos = lista.filter((d) => d.salud && d.salud !== 'Correcto');
  const sinDato = lista.filter((d) => !d.salud);
  if (malos.some((d) => d.salud === 'Dañado'))
    return { ...base, estado: 'problema', detalle: `Windows reporta daño en: ${malos.map((d) => d.modelo).join(', ')}.` };
  if (malos.length) return { ...base, estado: 'aviso', detalle: `Windows reporta advertencias en: ${malos.map((d) => d.modelo).join(', ')}.` };
  if (sinDato.length === lista.length) return { ...base, estado: 'desconocido', detalle: 'Windows no informó el estado de los discos.' };
  return { ...base, estado: 'ok', detalle: `${plural(lista.length - sinDato.length, 'disco', 'discos')} con estado "Correcto" según Windows.` };
}

function espacio(inv: Inventario): Comprobacion {
  const base = { id: 'espacio', titulo: 'Espacio libre' };
  const vols = (inv.volumenes ?? []).map((v) => ({ v, libre: porcentajeLibre(v) })).filter((x) => x.libre != null);
  if (vols.length === 0) return { ...base, estado: 'desconocido', detalle: 'No hay datos de volúmenes.' };
  const criticos = vols.filter((x) => x.libre! < U.espacioLibreProblema);
  const bajos = vols.filter((x) => x.libre! < U.espacioLibreAviso);
  const describir = (l: typeof vols) => l.map((x) => `${x.v.letra} (${Math.round(x.libre!)} % libre)`).join(', ');
  if (criticos.length) return { ...base, estado: 'problema', detalle: `Casi sin espacio: ${describir(criticos)}.` };
  if (bajos.length) return { ...base, estado: 'aviso', detalle: `Poco espacio: ${describir(bajos)}.` };
  return { ...base, estado: 'ok', detalle: `Todos los volúmenes tienen más de ${U.espacioLibreAviso} % libre.` };
}

function bateria(inv: Inventario): Comprobacion {
  const base = { id: 'bateria', titulo: 'Batería' };
  const b = inv.bateria;
  if (!b) return { ...base, estado: 'na', detalle: 'El equipo no tiene batería.' };
  const s = b.saludPorcentaje;
  if (s == null) return { ...base, estado: 'desconocido', detalle: 'La salud de la batería requiere ejecutar ScanGP como administrador.' };
  if (s < U.bateriaProblema) return { ...base, estado: 'problema', detalle: `Conserva el ${s} % de su capacidad original.` };
  if (s < U.bateriaAviso) return { ...base, estado: 'aviso', detalle: `Conserva el ${s} % de su capacidad original.` };
  return { ...base, estado: 'ok', detalle: `Conserva el ${s} % de su capacidad original.` };
}

function antivirus(inv: Inventario): Comprobacion {
  const base = { id: 'antivirus', titulo: 'Antivirus' };
  if (!inv.antivirus) return { ...base, estado: 'desconocido', detalle: 'ScanGP no pudo consultar el Centro de seguridad de Windows.' };
  const activos = inv.antivirus.filter((a) => a.activo);
  if (activos.length === 0) return { ...base, estado: 'problema', detalle: 'No hay ningún antivirus activo.' };
  const alDia = activos.filter((a) => a.actualizado);
  if (alDia.length === 0) return { ...base, estado: 'aviso', detalle: `${activos[0].nombre} está activo pero sus firmas no están actualizadas.` };
  return { ...base, estado: 'ok', detalle: `${alDia.map((a) => a.nombre).join(', ')} activo y actualizado.` };
}

function encendido(inv: Inventario, ahora: number): Comprobacion {
  const base = { id: 'encendido', titulo: 'Tiempo encendido' };
  const dias = diasDesde(inv.sistemaOperativo?.ultimoArranque, Date.parse(inv.fechaRecoleccion) || ahora);
  if (dias == null) return { ...base, estado: 'desconocido', detalle: 'No se conoce el último arranque.' };
  const texto = dias === 0 ? 'Reiniciado el mismo día del análisis.' : `Sin reiniciar desde hace ${plural(dias, 'día', 'días')} al momento del análisis.`;
  return { ...base, estado: dias > U.diasEncendidoAviso ? 'aviso' : 'ok', detalle: texto };
}

function lectura(inv: Inventario): Comprobacion {
  const base = { id: 'lectura', titulo: 'Lectura del detector' };
  const adv = inv.advertencias ?? [];
  if (adv.length === 0) return { ...base, estado: 'ok', detalle: 'Todas las secciones se leyeron correctamente.' };
  const secciones = adv.map((a) => a.split(':')[0]).join(', ');
  return { ...base, estado: 'aviso', detalle: `No se pudieron leer: ${secciones}.` };
}

/** Diagnóstico a partir del último reporte. No ejecuta pruebas activas en el equipo. */
export function diagnosticar(inv: Inventario, ahora = Date.now()): Comprobacion[] {
  return [discos(inv), espacio(inv), bateria(inv), antivirus(inv), encendido(inv, ahora), lectura(inv)];
}

export interface ResumenDiagnostico {
  estado: Estado;
  correctos: number;
  avisos: number;
  problemas: number;
  /** La comprobación más grave, para mostrar en listas. */
  principal: Comprobacion | null;
}

export function resumirDiagnostico(comprobaciones: Comprobacion[]): ResumenDiagnostico {
  const estado = peorEstado(comprobaciones.map((c) => c.estado));
  return {
    estado,
    correctos: comprobaciones.filter((c) => c.estado === 'ok').length,
    avisos: comprobaciones.filter((c) => c.estado === 'aviso').length,
    problemas: comprobaciones.filter((c) => c.estado === 'problema').length,
    principal: comprobaciones.find((c) => c.estado === 'problema') ?? comprobaciones.find((c) => c.estado === 'aviso') ?? null,
  };
}
