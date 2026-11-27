import { Disclosure, ErrorState, KeyValueList, LoadingState } from '../../components/ui';
import { usePolling } from '../../hooks/usePolling';
import { equiposService } from '../../services/equipos.service';
import { fecha } from '../../lib/formato';

export function DetallesTecnicosEquipo({ dispositivoId }: { dispositivoId: string }) {
  return <Disclosure titulo="Detalles técnicos" resumen="Placa base y BIOS"><DatosTecnicos dispositivoId={dispositivoId} /></Disclosure>;
}
function DatosTecnicos({ dispositivoId }: { dispositivoId: string }) {
  const datos = usePolling((s) => equiposService.obtener(dispositivoId, s), 60_000, dispositivoId);
  if (!datos.data) return datos.error ? <ErrorState mensaje={datos.error.message} onReintentar={datos.recargar} /> : <LoadingState />;
  const inv = datos.data.inventario;
  return <KeyValueList datos={[
    { etiqueta: 'Fabricante de placa base', valor: inv?.placaBase?.fabricante },
    { etiqueta: 'Modelo de placa base', valor: inv?.placaBase?.modelo },
    { etiqueta: 'Serie de placa base', valor: inv?.placaBase?.numeroSerie, mono: true },
    { etiqueta: 'Fabricante de BIOS', valor: inv?.bios?.fabricante },
    { etiqueta: 'Versión de BIOS', valor: inv?.bios?.version },
    { etiqueta: 'Fecha de BIOS', valor: fecha(inv?.bios?.fecha) },
  ]} />;
}
