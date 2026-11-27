import { Outlet, useParams } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { useEquipo } from '../../hooks/useEquipo';
import { ApiError } from '../../services/http';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { EquipoHeader } from './EquipoHeader';
import { EquipoNav } from './EquipoNav';

/** Carga el equipo una vez y lo comparte con todas las subpáginas (componentes y análisis). */
export function EquipoLayout() {
  const { id = '' } = useParams();
  const { data, error, cargando, recargar } = useEquipo(id);
  const migas = [{ etiqueta: 'Equipos', a: '/equipos' }];

  if (!data) {
    if (cargando) {
      return (
        <>
          <PageHeader titulo="Cargando equipo…" migas={migas} />
          <LoadingState filas={8} />
        </>
      );
    }
    if (error instanceof ApiError && error.tipo === 'no-encontrado') {
      return (
        <EmptyState
          icono={SearchX}
          titulo="Equipo no encontrado"
          descripcion="Es posible que haya sido eliminado del inventario."
          accion={<Button a="/equipos">Ver todos los equipos</Button>}
        />
      );
    }
    return (
      <>
        <PageHeader titulo="Equipo" migas={migas} />
        <ErrorState mensaje={error?.message ?? 'Error desconocido'} onReintentar={recargar} />
      </>
    );
  }

  return (
    <>
      <EquipoHeader equipo={data} />
      <div className="equipo-cuerpo">
        <EquipoNav equipo={data} />
        <div className="equipo-contenido">
          <Outlet context={data} />
        </div>
      </div>
    </>
  );
}
