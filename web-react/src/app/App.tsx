import type { ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Lock, SearchX } from 'lucide-react';
import { AppLayout } from './AppLayout';
import { InicioPage } from '../features/inicio/InicioPage';
import { EquiposPage } from '../features/equipos/EquiposPage';
import { DetectarPage } from '../features/detectar/DetectarPage';
import { EquipoLayout } from '../features/equipo/EquipoLayout';
import { ResumenPage } from '../features/equipo/ResumenPage';
import { ProcesadorPage } from '../features/componentes/ProcesadorPage';
import { PlacaPage } from '../features/componentes/PlacaPage';
import { MemoriaPage } from '../features/componentes/MemoriaPage';
import { GraficosPage } from '../features/componentes/GraficosPage';
import { AlmacenamientoPage } from '../features/componentes/AlmacenamientoPage';
import { BateriaPage } from '../features/componentes/BateriaPage';
import { MonitoresPage } from '../features/componentes/MonitoresPage';
import { CompatibilidadPage } from '../features/compatibilidad/CompatibilidadPage';
import { RecomendacionesPage } from '../features/recomendaciones/RecomendacionesPage';
import { DiagnosticoPage } from '../features/diagnostico/DiagnosticoPage';
import { HistorialPage } from '../features/historial/HistorialPage';
import { UsuariosPage } from '../features/admin/UsuariosPage';
import { ActivosPage } from '../features/activos/ActivosPage';
import { ActivoPage } from '../features/activos/ActivoPage';
import { ComponentePage, ComponentesPage } from '../features/rastreables/ComponentesPage';
import { AsignacionesPage, MantenimientoPage, OrdenPage, PersonaPage, PersonasPage } from '../features/operaciones/OperacionesPages';
import { AlmacenPage, CatalogoPage, ConfiguracionPage, GarantiasPage, OrganizacionPage } from '../features/maestros/MaestrosPages';
import { DiscrepanciasPage } from '../features/discrepancias/DiscrepanciasPage';
import { AuditoriaPage } from '../features/admin/AuditoriaPage';
import { LoginPage } from '../features/auth/LoginPage';
import { CambiarPasswordPage } from '../features/auth/CambiarPasswordPage';
import { Button, EmptyState, LoadingState } from '../components/ui';
import { SesionProvider, useSesion } from '../hooks/SesionContext';
import type { Rol } from '../types/identidad';

export function App() {
  return (
    <SesionProvider>
      <BrowserRouter>
        <Puerta />
      </BrowserRouter>
    </SesionProvider>
  );
}

/** Sin sesión: login. Con contraseña temporal: cambio obligatorio. Con sesión: la aplicación. */
function Puerta() {
  const { estado } = useSesion();
  if (estado.tipo === 'comprobando') return <LoadingState etiqueta="Comprobando la sesión" />;
  if (estado.tipo === 'sin-sesion') return <LoginPage />;
  if (estado.usuario.debeCambiarPassword) return <CambiarPasswordPage />;
  return <Rutas />;
}

/** Muestra la página solo a estos roles (la API también lo comprueba). */
function SoloRoles({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { puede } = useSesion();
  if (puede(...roles)) return <>{children}</>;
  return (
    <EmptyState icono={Lock} titulo="Sin permiso" descripcion="Tu rol no permite ver esta página." accion={<Button a="/">Ir al inicio</Button>} />
  );
}

function Rutas() {
  return (
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<InicioPage />} />
          <Route path="equipos" element={<EquiposPage />} />
          <Route path="equipos/:id" element={<EquipoLayout />}>
            <Route index element={<ResumenPage />} />
            <Route path="procesador" element={<ProcesadorPage />} />
            <Route path="placa" element={<PlacaPage />} />
            <Route path="memoria" element={<MemoriaPage />} />
            <Route path="graficos" element={<GraficosPage />} />
            <Route path="almacenamiento" element={<AlmacenamientoPage />} />
            <Route path="bateria" element={<BateriaPage />} />
            <Route path="monitores" element={<MonitoresPage />} />
            <Route path="compatibilidad" element={<CompatibilidadPage />} />
            <Route path="recomendaciones" element={<RecomendacionesPage />} />
            <Route path="diagnostico" element={<DiagnosticoPage />} />
            <Route path="historial" element={<HistorialPage />} />
          </Route>
          <Route path="activos" element={<ActivosPage />} />
          <Route path="activos/:id" element={<ActivoPage />} />
          <Route path="componentes" element={<ComponentesPage />} />
          <Route path="componentes/:id" element={<ComponentePage />} />
          <Route path="personas" element={<PersonasPage />} />
          <Route path="personas/:id" element={<PersonaPage />} />
          <Route path="asignaciones" element={<AsignacionesPage />} />
          <Route path="mantenimiento" element={<MantenimientoPage />} />
          <Route path="mantenimiento/:id" element={<OrdenPage />} />
          <Route path="garantias" element={<GarantiasPage />} />
          <Route path="almacen" element={<AlmacenPage />} />
          <Route path="discrepancias" element={<DiscrepanciasPage />} />
          <Route path="catalogo" element={<CatalogoPage />} />
          <Route path="organizacion" element={<OrganizacionPage />} />
          <Route path="admin/configuracion" element={<SoloRoles roles={['ADMIN']}><ConfiguracionPage /></SoloRoles>} />
          <Route path="detectar" element={<SoloRoles roles={['ADMIN', 'TECNICO']}><DetectarPage /></SoloRoles>} />
          <Route path="admin/usuarios" element={<SoloRoles roles={['ADMIN']}><UsuariosPage /></SoloRoles>} />
          <Route path="admin/auditoria" element={<SoloRoles roles={['ADMIN']}><AuditoriaPage /></SoloRoles>} />
          <Route
            path="*"
            element={<EmptyState icono={SearchX} titulo="Página no encontrada" accion={<Button a="/">Ir al inicio</Button>} />}
          />
        </Route>
      </Routes>
  );
}
