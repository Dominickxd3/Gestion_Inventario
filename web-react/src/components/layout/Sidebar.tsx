import { NavLink } from 'react-router-dom';
import {
  ArrowLeftRight, Boxes, Building2, Cpu, Download, GitCompareArrows, House, Library, LogOut, ScanSearch, ScrollText, Settings,
  ShieldCheck, UserCog, Users, Warehouse, Wrench, type LucideIcon,
} from 'lucide-react';
import { Button, Icon } from '../ui';
import { EstadoConexionPie } from './EstadoConexionPie';
import { useSesion } from '../../hooks/SesionContext';
import { ETIQUETA_ROL, type Rol } from '../../types/identidad';

interface Destino {
  a: string;
  etiqueta: string;
  icono: LucideIcon;
  fin?: boolean;
  /** Si se indica, solo estos roles ven el destino. */
  roles?: Rol[];
}

interface Grupo {
  titulo?: string;
  destinos: Destino[];
}

/** Navegación por módulos (DESIGN.md §3). Los grupos se completan en las fases siguientes. */
const GRUPOS: Grupo[] = [
  { destinos: [{ a: '/', etiqueta: 'Inicio', icono: House, fin: true }] },
  {
    titulo: 'Inventario',
    destinos: [
      { a: '/activos', etiqueta: 'Activos', icono: Boxes },
      { a: '/componentes', etiqueta: 'Componentes', icono: Cpu },
    ],
  },
  {
    titulo: 'Operaciones',
    destinos: [
      { a: '/asignaciones', etiqueta: 'Asignaciones', icono: ArrowLeftRight },
      { a: '/mantenimiento', etiqueta: 'Mantenimiento', icono: Wrench },
      { a: '/garantias', etiqueta: 'Garantías', icono: ShieldCheck },
      { a: '/almacen', etiqueta: 'Almacén', icono: Warehouse },
    ],
  },
  {
    titulo: 'Descubrimiento',
    destinos: [
      { a: '/discrepancias', etiqueta: 'Discrepancias', icono: GitCompareArrows },
      { a: '/equipos', etiqueta: 'Equipos detectados', icono: ScanSearch },
      { a: '/detectar', etiqueta: 'Desplegar ScanGP', icono: Download, roles: ['ADMIN', 'TECNICO'] },
    ],
  },
  {
    titulo: 'Maestros',
    destinos: [
      { a: '/personas', etiqueta: 'Trabajadores', icono: Users },
      { a: '/organizacion', etiqueta: 'Organización', icono: Building2 },
      { a: '/catalogo', etiqueta: 'Catálogo', icono: Library },
    ],
  },
  {
    titulo: 'Administración',
    destinos: [
      { a: '/admin/usuarios', etiqueta: 'Usuarios', icono: UserCog, roles: ['ADMIN'] },
      { a: '/admin/auditoria', etiqueta: 'Auditoría', icono: ScrollText, roles: ['ADMIN'] },
      { a: '/admin/configuracion', etiqueta: 'Configuración', icono: Settings, roles: ['ADMIN'] },
    ],
  },
];

export function NavPrincipal({ onNavegar }: { onNavegar?: () => void }) {
  const { puede } = useSesion();
  return (
    <nav aria-label="Principal">
      {GRUPOS.map((g, i) => {
        const visibles = g.destinos.filter((d) => !d.roles || puede(...d.roles));
        if (!visibles.length) return null;
        return (
          <div key={g.titulo ?? i}>
            {g.titulo && <p className="nav-grupo-titulo">{g.titulo}</p>}
            <ul className="nav-principal">
              {visibles.map((d) => (
                <li key={d.a}>
                  <NavLink to={d.a} end={d.fin} onClick={onNavegar} className={({ isActive }) => (isActive ? 'activo' : undefined)}>
                    <Icon icono={d.icono} tamano={20} />
                    {d.etiqueta}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function Marca() {
  return (
    <span className="marca">
      <span className="marca-simbolo" aria-hidden="true" />
      ScanGP
    </span>
  );
}

/** Usuario con sesión y botón para cerrarla. */
export function UsuarioPie() {
  const { usuario, cerrar } = useSesion();
  if (!usuario) return null;
  return (
    <div className="usuario-pie">
      <div className="usuario-pie-texto">
        <span>{usuario.nombre}</span>
        <span className="usuario-pie-rol">{ETIQUETA_ROL[usuario.rol]}</span>
      </div>
      <Button variante="fantasma" icono={LogOut} aria-label="Cerrar sesión" onClick={cerrar} />
    </div>
  );
}

/** Barra lateral de escritorio (≥ 768 px). */
export function Sidebar() {
  return (
    <aside className="barra-lateral">
      <Marca />
      <NavPrincipal />
      <div className="barra-lateral-pie">
        <EstadoConexionPie />
        <UsuarioPie />
      </div>
    </aside>
  );
}
