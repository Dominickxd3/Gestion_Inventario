import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useSesion } from '../../hooks/SesionContext';
import { useAvisos } from '../ui/alertas';
import { CircleAlert } from 'lucide-react';
import { Button, Icon, ModalFlotante, SelectField, TextField } from '../ui';

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
  modal?: boolean;
  /** Identidad estable del borrador, separada por registro. */
  borradorId?: string;
  onEnviar: (v: Record<string, unknown>) => Promise<unknown>;
  onCerrar: () => void;
  onHecho?: (resultado: unknown) => void;
}

// Respaldo en memoria cuando el navegador bloquea sessionStorage.
const borradores = new Map<string, Valores>();
function leerBorrador(clave: string): Valores {
  try {
    const datos: unknown = JSON.parse(sessionStorage.getItem(clave) ?? 'null');
    if (datos && typeof datos === 'object' && !Array.isArray(datos)) {
      return Object.fromEntries(Object.entries(datos).filter(([, v]) => v === null || typeof v === 'string' || typeof v === 'boolean'));
    }
  } catch { /* Se conserva el respaldo en memoria. */ }
  return borradores.get(clave) ?? {};
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

/** Formulario flotante centrado; modal elige la distribución de los campos. */
export function PanelFormulario({ titulo, campos, inicial = {}, textoEnviar = 'Guardar', descripcion, modal = true, borradorId, onEnviar, onCerrar, onHecho }: Props) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const [claveBorrador] = useState(() => JSON.stringify(['formulario', usuario?.id, window.location.pathname, borradorId ?? [titulo, inicial]]));
  const [valores, setValores] = useState<Valores>(() => ({ ...Object.fromEntries(campos.map((c) => [c.nombre, c.tipo === 'casilla' ? false : ''])), ...inicial, ...leerBorrador(claveBorrador) }));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const idForm = useId();
  const poner = (k: string, x: string | boolean | File | null) => {
    const siguientes = { ...valores, [k]: x };
    borradores.set(claveBorrador, siguientes);
    try {
      sessionStorage.setItem(claveBorrador, JSON.stringify(Object.fromEntries(Object.entries(siguientes).filter(([, v]) => !(v instanceof File)))));
    } catch { /* El borrador sigue disponible en memoria. */ }
    setValores(siguientes);
  };

  const enviar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (enviando) return;
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
      borradores.delete(claveBorrador);
      try { sessionStorage.removeItem(claveBorrador); } catch { /* Sin almacenamiento disponible. */ }
      onHecho?.(r);
      onCerrar();
      avisar({ severity: 'success', summary: 'Guardado correctamente', detail: 'Los cambios se guardaron.', life: 3500 });
    } catch (err) {
      const mensaje = (err as Error).message;
      setError(mensaje);
      avisar({ severity: 'error', summary: 'No se pudo guardar', detail: mensaje, life: 7000 });
    } finally {
      setEnviando(false);
    }
  };

  const pie = (
    <>
      <Button variante="primario" onClick={() => void enviar()} disabled={enviando}>
        {enviando ? 'Guardando…' : textoEnviar}
      </Button>
    </>
  );

  const cuerpo = (
    <form id={idForm} className={modal ? 'formulario-2col' : 'formulario'} onSubmit={enviar} noValidate>
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
          const esAncho = modal && (c.tipo === 'textarea' || c.tipo === 'casilla');
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
              <div key={c.nombre} className={esAncho ? 'form-campo-ancho' : undefined}>
                <TextAreaField {...comun} value={String(valores[c.nombre] ?? '')} onChange={(x) => poner(c.nombre, x)} />
              </div>
            );
          }
          if (c.tipo === 'casilla') {
            return (
              <div key={c.nombre} className={esAncho ? 'form-campo-ancho' : undefined}>
                <label className="casilla">
                  <input type="checkbox" checked={!!valores[c.nombre]} onChange={(e) => poner(c.nombre, e.target.checked)} />
                  <span>{c.etiqueta}</span>
                </label>
              </div>
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
  );

  return (
    <ModalFlotante titulo={titulo} descripcion={descripcion} onCerrar={onCerrar} pie={pie}>
      {cuerpo}
    </ModalFlotante>
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
