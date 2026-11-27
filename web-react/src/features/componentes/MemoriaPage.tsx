import { MemoryStick } from 'lucide-react';
import { Disclosure, EmptyState, KeyValueList, Section, SpecTable, StatFigure, StatRow } from '../../components/ui';
import { memoria, unir } from '../../lib/formato';
import type { InvModuloRam } from '../../types/api';
import { useEquipoActual } from '../equipo/contexto';

export function MemoriaPage() {
  const m = useEquipoActual().inventario.memoria;
  if (!m) return <EmptyState icono={MemoryStick} titulo="Memoria no detectada" descripcion="ScanGP no pudo leer la memoria RAM." />;

  const tipo = m.modulos.find((x) => x.tipo)?.tipo;
  const velocidad = m.modulos.find((x) => x.velocidadMHz)?.velocidadMHz;
  const [valor, unidad] = (memoria(m.instaladaBytes) ?? '').split(' ');

  return (
    <Section titulo="Memoria (RAM)">
      <StatRow>
        <StatFigure valor={valor || null} unidad={unidad} etiqueta="Instalada" />
        <StatFigure
          valor={m.ranurasTotales ? `${m.ranurasUsadas} de ${m.ranurasTotales}` : null}
          etiqueta="Ranuras ocupadas"
        />
        <StatFigure valor={unir([tipo, velocidad && `${velocidad} MHz`], ' · ')} etiqueta="Tipo y velocidad" />
      </StatRow>

      <SpecTable<InvModuloRam>
        titulo="Módulos instalados"
        filas={m.modulos}
        vacio="El equipo no informa módulos individuales."
        columnas={[
          { encabezado: 'Ranura', valor: (x) => x.banco },
          { encabezado: 'Capacidad', valor: (x) => memoria(x.capacidadBytes), numerica: true },
          { encabezado: 'Tipo', valor: (x) => x.tipo },
          { encabezado: 'Velocidad', valor: (x) => x.velocidadMHz && `${x.velocidadMHz} MHz`, numerica: true },
          { encabezado: 'Formato', valor: (x) => x.formato },
          { encabezado: 'Fabricante', valor: (x) => x.fabricante },
        ]}
      />

      <Disclosure titulo="Detalles técnicos" resumen="Números de parte y de serie, memoria utilizable">
        <KeyValueList
          datos={[
            { etiqueta: 'Memoria utilizable por Windows', valor: memoria(m.utilizableBytes) },
            ...m.modulos.flatMap((x, i) => [
              { etiqueta: `${x.banco ?? `Módulo ${i + 1}`} · n.º de parte`, valor: x.numeroParte, mono: true },
              { etiqueta: `${x.banco ?? `Módulo ${i + 1}`} · n.º de serie`, valor: x.numeroSerie, mono: true },
              { etiqueta: `${x.banco ?? `Módulo ${i + 1}`} · velocidad máxima`, valor: x.velocidadMaxMHz && `${x.velocidadMaxMHz} MHz` },
            ]),
          ]}
        />
      </Disclosure>
    </Section>
  );
}
