import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileUp, Link2, Plus, Replace, ScanSearch, Undo2, Unlink, Wrench } from 'lucide-react';
import { Button, ErrorState, KeyValueList, LoadingState, Section, SpecTable } from '../../components/ui';
import { PanelFormulario } from '../../components/forms/PanelFormulario';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { useEquipos } from '../../hooks/EquiposContext';
import { api } from '../../services/gestion.service';
import { fecha, fechaHora, unir } from '../../lib/formato';
import {
  MOTIVOS, TIPOS_DOCUMENTO, TIPOS_GARANTIA, et, opcionesDe, type ActivoDetalle, type Asignacion, type Documento, type Garantia, type InstalacionVista, type Orden,
} from '../../types/gestion';
import { EstadoPunto, LineaTiempo, useOpcionesUbicacion, useTiposComponente } from '../gestion/comun';
import { ListaDiscrepancias } from '../discrepancias/DiscrepanciasPage';

const DESTINOS = [
  { valor: 'ALMACEN', etiqueta: 'Almacén' },
  { valor: 'MANTENIMIENTO', etiqueta: 'Mantenimiento / garantía' },
  { valor: 'BAJA', etiqueta: 'Baja (dañado, extraviado)' },
];

export function TabGeneral({ a }: { a: ActivoDetalle }) {
  const specs = Object.entries(a.especificaciones ?? {}).filter(([, v]) => v != null && v !== '');
  return (
    <>
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
      <Section titulo="Adquisición">
        <KeyValueList
          datos={[
            { etiqueta: 'Fecha de adquisición', valor: fecha(a.fechaAdquisicion) },
            { etiqueta: 'Proveedor', valor: a.proveedor },
            { etiqueta: 'N.º de factura', valor: a.numeroFactura },
            { etiqueta: 'Costo', valor: a.costo && Number(a.costo).toLocaleString('es', { minimumFractionDigits: 2 }) },
          ]}
        />
      </Section>
      {specs.length > 0 && (
        <Section titulo="Especificaciones" descripcion="Registradas al dar de alta. Los datos al día están en la pestaña Detección.">
          <KeyValueList datos={specs.map(([k, v]) => ({ etiqueta: k, valor: String(v) }))} />
        </Section>
      )}
      <Section titulo="Otros datos">
        <KeyValueList
          datos={[
            { etiqueta: 'Observaciones', valor: a.observaciones },
            { etiqueta: 'Registrado', valor: fechaHora(a.creadoEn) },
            ...(a.fechaBaja ? [{ etiqueta: 'Fecha de baja', valor: fechaHora(a.fechaBaja) }] : []),
          ]}
        />
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ Componentes

type PanelComp = { tipo: 'retirar' | 'reemplazar'; inst: InstalacionVista } | { tipo: 'instalar' | 'nuevo' };

export function TabComponentes({ a, onCambio }: { a: ActivoDetalle; onCambio: () => void }) {
  const [retirados, setRetirados] = useState(false);
  const datos = usePolling((s) => api.activos.componentes(a.id, retirados, s), 60_000, `${a.id}${retirados}`);
  const almacen = usePolling((s) => api.componentes.listar({ situacion: 'EN_ALMACEN', porPagina: 500 }, s), 60_000);
  const almacenes = useOpcionesUbicacion();
  const tipos = useTiposComponente();
  const { puede } = useSesion();
  const escribe = puede('ADMIN', 'TECNICO') && a.cicloVida !== 'DADO_DE_BAJA';
  const [panel, setPanel] = useState<PanelComp | null>(null);
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

  return (
    <>
      <Section
        titulo="Componentes instalados"
        descripcion="Piezas con número de serie que se pueden retirar, enviar a mantenimiento o pasar a otro equipo."
        acciones={
          <div className="acciones-pagina">
            <label className="casilla"><input type="checkbox" checked={retirados} onChange={(e) => setRetirados(e.target.checked)} /> Mostrar retirados</label>
            {escribe && <Button icono={Plus} onClick={() => setPanel({ tipo: 'instalar' })}>Instalar desde almacén</Button>}
            {escribe && <Button icono={Plus} onClick={() => setPanel({ tipo: 'nuevo' })}>Componente nuevo</Button>}
          </div>
        }
      >
        {datos.error && !datos.data ? <ErrorState mensaje={datos.error.message} onReintentar={datos.recargar} /> : !datos.data ? <LoadingState /> : (
          <SpecTable<InstalacionVista>
            titulo="Componentes instalados"
            filas={datos.data.instalaciones}
            vacio="No hay componentes rastreables registrados en este equipo."
            columnas={[
              { encabezado: 'Código', mono: true, valor: (i) => <Link to={`/componentes/${i.componente!.id}`}>{i.componente!.codigo}</Link> },
              { encabezado: 'Tipo', valor: (i) => i.componente!.tipo.nombre },
              { encabezado: 'Modelo', valor: (i) => unir([i.componente!.marca, i.componente!.modelo]) ?? '—' },
              { encabezado: 'Capacidad', valor: (i) => i.componente!.capacidad ?? '—' },
              { encabezado: 'Serie', mono: true, valor: (i) => i.componente!.numeroSerie ?? '—' },
              { encabezado: 'Desde', valor: (i) => fecha(i.desde) },
              {
                encabezado: 'Estado',
                valor: (i) => i.hasta
                  ? <span className="texto-terciario">Retirado {fecha(i.hasta)} ({et(i.motivoRetiro)})</span>
                  : <span className="insignia"><EstadoPunto valor={i.componente!.estadoTecnico} />{i.confirmadaEn && <span className="texto-terciario" title={`ScanGP lo vio el ${fechaHora(i.confirmadaEn)}`}>· confirmado</span>}</span>,
              },
              ...(escribe ? [{
                encabezado: '',
                ancho: '96px',
                valor: (i: InstalacionVista) => !i.hasta && (
                  <span className="acciones-fila">
                    <Button variante="fantasma" icono={Undo2} aria-label="Retirar" onClick={() => setPanel({ tipo: 'retirar', inst: i })} />
                    <Button variante="fantasma" icono={Replace} aria-label="Reemplazar" onClick={() => setPanel({ tipo: 'reemplazar', inst: i })} />
                  </span>
                ),
              }] : []),
            ]}
          />
        )}
      </Section>

      {datos.data && datos.data.integrados.length > 0 && (
        <Section titulo="Integrados" descripcion="Según ScanGP. Sin número de serie: forman parte del equipo y no se rastrean por separado.">
          <KeyValueList datos={datos.data.integrados.map((x) => ({ etiqueta: x.tipo === 'RAM' ? 'Memoria' : x.tipo, valor: x.descripcion }))} />
        </Section>
      )}

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
      {panel?.tipo === 'instalar' && (
        <PanelFormulario
          titulo="Instalar desde almacén"
          textoEnviar="Instalar"
          campos={[
            { nombre: 'componenteId', etiqueta: 'Componente', tipo: 'select', opciones: enAlmacen(), requerido: true },
            { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'select', opciones: opcionesDe(MOTIVOS), requerido: true },
            { nombre: 'observacion', etiqueta: 'Observación', tipo: 'textarea' },
          ]}
          inicial={{ motivo: 'ACTUALIZACION' }}
          onEnviar={({ componenteId, ...d }) => api.componentes.instalar(String(componenteId), { ...d, activoId: a.id })}
          onCerrar={() => setPanel(null)}
          onHecho={listo}
        />
      )}
      {panel?.tipo === 'nuevo' && (
        <PanelFormulario
          titulo="Componente nuevo"
          descripcion="Se registra y queda instalado en este equipo."
          textoEnviar="Registrar e instalar"
          campos={[
            { nombre: 'tipoComponenteId', etiqueta: 'Tipo', tipo: 'select', opciones: tipos.map((t) => ({ valor: t.id, etiqueta: t.nombre })), requerido: true },
            { nombre: 'marca', etiqueta: 'Marca' },
            { nombre: 'modelo', etiqueta: 'Modelo' },
            { nombre: 'numeroSerie', etiqueta: 'Número de serie', ayuda: 'Con él, ScanGP confirmará la instalación en el próximo escaneo.' },
            { nombre: 'capacidad', etiqueta: 'Capacidad', placeholder: '16 GB, 1 TB…' },
            { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'select', opciones: opcionesDe(MOTIVOS), requerido: true },
          ]}
          inicial={{ motivo: 'ACTUALIZACION' }}
          onEnviar={(d) => api.componentes.crear({ ...d, activoId: a.id })}
          onCerrar={() => setPanel(null)}
          onHecho={listo}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ Asignaciones, mantenimientos, garantías

export function TabAsignaciones({ a }: { a: ActivoDetalle }) {
  const datos = usePolling((s) => api.asignaciones.listar({ activoId: a.id }, s), 60_000, a.id);
  return (
    <Section titulo="Asignaciones" descripcion="Quién tuvo el equipo y cuándo. Las acciones están arriba (Asignar, Transferir, Devolución).">
      {!datos.data ? <LoadingState /> : <TablaAsignaciones filas={datos.data} mostrar="persona" />}
    </Section>
  );
}

export function TablaAsignaciones({ filas, mostrar }: { filas: Asignacion[]; mostrar: 'persona' | 'activo' }) {
  return (
    <SpecTable<Asignacion>
      titulo="Asignaciones"
      filas={filas}
      vacio="Sin asignaciones registradas."
      columnas={[
        mostrar === 'persona'
          ? { encabezado: 'Responsable', valor: (x) => x.persona ? <Link to={`/personas/${x.persona.id}`}>{x.persona.nombre}</Link> : x.area?.nombre }
          : { encabezado: 'Activo', valor: (x) => x.activo && <Link to={`/activos/${x.activo.id}`}>{x.activo.codigoPatrimonial} · {x.activo.nombre}</Link> },
        { encabezado: 'Tipo', valor: (x) => et(x.tipo) },
        { encabezado: 'Desde', valor: (x) => fecha(x.desde) },
        { encabezado: 'Hasta', valor: (x) => x.hasta ? fecha(x.hasta) : x.hastaPrevisto ? <span className={x.hastaPrevisto < new Date().toISOString().slice(0, 10) ? 'estado-problema' : ''}>Previsto {fecha(x.hastaPrevisto)}</span> : <strong>Vigente</strong> },
        { encabezado: 'Cierre', valor: (x) => (x.motivoCierre ? et(x.motivoCierre) : '—') },
        { encabezado: 'Observaciones', valor: (x) => x.observaciones ?? '—' },
      ]}
    />
  );
}

export function TabMantenimientos({ a }: { a: ActivoDetalle }) {
  const datos = usePolling((s) => api.mantenimiento.listar({ activoId: a.id }, s), 60_000, a.id);
  return (
    <Section titulo="Mantenimientos">
      {!datos.data ? <LoadingState /> : <TablaOrdenes filas={datos.data} />}
    </Section>
  );
}

export function TablaOrdenes({ filas, conActivo }: { filas: Orden[]; conActivo?: boolean }) {
  return (
    <SpecTable<Orden>
      titulo="Órdenes de mantenimiento"
      filas={filas}
      vacio="Sin órdenes de mantenimiento."
      columnas={[
        { encabezado: 'Orden', mono: true, valor: (o) => <Link to={`/mantenimiento/${o.id}`}>{o.codigo}</Link> },
        ...(conActivo ? [{ encabezado: 'Activo', valor: (o: Orden) => o.activo && <Link to={`/activos/${o.activo.id}`}>{o.activo.codigoPatrimonial} · {o.activo.nombre}</Link> }] : []),
        { encabezado: 'Tipo', valor: (o) => `${et(o.tipo)} · ${et(o.motivo)}` },
        { encabezado: 'Falla', valor: (o) => o.fallaReportada },
        { encabezado: 'Apertura', valor: (o) => fecha(o.fechaApertura) },
        { encabezado: 'Estado', valor: (o) => <EstadoPunto valor={o.estado} /> },
        { encabezado: 'Resultado', valor: (o) => (o.resultado ? et(o.resultado) : '—') },
      ]}
    />
  );
}

export function TabGarantias({ a }: { a: ActivoDetalle }) {
  const datos = usePolling((s) => api.garantias.listar({ activoId: a.id }, s), 60_000, a.id);
  const [nueva, setNueva] = useState(false);
  const { puede } = useSesion();
  return (
    <Section titulo="Garantías y soporte" acciones={puede('ADMIN', 'TECNICO') && <Button icono={Plus} onClick={() => setNueva(true)}>Nueva garantía</Button>}>
      {!datos.data ? <LoadingState /> : <TablaGarantias filas={datos.data} />}
      {nueva && <PanelGarantia activoId={a.id} onCerrar={() => setNueva(false)} onHecho={datos.recargar} />}
    </Section>
  );
}

export function TablaGarantias({ filas, conActivo }: { filas: Garantia[]; conActivo?: boolean }) {
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <SpecTable<Garantia>
      titulo="Garantías"
      filas={filas}
      vacio="Sin garantías registradas."
      columnas={[
        ...(conActivo ? [{ encabezado: 'Cubre', valor: (g: Garantia) => g.activoId ? <Link to={`/activos/${g.activoId}`}>{g.activoCodigo} · {g.activoNombre}</Link> : g.componenteId && <Link to={`/componentes/${g.componenteId}`}>{g.componenteCodigo}</Link> }] : []),
        { encabezado: 'Tipo', valor: (g) => et(g.tipo) },
        { encabezado: 'Proveedor', valor: (g) => g.proveedor },
        { encabezado: 'Contrato', valor: (g) => g.numeroContrato ?? '—' },
        { encabezado: 'Inicio', valor: (g) => fecha(g.inicio) },
        { encabezado: 'Fin', valor: (g) => <span className={g.fin < hoy ? 'estado-problema' : ''}>{fecha(g.fin)}{g.fin < hoy ? ' (vencida)' : ''}</span> },
      ]}
    />
  );
}

export function PanelGarantia({ activoId, componenteId, onCerrar, onHecho }: { activoId?: string; componenteId?: string; onCerrar: () => void; onHecho: () => void }) {
  return (
    <PanelFormulario
      titulo="Nueva garantía"
      campos={[
        { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: opcionesDe(TIPOS_GARANTIA), requerido: true },
        { nombre: 'proveedor', etiqueta: 'Proveedor', requerido: true },
        { nombre: 'numeroContrato', etiqueta: 'N.º de contrato o caso' },
        { nombre: 'inicio', etiqueta: 'Inicio', tipo: 'fecha', requerido: true },
        { nombre: 'fin', etiqueta: 'Fin', tipo: 'fecha', requerido: true },
        { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'textarea' },
      ]}
      inicial={{ tipo: 'FABRICANTE' }}
      onEnviar={(d) => api.garantias.crear({ ...d, activoId, componenteId })}
      onCerrar={onCerrar}
      onHecho={onHecho}
    />
  );
}

// ------------------------------------------------------------------ Documentos, historial, detección

export function TabDocumentos({ entidad, entidadId }: { entidad: string; entidadId: string }) {
  const datos = usePolling((s) => api.documentos.listar(entidad, entidadId, s), 60_000, entidadId);
  const [subir, setSubir] = useState(false);
  const { puede } = useSesion();
  return (
    <Section titulo="Documentos" descripcion="Facturas, actas de entrega, informes técnicos. Máximo 20 MB por archivo." acciones={puede('ADMIN', 'TECNICO') && <Button icono={FileUp} onClick={() => setSubir(true)}>Adjuntar</Button>}>
      {!datos.data ? <LoadingState /> : (
        <SpecTable<Documento>
          titulo="Documentos"
          filas={datos.data}
          vacio="Sin documentos adjuntos."
          columnas={[
            { encabezado: 'Archivo', valor: (d) => d.nombreArchivo },
            { encabezado: 'Tipo', valor: (d) => et(d.tipo) },
            { encabezado: 'Descripción', valor: (d) => d.descripcion ?? '—' },
            { encabezado: 'Tamaño', numerica: true, valor: (d) => `${Math.max(1, Math.round(d.tamanoBytes / 1024))} KB` },
            { encabezado: 'Fecha', valor: (d) => fecha(d.creadoEn) },
            { encabezado: '', ancho: '48px', valor: (d) => <Button variante="fantasma" icono={Download} aria-label={`Descargar ${d.nombreArchivo}`} onClick={() => void api.documentos.descargar(d)} /> },
          ]}
        />
      )}
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
      {!datos.data ? <LoadingState /> : <LineaTiempo movimientos={datos.data} />}
    </Section>
  );
}

export function TabDeteccion({ a, onCambio }: { a: ActivoDetalle; onCambio: () => void }) {
  const { puede } = useSesion();
  const { equipos } = useEquipos();
  const [vincular, setVincular] = useState(false);
  const sinVincular = (equipos ?? []).filter((e) => !e.activoId).map((e) => ({ valor: e.id, etiqueta: `${e.resumen.nombreEquipo} · ${unir([e.resumen.fabricante, e.resumen.modelo]) ?? ''} · serie ${e.resumen.numeroSerie ?? '—'}` }));
  return (
    <>
      <Section
        titulo="Equipo detectado por ScanGP"
        acciones={puede('ADMIN', 'TECNICO') && (a.dispositivoId
          ? <Button variante="fantasma" icono={Unlink} onClick={() => void api.activos.desvincular(a.id).then(onCambio)}>Desvincular</Button>
          : <Button icono={Link2} onClick={() => setVincular(true)}>Vincular con un equipo detectado</Button>)}
      >
        {a.dispositivoId ? (
          <p>
            <Button icono={ScanSearch} a={`/equipos/${a.dispositivoId}`}>Ver datos técnicos detectados</Button>{' '}
            <span className="texto-terciario">Procesador, memoria, discos, batería, compatibilidad, diagnóstico e historial de escaneos.</span>
          </p>
        ) : (
          <p className="texto-secundario">
            {a.sincronizacion === 'NO_APLICA'
              ? 'Este tipo de activo no lo detecta ScanGP: su información es la que registró TI.'
              : 'Aún no está vinculado. Ejecuta ScanGP en el equipo y vincúlalo, o graba su código patrimonial como etiqueta de activo en la BIOS para que se vincule solo.'}
          </p>
        )}
      </Section>
      <Section titulo="Discrepancias" descripcion="Diferencias entre lo que ve ScanGP y lo registrado. Nada cambia en el inventario hasta que las aceptes.">
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

export const IconoMantenimiento = Wrench;
