import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface Miga {
  etiqueta: string;
  a?: string;
}

interface Props {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  acciones?: ReactNode;
  migas?: Miga[];
  icono?: ReactNode;
}

export function PageHeader({ titulo, subtitulo, acciones, migas, icono }: Props) {
  return (
    <header className="page-header">
      {migas && migas.length > 0 && (
        <nav aria-label="Ruta de navegación" className="migas">
          <ol>
            {migas.map((m, i) => (
              <li key={i}>
                {m.a ? <Link to={m.a}>{m.etiqueta}</Link> : <span aria-current="page">{m.etiqueta}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="page-header-fila">
        {icono && <div className="page-header-icono">{icono}</div>}
        <div className="page-header-texto">
          <h1>{titulo}</h1>
          {subtitulo && <p className="page-header-subtitulo">{subtitulo}</p>}
        </div>
        {acciones && <div className="page-header-acciones">{acciones}</div>}
      </div>
    </header>
  );
}
