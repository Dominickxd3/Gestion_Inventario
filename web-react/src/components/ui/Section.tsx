import { useId, type ReactNode } from 'react';

interface Props {
  titulo: ReactNode;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  children: ReactNode;
}

/** Sección de contenido: título + divisor. No es una tarjeta. */
export function Section({ titulo, descripcion, acciones, children }: Props) {
  const id = useId();
  return (
    <section className="seccion" aria-labelledby={id}>
      <div className="seccion-cabecera">
        <div>
          <h2 id={id}>{titulo}</h2>
          {descripcion && <p className="seccion-descripcion">{descripcion}</p>}
        </div>
        {acciones && <div className="seccion-acciones">{acciones}</div>}
      </div>
      {children}
    </section>
  );
}
