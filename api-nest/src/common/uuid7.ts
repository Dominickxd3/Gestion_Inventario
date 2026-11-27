import { randomBytes } from 'crypto';

/**
 * UUID v7 (RFC 9562): 48 bits de marca de tiempo en ms + aleatorio.
 * Ordenado por tiempo, evita la fragmentación del índice agrupado en SQL Server.
 */
export function uuid7(ahora = Date.now()): string {
  const b = randomBytes(16);
  const ts = BigInt(ahora);
  for (let i = 0; i < 6; i++) b[i] = Number((ts >> BigInt(8 * (5 - i))) & 0xffn);
  b[6] = (b[6] & 0x0f) | 0x70; // versión 7
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
