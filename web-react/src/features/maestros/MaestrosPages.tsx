import { useState } from 'react';
import { ArrowDownToLine, Settings } from 'lucide-react';
import { Button, ErrorState, KeyValueList, LoadingState, PageHeader, Section, SelectField, SpecTable } from '../../components/ui';
import { CAMPO_ACTIVO, TablaMaestra } from '../../components/forms/TablaMaestra';
import { PanelFormulario } from '../../components/forms/PanelFormulario';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { api } from '../../services/gestion.service';
import { fechaHora } from '../../lib/formato';
import {
  TIPOS_UBICACION, et, opcionesDe, type Area, type Articulo, type Existencia, type Marca, type Modelo, type MovimientoAlmacen, type Sede, type Ubicacion,
} from '../../types/gestion';
import { useOpcionesArea, useOpcionesTipoActivo, useOpcionesUbicacion } from '../gestion/comun';
import { TablaGarantias } from '../activos/ActivoTabs';
import { TablaComponentes } from '../rastreables/ComponentesPage';

// ------------------------------------------------------------------ Almacén

export function AlmacenPage() {
  const existencias = usePolling((s) => api.almacen.existencias(s), 30_000);
  const movimientos = usePolling((s) => api.almacen.movimientos(s), 30_000);
  const componentes = usePolling((s) => api.componentes.listar({ situacion: 'EN_ALMACEN', porPagina: 500 }, s), 30_000);
  const articulos = usePolling((s) => api.almacen.articulos(s), 120_000);
  const almacenes = useOpcionesUbicacion('ALMACEN');
  const { puede } = useSesion();
  const [mover, setMover] = useState(false);
  const recargar = () => {
    existencias.recargar();
    movimientos.recargar();
  };

  return (
    <>
      <PageHeader
        titulo="Almacén"
        subtitulo="Repuestos con número de serie (componentes) y consumibles por cantidad."
        acciones={puede('ADMIN', 'TECNICO') && <Button variante="primario" icono={ArrowDownToLine} onClick={() => setMover(true)}>Registrar movimiento</Button>}
      />
      <Section titulo="Componentes en almacén" descripcion="Piezas con identidad propia listas para instalar.">
        {!componentes.data ? <LoadingState /> : <TablaComponentes filas={componentes.data.items} />}
      </Section>
      <Section titulo="Existencias de consumibles">
        {existencias.error && !existencias.data ? <ErrorState mensaje={existencias.error.message} onReintentar={existencias.recargar} /> : !existencias.data ? <LoadingState /> : (
          <SpecTable<Existencia>
            titulo="Existencias"
            filas={existencias.data}
            vacio="Sin artículos. Créalos abajo, en Artículos."
            columnas={[
              { encabezado: 'Artículo', valor: (e) => e.nombre },
              { encabezado: 'Almacén', valor: (e) => (e.ubicacion ? `${e.sede} › ${e.ubicacion}` : 'Sin existencias') },
              { encabezado: 'Cantidad', numerica: true, valor: (e) => `${e.cantidad} ${e.unidad}` },
              { encabezado: 'Total', numerica: true, valor: (e) => <span className={e.stockMinimo > 0 && e.totalArticulo < e.stockMinimo ? 'estado-problema' : ''}>{e.totalArticulo}{e.stockMinimo > 0 ? ` / mín. ${e.stockMinimo}` : ''}</span> },
            ]}
          />
        )}
      </Section>
      <Section titulo="Últimos movimientos">
        {!movimientos.data ? <LoadingState /> : (
          <SpecTable<MovimientoAlmacen>
            titulo="Movimientos de almacén"
            filas={movimientos.data}
            vacio="Sin movimientos."
            columnas={[
              { encabezado: 'Fecha', valor: (m) => fechaHora(m.fecha) },
              { encabezado: 'Artículo', valor: (m) => m.articulo },
              { encabezado: 'Tipo', valor: (m) => et(m.tipo) },
              { encabezado: 'Cantidad', numerica: true, valor: (m) => `${m.cantidad > 0 ? '+' : ''}${m.cantidad}` },
              { encabezado: 'Saldo', numerica: true, valor: (m) => m.saldo },
              { encabezado: 'Almacén', valor: (m) => m.ubicacion },
              { encabezado: 'Destino / motivo', valor: (m) => [m.activo, m.orden, m.motivo].filter(Boolean).join(' · ') || '—' },
              { encabezado: 'Usuario', valor: (m) => m.usuarioNombre },
            ]}
          />
        )}
      </Section>
      <TablaMaestra<Articulo>
        titulo="Artículos"
        singular="artículo"
        cargar={(s) => api.almacen.articulos(s)}
        columnas={[
          { encabezado: 'Nombre', valor: (a) => a.nombre },
          { encabezado: 'Unidad', valor: (a) => a.unidad },
          { encabezado: 'Stock mínimo', numerica: true, valor: (a) => a.stockMinimo },
        ]}
        campos={(e) => [
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true, placeholder: 'Tóner HP 85A, cable HDMI…' },
          { nombre: 'unidad', etiqueta: 'Unidad', requerido: true, placeholder: 'unidad, caja, metro…' },
          { nombre: 'stockMinimo', etiqueta: 'Stock mínimo', tipo: 'numero', ayuda: 'El panel avisa cuando el total baja de este número.' },
          ...(e ? [CAMPO_ACTIVO] : []),
        ]}
        aValores={(a) => ({ nombre: a.nombre, unidad: a.unidad, stockMinimo: String(a.stockMinimo), activo: a.activo })}
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
          inicial={{ tipo: 'ENTRADA' }}
          onEnviar={(d) => api.almacen.mover(d)}
          onCerrar={() => setMover(false)}
          onHecho={recargar}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ Garantías

export function GarantiasPage() {
  const [vista, setVista] = useState('porVencer');
  const filtro = vista === 'porVencer' ? { porVencer: '60' } : vista === 'vencidas' ? { vencidas: 'true' } : {};
  const datos = usePolling((s) => api.garantias.listar(filtro, s), 60_000, vista);
  return (
    <>
      <PageHeader titulo="Garantías" subtitulo="Para registrar una, abre la ficha del activo › Garantías." />
      <div className="filtros-fila">
        <SelectField etiqueta="Ver" value={vista} onChange={(e) => setVista(e.target.value)} opciones={[
          { valor: 'porVencer', etiqueta: 'Vencen en 60 días' }, { valor: 'vencidas', etiqueta: 'Vencidas' }, { valor: 'todas', etiqueta: 'Todas' },
        ]} />
      </div>
      {!datos.data ? <LoadingState /> : <TablaGarantias filas={datos.data} conActivo />}
    </>
  );
}

// ------------------------------------------------------------------ Catálogo

export function CatalogoPage() {
  const tipos = useOpcionesTipoActivo();
  const marcas = usePolling((s) => api.catalogo.marcas(s), 120_000);
  const tiposActivo = usePolling((s) => api.catalogo.tiposActivo(s), 300_000);
  const tiposComponente = usePolling((s) => api.catalogo.tiposComponente(s), 300_000);
  const opcionesMarca = (marcas.data ?? []).map((m) => ({ valor: m.id, etiqueta: m.nombre }));
  return (
    <>
      <PageHeader titulo="Catálogo" subtitulo="Marcas, modelos y tipos, independientes de cada equipo." />
      <TablaMaestra<Marca>
        titulo="Marcas"
        singular="marca"
        cargar={(s) => api.catalogo.marcas(s)}
        columnas={[{ encabezado: 'Nombre', valor: (m) => m.nombre }, { encabezado: 'Estado', valor: (m) => (m.activo ? 'Activa' : 'Inactiva') }]}
        campos={(e) => [{ nombre: 'nombre', etiqueta: 'Nombre', requerido: true }, ...(e ? [CAMPO_ACTIVO] : [])]}
        aValores={(m) => ({ nombre: m.nombre, activo: m.activo })}
        crear={async (d) => { const r = await api.catalogo.crearMarca(d); marcas.recargar(); return r; }}
        editar={api.catalogo.editarMarca}
      />
      <TablaMaestra<Modelo>
        titulo="Modelos"
        singular="modelo"
        cargar={(s) => api.catalogo.modelos(s)}
        clave={String(opcionesMarca.length)}
        columnas={[
          { encabezado: 'Marca', valor: (m) => m.marca?.nombre },
          { encabezado: 'Modelo', valor: (m) => m.nombre },
          { encabezado: 'Tipo', valor: (m) => m.tipoActivo?.nombre },
        ]}
        campos={(e) => [
          { nombre: 'marcaId', etiqueta: 'Marca', tipo: 'select', opciones: opcionesMarca, requerido: true },
          { nombre: 'tipoActivoId', etiqueta: 'Tipo de activo', tipo: 'select', opciones: tipos, requerido: true },
          { nombre: 'nombre', etiqueta: 'Nombre del modelo', requerido: true },
          ...(e ? [CAMPO_ACTIVO] : []),
        ]}
        aValores={(m) => ({ marcaId: m.marcaId, tipoActivoId: m.tipoActivoId, nombre: m.nombre, activo: m.activo })}
        crear={api.catalogo.crearModelo}
        editar={api.catalogo.editarModelo}
      />
      <Section titulo="Tipos de activo" descripcion="Los marcados como detectables los registra ScanGP automáticamente.">
        <KeyValueList datos={(tiposActivo.data ?? []).map((t) => ({ etiqueta: t.nombre, valor: t.detectable ? 'Detectable por ScanGP' : 'Registro manual' }))} />
      </Section>
      <Section titulo="Tipos de componente">
        <KeyValueList datos={(tiposComponente.data ?? []).map((t) => ({ etiqueta: t.nombre, valor: t.codigo, mono: true }))} />
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ Organización

export function OrganizacionPage() {
  const sedes = usePolling((s) => api.org.sedes(s), 120_000);
  const areas = useOpcionesArea();
  const opcionesSede = (sedes.data ?? []).map((x) => ({ valor: x.id, etiqueta: x.nombre }));
  return (
    <>
      <PageHeader titulo="Organización" subtitulo="Sedes, áreas y ubicaciones (puestos, almacenes, talleres)." />
      <TablaMaestra<Sede>
        titulo="Sedes"
        singular="sede"
        cargar={(s) => api.org.sedes(s)}
        columnas={[
          { encabezado: 'Nombre', valor: (x) => x.nombre },
          { encabezado: 'Dirección', valor: (x) => x.direccion ?? '—' },
          { encabezado: 'Red', mono: true, valor: (x) => x.prefijoRed ?? '—' },
        ]}
        campos={(e) => [
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
          { nombre: 'direccion', etiqueta: 'Dirección' },
          { nombre: 'prefijoRed', etiqueta: 'Prefijo de red', placeholder: '192.168.1.', ayuda: 'Para reconocer la sede por la IP desde la que reporta ScanGP.' },
          ...(e ? [CAMPO_ACTIVO] : []),
        ]}
        aValores={(x) => ({ nombre: x.nombre, direccion: x.direccion ?? '', prefijoRed: x.prefijoRed ?? '', activo: x.activo })}
        crear={async (d) => { const r = await api.org.crearSede(d); sedes.recargar(); return r; }}
        editar={api.org.editarSede}
      />
      <TablaMaestra<Area>
        titulo="Áreas"
        singular="área"
        cargar={(s) => api.org.areas(s)}
        columnas={[{ encabezado: 'Nombre', valor: (x) => x.nombre }, { encabezado: 'Estado', valor: (x) => (x.activo ? 'Activa' : 'Inactiva') }]}
        campos={(e) => [{ nombre: 'nombre', etiqueta: 'Nombre', requerido: true }, ...(e ? [CAMPO_ACTIVO] : [])]}
        aValores={(x) => ({ nombre: x.nombre, activo: x.activo })}
        crear={api.org.crearArea}
        editar={api.org.editarArea}
      />
      <TablaMaestra<Ubicacion>
        titulo="Ubicaciones"
        singular="ubicación"
        descripcion="Los almacenes son ubicaciones de tipo Almacén."
        cargar={(s) => api.org.ubicaciones(s)}
        clave={String(opcionesSede.length)}
        columnas={[
          { encabezado: 'Sede', valor: (x) => x.sede?.nombre },
          { encabezado: 'Nombre', valor: (x) => x.nombre },
          { encabezado: 'Tipo', valor: (x) => et(x.tipo) },
          { encabezado: 'Área', valor: (x) => x.area?.nombre ?? '—' },
        ]}
        campos={(e) => [
          { nombre: 'sedeId', etiqueta: 'Sede', tipo: 'select', opciones: opcionesSede, requerido: true, vacio: opcionesSede.length ? 'Elegir…' : 'Primero crea una sede' },
          { nombre: 'nombre', etiqueta: 'Nombre', requerido: true, placeholder: 'Oficina 2, Almacén TI, Taller…' },
          { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: opcionesDe(TIPOS_UBICACION), requerido: true },
          { nombre: 'areaId', etiqueta: 'Área', tipo: 'select', opciones: areas, vacio: 'Sin área' },
          ...(e ? [CAMPO_ACTIVO] : []),
        ]}
        aValores={(x) => ({ sedeId: x.sedeId, nombre: x.nombre, tipo: x.tipo, areaId: x.areaId ?? '', activo: x.activo })}
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
