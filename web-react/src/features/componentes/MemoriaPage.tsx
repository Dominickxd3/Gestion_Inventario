import { MemoryStick } from 'lucide-react';
import { Disclosure, EmptyState, KeyValueList, Section, SpecTable, StatFigure, StatRow } from '../../components/ui';
import { memoria, unir } from '../../lib/formato';
import { analizarMemoria, esModuloSoldado } from '../../lib/memoria';
import type { InvModuloRam } from '../../types/api';
import { useEquipoActual } from '../equipo/contexto';

export function MemoriaPage() {
  const m = useEquipoActual().inventario.memoria;
  if (!m) return <EmptyState icono={MemoryStick} titulo="Memoria no detectada" descripcion="ScanGP no pudo leer la memoria RAM." />;

  const a = analizarMemoria(m);
  const tipo = m.modulos.find((x) => x.tipo)?.tipo;
  const velocidad = m.modulos.find((x) => x.velocidadMHz)?.velocidadMHz;
  const [valor, unidad] = (memoria(m.instaladaBytes) ?? '').split(' ');

  // La BIOS informa la memoria soldada como varios "módulos" (uno por chip o canal): se agrupan en una fila.
  const soldados = m.modulos.filter(esModuloSoldado);
  const filaSoldada: InvModuloRam | null = soldados.length
    ? {
        ...soldados[0],
        banco: 'Soldada en la placa',
        capacidadBytes: a.capacidadSoldadaBytes,
        formato: 'Soldada',
        numeroSerie: null,
      }
    : null;
  const filas = [...(filaSoldada ? [filaSoldada] : []), ...a.extraibles];

  const ranuras =
    a.soldada === 'total'
      ? { valor: 'Soldada', etiqueta: 'Sin ranuras · no ampliable' }
      : a.ranurasTotales
        ? {
            valor: `${a.ranurasUsadas} de ${a.ranurasTotales}`,
            etiqueta: a.soldada === 'parcial' ? `Ranuras ocupadas (+${memoria(a.capacidadSoldadaBytes)} soldada)` : 'Ranuras ocupadas',
          }
        : { valor: null, etiqueta: 'Ranuras ocupadas' };

  const partesSoldadas = [...new Set(soldados.map((x) => x.numeroParte).filter(Boolean))].join(', ') || null;

  return (
    <Section titulo="Memoria (RAM)">
      <StatRow>
        <StatFigure valor={valor || null} unidad={unidad} etiqueta="Instalada" />
        <StatFigure valor={ranuras.valor} etiqueta={ranuras.etiqueta} />
        <StatFigure valor={unir([tipo, velocidad && `${velocidad} MHz`], ' · ')} etiqueta="Tipo y velocidad" />
      </StatRow>

      <SpecTable<InvModuloRam>
        titulo="Módulos instalados"
        filas={filas}
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
            ...(soldados.length
              ? [
                  { etiqueta: 'Memoria soldada · n.º de parte', valor: partesSoldadas, mono: true },
                  { etiqueta: 'Memoria soldada · chips/canales informados', valor: String(soldados.length) },
                  {
                    etiqueta: 'Memoria soldada · velocidad máxima',
                    valor: soldados[0].velocidadMaxMHz && `${soldados[0].velocidadMaxMHz} MHz`,
                  },
                ]
              : []),
            ...a.extraibles.flatMap((x, i) => [
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
