import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Button, Icon, SelectField, SidePanel, TextField } from '../ui';

export interface Opcion {
  valor: string;
  etiqueta: string;
}

export interface Campo {
  nombre: string;
  etiqueta: string;
  tipo?: 'texto' | 'textarea' | 'select' | 'fecha' | 'numero' | 'casilla' | 'archivo';
  opciones?: Opcion[];
  /** Texto de la opción vacía en listas (si no se indica, la lista exige elegir). */
  vacio?: string;
  requerido?: boolean;
  ayuda?: ReactNode;
  placeholder?: string;
  /** Muestra el campo solo si se cumple la condición sobre los valores actuales. */
  visible?: (v: Valores) => boolean;
}

export type Valores = Record<string, string | boolean | File | null>;

interface Props {
  titulo: string;
  campos: Campo[];
  inicial?: Valores;
  textoEnviar?: string;
  /** Explicación breve encima del formulario. */
  descripcion?: ReactNode;
  onEnviar: (v: Record<string, unknown>) => Promise<unknown>;
  onCerrar: () => void;
  onHecho?: (resultado: unknown) => void;
}

/** Convierte los valores del formulario a lo que espera la API: vacío → null, número → number. */
function limpiar(campos: Campo[], v: Valores) {
  const r: Record<string, unknown> = {};
  for (const c of campos) {
    if (c.visible && !c.visible(v)) continue;
    const x = v[c.nombre];
    if (c.tipo === 'casilla') r[c.nombre] = !!x;
    else if (c.tipo === 'archivo') r[c.nombre] = x ?? null;
    else if (typeof x === 'string' && x.trim() === '') r[c.nombre] = null;
    else if (c.tipo === 'numero' && typeof x === 'string') r[c.nombre] = Number(x);
    else r[c.nombre] = typeof x === 'string' ? x.trim() : x;
  }
  return r;
}

/** Formulario en panel lateral para operaciones cortas (DESIGN.md §4.6), configurado con una lista de campos. */
export function PanelFormulario({ titulo, campos, inicial = {}, textoEnviar = 'Guardar', descripcion, onEnviar, onCerrar, onHecho }: Props) {
  const [valores, setValores] = useState<Valores>(() => ({ ...Object.fromEntries(campos.map((c) => [c.nombre, c.tipo === 'casilla' ? false : ''])), ...inicial }));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const idForm = useId();
  const poner = (k: string, x: string | boolean | File | null) => setValores((v) => ({ ...v, [k]: x }));

  const enviar = async (e?: FormEvent) => {
    e?.preventDefault();
    const faltan: Record<string, string> = {};
    for (const c of campos) {
      if (!c.requerido || (c.visible && !c.visible(valores))) continue;
      const x = valores[c.nombre];
      if (x === null || x === undefined || (typeof x === 'string' && !x.trim())) faltan[c.nombre] = 'Obligatorio';
    }
    setErrores(faltan);
    if (Object.keys(faltan).length) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await onEnviar(limpiar(campos, valores));
      onHecho?.(r);
      onCerrar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SidePanel
      titulo={titulo}
      abierto
      onCerrar={onCerrar}
      pie={
        <>
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button variante="primario" onClick={() => void enviar()} disabled={enviando}>
            {enviando ? 'Guardando…' : textoEnviar}
          </Button>
        </>
      }
    >
      <form id={idForm} className="formulario" onSubmit={enviar} noValidate>
        {descripcion && <div className="texto-secundario">{descripcion}</div>}
        {error && (
          <div className="aviso-formulario aviso-formulario-error" role="alert">
            <Icon icono={CircleAlert} />
            <span>{error}</span>
          </div>
        )}
        {campos
          .filter((c) => !c.visible || c.visible(valores))
          .map((c) => {
            const etiqueta = c.requerido ? c.etiqueta : `${c.etiqueta} (opcional)`;
            const comun = { etiqueta, ayuda: c.ayuda, error: errores[c.nombre] };
            if (c.tipo === 'select') {
              return (
                <SelectField
                  key={c.nombre}
                  {...comun}
                  opciones={[{ valor: '', etiqueta: c.vacio ?? 'Elegir…' }, ...(c.opciones ?? [])]}
                  value={String(valores[c.nombre] ?? '')}
                  onChange={(e) => poner(c.nombre, e.target.value)}
                />
              );
            }
            if (c.tipo === 'textarea') {
              return (
                <TextAreaField key={c.nombre} {...comun} value={String(valores[c.nombre] ?? '')} onChange={(x) => poner(c.nombre, x)} />
              );
            }
            if (c.tipo === 'casilla') {
              return (
                <label key={c.nombre} className="casilla">
                  <input type="checkbox" checked={!!valores[c.nombre]} onChange={(e) => poner(c.nombre, e.target.checked)} />
                  <span>{c.etiqueta}</span>
                </label>
              );
            }
            if (c.tipo === 'archivo') {
              return (
                <TextField key={c.nombre} {...comun} type="file" onChange={(e) => poner(c.nombre, e.target.files?.[0] ?? null)} />
              );
            }
            return (
              <TextField
                key={c.nombre}
                {...comun}
                type={c.tipo === 'fecha' ? 'date' : c.tipo === 'numero' ? 'number' : 'text'}
                placeholder={c.placeholder}
                value={String(valores[c.nombre] ?? '')}
                onChange={(e) => poner(c.nombre, e.target.value)}
              />
            );
          })}
        <button type="submit" hidden />
      </form>
    </SidePanel>
  );
}

function TextAreaField({ etiqueta, ayuda, error, value, onChange }: { etiqueta: string; ayuda?: ReactNode; error?: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className={`form-campo${error ? ' form-campo-invalido' : ''}`}>
      <label htmlFor={id} className="campo-etiqueta">
        {etiqueta}
      </label>
      <textarea id={id} className="campo-control campo-area" rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      {ayuda && !error && <p className="campo-ayuda">{ayuda}</p>}
      {error && <p className="campo-error">{error}</p>}
    </div>
  );
}
