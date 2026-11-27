/** Funciones de formato puras. Devuelven null si no hay dato, para que la UI muestre <Unavailable>. */

const GIB = 1024 ** 3;

/** Memoria (base 2): 34359738368 -> "32 GB". */
export function memoria(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  const gb = Math.round((bytes / GIB) * 10) / 10;
  return gb >= 1 ? `${gb} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

/** Capacidad de disco como la anuncia el fabricante (base 10): 1000204886016 -> "1.0 TB". */
export function capacidad(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(bytes >= 1e13 ? 0 : 1)} TB`;
  return `${Math.round(bytes / 1e9)} GB`;
}

/** Espacio en volúmenes (base 2, como lo muestra Windows). */
export function espacio(bytes: number | null | undefined): string | null {
  if (bytes == null || bytes < 0) return null;
  const tb = bytes / 1024 ** 4;
  if (tb >= 1) return `${tb.toFixed(2)} TB`;
  return `${(bytes / GIB).toFixed(1)} GB`;
}

export function mhzAGhz(mhz: number | null | undefined): string | null {
  return mhz ? `${(mhz / 1000).toFixed(2)} GHz` : null;
}

export function fecha(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fechaHora(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function haceCuanto(iso: string | number | null | undefined, ahora = Date.now()): string | null {
  if (iso == null) return null;
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const s = Math.max(0, (ahora - t) / 1000);
  if (s < 60) return 'hace unos segundos';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

export function diasDesde(iso: string | null | undefined, ahora = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((ahora - t) / 86_400_000);
}

/** Une partes no vacías: unir(['ASUS', null, 'X']) -> "ASUS X". */
export function unir(partes: Array<string | null | undefined | false | 0>, sep = ' '): string | null {
  const r = partes.filter(Boolean).join(sep).trim();
  return r || null;
}

/** "DESKTOP-X\\dominick" -> "dominick" */
export function usuarioCorto(u: string | null | undefined): string | null {
  if (!u) return null;
  return u.includes('\\') ? u.split('\\').pop() || u : u;
}

export function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}
