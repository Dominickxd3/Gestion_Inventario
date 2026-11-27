import { Battery } from 'lucide-react';
import { EmptyState, KeyValueList, Meter, Section, StatFigure, StatRow } from '../../components/ui';
import { useEquipoActual } from '../equipo/contexto';

const mwh = (v: number | null | undefined) => (v ? `${v.toLocaleString('es')} mWh` : null);

export function BateriaPage() {
  const b = useEquipoActual().inventario.bateria;
  if (!b) return <EmptyState icono={Battery} titulo="Este equipo no tiene batería" />;

  return (
    <Section titulo="Batería" descripcion="La carga corresponde al momento del análisis">
      <StatRow>
        <StatFigure valor={b.saludPorcentaje} unidad="%" etiqueta="Salud (capacidad respecto a la original)" />
        <StatFigure valor={b.cargaPorcentaje} unidad="%" etiqueta="Carga en el análisis" />
      </StatRow>
      {b.saludPorcentaje != null && (
        <div className="bloque-medidor">
          <Meter valor={b.saludPorcentaje} etiqueta="Salud de la batería" umbralAlerta={101} />
        </div>
      )}
      <KeyValueList
        datos={[
          { etiqueta: 'Modelo', valor: b.nombre },
          { etiqueta: 'Capacidad original', valor: mwh(b.capacidadDisenoMWh), motivo: 'requiere-admin' },
          { etiqueta: 'Capacidad actual', valor: mwh(b.capacidadActualMWh), motivo: 'requiere-admin' },
        ]}
      />
    </Section>
  );
}
