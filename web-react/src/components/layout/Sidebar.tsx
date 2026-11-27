import { useState } from 'react';
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

export function NavPrincipal({ onNavegar, contraida = false }: { onNavegar?: () => void; contraida?: boolean }) {
  const { puede } = useSesion();
  return (
    <nav aria-label="Principal">
      {GRUPOS.map((g, i) => {
        const visibles = g.destinos.filter((d) => !d.roles || puede(...d.roles));
        if (!visibles.length) return null;
        return (
          <div key={g.titulo ?? i}>
            {g.titulo && (contraida ? <hr className="nav-separador" /> : <p className="nav-grupo-titulo">{g.titulo}</p>)}
            <ul className="nav-principal">
              {visibles.map((d) => (
                <li key={d.a}>
                  <NavLink
                    to={d.a}
                    end={d.fin}
                    onClick={onNavegar}
                    title={contraida ? d.etiqueta : undefined}
                    aria-label={contraida ? d.etiqueta : undefined}
                    className={({ isActive }) => (isActive ? 'activo' : undefined)}
                  >
                    <Icon icono={d.icono} tamano={20} />
                    <span className="nav-texto">{d.etiqueta}</span>
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

/** Logo y nombre. En la barra lateral es el botón que la contrae y expande. */
export function Marca({ onClick, contraida }: { onClick?: () => void; contraida?: boolean }) {
  const contenido = (
    <>
      <span className="marca-simbolo" aria-hidden="true" />
      <span className="nav-texto">ScanGP</span>
    </>
  );
  if (!onClick) return <span className="marca">{contenido}</span>;
  return (
    <button
      type="button"
      className="marca marca-boton"
      onClick={onClick}
      aria-expanded={!contraida}
      aria-label={contraida ? 'Expandir el menú lateral' : 'Contraer el menú lateral'}
      title={contraida ? 'Expandir menú' : 'Contraer menú'}
    >
      {contenido}
    </button>
  );
}

/** Iniciales para el avatar del usuario. */
const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');

/** Usuario con sesión y botón para cerrarla. */
export function UsuarioPie({ contraida = false }: { contraida?: boolean }) {
  const { usuario, cerrar } = useSesion();
  if (!usuario) return null;
  return (
    <div className="usuario-pie">
      <span className="avatar" title={contraida ? `${usuario.nombre} · ${ETIQUETA_ROL[usuario.rol]}` : undefined} aria-hidden="true">
        {iniciales(usuario.nombre)}
      </span>
      <div className="usuario-pie-texto nav-texto">
        <span>{usuario.nombre}</span>
        <span className="usuario-pie-rol">{ETIQUETA_ROL[usuario.rol]}</span>
      </div>
      <Button variante="fantasma" icono={LogOut} aria-label="Cerrar sesión" onClick={cerrar} className="nav-texto-boton" />
    </div>
  );
}

const CLAVE_CONTRAIDA = 'scangp.menuContraido';

/** Estado de la barra lateral contraída, recordado en el navegador. */
export function useBarraContraida() {
  const [contraida, setContraida] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_CONTRAIDA) === '1';
    } catch {
      return false;
    }
  });
  const alternar = () =>
    setContraida((c) => {
      try {
        localStorage.setItem(CLAVE_CONTRAIDA, c ? '0' : '1');
      } catch {
        /* sin almacenamiento: solo dura la sesión */
      }
      return !c;
    });
  return { contraida, alternar };
}

/** Barra lateral de escritorio (≥ 768 px). Se contrae a solo iconos con un clic en el logo. */
export function Sidebar({ contraida, alternar }: { contraida: boolean; alternar: () => void }) {
  return (
    <aside className={`barra-lateral${contraida ? ' barra-contraida' : ''}`}>
      <Marca onClick={alternar} contraida={contraida} />
      <NavPrincipal contraida={contraida} />
      <div className="barra-lateral-pie">
        <EstadoConexionPie />
        <UsuarioPie contraida={contraida} />
      </div>
    </aside>
  );
}
