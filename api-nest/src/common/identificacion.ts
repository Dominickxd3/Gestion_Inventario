/**
 * Valores de relleno que algunas placas y BIOS reportan como UUID o número de serie.
 * Usarlos para identificar haría que equipos distintos se fusionen en uno (riesgo R4).
 */
const SERIES_INVALIDAS = new Set([
  'TO BE FILLED BY O.E.M.', 'TO BE FILLED BY OEM', 'DEFAULT STRING', 'SYSTEM SERIAL NUMBER', 'CHASSIS SERIAL NUMBER',
  'NOT SPECIFIED', 'NOT APPLICABLE', 'NONE', 'N/A', 'NA', 'NULL', '0', '00000000', '0123456789', '123456789', '1234567890',
  'SERIAL NUMBER', 'INVALID', 'UNKNOWN', 'OEM', 'BASE BOARD SERIAL NUMBER', 'SN', 'XXXXXXXX',
]);

const UUIDS_INVALIDOS = new Set([
  '03000200-0400-0500-0006-000700080009',
  '00000000-0000-0000-0000-000000000000',
  'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
  '12345678-1234-5678-90AB-CDDEEFAABBCC',
  '00020003-0004-0005-0006-000700080009',
]);

/** Número de serie útil para identificar: no vacío, no de relleno y con algo más que un carácter repetido. */
export function serieValida(s: string | null | undefined): s is string {
  if (!s) return false;
  const v = s.trim().toUpperCase();
  if (v.length < 3 || SERIES_INVALIDAS.has(v)) return false;
  return !/^(.)\1*$/.test(v.replace(/[\s-]/g, ''));
}

export function uuidValido(u: string | null | undefined): u is string {
  if (!u) return false;
  const v = u.trim().toUpperCase();
  return /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(v) && !UUIDS_INVALIDOS.has(v) && !/^(.)\1*$/.test(v.replace(/-/g, ''));
}

/** Clave con la que ScanGP reconoce un componente: tipo + serie normalizada. null si la serie no sirve. */
export function huellaComponente(tipoCodigo: string, serie: string | null | undefined): string | null {
  if (!serieValida(serie)) return null;
  return `${tipoCodigo.toUpperCase()}:${serie.trim().toUpperCase().replace(/\s+/g, '')}`;
}

/** Capacidad legible: 1024209543168 → "1 TB", 17179869184 → "16 GB". */
export function capacidadLegible(bytes: number | null | undefined, base: 1000 | 1024 = 1024): string | null {
  if (!bytes || bytes <= 0) return null;
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = bytes;
  while (v >= base && i < u.length - 1) {
    v /= base;
    i++;
  }
  return `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10} ${u[i]}`;
}
