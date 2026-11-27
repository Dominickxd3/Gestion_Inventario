import { infoTipo } from '../../lib/tipoEquipo';
import { Icon } from './Icon';

/** Icono del tipo de equipo. Sin color propio: el tipo se distingue por forma y nombre. */
export function DeviceTypeIcon({ tipo, tamano = 16 }: { tipo: string | null | undefined; tamano?: 16 | 20 | 24 }) {
  const t = infoTipo(tipo);
  return <Icon icono={t.icono} tamano={tamano} etiqueta={t.etiqueta} className="icono-tipo" />;
}
