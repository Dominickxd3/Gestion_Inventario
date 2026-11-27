import { Section, StatusLine, StatusList } from '../../components/ui';
import { useEquipoActual } from '../equipo/contexto';
import { evaluarCompatibilidad } from './rules';

export function CompatibilidadPage() {
  const grupos = evaluarCompatibilidad(useEquipoActual().inventario);
  return (
    <>
      <p className="aclaracion">
        Calculado a partir de los componentes detectados. No reemplaza la ficha técnica del fabricante: lo que no se puede
        determinar con los datos del equipo se indica como «Sin datos».
      </p>
      {grupos.map((g) => (
        <Section key={g.id} titulo={g.titulo}>
          <StatusList>
            {g.comprobaciones.map((c) => (
              <StatusLine key={c.id} estado={c.estado} titulo={c.titulo} detalle={c.detalle} />
            ))}
          </StatusList>
        </Section>
      ))}
    </>
  );
}
