import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';

interface Props {
  titulo: string;
  descripcion?: ReactNode;
  onCerrar: () => void;
  /** Botones del pie (p. ej. Cancelar / Guardar). */
  pie?: ReactNode;
  children: ReactNode;
}

/** Modal flotante centrado que ocupa casi todo el viewport, para formularios grandes. */
export function ModalFlotante({ titulo, descripcion, onCerrar, pie, children }: Props) {
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = anterior; };
  }, []);

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-flotante" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-flotante-cabecera">
          <div>
            <h2>{titulo}</h2>
            {descripcion && <p className="texto-secundario" style={{ marginTop: 4 }}>{descripcion}</p>}
          </div>
          <Button variante="fantasma" icono={X} aria-label="Cerrar" onClick={onCerrar} />
        </div>
        <div className="modal-flotante-cuerpo">{children}</div>
        {pie && <div className="modal-flotante-pie">{pie}</div>}
      </div>
    </div>,
    document.body,
  );
}
