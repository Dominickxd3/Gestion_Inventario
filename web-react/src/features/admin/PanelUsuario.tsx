import { useState, type FormEvent } from 'react';
import { Check, CircleAlert, Copy } from 'lucide-react';
import { Button, Icon, SelectField, SidePanel, TextField } from '../../components/ui';
import { usuariosService } from '../../services/auth.service';
import { DESCRIPCION_ROL, ETIQUETA_ROL, type Rol, type UsuarioPlataforma } from '../../types/identidad';

export type ModoPanel =
  | { tipo: 'crear' }
  | { tipo: 'editar'; usuario: UsuarioPlataforma }
  | { tipo: 'restablecer'; usuario: UsuarioPlataforma };

const ROLES: Rol[] = ['ADMIN', 'TECNICO', 'CONSULTA'];
const OPCIONES_ROL = ROLES.map((r) => ({ valor: r, etiqueta: `${ETIQUETA_ROL[r]} — ${DESCRIPCION_ROL[r]}` }));

interface Props {
  modo: ModoPanel;
  onCerrar: () => void;
  onCambio: () => void;
}

/** Crear, editar o restablecer la contraseña de un usuario, en panel lateral. */
export function PanelUsuario({ modo, onCerrar, onCambio }: Props) {
  const existente = modo.tipo === 'crear' ? null : modo.usuario;
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [nombre, setNombre] = useState(existente?.nombre ?? '');
  const [correo, setCorreo] = useState(existente?.correo ?? '');
  const [rol, setRol] = useState<Rol>(existente?.rol ?? 'TECNICO');
  const [activo, setActivo] = useState(existente?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  /** Contraseña temporal recién generada: se muestra una sola vez. */
  const [temporal, setTemporal] = useState<{ usuario: string; password: string } | null>(null);

  const titulo =
    modo.tipo === 'crear' ? 'Nuevo usuario' : modo.tipo === 'editar' ? `Editar ${modo.usuario.nombreUsuario}` : 'Restablecer contraseña';

  const ejecutar = async (accion: () => Promise<void>) => {
    setEnviando(true);
    setError(null);
    try {
      await accion();
      onCambio();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const guardar = (e?: FormEvent) => {
    e?.preventDefault();
    void ejecutar(async () => {
      if (modo.tipo === 'crear') {
        const r = await usuariosService.crear({ nombreUsuario: nombreUsuario.trim(), nombre: nombre.trim(), correo: correo.trim() || null, rol });
        setTemporal({ usuario: r.usuario.nombreUsuario, password: r.passwordTemporal });
      } else if (modo.tipo === 'editar') {
        await usuariosService.actualizar(modo.usuario.id, { nombre: nombre.trim(), correo: correo.trim() || null, rol, activo });
        onCerrar();
      } else {
        const r = await usuariosService.restablecerPassword(modo.usuario.id);
        setTemporal({ usuario: modo.usuario.nombreUsuario, password: r.passwordTemporal });
      }
    });
  };

  const pie = temporal ? (
    <Button variante="primario" onClick={onCerrar}>
      Listo
    </Button>
  ) : (
    <>
      <Button onClick={onCerrar}>Cancelar</Button>
      <Button variante="primario" onClick={() => guardar()} disabled={enviando}>
        {modo.tipo === 'crear' ? 'Crear usuario' : modo.tipo === 'editar' ? 'Guardar' : 'Generar contraseña temporal'}
      </Button>
    </>
  );

  return (
    <SidePanel titulo={titulo} abierto onCerrar={onCerrar} pie={pie}>
      {temporal ? (
        <MostrarTemporal {...temporal} />
      ) : (
        <form className="formulario" onSubmit={guardar} noValidate>
          {error && (
            <div className="aviso-formulario aviso-formulario-error" role="alert">
              <Icon icono={CircleAlert} />
              <span>{error}</span>
            </div>
          )}
          {modo.tipo === 'restablecer' ? (
            <p className="texto-secundario">
              Se generará una contraseña temporal para <strong>{modo.usuario.nombre}</strong> ({modo.usuario.nombreUsuario}). Sus
              sesiones abiertas se cerrarán y deberá elegir una contraseña nueva al entrar.
            </p>
          ) : (
            <>
              {modo.tipo === 'crear' && (
                <TextField
                  etiqueta="Usuario"
                  ayuda="Con el que inicia sesión. Letras, números, punto, guion o guion bajo."
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                  value={nombreUsuario}
                  onChange={(e) => setNombreUsuario(e.target.value)}
                />
              )}
              <TextField etiqueta="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <TextField etiqueta="Correo (opcional)" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
              <SelectField etiqueta="Rol" opciones={OPCIONES_ROL} value={rol} onChange={(e) => setRol(e.target.value as Rol)} />
              {modo.tipo === 'editar' && (
                <SelectField
                  etiqueta="Estado"
                  ayuda="Un usuario inactivo no puede iniciar sesión. Su historial se conserva."
                  opciones={[
                    { valor: 'si', etiqueta: 'Activo' },
                    { valor: 'no', etiqueta: 'Inactivo' },
                  ]}
                  value={activo ? 'si' : 'no'}
                  onChange={(e) => setActivo(e.target.value === 'si')}
                />
              )}
              <button type="submit" hidden />
            </>
          )}
        </form>
      )}
    </SidePanel>
  );
}

function MostrarTemporal({ usuario, password }: { usuario: string; password: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopiado(true);
    } catch {
      /* se puede seleccionar a mano */
    }
  };
  return (
    <div className="formulario">
      <p className="texto-secundario">
        Contraseña temporal de <strong>{usuario}</strong>. Entrégala por un canal privado: <strong>no se volverá a mostrar</strong>.
        Se pedirá cambiarla en el primer inicio de sesión.
      </p>
      <div className="secreto">
        <span>{password}</span>
        <Button variante="fantasma" icono={copiado ? Check : Copy} aria-label={copiado ? 'Copiada' : 'Copiar contraseña'} onClick={copiar} />
      </div>
    </div>
  );
}
