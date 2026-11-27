import { descargarArchivo, enviarJson, getJson, subirArchivo } from './http';
import type {
  ActivoDetalle, ActivoVista, Area, Articulo, Asignacion, ComponenteDetalle, ComponenteVista, Config, Discrepancia, Documento, Existencia,
  Garantia, InstalacionVista, Marca, Modelo, Movimiento, MovimientoAlmacen, Orden, Pagina, Panel, Persona, Sede, SugerenciaActivo,
  TipoActivo, TipoComponente, Ubicacion,
} from '../types/gestion';

type S = AbortSignal | undefined;
type Datos = Record<string, unknown>;
const qs = (p: Record<string, string | number | boolean | null | undefined>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : '';
};
const id = encodeURIComponent;

export const api = {
  panel: (s?: S) => getJson<Panel>('/panel', s),

  catalogo: {
    tiposActivo: (s?: S) => getJson<TipoActivo[]>('/catalogo/tipos-activo', s),
    tiposComponente: (s?: S) => getJson<TipoComponente[]>('/catalogo/tipos-componente', s),
    marcas: (s?: S) => getJson<Marca[]>('/catalogo/marcas', s),
    crearMarca: (d: Datos) => enviarJson<Marca>('POST', '/catalogo/marcas', d),
    editarMarca: (x: string, d: Datos) => enviarJson<Marca>('PATCH', `/catalogo/marcas/${id(x)}`, d),
    modelos: (s?: S) => getJson<Modelo[]>('/catalogo/modelos', s),
    crearModelo: (d: Datos) => enviarJson<Modelo>('POST', '/catalogo/modelos', d),
    editarModelo: (x: string, d: Datos) => enviarJson<Modelo>('PATCH', `/catalogo/modelos/${id(x)}`, d),
  },

  org: {
    sedes: (s?: S) => getJson<Sede[]>('/organizacion/sedes', s),
    crearSede: (d: Datos) => enviarJson<Sede>('POST', '/organizacion/sedes', d),
    editarSede: (x: string, d: Datos) => enviarJson<Sede>('PATCH', `/organizacion/sedes/${id(x)}`, d),
    areas: (s?: S) => getJson<Area[]>('/organizacion/areas', s),
    crearArea: (d: Datos) => enviarJson<Area>('POST', '/organizacion/areas', d),
    editarArea: (x: string, d: Datos) => enviarJson<Area>('PATCH', `/organizacion/areas/${id(x)}`, d),
    ubicaciones: (s?: S, tipo?: string) => getJson<Ubicacion[]>(`/organizacion/ubicaciones${qs({ tipo })}`, s),
    crearUbicacion: (d: Datos) => enviarJson<Ubicacion>('POST', '/organizacion/ubicaciones', d),
    editarUbicacion: (x: string, d: Datos) => enviarJson<Ubicacion>('PATCH', `/organizacion/ubicaciones/${id(x)}`, d),
    personas: (s?: S, q?: string) => getJson<Persona[]>(`/organizacion/personas${qs({ q })}`, s),
    persona: (x: string, s?: S) => getJson<Persona>(`/organizacion/personas/${id(x)}`, s),
    crearPersona: (d: Datos) => enviarJson<Persona>('POST', '/organizacion/personas', d),
    editarPersona: (x: string, d: Datos) => enviarJson<Persona>('PATCH', `/organizacion/personas/${id(x)}`, d),
    config: (s?: S) => getJson<Config>('/organizacion/config', s),
    editarConfig: (d: Datos) => enviarJson<Config>('PATCH', '/organizacion/config', d),
  },

  activos: {
    listar: (f: Record<string, string | number | undefined>, s?: S) => getJson<Pagina<ActivoVista>>(`/activos${qs(f)}`, s),
    obtener: (x: string, s?: S) => getJson<ActivoDetalle>(`/activos/${id(x)}`, s),
    historial: (x: string, s?: S) => getJson<Movimiento[]>(`/activos/${id(x)}/historial`, s),
    componentes: (x: string, retirados: boolean, s?: S) =>
      getJson<{ instalaciones: InstalacionVista[]; integrados: { tipo: string; descripcion: string }[] }>(`/activos/${id(x)}/componentes${qs({ retirados })}`, s),
    crear: (d: Datos) => enviarJson<ActivoDetalle>('POST', '/activos', d),
    editar: (x: string, d: Datos) => enviarJson<ActivoDetalle>('PATCH', `/activos/${id(x)}`, d),
    estadoTecnico: (x: string, d: Datos) => enviarJson('POST', `/activos/${id(x)}/estado-tecnico`, d),
    ciclo: (x: string, d: Datos) => enviarJson('POST', `/activos/${id(x)}/ciclo`, d),
    ubicacion: (x: string, d: Datos) => enviarJson('POST', `/activos/${id(x)}/ubicacion`, d),
    baja: (x: string, d: Datos) => enviarJson('POST', `/activos/${id(x)}/baja`, d),
    vincular: (x: string, dispositivoId: string) => enviarJson('POST', `/activos/${id(x)}/vincular`, { dispositivoId }),
    desvincular: (x: string) => enviarJson('POST', `/activos/${id(x)}/desvincular`),
    reemplazarComponente: (x: string, d: Datos) => enviarJson('POST', `/activos/${id(x)}/reemplazar-componente`, d),
  },

  componentes: {
    listar: (f: Record<string, string | number | undefined>, s?: S) => getJson<Pagina<ComponenteVista>>(`/componentes${qs(f)}`, s),
    obtener: (x: string, s?: S) => getJson<ComponenteDetalle>(`/componentes/${id(x)}`, s),
    crear: (d: Datos) => enviarJson<ComponenteVista>('POST', '/componentes', d),
    editar: (x: string, d: Datos) => enviarJson('PATCH', `/componentes/${id(x)}`, d),
    instalar: (x: string, d: Datos) => enviarJson('POST', `/componentes/${id(x)}/instalar`, d),
    retirar: (x: string, d: Datos) => enviarJson('POST', `/componentes/${id(x)}/retirar`, d),
    reingresar: (x: string, d: Datos) => enviarJson('POST', `/componentes/${id(x)}/reingresar`, d),
    baja: (x: string, d: Datos) => enviarJson('POST', `/componentes/${id(x)}/baja`, d),
  },

  asignaciones: {
    listar: (f: Record<string, string | boolean | undefined>, s?: S) => getJson<Asignacion[]>(`/asignaciones${qs(f)}`, s),
    asignar: (d: Datos) => enviarJson<Asignacion>('POST', '/asignaciones', d),
    devolver: (x: string, d: Datos) => enviarJson('POST', `/asignaciones/${id(x)}/devolver`, d),
    transferir: (x: string, d: Datos) => enviarJson('POST', `/asignaciones/${id(x)}/transferir`, d),
  },

  mantenimiento: {
    listar: (f: Record<string, string | boolean | undefined>, s?: S) => getJson<Orden[]>(`/mantenimiento${qs(f)}`, s),
    obtener: (x: string, s?: S) => getJson<Orden>(`/mantenimiento/${id(x)}`, s),
    abrir: (d: Datos) => enviarJson<Orden>('POST', '/mantenimiento', d),
    actualizar: (x: string, d: Datos) => enviarJson<Orden>('PATCH', `/mantenimiento/${id(x)}`, d),
    cerrar: (x: string, d: Datos) => enviarJson<Orden>('POST', `/mantenimiento/${id(x)}/cerrar`, d),
    cancelar: (x: string, d: Datos) => enviarJson<Orden>('POST', `/mantenimiento/${id(x)}/cancelar`, d),
  },

  discrepancias: {
    listar: (f: { estado?: string; activoId?: string }, s?: S) => getJson<Discrepancia[]>(`/discrepancias${qs(f)}`, s),
    aceptar: (x: string, d: Datos) => enviarJson('POST', `/discrepancias/${id(x)}/aceptar`, d),
    rechazar: (x: string, d: Datos) => enviarJson('POST', `/discrepancias/${id(x)}/rechazar`, d),
  },

  detectados: {
    sugerencia: (x: string, s?: S) => getJson<SugerenciaActivo>(`/equipos/${id(x)}/sugerencia-activo`, s),
    alta: (d: Datos) => enviarJson<ActivoDetalle>('POST', '/equipos/alta-activo', d),
    archivar: (x: string) => enviarJson('POST', `/equipos/${id(x)}/archivar`),
  },

  almacen: {
    articulos: (s?: S) => getJson<Articulo[]>('/almacen/articulos', s),
    crearArticulo: (d: Datos) => enviarJson<Articulo>('POST', '/almacen/articulos', d),
    editarArticulo: (x: string, d: Datos) => enviarJson<Articulo>('PATCH', `/almacen/articulos/${id(x)}`, d),
    existencias: (s?: S) => getJson<Existencia[]>('/almacen/existencias', s),
    movimientos: (s?: S, articuloId?: string) => getJson<MovimientoAlmacen[]>(`/almacen/movimientos${qs({ articuloId })}`, s),
    mover: (d: Datos) => enviarJson('POST', '/almacen/movimientos', d),
  },

  garantias: {
    listar: (f: Record<string, string | undefined>, s?: S) => getJson<Garantia[]>(`/garantias${qs(f)}`, s),
    crear: (d: Datos) => enviarJson<Garantia>('POST', '/garantias', d),
    editar: (x: string, d: Datos) => enviarJson<Garantia>('PATCH', `/garantias/${id(x)}`, d),
  },

  documentos: {
    listar: (entidad: string, entidadId: string, s?: S) => getJson<Documento[]>(`/documentos${qs({ entidad, entidadId })}`, s),
    subir: (datos: FormData) => subirArchivo<Documento>('/documentos', datos),
    descargar: (d: Documento) => descargarArchivo(`/documentos/${id(d.id)}/descargar`, d.nombreArchivo),
    anular: (x: string) => enviarJson('POST', `/documentos/${id(x)}/anular`),
  },
};
