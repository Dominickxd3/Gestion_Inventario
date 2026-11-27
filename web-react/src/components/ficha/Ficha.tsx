import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { Button, Icon } from '../ui';
import './ficha.css';

/** Dato destacado del resumen de una ficha: etiqueta pequeña, valor y una línea de detalle. */
export interface DatoResumen {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  icono?: LucideIcon;
  /** Lleva a otra pantalla al hacer clic en la tarjeta. */
  a?: string;
  /** Resalta la tarjeta: es lo primero que hay que mirar (dónde está, quién lo tiene). */
  destacado?: boolean;
}

/**
 * Resumen de la ficha (DESIGN.md §4.3): responde de un vistazo "dónde está, quién lo tiene y en qué estado",
 * en tarjetas del mismo alto en vez de una franja de texto corrido.
 */
export function ResumenFicha({ datos }: { datos: DatoResumen[] }) {
  return (
    <section className="resumen-ficha" aria-label="Resumen">
      {datos.map((d) => {
        const contenido = (
          <>
            <span className="resumen-etiqueta">
              {d.icono && <Icon icono={d.icono} />}
              {d.etiqueta}
            </span>
            <span className="resumen-valor">{d.valor}</span>
            {d.detalle && <span className="resumen-detalle">{d.detalle}</span>}
          </>
        );
        const clase = `resumen-tarjeta${d.destacado ? ' resumen-destacado' : ''}`;
        return d.a
          ? <Link key={d.etiqueta} to={d.a} className={`${clase} resumen-enlace`}>{contenido}</Link>
          : <div key={d.etiqueta} className={clase}>{contenido}</div>;
      })}
    </section>
  );
}

export interface AccionMenu {
  etiqueta: string;
  icono?: LucideIcon;
  onClick: () => void;
  peligro?: boolean;
}

/** "Más acciones": las operaciones poco frecuentes salen de la cabecera y quedan a un clic. */
export function MenuMas({ acciones, etiqueta = 'Más acciones' }: { acciones: AccionMenu[]; etiqueta?: string }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrarFuera = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAbierto(false); };
    const cerrarEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', cerrarFuera);
    document.addEventListener('keydown', cerrarEsc);
    raiz.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', cerrarFuera);
      document.removeEventListener('keydown', cerrarEsc);
    };
  }, [abierto]);

  if (!acciones.length) return null;
  return (
    <div className="menu-mas" ref={raiz}>
      <Button icono={MoreHorizontal} aria-haspopup="menu" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
        {etiqueta}
      </Button>
      {abierto && (
        <div className="menu-mas-lista" role="menu">
          {acciones.map((a, i) => (
            <button
              key={a.etiqueta}
              type="button"
              role="menuitem"
              className={`menu-mas-item${a.peligro ? ' peligro' : ''}${a.peligro && i > 0 && !acciones[i - 1].peligro ? ' separado' : ''}`}
              onClick={() => { setAbierto(false); a.onClick(); }}
            >
              {a.icono && <Icon icono={a.icono} />}
              {a.etiqueta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Ficha en dos columnas: contenido principal y columna lateral con los datos fijos. */
export function FichaColumnas({ principal, lateral }: { principal: ReactNode; lateral: ReactNode }) {
  return (
    <div className="ficha-layout">
      <div className="ficha-principal">{principal}</div>
      <aside className="ficha-lateral">{lateral}</aside>
    </div>
  );
}

/** Pestañas por parámetro ?tab= (se pueden enlazar y sobreviven a recargar). */
export function PestanasFicha({ pestanas, actual, etiqueta }: {
  pestanas: { clave: string; nombre: string; contador?: number }[];
  actual: string;
  etiqueta: string;
}) {
  return (
    <nav className="pestanas" aria-label={etiqueta}>
      {pestanas.map((p) => (
        <Link key={p.clave} to={`?tab=${p.clave}`} replace className={actual === p.clave ? 'activo' : undefined} aria-current={actual === p.clave ? 'page' : undefined}>
          {p.nombre}
          {!!p.contador && <span className="contador">{p.contador}</span>}
        </Link>
      ))}
    </nav>
  );
}
