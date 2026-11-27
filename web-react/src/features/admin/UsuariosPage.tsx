import { useState } from 'react';
import { KeyRound, Pencil, Power, PowerOff } from 'lucide-react';
import { PageHeader, StatusBadge } from '../../components/ui';
import { TablaCrud } from '../../components/crud/TablaCrud';
import { useConfirmar } from '../../components/crud/Confirmar';
import { usePolling } from '../../hooks/usePolling';
import { useAhora } from '../../hooks/useAhora';
import { useSesion } from '../../hooks/SesionContext';
import { usuariosService } from '../../services/auth.service';
import { haceCuanto } from '../../lib/formato';
import { ETIQUETA_ROL, type UsuarioPlataforma } from '../../types/identidad';
import { PanelUsuario, type ModoPanel } from './PanelUsuario';

/** Administración de usuarios de la plataforma (solo ADMIN). Sin borrado: se desactivan. */
export function UsuariosPage() {
  const lista = usePolling((s) => usuariosService.listar(s), 60_000);
  const ahora = useAhora(30_000);
  const { usuario: yo } = useSesion();
  const confirmar = useConfirmar();
  const [panel, setPanel] = useState<ModoPanel | null>(null);
  const esYo = (u: UsuarioPlataforma) => u.id === yo?.id;

  const alternar = async (u: UsuarioPlataforma) => {
    const ok = await confirmar({
      titulo: u.activo ? 'Desactivar usuario' : 'Activar usuario',
      mensaje: u.activo
        ? `${u.nombre} no podrá iniciar sesión y sus sesiones abiertas se cierran. Su historial en la auditoría se conserva.`
        : `${u.nombre} podrá volver a iniciar sesión.`,
      accion: u.activo ? 'Desactivar' : 'Activar',
      peligro: u.activo,
    });
    if (!ok) return;
    await usuariosService.actualizar(u.id, { activo: !u.activo });
    lista.recargar();
  };

  return (
    <>
      <PageHeader titulo="Usuarios" subtitulo="Personas que pueden iniciar sesión en la plataforma y su rol." />
      <TablaCrud<UsuarioPlataforma>
        titulo="Usuarios"
        filas={lista.data}
        error={lista.error}
        onReintentar={lista.recargar}
        textoBusqueda={(u) => `${u.nombreUsuario} ${u.nombre} ${u.correo ?? ''} ${ETIQUETA_ROL[u.rol]}`}
        nuevo={{ etiqueta: 'Nuevo usuario', onClick: () => setPanel({ tipo: 'crear' }) }}
        acciones={[
          { etiqueta: 'Editar', icono: Pencil, onClick: (u) => setPanel({ tipo: 'editar', usuario: u }) },
          { etiqueta: 'Restablecer contraseña', icono: KeyRound, onClick: (u) => setPanel({ tipo: 'restablecer', usuario: u }) },
          { etiqueta: 'Desactivar', icono: PowerOff, peligro: true, grupo: 'estado', onClick: (u) => void alternar(u), visible: (u) => u.activo && !esYo(u) },
          { etiqueta: 'Activar', icono: Power, grupo: 'estado', onClick: (u) => void alternar(u), visible: (u) => !u.activo },
        ]}
        vacio="No hay usuarios."
        columnas={[
          { encabezado: 'Usuario', mono: true, ordenar: (u) => u.nombreUsuario, valor: (u) => u.nombreUsuario },
          { encabezado: 'Nombre', ordenar: (u) => u.nombre, valor: (u) => (esYo(u) ? `${u.nombre} (tú)` : u.nombre) },
          { encabezado: 'Correo', valor: (u) => u.correo, secundaria: true },
          { encabezado: 'Rol', ordenar: (u) => u.rol, valor: (u) => ETIQUETA_ROL[u.rol] },
          {
            encabezado: 'Estado',
            ordenar: (u) => (u.activo ? (u.debeCambiarPassword ? 1 : 0) : 2),
            valor: (u) => !u.activo
              ? <StatusBadge estado="na" texto="Inactivo" />
              : u.debeCambiarPassword ? <StatusBadge estado="aviso" texto="Contraseña temporal" /> : <StatusBadge estado="ok" texto="Activo" />,
          },
          { encabezado: 'Último acceso', ordenar: (u) => u.ultimoAcceso ?? '', valor: (u) => (u.ultimoAcceso ? haceCuanto(u.ultimoAcceso, ahora) : 'Nunca'), secundaria: true },
        ]}
      />
      {panel && <PanelUsuario modo={panel} onCerrar={() => setPanel(null)} onCambio={lista.recargar} />}
    </>
  );
}
