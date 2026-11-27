import { Disclosure, KeyValueList, Section, SpecTable } from '../../components/ui';
import { memoria } from '../../lib/formato';
import type { InvGrafica } from '../../types/api';
import { useEquipoActual } from '../equipo/contexto';

export function GraficosPage() {
  const graficos = useEquipoActual().inventario.graficos ?? [];
  return (
    <Section titulo="Tarjetas gráficas" descripcion="La resolución corresponde al monitor conectado en el momento del análisis">
      <SpecTable<InvGrafica>
        titulo="Tarjetas gráficas"
        filas={graficos}
        vacio="No se detectaron tarjetas gráficas."
        columnas={[
          { encabezado: 'Modelo', valor: (g) => g.nombre },
          { encabezado: 'Memoria', valor: (g) => memoria(g.memoriaBytes), numerica: true },
          { encabezado: 'Resolución', valor: (g) => g.resolucion, numerica: true },
          { encabezado: 'Frecuencia', valor: (g) => g.frecuenciaHz && `${g.frecuenciaHz} Hz`, numerica: true },
        ]}
      />
      {graficos.length > 0 && (
        <Disclosure titulo="Detalles técnicos" resumen="Fabricante y versión del controlador">
          <KeyValueList
            datos={graficos.flatMap((g, i) => [
              { etiqueta: `${g.nombre ?? `Tarjeta ${i + 1}`} · fabricante`, valor: g.fabricante },
              { etiqueta: `${g.nombre ?? `Tarjeta ${i + 1}`} · controlador`, valor: g.versionDriver, mono: true },
            ])}
          />
        </Disclosure>
      )}
    </Section>
  );
}
