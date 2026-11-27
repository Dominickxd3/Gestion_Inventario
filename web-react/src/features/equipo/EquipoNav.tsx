import { NavLink } from 'react-router-dom';
import {
  Battery,
  CircuitBoard,
  Cpu,
  HardDrive,
  History,
  LayoutDashboard,
  MemoryStick,
  Monitor,
  MonitorCog,
  Puzzle,
  Stethoscope,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Icon } from '../../components/ui';
import type { EquipoDetalle } from '../../types/api';
import { recomendar } from '../recomendaciones/rules';

interface Item {
  ruta: string;
  etiqueta: string;
  icono: LucideIcon;
  contador?: number;
}

/** Navegación interna estilo Speccy. Solo muestra componentes con datos. */
export function EquipoNav({ equipo }: { equipo: EquipoDetalle }) {
  const inv = equipo.inventario;
  const componentes: Item[] = [
    { ruta: 'procesador', etiqueta: 'Procesador', icono: Cpu },
    { ruta: 'placa', etiqueta: 'Placa madre y BIOS', icono: CircuitBoard },
    { ruta: 'memoria', etiqueta: 'Memoria', icono: MemoryStick },
    { ruta: 'graficos', etiqueta: 'Gráficos', icono: MonitorCog },
    { ruta: 'almacenamiento', etiqueta: 'Almacenamiento', icono: HardDrive },
    ...(inv.bateria ? [{ ruta: 'bateria', etiqueta: 'Batería', icono: Battery }] : []),
    ...(inv.monitores?.length ? [{ ruta: 'monitores', etiqueta: 'Monitores', icono: Monitor }] : []),
  ];
  const analisis: Item[] = [
    { ruta: 'compatibilidad', etiqueta: 'Compatibilidad', icono: Puzzle },
    { ruta: 'recomendaciones', etiqueta: 'Recomendaciones', icono: TrendingUp, contador: recomendar(inv).length },
    { ruta: 'diagnostico', etiqueta: 'Diagnóstico', icono: Stethoscope },
    { ruta: 'historial', etiqueta: 'Historial', icono: History, contador: equipo.historial.length || undefined },
  ];

  const enlace = (i: Item, fin = false) => (
    <li key={i.ruta}>
      <NavLink to={i.ruta} end={fin} className={({ isActive }) => (isActive ? 'activo' : undefined)}>
        <Icon icono={i.icono} />
        <span>{i.etiqueta}</span>
        {!!i.contador && <span className="nav-contador num">{i.contador}</span>}
      </NavLink>
    </li>
  );

  return (
    <nav className="equipo-nav" aria-label="Secciones del equipo">
      <ul>{enlace({ ruta: '.', etiqueta: 'Resumen', icono: LayoutDashboard }, true)}</ul>
      <p className="equipo-nav-grupo">Componentes</p>
      <ul>{componentes.map((i) => enlace(i))}</ul>
      <p className="equipo-nav-grupo">Análisis</p>
      <ul>{analisis.map((i) => enlace(i))}</ul>
    </nav>
  );
}
