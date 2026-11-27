import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pencil, PowerOff, Settings } from 'lucide-react';
import { Button, KeyValueList, LoadingState, PageHeader, PuntoEstado, Section, SelectField } from '../../components/ui';
import { TablaCrud, type AccionFila } from '../../components/crud/TablaCrud';
import { useConfirmar } from '../../components/crud/Confirmar';
import { TablaMaestra } from '../../components/forms/TablaMaestra';
import { PanelFormulario } from '../../components/forms/PanelFormulario';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { api } from '../../services/gestion.service';
import { fecha, fechaHora } from '../../lib/formato';
import {
  TIPOS_GARANTIA, TIPOS_UBICACION, et, opcionesDe, type Area, type Articulo, type Existencia, type Garantia, type Marca, type Modelo,
  type MovimientoAlmacen, type Sede, type TipoActivo, type TipoComponente, type Ubicacion,
} from '../../types/gestion';
import { useOpcionesArea, useOpcionesTipoActivo, useOpcionesUbicacion } from '../gestion/comun';
import { TablaComponentes, accionesComponente } from '../rastreables/ComponentesPage';
import { ComponenteAcciones, type AccionComponente } from '../rastreables/ComponenteAcciones';
import type { ComponenteVista } from '../../types/gestion';

// ------------------------------------------------------------------ Almacén

export function AlmacenPage() {
  const existencias = usePolling((s) => api.almacen.existencias(s), 30_000);
  const movimientos = usePolling((s) => api.almacen.movimientos(s), 30_000);
  const componentes = usePolling((s) => api.componentes.listar({ situacion: 'EN_ALMACEN', porPagina: 500 }, s), 30_000);
  const articulos = usePolling((s) => api.almacen.articulos(s), 120_000);
  const almacenes = useOpcionesUbicacion('ALMACEN');
  const { puede } = useSesion();
  const navegar = useNavigate();
  const escribe = puede('ADMIN', 'TECNICO');
  const [mover, setMover] = useState<Existencia | true | null>(null);
  const [accionComp, setAccionComp] = useState<{ a: AccionComponente; c?: ComponenteVista } | null>(null);
  const recargar = () => {
    existencias.recargar();
    movimientos.recargar();
  };

  return (
    <>
      <PageHeader titulo="Almacén" subtitulo="Repuestos con número de serie (componentes) y consumibles por cantidad." />
      <Section titulo="Componentes en almacén" descripcion="Piezas con identidad propia listas para instalar.">
        <TablaComponentes
          filas={componentes.data?.items}
          nuevo={escribe && { etiqueta: 'Ingresar componente', onClick: () => setAccionComp({ a: 'nuevo' }) }}
          acciones={escribe ? accionesComponente((a, c) => setAccionComp({ a, c }), (c) => navegar(`/componentes/${c.id}`)) : undefined}
          onFila={(c) => navegar(`/componentes/${c.id}`)}
        />
      </Section>
      <Section titulo="Existencias de consumibles">
        <TablaCrud<Existencia>
          titulo="Existencias"
          filas={existencias.data}
          error={existencias.error}
          clave={(e) => `${e.articuloId}${e.ubicacionId}`}
          textoBusqueda={(e) => `${e.nombre} ${e.ubicacion ?? ''}`}
          nuevo={escribe && { etiqueta: 'Registrar movimiento', onClick: () => setMover(true) }}
          acciones={escribe ? [{ etiqueta: 'Entrada, salida o ajuste', icono: Pencil, onClick: (e) => setMover(e) }] : []}
          vacio="Sin artículos. Créalos abajo, en Artículos."
          columnas={[
            { encabezado: 'Artículo', ordenar: (e) => e.nombre, valor: (e) => e.nombre },
            { encabezado: 'Almacén', ordenar: (e) => e.ubicacion, valor: (e) => (e.ubicacion ? `${e.sede} › ${e.ubicacion}` : 'Sin existencias') },
            { encabezado: 'Cantidad', numerica: true, ordenar: (e) => e.cantidad, valor: (e) => `${e.cantidad} ${e.unidad}` },
            {
              encabezado: 'Total / mínimo',
              numerica: true,
              ordenar: (e) => e.totalArticulo,
              valor: (e) => <span className={e.stockMinimo > 0 && e.totalArticulo < e.stockMinimo ? 'estado-problema' : ''}>{e.totalArticulo}{e.stockMinimo > 0 ? ` / ${e.stockMinimo}` : ''}</span>,
            },
          ]}
        />
      </Section>
      <Section titulo="Movimientos">
        <TablaCrud<MovimientoAlmacen>
          titulo="Movimientos de almacén"
          filas={movimientos.data}
          textoBusqueda={(m) => [m.articulo, m.ubicacion, m.activo, m.orden, m.motivo, m.usuarioNombre].join(' ')}
          vacio="Sin movimientos."
          columnas={[
            { encabezado: 'Fecha', ordenar: (m) => m.fecha, valor: (m) => fechaHora(m.fecha) },
            { encabezado: 'Artículo', ordenar: (m) => m.articulo, valor: (m) => m.articulo },
            { encabezado: 'Tipo', ordenar: (m) => m.tipo, valor: (m) => et(m.tipo) },
            { encabezado: 'Cantidad', numerica: true, ordenar: (m) => m.cantidad, valor: (m) => `${m.cantidad > 0 ? '+' : ''}${m.cantidad}` },
            { encabezado: 'Saldo', numerica: true, valor: (m) => m.saldo },
            { encabezado: 'Almacén', valor: (m) => m.ubicacion, secundaria: true },
            { encabezado: 'Destino / motivo', valor: (m) => [m.activo, m.orden, m.motivo].filter(Boolean).join(' · '), secundaria: true },
            { encabezado: 'Usuario', valor: (m) => m.usuarioNombre, secundaria: true },
          ]}
        />
      </Section>
      <TablaMaestra<Articulo>
        titulo="Artículos"
        singular="artículo"
        cargar={(s) => api.almacen.articulos(s)}
        textoBusqueda={(a) => a.nombre}
        nombre={(a) => a.nombre}
        columnas={[
          { encabezado: 'Nombre', ordenar: (a) => a.nombre, valor: (a) => a.nombre },
          { encabezado: 'Unidad', valor: (a) => a.unidad },
          { encabezado: 'Stock mínimo', numerica: true, ordenar: (a) => a.stockMinimo, valor: (a) => a.stockMinimo },
        ]}
        campos={[
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true, placeholder: 'Tóner HP 85A, cable HDMI…' },
          { nombre: 'unidad', etiqueta: 'Unidad', requerido: true, placeholder: 'unidad, caja, metro…' },
          { nombre: 'stockMinimo', etiqueta: 'Stock mínimo', tipo: 'numero', ayuda: 'El panel avisa cuando el total baja de este número.' },
        ]}
        aValores={(a) => ({ nombre: a.nombre, unidad: a.unidad, stockMinimo: String(a.stockMinimo) })}
        crear={(d) => api.almacen.crearArticulo({ ...d, stockMinimo: d.stockMinimo ?? 0 })}
        editar={api.almacen.editarArticulo}
      />
      {mover && (
        <PanelFormulario
          titulo="Registrar movimiento"
          campos={[
            { nombre: 'articuloId', etiqueta: 'Artículo', tipo: 'select', requerido: true, opciones: (articulos.data ?? []).filter((a) => a.activo).map((a) => ({ valor: a.id, etiqueta: `${a.nombre} (${a.unidad})` })) },
            { nombre: 'ubicacionId', etiqueta: 'Almacén', tipo: 'select', opciones: almacenes, requerido: true },
            { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: opcionesDe(['ENTRADA', 'SALIDA', 'AJUSTE']), requerido: true },
            { nombre: 'cantidad', etiqueta: 'Cantidad', tipo: 'numero', requerido: true, ayuda: 'En un ajuste, la cantidad contada (nuevo saldo).' },
            { nombre: 'motivo', etiqueta: 'Motivo o destino', ayuda: 'Obligatorio en ajustes.' },
          ]}
          inicial={{ tipo: 'ENTRADA', ...(mover !== true ? { articuloId: mover.articuloId, ubicacionId: mover.ubicacionId ?? '' } : {}) }}
          onEnviar={(d) => api.almacen.mover(d)}
          onCerrar={() => setMover(null)}
          onHecho={recargar}
        />
      )}
      {accionComp && <ComponenteAcciones accion={accionComp.a} c={accionComp.c} onCerrar={() => setAccionComp(null)} onHecho={componentes.recargar} />}
    </>
  );
}

// ------------------------------------------------------------------ Garantías

export function TablaGarantiasCrud({ filas, conActivo, activoId, componenteId, onCambio, filtros }: {
  filas: Garantia[] | undefined;
  conActivo?: boolean;
  activoId?: string;
  componenteId?: string;
  onCambio: () => void;
  filtros?: React.ReactNode;
}) {
  const { puede } = useSesion();
  const confirmar = useConfirmar();
  const activos = usePolling((s) => api.activos.listar({ porPagina: 500 }, s), 300_000, activoId ? 'no' : 'si');
  const [panel, setPanel] = useState<{ g: Garantia | null } | null>(null);
  const hoy = new Date().toISOString().slice(0, 10);
  const escribe = puede('ADMIN', 'TECNICO');
  const acciones: AccionFila<Garantia>[] = escribe
    ? [
        { etiqueta: 'Editar', icono: Pencil, onClick: (g) => setPanel({ g }) },
        {
          etiqueta: 'Desactivar',
          icono: PowerOff,
          peligro: true,
          visible: (g) => g.vigente,
          onClick: async (g) => {
            const ok = await confirmar({ titulo: 'Desactivar garantía', mensaje: `La garantía de ${g.proveedor} dejará de avisar su vencimiento. Queda en el historial.`, accion: 'Desactivar', peligro: true });
            if (ok) {
              await api.garantias.editar(g.id, { vigente: false });
              onCambio();
            }
          },
        },
      ]
    : [];
  return (
    <>
      <TablaCrud<Garantia>
        titulo="Garantías"
        filas={filas}
        filtros={filtros}
        acciones={acciones}
        nuevo={escribe && { etiqueta: 'Nueva garantía', onClick: () => setPanel({ g: null }) }}
        textoBusqueda={(g) => [g.proveedor, g.numeroContrato, g.activoCodigo, g.activoNombre, g.componenteCodigo].join(' ')}
        vacio="Sin garantías registradas."
        columnas={[
          ...(conActivo ? [{ encabezado: 'Cubre', ordenar: (g: Garantia) => g.activoCodigo ?? g.componenteCodigo, valor: (g: Garantia) => g.activoId ? <Link to={`/activos/${g.activoId}?tab=garantias`}>{g.activoCodigo} · {g.activoNombre}</Link> : g.componenteId && <Link to={`/componentes/${g.componenteId}`}>{g.componenteCodigo}</Link> }] : []),
          { encabezado: 'Tipo', ordenar: (g) => g.tipo, valor: (g) => et(g.tipo) },
          { encabezado: 'Proveedor', ordenar: (g) => g.proveedor, valor: (g) => g.proveedor },
          { encabezado: 'Contrato', valor: (g) => g.numeroContrato, secundaria: true },
          { encabezado: 'Inicio', ordenar: (g) => g.inicio, valor: (g) => fecha(g.inicio), secundaria: true },
          { encabezado: 'Fin', ordenar: (g) => g.fin, valor: (g) => <span className={g.fin < hoy ? 'estado-problema' : ''}>{fecha(g.fin)}</span> },
          { encabezado: 'Estado', ordenar: (g) => (g.vigente ? 0 : 1), valor: (g) => (!g.vigente ? <PuntoEstado tono="neutro" texto="Desactivada" /> : g.fin < hoy ? <PuntoEstado tono="problema" texto="Vencida" /> : <PuntoEstado tono="ok" texto="Vigente" />) },
        ]}
      />
      {panel && (
        <PanelFormulario
          titulo={panel.g ? 'Editar garantía' : 'Nueva garantía'}
          campos={[
            ...(!activoId && !componenteId && !panel.g
              ? [{ nombre: 'activoId', etiqueta: 'Activo', tipo: 'select' as const, requerido: true, opciones: (activos.data?.items ?? []).map((a) => ({ valor: a.id, etiqueta: `${a.codigoPatrimonial} · ${a.nombre}` })) }]
              : []),
            { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: opcionesDe(TIPOS_GARANTIA), requerido: true },
            { nombre: 'proveedor', etiqueta: 'Proveedor', requerido: true },
            { nombre: 'numeroContrato', etiqueta: 'N.º de contrato o caso' },
            { nombre: 'inicio', etiqueta: 'Inicio', tipo: 'fecha', requerido: true },
            { nombre: 'fin', etiqueta: 'Fin', tipo: 'fecha', requerido: true },
            { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'textarea' },
          ]}
          inicial={panel.g
            ? { tipo: panel.g.tipo, proveedor: panel.g.proveedor, numeroContrato: panel.g.numeroContrato ?? '', inicio: panel.g.inicio, fin: panel.g.fin, observaciones: panel.g.observaciones ?? '' }
            : { tipo: 'FABRICANTE' }}
          onEnviar={(d) => (panel.g ? api.garantias.editar(panel.g.id, d) : api.garantias.crear({ activoId, componenteId, ...d }))}
          onCerrar={() => setPanel(null)}
          onHecho={onCambio}
        />
      )}
    </>
  );
}

export function GarantiasPage() {
  const [vista, setVista] = useState('porVencer');
  const filtro = vista === 'porVencer' ? { porVencer: '60' } : vista === 'vencidas' ? { vencidas: 'true' } : {};
  const datos = usePolling((s) => api.garantias.listar(filtro, s), 60_000, vista);
  return (
    <>
      <PageHeader titulo="Garantías" subtitulo="Garantías de fábrica, extendidas y contratos de soporte." />
      <TablaGarantiasCrud
        filas={datos.data}
        conActivo
        onCambio={datos.recargar}
        filtros={<SelectField etiqueta="Ver" value={vista} onChange={(e) => setVista(e.target.value)} opciones={[
          { valor: 'porVencer', etiqueta: 'Vencen en 60 días' }, { valor: 'vencidas', etiqueta: 'Vencidas' }, { valor: 'todas', etiqueta: 'Todas' },
        ]} />}
      />
    </>
  );
}

// ------------------------------------------------------------------ Catálogo

export function CatalogoPage() {
  const tipos = useOpcionesTipoActivo();
  const marcas = usePolling((s) => api.catalogo.marcas(s), 120_000);
  const tiposActivo = usePolling((s) => api.catalogo.tiposActivo(s), 300_000);
  const tiposComponente = usePolling((s) => api.catalogo.tiposComponente(s), 300_000);
  const opcionesMarca = (marcas.data ?? []).filter((m) => m.activo).map((m) => ({ valor: m.id, etiqueta: m.nombre }));
  return (
    <>
      <PageHeader titulo="Catálogo" subtitulo="Marcas, modelos y tipos, independientes de cada equipo." />
      <TablaMaestra<Marca>
        titulo="Marcas"
        singular="marca"
        cargar={(s) => api.catalogo.marcas(s)}
        textoBusqueda={(m) => m.nombre}
        nombre={(m) => m.nombre}
        columnas={[{ encabezado: 'Nombre', ordenar: (m) => m.nombre, valor: (m) => m.nombre }]}
        campos={[{ nombre: 'nombre', etiqueta: 'Nombre', requerido: true }]}
        aValores={(m) => ({ nombre: m.nombre })}
        crear={async (d) => { const r = await api.catalogo.crearMarca(d); marcas.recargar(); return r; }}
        editar={async (id, d) => { const r = await api.catalogo.editarMarca(id, d); marcas.recargar(); return r; }}
      />
      <TablaMaestra<Modelo>
        titulo="Modelos"
        singular="modelo"
        cargar={(s) => api.catalogo.modelos(s)}
        clave={String(opcionesMarca.length)}
        textoBusqueda={(m) => `${m.marca?.nombre} ${m.nombre} ${m.tipoActivo?.nombre}`}
        nombre={(m) => `${m.marca?.nombre ?? ''} ${m.nombre}`}
        columnas={[
          { encabezado: 'Marca', ordenar: (m) => m.marca?.nombre, valor: (m) => m.marca?.nombre },
          { encabezado: 'Modelo', ordenar: (m) => m.nombre, valor: (m) => m.nombre },
          { encabezado: 'Tipo', ordenar: (m) => m.tipoActivo?.nombre, valor: (m) => m.tipoActivo?.nombre },
        ]}
        campos={[
          { nombre: 'marcaId', etiqueta: 'Marca', tipo: 'select', opciones: opcionesMarca, requerido: true },
          { nombre: 'tipoActivoId', etiqueta: 'Tipo de activo', tipo: 'select', opciones: tipos, requerido: true },
          { nombre: 'nombre', etiqueta: 'Nombre del modelo', requerido: true },
        ]}
        aValores={(m) => ({ marcaId: m.marcaId, tipoActivoId: m.tipoActivoId, nombre: m.nombre })}
        crear={api.catalogo.crearModelo}
        editar={api.catalogo.editarModelo}
      />
      <Section titulo="Tipos de activo" descripcion="Los detectables los registra ScanGP automáticamente. Son fijos del sistema.">
        <TablaCrud<TipoActivo>
          titulo="Tipos de activo"
          filas={tiposActivo.data}
          columnas={[
            { encabezado: 'Nombre', ordenar: (t) => t.nombre, valor: (t) => t.nombre },
            { encabezado: 'Código', mono: true, valor: (t) => t.codigo },
            { encabezado: 'Registro', ordenar: (t) => (t.detectable ? 0 : 1), valor: (t) => (t.detectable ? 'Detectable por ScanGP' : 'Manual') },
          ]}
        />
      </Section>
      <Section titulo="Tipos de componente">
        <TablaCrud<TipoComponente>
          titulo="Tipos de componente"
          filas={tiposComponente.data}
          columnas={[
            { encabezado: 'Nombre', ordenar: (t) => t.nombre, valor: (t) => t.nombre },
            { encabezado: 'Código', mono: true, valor: (t) => t.codigo },
          ]}
        />
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ Organización

export function OrganizacionPage() {
  const sedes = usePolling((s) => api.org.sedes(s), 120_000);
  const areas = useOpcionesArea();
  const opcionesSede = (sedes.data ?? []).filter((x) => x.activo).map((x) => ({ valor: x.id, etiqueta: x.nombre }));
  return (
    <>
      <PageHeader titulo="Organización" subtitulo="Sedes, áreas y ubicaciones (puestos, almacenes, talleres)." />
      <TablaMaestra<Sede>
        titulo="Sedes"
        singular="sede"
        cargar={(s) => api.org.sedes(s)}
        textoBusqueda={(x) => `${x.nombre} ${x.direccion ?? ''}`}
        nombre={(x) => x.nombre}
        columnas={[
          { encabezado: 'Nombre', ordenar: (x) => x.nombre, valor: (x) => x.nombre },
          { encabezado: 'Dirección', valor: (x) => x.direccion },
          { encabezado: 'Red', mono: true, valor: (x) => x.prefijoRed, secundaria: true },
        ]}
        campos={[
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
          { nombre: 'direccion', etiqueta: 'Dirección' },
          { nombre: 'prefijoRed', etiqueta: 'Prefijo de red', placeholder: '192.168.1.', ayuda: 'Para reconocer la sede por la IP desde la que reporta ScanGP.' },
        ]}
        aValores={(x) => ({ nombre: x.nombre, direccion: x.direccion ?? '', prefijoRed: x.prefijoRed ?? '' })}
        crear={async (d) => { const r = await api.org.crearSede(d); sedes.recargar(); return r; }}
        editar={async (id, d) => { const r = await api.org.editarSede(id, d); sedes.recargar(); return r; }}
      />
      <TablaMaestra<Area>
        titulo="Áreas"
        singular="área"
        cargar={(s) => api.org.areas(s)}
        textoBusqueda={(x) => x.nombre}
        nombre={(x) => x.nombre}
        columnas={[{ encabezado: 'Nombre', ordenar: (x) => x.nombre, valor: (x) => x.nombre }]}
        campos={[{ nombre: 'nombre', etiqueta: 'Nombre', requerido: true }]}
        aValores={(x) => ({ nombre: x.nombre })}
        crear={api.org.crearArea}
        editar={api.org.editarArea}
      />
      <TablaMaestra<Ubicacion>
        titulo="Ubicaciones"
        singular="ubicación"
        descripcion="Los almacenes son ubicaciones de tipo Almacén."
        cargar={(s) => api.org.ubicaciones(s)}
        clave={String(opcionesSede.length)}
        textoBusqueda={(x) => `${x.sede?.nombre} ${x.nombre} ${et(x.tipo)} ${x.area?.nombre ?? ''}`}
        nombre={(x) => x.nombre}
        columnas={[
          { encabezado: 'Sede', ordenar: (x) => x.sede?.nombre, valor: (x) => x.sede?.nombre },
          { encabezado: 'Nombre', ordenar: (x) => x.nombre, valor: (x) => x.nombre },
          { encabezado: 'Tipo', ordenar: (x) => x.tipo, valor: (x) => et(x.tipo) },
          { encabezado: 'Área', ordenar: (x) => x.area?.nombre, valor: (x) => x.area?.nombre },
        ]}
        campos={[
          { nombre: 'sedeId', etiqueta: 'Sede', tipo: 'select', opciones: opcionesSede, requerido: true, vacio: opcionesSede.length ? 'Elegir…' : 'Primero crea una sede' },
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true, placeholder: 'Oficina 2, Almacén TI, Taller…' },
          { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: opcionesDe(TIPOS_UBICACION), requerido: true },
          { nombre: 'areaId', etiqueta: 'Área', tipo: 'select', opciones: areas, vacio: 'Sin área' },
        ]}
        aValores={(x) => ({ sedeId: x.sedeId, nombre: x.nombre, tipo: x.tipo, areaId: x.areaId ?? '' })}
        crear={api.org.crearUbicacion}
        editar={api.org.editarUbicacion}
      />
    </>
  );
}

// ------------------------------------------------------------------ Configuración

export function ConfiguracionPage() {
  const cfg = usePolling((s) => api.org.config(s), 300_000);
  const [editar, setEditar] = useState(false);
  const c = cfg.data;
  return (
    <>
      <PageHeader titulo="Configuración" acciones={c && <Button icono={Settings} onClick={() => setEditar(true)}>Editar</Button>} />
      {!c ? <LoadingState /> : (
        <Section titulo="Organización y códigos">
          <KeyValueList datos={[
            { etiqueta: 'Nombre de la organización', valor: c.nombre },
            { etiqueta: 'Código de activos', valor: `${c.prefijoActivo}${'0'.repeat(c.digitosCodigo - 1)}1`, mono: true },
            { etiqueta: 'Código de componentes', valor: `${c.prefijoComponente}${'0'.repeat(c.digitosCodigo - 1)}1`, mono: true },
            { etiqueta: 'Código de órdenes', valor: `${c.prefijoOrden}${'0'.repeat(c.digitosCodigo - 1)}1`, mono: true },
            { etiqueta: 'Aviso de equipo sin reporte', valor: `${c.diasSinReporte} días sin datos de ScanGP` },
            { etiqueta: 'Aviso de garantía', valor: `${c.diasAvisoGarantia} días antes del vencimiento` },
          ]} />
        </Section>
      )}
      {editar && c && (
        <PanelFormulario
          titulo="Editar configuración"
          descripcion="Cambiar un prefijo solo afecta a los códigos nuevos."
          campos={[
            { nombre: 'nombre', etiqueta: 'Nombre de la organización', requerido: true },
            { nombre: 'prefijoActivo', etiqueta: 'Prefijo de activos', requerido: true },
            { nombre: 'prefijoComponente', etiqueta: 'Prefijo de componentes', requerido: true },
            { nombre: 'prefijoOrden', etiqueta: 'Prefijo de órdenes', requerido: true },
            { nombre: 'digitosCodigo', etiqueta: 'Dígitos del correlativo', tipo: 'numero', requerido: true },
            { nombre: 'diasSinReporte', etiqueta: 'Días sin reporte para avisar', tipo: 'numero', requerido: true },
            { nombre: 'diasAvisoGarantia', etiqueta: 'Días de aviso de garantía', tipo: 'numero', requerido: true },
          ]}
          inicial={Object.fromEntries(Object.entries(c).map(([k, v]) => [k, String(v)]))}
          onEnviar={(d) => api.org.editarConfig(d)}
          onCerrar={() => setEditar(false)}
          onHecho={cfg.recargar}
        />
      )}
    </>
  );
}
