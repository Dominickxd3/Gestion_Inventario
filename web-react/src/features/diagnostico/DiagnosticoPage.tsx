import { Section, StatusLine, StatusList } from '../../components/ui';
import { useAhora } from '../../hooks/useAhora';
import { haceCuanto } from '../../lib/formato';
import { useEquipoActual } from '../equipo/contexto';
import { diagnosticar } from './rules';

export function DiagnosticoPage() {
  const equipo = useEquipoActual();
  const ahora = useAhora();
  const comprobaciones = diagnosticar(equipo.inventario, ahora);

  return (
    <Section
      titulo="Diagnóstico de hardware"
      descripcion={`Último análisis ${haceCuanto(equipo.ultimoReporte, ahora)}. Basado en lo que Windows informa; no ejecuta pruebas de rendimiento ni de estrés.`}
    >
      <StatusList>
        {comprobaciones.map((c) => (
          <StatusLine key={c.id} estado={c.estado} titulo={c.titulo} detalle={c.detalle} />
        ))}
      </StatusList>
    </Section>
  );
}
