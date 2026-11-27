import { useId, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Icon } from './Icon';

interface Props {
  titulo: ReactNode;
  resumen?: ReactNode;
  abiertoInicial?: boolean;
  children: ReactNode;
}

/** Bloque expandible para detalles técnicos avanzados. */
export function Disclosure({ titulo, resumen, abiertoInicial = false, children }: Props) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const id = useId();
  return (
    <div className={`disclosure ${abierto ? 'abierto' : ''}`}>
      <button type="button" className="disclosure-boton" aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto(!abierto)}>
        <Icon icono={ChevronRight} className="disclosure-chevron" />
        <span className="disclosure-titulo">{titulo}</span>
        {resumen && !abierto && <span className="disclosure-resumen">{resumen}</span>}
      </button>
      <div id={id} className="disclosure-contenido" hidden={!abierto}>
        {children}
      </div>
    </div>
  );
}
