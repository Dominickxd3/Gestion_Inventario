import { DeviceTypeIcon, PageHeader, StatusBadge } from '../../components/ui';
import { useAhora } from '../../hooks/useAhora';
import { estimarEstacionDeTrabajo, formatoChasis, infoTipo } from '../../lib/tipoEquipo';
import { haceCuanto, unir, usuarioCorto } from '../../lib/formato';
import { diagnosticar, resumirDiagnostico } from '../diagnostico/rules';
import type { EquipoDetalle } from '../../types/api';
import { AccionActivoDetectado } from './RegistrarActivo';

export function EquipoHeader({ equipo }: { equipo: EquipoDetalle }) {
  const ahora = useAhora();
  const inv = equipo.inventario;
  const formato = formatoChasis(inv);
  const estacion = estimarEstacionDeTrabajo(inv);
  const diag = resumirDiagnostico(diagnosticar(inv, ahora));

  const tipo = unir([infoTipo(inv.equipo.tipo).etiqueta, formato && `formato ${formato.etiqueta}`], ', ');
  const subtitulo = unir(
    [
      tipo,
      unir([inv.equipo.fabricante, inv.equipo.modelo]),
      usuarioCorto(inv.equipo.usuario) && `Usuario ${usuarioCorto(inv.equipo.usuario)}`,
      `Reportó ${haceCuanto(equipo.ultimoReporte, ahora)}`,
    ],
    ' · ',
  );

  return (
    <PageHeader
      migas={[{ etiqueta: 'Equipos', a: '/equipos' }, { etiqueta: inv.equipo.nombreEquipo }]}
      icono={<DeviceTypeIcon tipo={inv.equipo.tipo} tamano={20} />}
      titulo={inv.equipo.nombreEquipo}
      subtitulo={
        <>
          {subtitulo}
          {estacion && (
            <span className="texto-terciario" title={`Estimado a partir de: ${estacion}`}>
              {' '}
              · Estación de trabajo (estimado)
            </span>
          )}
        </>
      }
      acciones={
        <div className="acciones-pagina">
          <StatusBadge
            estado={diag.estado}
            texto={diag.estado === 'ok' ? 'Sin problemas' : diag.problemas ? `${diag.problemas} con problema` : `${diag.avisos} advertencias`}
          />
          <AccionActivoDetectado equipo={equipo} />
        </div>
      }
    />
  );
}
