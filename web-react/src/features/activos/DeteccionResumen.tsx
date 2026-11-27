import { Button, ErrorState, KeyValueList, LoadingState, Section, SpecTable } from '../../components/ui';
import { DetallesTecnicosEquipo } from './DetallesTecnicosEquipo';
import { usePolling } from '../../hooks/usePolling';
import { equiposService } from '../../services/equipos.service';
import { capacidad, fechaHora, memoria } from '../../lib/formato';
import { resumenAlmacenamiento, resumenGraficos, resumenMemoria, resumenProcesador, resumenSistema } from '../equipo/resumenComponentes';

/** Muestra el último inventario directamente en la ficha del activo vinculado. */
export function DeteccionResumen({ dispositivoId }: { dispositivoId: string }) {
  const datos = usePolling((s) => equiposService.obtener(dispositivoId, s), 30_000, dispositivoId);
  if (!datos.data) return datos.error
    ? <ErrorState mensaje={datos.error.message} onReintentar={datos.recargar} />
    : <LoadingState etiqueta="Cargando el último inventario de ScanGP" />;
  const e = datos.data;
  const inv = e.inventario;
  if (!inv?.equipo) return <p className="texto-secundario">El equipo está vinculado, pero aún no tiene un inventario disponible.</p>;
  const red = inv.red?.find((x) => x.conectado) ?? inv.red?.[0];
  return (
    <>
      {datos.error && <ErrorState mensaje="No se pudo actualizar el inventario. Se muestra el último recibido." onReintentar={datos.recargar} />}
      <KeyValueList datos={[
        { etiqueta: 'Equipo', valor: inv.equipo.nombreEquipo },
        { etiqueta: 'Último reporte recibido', valor: fechaHora(e.ultimoReporte) },
        { etiqueta: 'Reportes recibidos', valor: e.totalReportes },
        { etiqueta: 'Procesador', valor: resumenProcesador(inv) },
        { etiqueta: 'Memoria RAM', valor: resumenMemoria(inv) },
        { etiqueta: 'Almacenamiento', valor: resumenAlmacenamiento(inv) },
        { etiqueta: 'Gráficos', valor: resumenGraficos(inv) },
        { etiqueta: 'Sistema operativo', valor: resumenSistema(inv) },
        { etiqueta: 'Usuario de Windows detectado', valor: inv.equipo.usuario },
        { etiqueta: 'Dirección IP', valor: red?.ips?.join(', '), mono: true },
        { etiqueta: 'Dirección MAC', valor: red?.mac, mono: true },
        { etiqueta: 'Versión de ScanGP', valor: inv.agenteVersion },
      ]} />
      <Section titulo="Discos detectados">
        <SpecTable titulo="Discos detectados" filas={inv.discos} vacio="No hay información de discos en este reporte." columnas={[
          { encabezado: 'Modelo', valor: (x) => x.modelo },
          { encabezado: 'Tipo', valor: (x) => x.tipo },
          { encabezado: 'Capacidad', valor: (x) => capacidad(x.capacidadBytes) },
          { encabezado: 'Serie', valor: (x) => x.numeroSerie, mono: true },
          { encabezado: 'Conexión', valor: (x) => x.externo ? 'Externo' : 'Interno' },
        ]} />
      </Section>
      <Section titulo="Módulos de memoria detectados">
        <SpecTable titulo="Módulos de memoria" filas={inv.memoria?.modulos} vacio="ScanGP no pudo desglosar los módulos de memoria." columnas={[
          { encabezado: 'Banco', valor: (x) => x.banco },
          { encabezado: 'Tipo', valor: (x) => x.tipo },
          { encabezado: 'Capacidad', valor: (x) => memoria(x.capacidadBytes) },
          { encabezado: 'Número de parte', valor: (x) => x.numeroParte },
          { encabezado: 'Serie', valor: (x) => x.numeroSerie, mono: true },
          { encabezado: 'Formato', valor: (x) => x.soldado ? 'Soldada' : x.formato },
        ]} />
      </Section>
      <Section titulo="Monitores detectados">
        <SpecTable titulo="Monitores detectados" filas={inv.monitores} vacio="No hay información de monitores en este reporte." columnas={[
          { encabezado: 'Fabricante', valor: (x) => x.fabricante },
          { encabezado: 'Modelo', valor: (x) => x.modelo ?? x.codigoProducto },
          { encabezado: 'Serie', valor: (x) => x.numeroSerie, mono: true },
        ]} />
      </Section>
      <DetallesTecnicosEquipo dispositivoId={dispositivoId} />
      <div className="acciones-pagina">
        <Button a={`/equipos/${dispositivoId}`}>Ver análisis técnico completo</Button>
        <Button a={`/equipos/${dispositivoId}/historial`}>Ver historial de escaneos</Button>
      </div>
    </>
  );
}
