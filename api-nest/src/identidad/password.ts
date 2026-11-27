import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

/** Parámetros de scrypt (OWASP: N=2^17, r=8, p=1). Se guardan en el hash para poder subirlos en el futuro. */
const N = 2 ** 17;
const R = 8;
const P = 1;
const LONGITUD = 32;
const MAXMEM = 256 * 1024 * 1024;

export const LONGITUD_MINIMA_PASSWORD = 10;

/** Formato: `scrypt$N$r$p$salBase64$hashBase64` */
export async function hashPassword(password: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scryptAsync(password.normalize('NFC'), sal, LONGITUD, { N, r: R, p: P, maxmem: MAXMEM });
  return ['scrypt', N, R, P, sal.toString('base64'), hash.toString('base64')].join('$');
}

export async function verificarPassword(password: string, guardado: string): Promise<boolean> {
  const [alg, n, r, p, sal, hash] = guardado.split('$');
  if (alg !== 'scrypt' || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const calculado = await scryptAsync(password.normalize('NFC'), Buffer.from(sal, 'base64'), esperado.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  return timingSafeEqual(esperado, calculado);
}

/** Hash de una contraseña que nunca existirá: se compara contra él cuando el usuario no existe (mismo tiempo de respuesta). */
export const HASH_FICTICIO = 'scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

/** Contraseña temporal legible: sin caracteres ambiguos (0/O, 1/l/I). */
export function passwordTemporal(longitud = 14): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: longitud }, () => alfabeto[randomInt(alfabeto.length)]).join('');
}
