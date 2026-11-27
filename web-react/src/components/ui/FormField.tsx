import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { CircleAlert } from 'lucide-react';
import { Icon } from './Icon';

interface Base {
  etiqueta: string;
  ayuda?: ReactNode;
  error?: string | null;
}

function Envoltorio({ id, etiqueta, ayuda, error, children }: Base & { id: string; children: ReactNode }) {
  return (
    <div className={`form-campo${error ? ' form-campo-invalido' : ''}`}>
      <label htmlFor={id} className="campo-etiqueta">
        {etiqueta}
      </label>
      {children}
      {ayuda && !error && (
        <p id={`${id}-ayuda`} className="campo-ayuda">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="campo-error" role="alert">
          <Icon icono={CircleAlert} />
          {error}
        </p>
      )}
    </div>
  );
}

/** Campo de texto con etiqueta encima, ayuda y error debajo (DESIGN.md §4.6). */
export function TextField({ etiqueta, ayuda, error, ...input }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Envoltorio id={id} etiqueta={etiqueta} ayuda={ayuda} error={error}>
      <input
        id={id}
        className="campo-control"
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined}
        {...input}
      />
    </Envoltorio>
  );
}

export function SelectField({
  etiqueta,
  ayuda,
  error,
  opciones,
  ...select
}: Base & SelectHTMLAttributes<HTMLSelectElement> & { opciones: { valor: string; etiqueta: string }[] }) {
  const id = useId();
  return (
    <Envoltorio id={id} etiqueta={etiqueta} ayuda={ayuda} error={error}>
      <select id={id} className="campo-control" aria-describedby={ayuda ? `${id}-ayuda` : undefined} {...select}>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </Envoltorio>
  );
}
