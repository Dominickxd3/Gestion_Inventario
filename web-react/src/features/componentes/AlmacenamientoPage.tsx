import { Disclosure, KeyValueList, Meter, Section, SpecTable, StatFigure, StatRow, StatusBadge, Unavailable } from '../../components/ui';
import { capacidad, espacio, unir } from '../../lib/formato';
import type { InvDisco } from '../../types/api';
import { porcentajeLibre } from '../diagnostico/rules';
import { useEquipoActual } from '../equipo/contexto';

const estadoSalud = (s: string | null | undefined) => (s === 'Correcto' ? 'ok' : s === 'Dañado' ? 'problema' : 'aviso');

export function AlmacenamientoPage() {
  const inv = useEquipoActual().inventario;
  const discos = inv.discos ?? [];
  const internos = discos.filter((d) => !d.externo);
  const total = internos.reduce((s, d) => s + (d.capacidadBytes ?? 0), 0);
  const [valor, unidad] = (capacidad(total) ?? '').split(' ');

  return (
    <>
      <Section titulo="Almacenamiento">
        <StatRow>
          <StatFigure valor={valor || null} unidad={unidad} etiqueta="Capacidad total interna" />
          <StatFigure valor={internos.length} etiqueta={internos.length === 1 ? 'Disco interno' : 'Discos internos'} />
          {discos.length > internos.length && <StatFigure valor={discos.length - internos.length} etiqueta="Externos" />}
        </StatRow>
        <SpecTable<InvDisco>
          titulo="Discos"
          filas={discos}
          vacio="No se detectaron discos."
          columnas={[
            { encabezado: 'Disco', valor: (d) => d.modelo },
            { encabezado: 'Tipo', valor: (d) => d.tipo !== 'Desconocido' ? d.tipo : null },
            { encabezado: 'Capacidad', valor: (d) => capacidad(d.capacidadBytes), numerica: true },
            { encabezado: 'Interfaz', valor: (d) => unir([d.interfaz, d.externo && '(externo)']) },
            { encabezado: 'Estado', valor: (d) => d.salud && <StatusBadge estado={estadoSalud(d.salud)} texto={d.salud} /> },
          ]}
        />
        <Disclosure titulo="Detalles técnicos" resumen="Números de serie y firmware">
          <KeyValueList
            datos={discos.flatMap((d, i) => [
              { etiqueta: `${d.modelo ?? `Disco ${i + 1}`} · n.º de serie`, valor: d.numeroSerie, mono: true },
              { etiqueta: `${d.modelo ?? `Disco ${i + 1}`} · firmware`, valor: d.firmware, mono: true },
            ])}
          />
        </Disclosure>
      </Section>

      <Section titulo="Unidades" descripcion="Espacio usado en cada unidad de Windows">
        {(inv.volumenes ?? []).length === 0 ? (
          <Unavailable />
        ) : (
          <ul className="volumenes">
            {inv.volumenes!.map((v) => {
              const libre = porcentajeLibre(v);
              const usado = libre == null ? null : 100 - libre;
              return (
                <li key={v.letra} className="volumen">
                  <span className="volumen-nombre">
                    <strong>{v.letra}</strong> {v.etiqueta} <span className="texto-terciario">{v.sistemaArchivos}</span>
                  </span>
                  {usado == null ? <Unavailable /> : <Meter valor={usado} etiqueta={`Espacio usado en ${v.letra}`} />}
                  <span className="volumen-dato num">
                    {espacio(v.libreBytes)} libres de {espacio(v.capacidadBytes)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
