import { useRef, useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { usePolling } from '../../hooks/usePolling';
import { useAhora } from '../../hooks/useAhora';
import { equiposService } from '../../services/equipos.service';
import { scangpService } from '../../services/scangp.service';
import { Button, DeviceTypeIcon, Disclosure, ErrorState, Icon, PageHeader } from '../../components/ui';
import { infoTipo } from '../../lib/tipoEquipo';
import { capacidad, unir } from '../../lib/formato';
import { Paso, type EstadoPasoAsistente } from './Paso';
import { ComandoCopiable } from './ComandoCopiable';

const SONDEO_MS = 3000;
const ESPERA_LARGA_MS = 120_000;

/** Asistente: descargar ScanGP, ejecutarlo y vincular el equipo. */
export function DetectarPage() {
  const desde = useRef(Date.now() - 2000);
  const [descargado, setDescargado] = useState(false);
  const ahora = useAhora(5000);
  const info = usePolling((s) => scangpService.info(s), 60_000);
  const lista = usePolling((s) => equiposService.listar(s), SONDEO_MS);

  const detectados = (lista.data ?? []).filter((e) => Date.parse(e.ultimoReporte) >= desde.current);
  const vinculado = detectados.length > 0;
  const paso = vinculado ? 4 : descargado ? 2 : 1;
  const estadoDe = (n: number): EstadoPasoAsistente => (n < paso ? 'hecho' : n === paso || (n === 3 && paso === 2) ? 'actual' : 'pendiente');
  const archivo = info.data?.nombreArchivo ?? 'ScanGP-Registrar-Equipo.exe';
  const esperaLarga = descargado && !vinculado && ahora - desde.current > ESPERA_LARGA_MS;

  // La descarga necesita el token de sesión: se hace con fetch en vez de un enlace directo.
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const descargar = async () => {
    setDescargando(true);
    setErrorDescarga(null);
    try {
      await scangpService.descargar(archivo);
      setDescargado(true);
    } catch (e) {
      setErrorDescarga((e as Error).message);
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="asistente">
      <PageHeader
        titulo="Detectar un equipo"
        subtitulo="ScanGP lee las características del equipo y las envía al inventario. No se instala nada."
        migas={[{ etiqueta: 'Inicio', a: '/' }, { etiqueta: 'Detectar equipo' }]}
      />

      <p className="asistente-progreso" aria-live="polite">
        {vinculado ? 'Completado' : `Paso ${Math.min(paso, 3)} de 3`}
      </p>

      <ol className="pasos">
        <Paso numero={1} titulo="Descargar ScanGP" estado={estadoDe(1)}>
          {info.error && !info.data ? (
            <ErrorState titulo="No se pudo consultar el servidor" mensaje={info.error.message} onReintentar={info.recargar} />
          ) : info.data && !info.data.disponible ? (
            <ErrorState
              titulo="ScanGP no está disponible en el servidor"
              mensaje="El administrador debe compilar el detector (agente-windows/build.ps1)."
            />
          ) : (
            <>
              <p className="texto-secundario">El archivo ya viene configurado para enviar los datos a este servidor.</p>
              <div className="fila-accion">
                <Button
                  variante={descargado ? 'secundario' : 'primario'}
                  icono={descargando ? LoaderCircle : Download}
                  disabled={descargando}
                  onClick={descargar}
                >
                  {descargando ? 'Descargando…' : descargado ? 'Descargar de nuevo' : 'Descargar ScanGP'}
                </Button>
                {errorDescarga && (
                  <span className="campo-error" role="alert">
                    {errorDescarga}
                  </span>
                )}
                {info.data && !errorDescarga && (
                  <span className="texto-terciario">
                    {unir([archivo, info.data.tamanoBytes && `${Math.round(info.data.tamanoBytes / 1024)} KB`], ' · ')}
                  </span>
                )}
              </div>
            </>
          )}
        </Paso>

        <Paso numero={2} titulo="Abrir el archivo en el equipo" estado={estadoDe(2)}>
          <p className="texto-secundario">
            Haz doble clic en <strong>{archivo}</strong> en el equipo que quieres registrar. Se abrirá una ventana que muestra
            el avance y termina con el mensaje «Equipo registrado».
          </p>
          <Disclosure titulo="¿Windows muestra «Windows protegió su PC»?">
            <p className="texto-secundario">
              Elige <em>Más información</em> y luego <em>Ejecutar de todas formas</em>. El aviso aparece porque el archivo todavía
              no tiene firma digital; desaparecerá cuando se firme.
            </p>
          </Disclosure>
        </Paso>

        <Paso numero={3} titulo="Vincular el equipo" estado={estadoDe(3)}>
          {!vinculado ? (
            <>
              <p className="esperando" role="status">
                <Icon icono={LoaderCircle} className="girando" />
                Esperando que un equipo envíe sus datos…
              </p>
              {esperaLarga && (
                <ul className="sugerencias">
                  <li>Comprueba que la ventana de ScanGP haya terminado y no muestre un error.</li>
                  <li>El equipo debe estar en la misma red que el servidor ({info.data?.urlServidor}).</li>
                  <li>Si la ventana indica «No se pudo conectar», revisa el firewall del servidor.</li>
                </ul>
              )}
              {lista.error && <p className="texto-terciario">Sin conexión con el servidor; reintentando…</p>}
            </>
          ) : (
            <ul className="detectados">
              {detectados.map((e) => (
                <li key={e.id} className="detectado">
                  <DeviceTypeIcon tipo={e.resumen.tipo} tamano={20} />
                  <div>
                    <strong>{e.resumen.nombreEquipo}</strong>
                    <p className="texto-secundario">
                      {unir(
                        [
                          infoTipo(e.resumen.tipo).etiqueta,
                          unir([e.resumen.fabricante, e.resumen.modelo]),
                          e.resumen.ramGB && `${e.resumen.ramGB} GB RAM`,
                          capacidad((e.resumen.almacenamientoGB ?? 0) * 1e9),
                        ],
                        ' · ',
                      )}
                    </p>
                    <p className="texto-terciario">{e.totalReportes > 1 ? 'Ya estaba registrado: datos actualizados.' : 'Equipo nuevo en el inventario.'}</p>
                  </div>
                  <Button a={`/equipos/${e.id}`}>Ver equipo</Button>
                </li>
              ))}
            </ul>
          )}
        </Paso>
      </ol>

      <Disclosure titulo="Registrar muchos equipos a la vez (área de TI)">
        <p className="texto-secundario">
          Con el parámetro <code>--silencioso</code> ScanGP no muestra ventana y termina solo. Copia el archivo a una carpeta
          compartida y ejecútalo en los equipos:
        </p>
        <h3 className="subtitulo">Directiva de grupo (GPO) › Scripts de inicio</h3>
        <ComandoCopiable etiqueta="comando para GPO" texto={`\\\\servidor\\scangp$\\${archivo} --silencioso`} />
        <h3 className="subtitulo">Intune, PDQ o PowerShell remoto</h3>
        <ComandoCopiable
          etiqueta="comando de PowerShell"
          texto={`Start-Process "\\\\servidor\\scangp$\\${archivo}" -ArgumentList "--silencioso" -Wait`}
        />
        {info.data && (
          <p className="texto-terciario">
            Los equipos enviarán su inventario a <code>{info.data.urlServidor}</code>
          </p>
        )}
      </Disclosure>
    </div>
  );
}
