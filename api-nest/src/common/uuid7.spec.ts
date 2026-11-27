import { uuid7 } from './uuid7';

describe('uuid7', () => {
  it('tiene formato UUID con versión 7 y variante RFC', () => {
    expect(uuid7()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('codifica la marca de tiempo en los primeros 48 bits (ordenable por tiempo)', () => {
    const t = Date.UTC(2026, 10, 27, 12, 0, 0);
    const id = uuid7(t);
    expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(t);
    expect(uuid7(t) < uuid7(t + 1)).toBe(true);
  });

  it('no repite valores', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuid7()));
    expect(ids.size).toBe(1000);
  });
});
