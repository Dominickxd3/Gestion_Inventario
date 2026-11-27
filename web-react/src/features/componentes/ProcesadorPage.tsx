import { Cpu } from 'lucide-react';
import { Disclosure, EmptyState, KeyValueList, Section, StatFigure, StatRow } from '../../components/ui';
import { mhzAGhz } from '../../lib/formato';
import { useEquipoActual } from '../equipo/contexto';

const kb = (v: number | null | undefined) => (v ? (v >= 1024 ? `${v / 1024} MB` : `${v} KB`) : null);

export function ProcesadorPage() {
  const cpus = useEquipoActual().inventario.procesadores ?? [];
  if (!cpus.length) return <EmptyState icono={Cpu} titulo="Procesador no detectado" descripcion="ScanGP no pudo leer la información del procesador." />;

  return (
    <>
      {cpus.map((p, i) => (
        <Section key={i} titulo={cpus.length > 1 ? `Procesador ${i + 1}` : 'Procesador (CPU)'} descripcion={p.nombre ?? undefined}>
          <StatRow>
            <StatFigure valor={p.nucleos} etiqueta="Núcleos" />
            <StatFigure valor={p.hilos} etiqueta="Hilos" />
            <StatFigure valor={p.velocidadMaxMHz ? (p.velocidadMaxMHz / 1000).toFixed(2) : null} unidad="GHz" etiqueta="Frecuencia base" />
          </StatRow>
          <KeyValueList
            datos={[
              { etiqueta: 'Modelo', valor: p.nombre },
              { etiqueta: 'Fabricante', valor: p.fabricante?.replace(/^AuthenticAMD$/, 'AMD').replace(/^GenuineIntel$/, 'Intel') },
              { etiqueta: 'Socket', valor: p.socket },
            ]}
          />
          <Disclosure titulo="Detalles técnicos" resumen="Caché, virtualización, identificador">
            <KeyValueList
              datos={[
                { etiqueta: 'Caché L2', valor: kb(p.cacheL2KB) },
                { etiqueta: 'Caché L3', valor: kb(p.cacheL3KB) },
                { etiqueta: 'Frecuencia base', valor: mhzAGhz(p.velocidadMaxMHz) },
                {
                  etiqueta: 'Virtualización',
                  valor: p.virtualizacionHabilitada == null ? null : p.virtualizacionHabilitada ? 'Habilitada en la BIOS' : 'Deshabilitada en la BIOS',
                },
                { etiqueta: 'Identificador', valor: p.idProcesador, mono: true },
              ]}
            />
          </Disclosure>
        </Section>
      ))}
    </>
  );
}
