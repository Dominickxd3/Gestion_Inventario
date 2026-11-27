import { useState, type FormEvent } from 'react';
import { CircleAlert, LogIn } from 'lucide-react';
import { Button, Icon, TextField } from '../../components/ui';
import { Marca } from '../../components/layout/Sidebar';
import { useSesion } from '../../hooks/SesionContext';

/** Inicio de sesión. Sin decoración: marca, dos campos y un botón. */
export function LoginPage() {
  const { iniciar, estado } = useSesion();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(estado.tipo === 'sin-sesion' ? (estado.motivo ?? null) : null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !password) {
      setError('Escribe tu usuario y tu contraseña.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await iniciar(usuario.trim(), password);
    } catch (err) {
      setError((err as Error).message);
      setPassword('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="acceso">
      <main className="acceso-panel">
        <Marca />
        <h1 className="acceso-titulo">Iniciar sesión</h1>
        <form className="formulario" onSubmit={enviar} noValidate>
          {error && (
            <div className="aviso-formulario aviso-formulario-error" role="alert">
              <Icon icono={CircleAlert} />
              <span>{error}</span>
            </div>
          )}
          <TextField
            etiqueta="Usuario"
            name="usuario"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
          <TextField
            etiqueta="Contraseña"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button tipo="submit" variante="primario" icono={LogIn} disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
        <p className="acceso-nota">¿No tienes acceso o olvidaste tu contraseña? Pídelo al administrador de la plataforma.</p>
      </main>
    </div>
  );
}
