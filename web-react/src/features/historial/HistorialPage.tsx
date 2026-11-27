import { Section } from '../../components/ui';
import { fechaHora, plural } from '../../lib/formato';
import { useEquipoActual } from '../equipo/contexto';

const CAMPOS: Record<string, string> = {
  'hardware.discos': 'Discos y números de serie',
  'hardware.memoria': 'Módulos de memoria',
  'hardware.procesadores': 'Características del procesador',
  'hardware.graficos': 'Características de gráficos',
  'hardware.placaBase': 'Placa base',
  'hardware.monitores': 'Monitores',
  nombreEquipo: 'Nombre del equipo',
  usuario: 'Usuario',
  procesador: 'Procesador',
  ramGB: 'Memoria (GB)',
  discos: 'Discos',
  gpu: 'Gráficos',
  sistemaOperativo: 'Sistema operativo',
  numeroSerie: 'Número de serie',
};

export function HistorialPage() {
  const equipo = useEquipoActual();
  return (
    <Section
      titulo="Historial de análisis"
      descripcion={`${plural(equipo.totalReportes, 'análisis recibido', 'análisis recibidos')} · Se registran los cambios de hardware, usuario y sistema entre análisis`}
    >
      <ol className="historial">
        {equipo.historial.map((c, i) => (
          <li key={i}>
            <time className="historial-fecha num" dateTime={c.fecha}>
              {fechaHora(c.fecha)}
            </time>
            <span>
              <strong>{CAMPOS[c.campo] ?? c.campo}:</strong> <span className="texto-secundario">{c.anterior ?? 'sin dato'}</span>
              {' → '}
              {c.nuevo ?? 'sin dato'}
            </span>
          </li>
        ))}
        <li>
          <time className="historial-fecha num" dateTime={equipo.ultimoReporte}>
            {fechaHora(equipo.ultimoReporte)}
          </time>
          <span className="texto-secundario">Último análisis recibido</span>
        </li>
        <li>
          <time className="historial-fecha num" dateTime={equipo.primerRegistro}>
            {fechaHora(equipo.primerRegistro)}
          </time>
          <span className="texto-secundario">Primer registro en el inventario</span>
        </li>
      </ol>
      {equipo.historial.length === 0 && <p className="texto-terciario">Sin cambios detectados desde el primer registro.</p>}
    </Section>
  );
}
