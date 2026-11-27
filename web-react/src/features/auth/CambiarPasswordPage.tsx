import { useState, type FormEvent } from 'react';
import { CircleAlert, KeyRound } from 'lucide-react';
import { Button, Icon, TextField } from '../../components/ui';
import { Marca } from '../../components/layout/Sidebar';
import { useSesion } from '../../hooks/SesionContext';

const MINIMO = 10;

/** Cambio obligatorio de la contraseña temporal en el primer acceso o tras un restablecimiento. */
export function CambiarPasswordPage() {
  const { usuario, cambiarPassword, cerrar } = useSesion();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [errores, setErrores] = useState<{ nueva?: string; repetida?: string; general?: string }>({});
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const err: typeof errores = {};
    if (nueva.length < MINIMO) err.nueva = `Debe tener al menos ${MINIMO} caracteres.`;
    else if (nueva === actual) err.nueva = 'Debe ser distinta de la temporal.';
    if (repetida !== nueva) err.repetida = 'No coincide con la contraseña nueva.';
    setErrores(err);
    if (Object.keys(err).length) return;

    setEnviando(true);
    try {
      await cambiarPassword(actual, nueva);
    } catch (e2) {
      setErrores({ general: (e2 as Error).message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="acceso">
      <main className="acceso-panel">
        <Marca />
        <h1 className="acceso-titulo">Crea tu contraseña</h1>
        <p className="texto-secundario">
          {usuario?.nombre}, estás usando una contraseña temporal. Elige una nueva para continuar.
        </p>
        <form className="formulario" onSubmit={enviar} noValidate>
          {errores.general && (
            <div className="aviso-formulario aviso-formulario-error" role="alert">
              <Icon icono={CircleAlert} />
              <span>{errores.general}</span>
            </div>
          )}
          <input type="text" name="usuario" autoComplete="username" value={usuario?.nombreUsuario ?? ''} readOnly hidden />
          <TextField
            etiqueta="Contraseña temporal"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={actual}
            onChange={(e) => setActual(e.target.value)}
          />
          <TextField
            etiqueta="Contraseña nueva"
            type="password"
            autoComplete="new-password"
            ayuda={`Al menos ${MINIMO} caracteres. Una frase larga es más segura y fácil de recordar.`}
            error={errores.nueva}
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
          />
          <TextField
            etiqueta="Repite la contraseña nueva"
            type="password"
            autoComplete="new-password"
            error={errores.repetida}
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
          />
          <Button tipo="submit" variante="primario" icono={KeyRound} disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar y continuar'}
          </Button>
        </form>
        <Button variante="fantasma" onClick={cerrar}>
          Cerrar sesión
        </Button>
      </main>
    </div>
  );
}
