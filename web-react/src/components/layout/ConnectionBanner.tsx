import { WifiOff } from 'lucide-react';
import { useConexion } from '../../hooks/useConexion';
import { useAhora } from '../../hooks/useAhora';
import { haceCuanto } from '../../lib/formato';
import { Icon } from '../ui';

/** Aviso fijo cuando la API no responde. Los datos ya cargados siguen visibles. */
export function ConnectionBanner() {
  const { conectado, ultimoExito } = useConexion();
  const ahora = useAhora(15_000);
  if (conectado) return null;
  return (
    <div className="aviso-conexion" role="alert">
      <Icon icono={WifiOff} />
      <span>
        Sin conexión con el servidor.{' '}
        {ultimoExito
          ? `Se muestran los últimos datos recibidos (${haceCuanto(ultimoExito, ahora)}).`
          : 'Aún no se han recibido datos.'}{' '}
        Reintentando automáticamente.
      </span>
    </div>
  );
}
