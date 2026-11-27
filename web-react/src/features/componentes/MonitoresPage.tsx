import { Disclosure, KeyValueList, Section, SpecTable } from '../../components/ui';
import type { InvMonitor } from '../../types/api';
import { useEquipoActual } from '../equipo/contexto';

export function MonitoresPage() {
  const monitores = useEquipoActual().inventario.monitores ?? [];
  return (
    <Section titulo="Monitores" descripcion="Datos leídos del propio monitor (EDID). La resolución está en Gráficos">
      <SpecTable<InvMonitor>
        titulo="Monitores conectados"
        filas={monitores}
        vacio="No se detectaron monitores externos."
        columnas={[
          { encabezado: 'Modelo', valor: (m) => m.modelo },
          { encabezado: 'Código de fabricante', valor: (m) => m.fabricante, mono: true },
          { encabezado: 'Año de fabricación', valor: (m) => m.anioFabricacion, numerica: true },
        ]}
      />
      {monitores.length > 0 && (
        <Disclosure titulo="Detalles técnicos" resumen="Números de serie y códigos de producto">
          <KeyValueList
            datos={monitores.flatMap((m, i) => [
              { etiqueta: `${m.modelo ?? `Monitor ${i + 1}`} · n.º de serie`, valor: m.numeroSerie, mono: true },
              { etiqueta: `${m.modelo ?? `Monitor ${i + 1}`} · código de producto`, valor: m.codigoProducto, mono: true },
            ])}
          />
        </Disclosure>
      )}
    </Section>
  );
}
