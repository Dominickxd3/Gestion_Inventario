import { useState } from 'react';
import { DetallesTecnicosEquipo } from './DetallesTecnicosEquipo';
import { DeteccionResumen } from './DeteccionResumen';
import { Link, useNavigate } from 'react-router-dom';
import { Ban, Download, Eye, Link2, Replace, ScanSearch, Undo2, Unlink } from 'lucide-react';
import { Button, KeyValueList, Section } from '../../components/ui';
import { TablaCrud, type AccionFila } from '../../components/crud/TablaCrud';
import { useConfirmar } from '../../components/crud/Confirmar';
import { PanelFormulario } from '../../components/forms/PanelFormulario';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { useEquipos } from '../../hooks/EquiposContext';
import { api } from '../../services/gestion.service';
import { fecha, fechaHora, unir } from '../../lib/formato';
import { MOTIVOS, TIPOS_DOCUMENTO, et, opcionesDe, type ActivoDetalle, type Documento, type InstalacionVista } from '../../types/gestion';
import { EstadoPunto, LineaTiempo, useOpcionesUbicacion, useTiposComponente } from '../gestion/comun';
import { ListaDiscrepancias } from '../discrepancias/DiscrepanciasPage';
import { AYUDA_MEDIDA } from '../rastreables/tiposComponente';
import { TablaAsignacionesCrud, TablaOrdenesCrud } from '../operaciones/OperacionesPages';
import { TablaGarantiasCrud } from '../maestros/MaestrosPages';

const DESTINOS = [
  { valor: 'ALMACEN', etiqueta: 'Almacén' },
  { valor: 'MANTENIMIENTO', etiqueta: 'Mantenimiento / garantía' },
  { valor: 'BAJA', etiqueta: 'Baja (dañado, extraviado)' },
];

/** Nombres legibles de las claves de especificaciones que guarda el alta desde ScanGP. */
const ESPECIFICACIONES: Record<string, { etiqueta: string; unidad?: string }> = {
  procesador: { etiqueta: 'Procesador' },
  nucleos: { etiqueta: 'Núcleos' },
  hilos: { etiqueta: 'Hilos' },
  ramGB: { etiqueta: 'Memoria RAM', unidad: 'GB' },
  almacenamiento: { etiqueta: 'Almacenamiento' },
  graficos: { etiqueta: 'Gráficos' },
  sistemaOperativo: { etiqueta: 'Sistema operativo' },
  pantalla: { etiqueta: 'Pantalla' },
};

function etiquetaEspecificacion(clave: string) {
  if (ESPECIFICACIONES[clave]) return ESPECIFICACIONES[clave].etiqueta;
  const texto = clave.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function valorEspecificacion(clave: string, valor: unknown) {
  const unidad = ESPECIFICACIONES[clave]?.unidad;
  return unidad && /^\d+(\.\d+)?$/.test(String(valor)) ? `${valor} ${unidad}` : String(valor);
}

export function TabGeneral({ a }: { a: ActivoDetalle }) {
  const specs = Object.entries(a.especificaciones ?? {}).filter(([, v]) => v != null && v !== '');
  // Dos pilas independientes: izquierda lo que identifica al equipo, derecha lo administrativo.
  return (
    <div className="ficha-dos-columnas">
      <div>
      <Section titulo="Identificación">
        <KeyValueList
          datos={[
            { etiqueta: 'Código patrimonial', valor: a.codigoPatrimonial, mono: true },
            { etiqueta: 'Nombre', valor: a.nombre },
            { etiqueta: 'Tipo', valor: a.tipo.nombre },
            { etiqueta: 'Marca y modelo', valor: unir([a.marca, a.modelo]) },
            { etiqueta: 'Número de serie', valor: a.numeroSerie, mono: true },
          ]}
        />
      </Section>
      {specs.length > 0 && (
        <Section titulo="Especificaciones" descripcion="Registradas al dar de alta. Los datos al día están en Detección.">
          <KeyValueList datos={specs.map(([k, v]) => ({ etiqueta: etiquetaEspecificacion(k), valor: valorEspecificacion(k, v) }))} />
        </Section>
      )}
      </div>
      <div>
      <Section titulo="Adquisición">
        <KeyValueList
          datos={[
            { etiqueta: 'Fecha de adquisición', valor: fecha(a.fechaAdquisicion), motivo: 'sin-registrar' },
            { etiqueta: 'Proveedor', valor: a.proveedor, motivo: 'sin-registrar' },
            { etiqueta: 'N.º de factura', valor: a.numeroFactura, motivo: 'sin-registrar' },
            { etiqueta: 'Costo', valor: a.costo && Number(a.costo).toLocaleString('es', { minimumFractionDigits: 2 }), motivo: 'sin-registrar' },
          ]}
        />
      </Section>
      <Section titulo="Otros datos">
        <KeyValueList
          datos={[
            { etiqueta: 'Observaciones', valor: a.observaciones, motivo: 'sin-registrar' },
            { etiqueta: 'Registrado', valor: fechaHora(a.creadoEn) },
            ...(a.fechaBaja ? [{ etiqueta: 'Fecha de baja', valor: fechaHora(a.fechaBaja) }] : []),
          ]}
        />
      </Section>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Componentes

type PanelComp = { tipo: 'retirar' | 'reemplazar'; inst: InstalacionVista } | { tipo: 'instalar' };

export function TabComponentes({ a, onCambio }: { a: ActivoDetalle; onCambio: () => void }) {
  const [retirados, setRetirados] = useState(false);
  const datos = usePolling((s) => api.activos.componentes(a.id, retirados, s), 60_000, `${a.id}${retirados}`);
  const almacen = usePolling((s) => api.componentes.listar({ situacion: 'EN_ALMACEN', porPagina: 500 }, s), 60_000);
  const almacenes = useOpcionesUbicacion();
  const tipos = useTiposComponente();
  const { puede } = useSesion();
  const escribe = puede('ADMIN', 'TECNICO') && a.cicloVida !== 'DADO_DE_BAJA';
  const [panel, setPanel] = useState<PanelComp | null>(null);
  const navegar = useNavigate();
  const listo = () => {
    datos.recargar();
    almacen.recargar();
    onCambio();
  };
  const enAlmacen = (tipoCodigo?: string) =>
    (almacen.data?.items ?? [])
      .filter((c) => !tipoCodigo || c.tipo.codigo === tipoCodigo)
      .map((c) => ({ valor: c.id, etiqueta: `${c.codigo} · ${c.tipo.nombre} ${unir([c.marca, c.modelo, c.capacidad]) ?? ''} (${c.ubicacion?.nombre ?? ''})` }));
  const camposRetiro = [
    { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'select' as const, opciones: opcionesDe(MOTIVOS), requerido: true },
    { nombre: 'destino', etiqueta: 'A dónde va', tipo: 'select' as const, opciones: DESTINOS, requerido: true },
    { nombre: 'ubicacionId', etiqueta: 'Almacén', tipo: 'select' as const, opciones: almacenes, requerido: true, visible: (v: Record<string, unknown>) => v.destino === 'ALMACEN' },
    { nombre: 'observacion', etiqueta: 'Observación', tipo: 'textarea' as const, ayuda: 'Qué falla tiene, diagnóstico, n.º de caso de garantía…' },
  ];
  const vigente = (i: InstalacionVista) => !i.hasta;
  const acciones: AccionFila<InstalacionVista>[] = [
    { etiqueta: 'Ver componente', icono: Eye, onClick: (i) => navegar(`/componentes/${i.componente!.id}`) },
    ...(escribe
      ? [
          { etiqueta: 'Reemplazar', icono: Replace, onClick: (i: InstalacionVista) => setPanel({ tipo: 'reemplazar', inst: i }), visible: vigente },
          { etiqueta: 'Retirar', icono: Undo2, peligro: true, onClick: (i: InstalacionVista) => setPanel({ tipo: 'retirar', inst: i }), visible: vigente },
        ]
      : []),
  ];

  return (
    <>
      <Section titulo="Componentes con trazabilidad" descripcion="Piezas con número de serie que se pueden retirar, enviar a mantenimiento o pasar a otro equipo.">
        <TablaCrud<InstalacionVista>
          titulo="Componentes instalados"
          filas={datos.data?.instalaciones}
          error={datos.error}
          acciones={acciones}
          nuevo={escribe && { etiqueta: 'Agregar componente', onClick: () => setPanel({ tipo: 'instalar' }) }}
          filtros={<label className="casilla"><input type="checkbox" checked={retirados} onChange={(e) => setRetirados(e.target.checked)} /> Mostrar retirados</label>}
          vacio="No hay componentes rastreables registrados en este equipo."
          columnas={[
            { encabezado: 'Código', mono: true, ordenar: (i) => i.componente!.codigo, valor: (i) => <Link to={`/componentes/${i.componente!.id}`}>{i.componente!.codigo}</Link> },
            { encabezado: 'Tipo', ordenar: (i) => i.componente!.tipo.nombre, valor: (i) => i.componente!.tipo.nombre },
            { encabezado: 'Modelo', valor: (i) => unir([i.componente!.marca, i.componente!.modelo]) },
            { encabezado: 'Capacidad / medida', valor: (i) => i.componente!.capacidad },
            { encabezado: 'Serie', mono: true, valor: (i) => i.componente!.numeroSerie, secundaria: true },
            { encabezado: 'Desde', ordenar: (i) => i.desde, valor: (i) => fecha(i.desde), secundaria: true },
            {
              encabezado: 'Estado',
              valor: (i) => i.hasta
                ? <span className="texto-terciario">Retirado {fecha(i.hasta)} ({et(i.motivoRetiro)})</span>
                : <span className="insignia"><EstadoPunto valor={i.componente!.estadoTecnico} />{i.confirmadaEn && <span className="texto-terciario" title={`ScanGP lo vio el ${fechaHora(i.confirmadaEn)}`}>· confirmado</span>}</span>,
            },
          ]}
        />
      </Section>

      {datos.data && datos.data.integrados.some((x) => !['PLACA', 'BIOS'].includes(x.tipo)) && (
        <Section titulo="Características internas del equipo" descripcion="Según el último escaneo de ScanGP.">
          <KeyValueList datos={datos.data.integrados.filter((x) => !['PLACA', 'BIOS'].includes(x.tipo)).map((x) => ({ etiqueta: ({ RAM: 'Memoria', CPU: 'Procesador', GPU: 'Gráficos', PLACA: 'Placa base', DISCO: 'Disco' } as Record<string, string>)[x.tipo] ?? x.tipo, valor: x.descripcion }))} />
        </Section>
      )}

      {a.dispositivoId && <DetallesTecnicosEquipo dispositivoId={a.dispositivoId} />}

      {panel?.tipo === 'retirar' && (
        <PanelFormulario
          titulo={`Retirar ${panel.inst.componente!.codigo}`}
          textoEnviar="Retirar"
          campos={camposRetiro}
          inicial={{ motivo: 'FALLA_TECNICA', destino: 'MANTENIMIENTO' }}
          onEnviar={(d) => api.componentes.retirar(panel.inst.componente!.id, d)}
          onCerrar={() => setPanel(null)}
          onHecho={listo}
        />
      )}
      {panel?.tipo === 'reemplazar' && (
        <PanelFormulario
          titulo={`Reemplazar ${panel.inst.componente!.codigo}`}
          descripcion="Se retira el componente y se instala otro del almacén, en una sola operación."
          textoEnviar="Reemplazar"
          campos={[
            { nombre: 'componenteNuevoId', etiqueta: 'Componente que se instala', tipo: 'select', opciones: enAlmacen(panel.inst.componente!.tipo.codigo), requerido: true, vacio: enAlmacen(panel.inst.componente!.tipo.codigo).length ? 'Elegir…' : 'No hay en almacén: regístralo primero' },
            ...camposRetiro,
          ]}
          inicial={{ motivo: 'FALLA_TECNICA', destino: 'MANTENIMIENTO' }}
          onEnviar={(d) => api.activos.reemplazarComponente(a.id, { ...d, componenteRetiradoId: panel.inst.componente!.id })}
          onCerrar={() => setPanel(null)}
          onHecho={listo}
        />
      )}
      {panel?.tipo === 'instalar' && (() => {
        // Un solo formulario: primero se pregunta de dónde viene la pieza y solo se piden los datos de ese caso.
        const delAlmacen = (v: Record<string, unknown>) => v.origen === 'ALMACEN';
        const nueva = (v: Record<string, unknown>) => v.origen === 'NUEVA';
        const hayEnAlmacen = enAlmacen().length > 0;
        return (
          <PanelFormulario
            titulo={`Agregar componente a ${a.codigoPatrimonial}`}
            descripcion="La pieza queda instalada en este equipo. ScanGP confirma la instalación en el próximo escaneo si tiene número de serie."
            textoEnviar="Agregar al equipo"
            campos={[
              {
                nombre: 'origen', etiqueta: '¿De dónde viene la pieza?', tipo: 'select', requerido: true,
                opciones: [
                  { valor: 'ALMACEN', etiqueta: hayEnAlmacen ? 'Del almacén (ya está registrada)' : 'Del almacén (no hay piezas disponibles)' },
                  { valor: 'NUEVA', etiqueta: 'Es nueva: registrarla ahora' },
                ],
              },
              { nombre: 'componenteId', etiqueta: 'Componente del almacén', tipo: 'select', opciones: enAlmacen(), requerido: true, vacio: hayEnAlmacen ? 'Elegir…' : 'No hay componentes en almacén', visible: delAlmacen },
              { nombre: 'tipoComponenteId', etiqueta: 'Tipo', tipo: 'select', opciones: tipos.map((t) => ({ valor: t.id, etiqueta: t.nombre })), requerido: true, visible: nueva },
              { nombre: 'marca', etiqueta: 'Marca', visible: nueva },
              { nombre: 'modelo', etiqueta: 'Modelo', visible: nueva },
              { nombre: 'numeroSerie', etiqueta: 'Número de serie', ayuda: 'Con él, ScanGP confirmará la instalación en el próximo escaneo.', visible: nueva },
              { nombre: 'capacidad', etiqueta: 'Capacidad o medida', placeholder: '1 TB, 24", 65 W…', ayuda: AYUDA_MEDIDA, visible: nueva },
              { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'select', opciones: opcionesDe(MOTIVOS), requerido: true },
              { nombre: 'observacion', etiqueta: 'Observación', tipo: 'textarea' },
            ]}
            inicial={{ origen: hayEnAlmacen ? 'ALMACEN' : 'NUEVA', motivo: 'ACTUALIZACION' }}
            onEnviar={({ origen, componenteId, observacion, ...d }) =>
              origen === 'ALMACEN'
                ? api.componentes.instalar(String(componenteId), { motivo: d.motivo, observacion, activoId: a.id })
                : api.componentes.crear({ ...d, observaciones: observacion, activoId: a.id })}
            onCerrar={() => setPanel(null)}
            onHecho={listo}
          />
        );
      })()}
    </>
  );
}

// ------------------------------------------------------------------ Asignaciones, mantenimientos, garantías

export function TabAsignaciones({ a }: { a: ActivoDetalle }) {
  const datos = usePolling((s) => api.asignaciones.listar({ activoId: a.id }, s), 60_000, a.id);
  return (
    <Section titulo="Asignaciones" descripcion="Quién tuvo el equipo y cuándo. Para asignar, transferir o registrar la devolución, usa los botones de arriba.">
      <TablaAsignacionesCrud filas={datos.data} error={datos.error} mostrar="persona" />
    </Section>
  );
}

export function TabMantenimientos({ a }: { a: ActivoDetalle }) {
  const datos = usePolling((s) => api.mantenimiento.listar({ activoId: a.id }, s), 60_000, a.id);
  return (
    <Section titulo="Mantenimientos">
      <TablaOrdenesCrud filas={datos.data} error={datos.error} />
    </Section>
  );
}

export function TabGarantias({ a }: { a: ActivoDetalle }) {
  const datos = usePolling((s) => api.garantias.listar({ activoId: a.id }, s), 60_000, a.id);
  return (
    <Section titulo="Garantías y soporte">
      <TablaGarantiasCrud filas={datos.data} activoId={a.id} onCambio={datos.recargar} />
    </Section>
  );
}

// ------------------------------------------------------------------ Documentos, historial, detección

export function TabDocumentos({ entidad, entidadId }: { entidad: string; entidadId: string }) {
  const datos = usePolling((s) => api.documentos.listar(entidad, entidadId, s), 60_000, entidadId);
  const [subir, setSubir] = useState(false);
  const { puede } = useSesion();
  const confirmar = useConfirmar();
  const escribe = puede('ADMIN', 'TECNICO');
  const acciones: AccionFila<Documento>[] = [
    { etiqueta: 'Descargar', icono: Download, onClick: (d) => void api.documentos.descargar(d) },
    ...(escribe
      ? [{
          etiqueta: 'Anular',
          icono: Ban,
          peligro: true,
          onClick: async (d: Documento) => {
            const ok = await confirmar({ titulo: 'Anular documento', mensaje: `«${d.nombreArchivo}» dejará de mostrarse. El archivo se conserva en el servidor.`, accion: 'Anular', peligro: true });
            if (ok) {
              await api.documentos.anular(d.id);
              datos.recargar();
            }
          },
        }]
      : []),
  ];
  return (
    <Section titulo="Documentos" descripcion="Facturas, actas de entrega, informes técnicos. Máximo 20 MB por archivo.">
      <TablaCrud<Documento>
        titulo="Documentos"
        filas={datos.data}
        error={datos.error}
        acciones={acciones}
        nuevo={escribe && { etiqueta: 'Adjuntar', onClick: () => setSubir(true) }}
        textoBusqueda={(d) => `${d.nombreArchivo} ${d.descripcion ?? ''} ${et(d.tipo)}`}
        vacio="Sin documentos adjuntos."
        columnas={[
          { encabezado: 'Archivo', ordenar: (d) => d.nombreArchivo, valor: (d) => d.nombreArchivo },
          { encabezado: 'Tipo', ordenar: (d) => d.tipo, valor: (d) => et(d.tipo) },
          { encabezado: 'Descripción', valor: (d) => d.descripcion, secundaria: true, envolver: true },
          { encabezado: 'Tamaño', numerica: true, ordenar: (d) => d.tamanoBytes, valor: (d) => `${Math.max(1, Math.round(d.tamanoBytes / 1024))} KB` },
          { encabezado: 'Fecha', ordenar: (d) => d.creadoEn, valor: (d) => fecha(d.creadoEn) },
        ]}
      />
      {subir && (
        <PanelFormulario
          titulo="Adjuntar documento"
          textoEnviar="Subir"
          campos={[
            { nombre: 'archivo', etiqueta: 'Archivo (PDF, imagen, Word, Excel)', tipo: 'archivo', requerido: true },
            { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: opcionesDe(TIPOS_DOCUMENTO), requerido: true },
            { nombre: 'descripcion', etiqueta: 'Descripción' },
          ]}
          inicial={{ tipo: 'ACTA_ENTREGA' }}
          onEnviar={(d) => {
            const f = new FormData();
            f.append('entidad', entidad);
            f.append('entidadId', entidadId);
            f.append('tipo', String(d.tipo));
            if (d.descripcion) f.append('descripcion', String(d.descripcion));
            f.append('archivo', d.archivo as File);
            return api.documentos.subir(f);
          }}
          onCerrar={() => setSubir(false)}
          onHecho={datos.recargar}
        />
      )}
    </Section>
  );
}

export function TabHistorial({ a }: { a: ActivoDetalle }) {
  const datos = usePolling((s) => api.activos.historial(a.id, s), 60_000, a.id);
  return (
    <Section titulo="Historial" descripcion="Todo lo que pasó con el activo. No se puede modificar ni borrar.">
      {datos.data ? <LineaTiempo movimientos={datos.data} /> : null}
    </Section>
  );
}

export function TabDeteccion({ a, onCambio }: { a: ActivoDetalle; onCambio: () => void }) {
  const { puede } = useSesion();
  const { equipos } = useEquipos();
  const confirmar = useConfirmar();
  const [vincular, setVincular] = useState(false);
  const sinVincular = (equipos ?? []).filter((e) => !e.activoId).map((e) => ({ valor: e.id, etiqueta: `${e.resumen.nombreEquipo} · ${unir([e.resumen.fabricante, e.resumen.modelo]) ?? ''} · serie ${e.resumen.numeroSerie ?? '—'}` }));
  const desvincular = async () => {
    const ok = await confirmar({ titulo: 'Desvincular de ScanGP', mensaje: 'El activo deja de recibir los datos y las discrepancias de ese equipo detectado. Puedes volver a vincularlo.', accion: 'Desvincular', peligro: true });
    if (ok) {
      await api.activos.desvincular(a.id);
      onCambio();
    }
  };
  return (
    <>
      <Section
        titulo="Equipo detectado por ScanGP"
        acciones={puede('ADMIN', 'TECNICO') && (a.dispositivoId
          ? <Button variante="fantasma" icono={Unlink} onClick={() => void desvincular()}>Desvincular</Button>
          : <Button icono={Link2} onClick={() => setVincular(true)}>Vincular con un equipo detectado</Button>)}
      >
        {a.dispositivoId ? (
          <DeteccionResumen dispositivoId={a.dispositivoId} />
        ) : (
          <p className="texto-secundario">
            {a.sincronizacion === 'NO_APLICA'
              ? 'Este tipo de activo no lo detecta ScanGP: su información es la que registró TI.'
              : 'Aún no está vinculado. Ejecuta ScanGP en el equipo y vincúlalo, o graba su código patrimonial como etiqueta de activo en la BIOS para que se vincule solo.'}
          </p>
        )}
      </Section>
      <Section titulo="Discrepancias" descripcion="Diferencias que requieren revisión entre la detección de ScanGP y el inventario registrado.">
        <ListaDiscrepancias activoId={a.id} onCambio={onCambio} />
      </Section>
      {vincular && (
        <PanelFormulario
          titulo="Vincular con un equipo detectado"
          textoEnviar="Vincular"
          campos={[{ nombre: 'dispositivoId', etiqueta: 'Equipo detectado', tipo: 'select', opciones: sinVincular, requerido: true, vacio: sinVincular.length ? 'Elegir…' : 'No hay equipos detectados sin vincular' }]}
          onEnviar={(d) => api.activos.vincular(a.id, String(d.dispositivoId))}
          onCerrar={() => setVincular(false)}
          onHecho={onCambio}
        />
      )}
    </>
  );
}
