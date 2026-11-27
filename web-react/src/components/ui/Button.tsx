import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Icon } from './Icon';

type Variante = 'primario' | 'secundario' | 'fantasma';

interface Props {
  variante?: Variante;
  icono?: LucideIcon;
  /** Enlace interno (react-router). */
  a?: string;
  /** Enlace normal (descargas). */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** submit para enviar formularios. */
  tipo?: 'button' | 'submit';
  'aria-label'?: string;
  className?: string;
  children?: ReactNode;
}

/** Botón del sistema. Se renderiza como <button>, <Link> o <a> según las props. */
export function Button({ variante = 'secundario', icono, a, href, onClick, disabled, tipo = 'button', className = '', children, ...aria }: Props) {
  const clase = ['boton', `boton-${variante}`, !children && 'boton-solo-icono', className].filter(Boolean).join(' ');
  const contenido = (
    <>
      {icono && <Icon icono={icono} />}
      {children && <span>{children}</span>}
    </>
  );
  if (a) {
    return (
      <Link to={a} className={clase} onClick={onClick} {...aria}>
        {contenido}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={clase} onClick={onClick} {...aria}>
        {contenido}
      </a>
    );
  }
  return (
    <button type={tipo} className={clase} onClick={onClick} disabled={disabled} {...aria}>
      {contenido}
    </button>
  );
}
