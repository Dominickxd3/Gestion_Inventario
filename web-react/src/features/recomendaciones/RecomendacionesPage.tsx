import { CircleCheck } from 'lucide-react';
import { EmptyState, Section } from '../../components/ui';
import { plural } from '../../lib/formato';
import { useEquipoActual } from '../equipo/contexto';
import { recomendar, type Prioridad } from './rules';

const PRIORIDAD: Record<Prioridad, string> = { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja' };

export function RecomendacionesPage() {
  const recs = recomendar(useEquipoActual().inventario);

  if (recs.length === 0) {
    return (
      <EmptyState
        icono={CircleCheck}
        titulo="No hay recomendaciones para este equipo"
        descripcion="Se revisaron el espacio libre, el antivirus, la memoria, el tipo de discos, la batería, la versión de Windows y la antigüedad de la BIOS."
      />
    );
  }

  return (
    <Section titulo="Recomendaciones de actualización" descripcion={plural(recs.length, 'sugerencia', 'sugerencias')}>
      <ol className="recomendaciones">
        {recs.map((r) => (
          <li key={r.id} className={`recomendacion prioridad-${r.prioridad}`}>
            <span className="recomendacion-prioridad">{PRIORIDAD[r.prioridad]}</span>
            <h3>{r.titulo}</h3>
            <p className="texto-secundario">{r.detalle}</p>
            <p className="texto-terciario">Basado en: {r.basadoEn}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
