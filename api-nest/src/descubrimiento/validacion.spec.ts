import { erroresInventario } from './validacion';
import inventarioReal from '../../test/fixtures/inventario-scangp-1.1.json';

describe('erroresInventario', () => {
  it('acepta un inventario real de ScanGP 1.1 (anonimizado)', () => {
    expect(erroresInventario(inventarioReal)).toEqual([]);
  });

  it('acepta campos desconocidos (versiones futuras del detector) y secciones nulas (lecturas fallidas)', () => {
    expect(erroresInventario({ ...inventarioReal, seccionNueva: { x: 1 }, bateria: null, monitores: null })).toEqual([]);
  });

  it('exige equipo.nombreEquipo', () => {
    expect(erroresInventario({ equipo: {} })).toContain('equipo.nombreEquipo es obligatorio');
    expect(erroresInventario({ equipo: { nombreEquipo: '   ' } })).toContain('equipo.nombreEquipo es obligatorio');
    expect(erroresInventario({})).toContain('Falta la sección "equipo"');
  });

  it('rechaza tipos incorrectos', () => {
    const e = erroresInventario({ equipo: { nombreEquipo: 'PC', uuid: 5 }, discos: {}, memoria: [], software: ['x'] });
    expect(e).toEqual(
      expect.arrayContaining([
        'equipo.uuid debe ser texto',
        '"discos" debe ser una lista',
        '"memoria" debe ser un objeto',
        '"software" solo admite objetos',
      ]),
    );
  });

  it('rechaza cuerpos que no son objeto', () => {
    expect(erroresInventario(null)).toEqual(['El cuerpo debe ser un objeto JSON']);
    expect(erroresInventario([])).toEqual(['El cuerpo debe ser un objeto JSON']);
  });
});
