import { CircleCheck, Clock, ScanSearch } from 'lucide-react';
import { useEquipos } from '../../hooks/EquiposContext';
import { useAhora } from '../../hooks/useAhora';
import { Button, EmptyState, ErrorState, Icon, LoadingState, PageHeader, Section, StatFigure, StatRow, StatusBadge } from '../../components/ui';
import { ORDEN_TIPOS, TIPOS } from '../../lib/tipoEquipo';
import { diasDesde, haceCuanto, unir } from '../../lib/formato';
import { useDiagnosticos } from '../diagnostico/useDiagnosticos';
import { UMBRALES } from '../diagnostico/umbrales';
import { EquipoFila, ListaEquipos } from '../equipos/EquipoFila';
import type { EquipoListado } from '../../types/api';
import type { Estado } from '../../lib/estados';

const RECIENTES = 5;

export function InicioPage() {
  const { equipos, estadisticas, cargando, error, recargar } = useEquipos();
  const ahora = useAhora();
  const { diagnosticoDe, listo } = useDiagnosticos(equipos);

  const accion = (
    <Button variante="primario" icono={ScanSearch} a="/detectar">
      Detectar equipo
    </Button>
  );

  if (!equipos) {
    return (
      <>
        <PageHeader titulo="Inicio" acciones={accion} />
        {cargando ? <LoadingState filas={6} /> : <ErrorState mensaje={error?.message ?? 'Error desconocido'} onReintentar={recargar} />}
      </>
    );
  }

  if (equipos.length === 0) {
    return (
      <>
        <PageHeader titulo="Inicio" />
        <EmptyState
          icono={ScanSearch}
          titulo="Aún no hay equipos registrados"
          descripcion="Descarga ScanGP y ábrelo en un equipo: sus características aparecerán aquí en segundos."
          accion={accion}
        />
      </>
    );
  }

  const atencion = equipos
    .map((e) => {
      const dias = diasDesde(e.ultimoReporte, ahora) ?? 0;
      if (dias > UMBRALES.diasSinReportar)
        return { e, estado: 'aviso' as Estado, motivo: `Sin reportar desde hace ${dias} días` };
      const d = diagnosticoDe(e.id);
      return d?.principal ? { e, estado: d.estado, motivo: d.principal.detalle } : null;
    })
    .filter((x): x is { e: EquipoListado; estado: Estado; motivo: string } => x !== null)
    .sort((a, b) => (a.estado === 'problema' ? -1 : 0) - (b.estado === 'problema' ? -1 : 0));

  const recientes = [...equipos].sort((a, b) => b.ultimoReporte.localeCompare(a.ultimoReporte)).slice(0, RECIENTES);

  return (
    <>
      <PageHeader titulo="Inicio" subtitulo="Resumen del inventario de equipos" acciones={accion} />

      <StatRow>
        <StatFigure valor={estadisticas?.total ?? equipos.length} etiqueta="Equipos registrados" />
        {ORDEN_TIPOS.filter((t) => estadisticas?.porTipo[t]).map((t) => (
          <StatFigure key={t} valor={estadisticas!.porTipo[t]} etiqueta={TIPOS[t].plural} />
        ))}
      </StatRow>

      <Section titulo="Requieren atención" descripcion="Según el último reporte de cada equipo">
        {!listo && atencion.length === 0 ? (
          <LoadingState filas={3} etiqueta="Analizando equipos" />
        ) : atencion.length === 0 ? (
          <p className="nota-correcta">
            <Icon icono={CircleCheck} /> Ningún equipo requiere atención.
          </p>
        ) : (
          <ListaEquipos>
            {atencion.map(({ e, estado, motivo }) => (
              <EquipoFila
                key={e.id}
                equipo={e}
                a={`/equipos/${e.id}/diagnostico`}
                icono={<StatusBadge estado={estado} texto="" />}
                detalle={motivo}
                meta={haceCuanto(e.ultimoReporte, ahora)}
              />
            ))}
          </ListaEquipos>
        )}
      </Section>

      <Section titulo="Actividad reciente" descripcion="Últimos equipos que enviaron su inventario">
        <ListaEquipos>
          {recientes.map((e) => (
            <EquipoFila
              key={e.id}
              equipo={e}
              detalle={unir([TIPOS[e.resumen.tipo]?.etiqueta, e.resumen.fabricante, e.resumen.procesador], ' · ')}
              meta={
                <>
                  <Icon icono={Clock} /> {haceCuanto(e.ultimoReporte, ahora)}
                </>
              }
            />
          ))}
        </ListaEquipos>
      </Section>
    </>
  );
}
