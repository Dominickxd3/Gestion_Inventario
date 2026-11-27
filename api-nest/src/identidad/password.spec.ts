import { HASH_FICTICIO, hashPassword, passwordTemporal, verificarPassword } from './password';

describe('password', () => {
  it('verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const hash = await hashPassword('una frase bastante larga');
    expect(hash).toMatch(/^scrypt\$131072\$8\$1\$/);
    await expect(verificarPassword('una frase bastante larga', hash)).resolves.toBe(true);
    await expect(verificarPassword('una frase bastante largA', hash)).resolves.toBe(false);
  });

  it('usa sal aleatoria: la misma contraseña produce hashes distintos', async () => {
    expect(await hashPassword('igual igual igual')).not.toBe(await hashPassword('igual igual igual'));
  });

  it('normaliza Unicode (é compuesta y descompuesta son la misma contraseña)', async () => {
    const hash = await hashPassword('contraseña café');
    await expect(verificarPassword('contraseña café', hash)).resolves.toBe(true);
  });

  it('el hash ficticio nunca coincide', async () => {
    await expect(verificarPassword('', HASH_FICTICIO)).resolves.toBe(false);
    await expect(verificarPassword('cualquiera', HASH_FICTICIO)).resolves.toBe(false);
  });

  it('rechaza formatos desconocidos', async () => {
    await expect(verificarPassword('x', 'bcrypt$...')).resolves.toBe(false);
  });

  it('genera contraseñas temporales sin caracteres ambiguos', () => {
    const p = passwordTemporal();
    expect(p).toHaveLength(14);
    expect(p).not.toMatch(/[0O1lI]/);
  });
});
