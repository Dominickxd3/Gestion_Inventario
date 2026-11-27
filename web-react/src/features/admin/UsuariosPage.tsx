import { useState } from 'react';
import { KeyRound, Pencil, UserPlus } from 'lucide-react';
import { Button, ErrorState, LoadingState, PageHeader, SpecTable, StatusBadge } from '../../components/ui';
import { usePolling } from '../../hooks/usePolling';
import { useAhora } from '../../hooks/useAhora';
import { useSesion } from '../../hooks/SesionContext';
import { usuariosService } from '../../services/auth.service';
import { haceCuanto } from '../../lib/formato';
import { ETIQUETA_ROL, type UsuarioPlataforma } from '../../types/identidad';
import { PanelUsuario, type ModoPanel } from './PanelUsuario';

/** Administración de usuarios de la plataforma (solo ADMIN). */
export function UsuariosPage() {
  const lista = usePolling((s) => usuariosService.listar(s), 60_000);
  const ahora = useAhora(30_000);
  const { usuario: yo } = useSesion();
  const [panel, setPanel] = useState<ModoPanel | null>(null);

  return (
    <>
      <PageHeader
        titulo="Usuarios"
        subtitulo="Personas que pueden iniciar sesión en la plataforma y su rol."
        acciones={
          <Button variante="primario" icono={UserPlus} onClick={() => setPanel({ tipo: 'crear' })}>
            Nuevo usuario
          </Button>
        }
      />

      {lista.error && !lista.data ? (
        <ErrorState mensaje={lista.error.message} onReintentar={lista.recargar} />
      ) : !lista.data ? (
        <LoadingState />
      ) : (
        <SpecTable<UsuarioPlataforma>
          titulo="Usuarios"
          filas={lista.data}
          vacio="No hay usuarios."
          columnas={[
            { encabezado: 'Usuario', valor: (u) => u.nombreUsuario, mono: true },
            { encabezado: 'Nombre', valor: (u) => (u.id === yo?.id ? `${u.nombre} (tú)` : u.nombre) },
            { encabezado: 'Correo', valor: (u) => u.correo ?? '' },
            { encabezado: 'Rol', valor: (u) => ETIQUETA_ROL[u.rol] },
            {
              encabezado: 'Estado',
              valor: (u) =>
                !u.activo ? (
                  <StatusBadge estado="na" texto="Inactivo" />
                ) : u.debeCambiarPassword ? (
                  <StatusBadge estado="aviso" texto="Contraseña temporal" />
                ) : (
                  <StatusBadge estado="ok" texto="Activo" />
                ),
            },
            { encabezado: 'Último acceso', valor: (u) => (u.ultimoAcceso ? haceCuanto(u.ultimoAcceso, ahora) : 'Nunca') },
            {
              encabezado: 'Acciones',
              ancho: '96px',
              valor: (u) => (
                <span className="acciones-fila">
                  <Button variante="fantasma" icono={Pencil} aria-label={`Editar ${u.nombreUsuario}`} onClick={() => setPanel({ tipo: 'editar', usuario: u })} />
                  <Button
                    variante="fantasma"
                    icono={KeyRound}
                    aria-label={`Restablecer contraseña de ${u.nombreUsuario}`}
                    onClick={() => setPanel({ tipo: 'restablecer', usuario: u })}
                  />
                </span>
              ),
            },
          ]}
        />
      )}

      {panel && <PanelUsuario modo={panel} onCerrar={() => setPanel(null)} onCambio={lista.recargar} />}
    </>
  );
}
