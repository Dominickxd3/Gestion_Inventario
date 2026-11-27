import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SearchX } from 'lucide-react';
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
import { Button, EmptyState } from '../components/ui';

export function App() {
  return (
    <BrowserRouter>
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
          <Route path="detectar" element={<DetectarPage />} />
          <Route
            path="*"
            element={<EmptyState icono={SearchX} titulo="Página no encontrada" accion={<Button a="/">Ir al inicio</Button>} />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
