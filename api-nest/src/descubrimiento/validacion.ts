/**
 * Validación estructural del inventario que envía ScanGP.
 * Es deliberadamente tolerante: acepta campos desconocidos (versiones nuevas del detector) y secciones nulas
 * (lecturas fallidas), pero rechaza tipos incorrectos que romperían el procesamiento.
 */
const SECCIONES_LISTA = ['procesadores', 'discos', 'volumenes', 'graficos', 'monitores', 'red', 'antivirus', 'software'] as const;
const SECCIONES_OBJETO = ['sistemaOperativo', 'placaBase', 'bios', 'memoria', 'bateria'] as const;

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function erroresInventario(p: unknown): string[] {
  if (!esObjeto(p)) return ['El cuerpo debe ser un objeto JSON'];
  const errores: string[] = [];

  if (!esObjeto(p.equipo)) {
    errores.push('Falta la sección "equipo"');
  } else {
    const nombre = p.equipo.nombreEquipo;
    if (typeof nombre !== 'string' || !nombre.trim()) errores.push('equipo.nombreEquipo es obligatorio');
    else if (nombre.length > 256) errores.push('equipo.nombreEquipo supera 256 caracteres');
    for (const campo of ['uuid', 'numeroSerie', 'fabricante', 'modelo', 'usuario']) {
      const v = p.equipo[campo];
      if (v != null && typeof v !== 'string') errores.push(`equipo.${campo} debe ser texto`);
    }
  }

  for (const s of SECCIONES_LISTA) {
    if (p[s] != null && !Array.isArray(p[s])) errores.push(`"${s}" debe ser una lista`);
    else if (Array.isArray(p[s]) && (p[s] as unknown[]).some((x) => !esObjeto(x))) errores.push(`"${s}" solo admite objetos`);
  }
  for (const s of SECCIONES_OBJETO) {
    if (p[s] != null && !esObjeto(p[s])) errores.push(`"${s}" debe ser un objeto`);
  }
  if (esObjeto(p.memoria) && p.memoria.modulos != null && !Array.isArray(p.memoria.modulos)) {
    errores.push('memoria.modulos debe ser una lista');
  }
  if (p.advertencias != null && !Array.isArray(p.advertencias)) errores.push('"advertencias" debe ser una lista');
  return errores;
}
