import { useConexion } from '../../hooks/useConexion';
import { useAhora } from '../../hooks/useAhora';
import { haceCuanto } from '../../lib/formato';

/** Indicador discreto del estado de la conexión con el servidor. */
export function EstadoConexionPie() {
  const { conectado, ultimoExito } = useConexion();
  const ahora = useAhora(15_000);
  return (
    <div className="conexion-pie" role="status">
      <span className={`punto ${conectado ? 'punto-ok' : 'punto-error'}`} aria-hidden="true" />
      <div>
        <div>{conectado ? 'Conectado' : 'Sin conexión'}</div>
        {ultimoExito && <div className="texto-terciario">Actualizado {haceCuanto(ultimoExito, ahora)}</div>}
      </div>
    </div>
  );
}
