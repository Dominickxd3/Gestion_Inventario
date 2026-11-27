import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Icon, LoadingState, Section } from '../../components/ui';
import { usePolling } from '../../hooks/usePolling';
import { api } from '../../services/gestion.service';
import { LineaTiempo } from '../gestion/comun';

/** Cifras que llevan a la lista filtrada + lo que requiere atención + actividad reciente (DESIGN.md §4.7). */
export function PanelGestion() {
  const datos = usePolling((s) => api.panel(s), 30_000);
  if (!datos.data) return <LoadingState filas={3} />;
  const c = datos.data.contadores;
  const resumen: [string, number, string][] = [
    ['Activos en servicio', c.enServicio, '/activos?cicloVida=EN_SERVICIO'],
    ['Asignados', c.asignados, '/activos?situacion=ASIGNADO'],
    ['Disponibles', c.disponibles, '/activos?situacion=DISPONIBLE'],
    ['En mantenimiento', c.enMantenimiento, '/mantenimiento'],
    ['Componentes en almacén', c.componentesEnAlmacen, '/almacen'],
  ];
  const pendientes: [string, number, string][] = [
    ['Discrepancias por revisar', c.discrepancias, '/discrepancias'],
    ['Equipos detectados sin registrar como activo', c.detectadosSinRegistrar, '/equipos'],
    ['Préstamos vencidos', c.prestamosVencidos, '/asignaciones'],
    [`Garantías que vencen en ${c.diasAvisoGarantia} días`, c.garantiasPorVencer, '/garantias'],
    [`Activos sin reporte de ScanGP (más de ${c.diasSinReporte} días)`, c.sinReporte, '/activos?situacion=SIN_REPORTE'],
    ['Componentes en mantenimiento', c.componentesEnMantenimiento, '/componentes'],
    ['Artículos bajo el stock mínimo', c.articulosBajoMinimo, '/almacen'],
    ['Activos fuera de servicio', c.fueraDeServicio, '/activos?cicloVida=FUERA_DE_SERVICIO'],
  ];
  const conAlgo = pendientes.filter(([, n]) => n > 0);

  return (
    <>
      <div className="cifras-panel">
        {resumen.map(([etiqueta, n, a]) => (
          <Link key={etiqueta} to={a} className="cifra-enlace">
            <span className="cifra-valor">{n}</span>
            <span className="cifra-etiqueta">{etiqueta}</span>
          </Link>
        ))}
      </div>
      <div className="inicio-columnas">
        <Section titulo="Pendientes">
          {conAlgo.length === 0 ? (
            <p className="texto-secundario">Nada pendiente.</p>
          ) : (
            <ul className="lista-pendientes">
              {conAlgo.map(([etiqueta, n, a]) => (
                <li key={etiqueta}>
                  <Link to={a}>
                    <span className="pendiente-numero">{n}</span>
                    <span className="pendiente-texto">{etiqueta}</span>
                    <Icon icono={ChevronRight} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section titulo="Actividad reciente" descripcion="Últimas operaciones sobre activos y componentes.">
          <LineaTiempo movimientos={datos.data.actividad.slice(0, 8)} />
        </Section>
      </div>
    </>
  );
}
