import { Link, useNavigate } from 'react-router-dom';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { DeviceTypeIcon, StatusBadge, Unavailable } from '../../components/ui';
import { useAhora } from '../../hooks/useAhora';
import { infoTipo } from '../../lib/tipoEquipo';
import { capacidad, haceCuanto, unir, usuarioCorto } from '../../lib/formato';
import type { EquipoListado } from '../../types/api';
import type { ResumenDiagnostico } from '../diagnostico/rules';

interface Props {
  equipos: EquipoListado[];
  diagnosticoDe: (id: string) => ResumenDiagnostico | undefined;
}

const o = (v: string | null | undefined) => v || <Unavailable />;

export function EquiposTable({ equipos, diagnosticoDe }: Props) {
  const navegar = useNavigate();
  const ahora = useAhora();

  return (
    <DataTable
      value={equipos}
      dataKey="id"
      size="small"
      sortField="ultimoReporte"
      sortOrder={-1}
      rowHover
      responsiveLayout="stack"
      breakpoint="767px"
      onRowClick={(e) => navegar(`/equipos/${(e.data as EquipoListado).id}`)}
      emptyMessage="Ningún equipo coincide con los filtros."
      className="tabla-equipos"
      aria-label="Equipos registrados"
    >
      <Column
        header="Equipo"
        field="resumen.nombreEquipo"
        sortable
        body={(e: EquipoListado) => (
          <span className="celda-equipo">
            <Link to={`/equipos/${e.id}`} onClick={(ev) => ev.stopPropagation()}>
              {e.resumen.nombreEquipo}
            </Link>
            <span className="texto-terciario">{usuarioCorto(e.resumen.usuario) ?? 'Sin sesión'}</span>
          </span>
        )}
      />
      <Column
        header="Activo"
        field="codigoPatrimonial"
        sortable
        body={(e: EquipoListado) =>
          e.activoId ? (
            <Link to={`/activos/${e.activoId}`} className="mono" onClick={(ev) => ev.stopPropagation()}>
              {e.codigoPatrimonial}
            </Link>
          ) : (
            <span className="texto-terciario">Sin registrar</span>
          )
        }
      />
      <Column
        header="Tipo"
        field="resumen.tipo"
        sortable
        body={(e: EquipoListado) => (
          <span className="celda-tipo">
            <DeviceTypeIcon tipo={e.resumen.tipo} />
            {infoTipo(e.resumen.tipo).etiqueta}
          </span>
        )}
      />
      <Column header="Modelo" field="resumen.modelo" sortable body={(e: EquipoListado) => o(unir([e.resumen.fabricante, e.resumen.modelo]))} />
      <Column header="Procesador" field="resumen.procesador" sortable body={(e: EquipoListado) => o(e.resumen.procesador)} />
      <Column
        header="RAM"
        field="resumen.ramGB"
        sortable
        headerClassName="num"
        bodyClassName="num"
        body={(e: EquipoListado) => (e.resumen.ramGB ? `${e.resumen.ramGB} GB` : <Unavailable />)}
      />
      <Column
        header="Almacenamiento"
        field="resumen.almacenamientoGB"
        sortable
        headerClassName="num"
        bodyClassName="num"
        body={(e: EquipoListado) => o(capacidad((e.resumen.almacenamientoGB ?? 0) * 1e9))}
      />
      <Column
        header="Estado"
        body={(e: EquipoListado) => {
          const d = diagnosticoDe(e.id);
          return d ? <StatusBadge estado={d.estado} /> : <span className="texto-terciario">Analizando…</span>;
        }}
      />
      <Column
        header="Último reporte"
        field="ultimoReporte"
        sortable
        body={(e: EquipoListado) => <span className="num">{haceCuanto(e.ultimoReporte, ahora)}</span>}
      />
    </DataTable>
  );
}
