import type { ReactNode } from 'react';
import { Sidebar } from 'primereact/sidebar';
import { X } from 'lucide-react';
import { Button } from './Button';

interface Props {
  titulo: string;
  abierto: boolean;
  onCerrar: () => void;
  /** Botones del pie (p. ej. Cancelar / Guardar). */
  pie?: ReactNode;
  children: ReactNode;
}

/** Panel lateral derecho de 480 px para operaciones cortas (DESIGN.md §4.6). Esc cierra y devuelve el foco. */
export function SidePanel({ titulo, abierto, onCerrar, pie, children }: Props) {
  return (
    <Sidebar
      visible={abierto}
      position="right"
      onHide={onCerrar}
      showCloseIcon={false}
      blockScroll
      className="panel-lateral"
      aria-label={titulo}
      header={
        <div className="panel-lateral-cabecera">
          <h2>{titulo}</h2>
          <Button variante="fantasma" icono={X} aria-label="Cerrar" onClick={onCerrar} />
        </div>
      }
    >
      <div className="panel-lateral-cuerpo">{children}</div>
      {pie && <div className="panel-lateral-pie">{pie}</div>}
    </Sidebar>
  );
}
