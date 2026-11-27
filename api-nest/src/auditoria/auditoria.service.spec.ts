import { sinSensibles } from './auditoria.service';

describe('sinSensibles', () => {
  it('omite contraseñas, hashes, tokens y claves a cualquier profundidad', () => {
    expect(
      sinSensibles({
        nombre: 'Ana',
        password: 'x',
        hashPassword: 'y',
        datos: [{ token: 'z', apiKey: 'k', ok: 1 }],
        fecha: new Date(0),
      }),
    ).toEqual({
      nombre: 'Ana',
      password: '[omitido]',
      hashPassword: '[omitido]',
      datos: [{ token: '[omitido]', apiKey: '[omitido]', ok: 1 }],
      fecha: new Date(0),
    });
  });
});
