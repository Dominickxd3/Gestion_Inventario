import { Disclosure, KeyValueList, Section } from '../../components/ui';
import { fecha } from '../../lib/formato';
import { useEquipoActual } from '../equipo/contexto';

export function PlacaPage() {
  const { placaBase: p, bios: b } = useEquipoActual().inventario;
  return (
    <>
      <Section titulo="Placa madre">
        <KeyValueList
          datos={[
            { etiqueta: 'Fabricante', valor: p?.fabricante },
            { etiqueta: 'Modelo', valor: p?.modelo },
          ]}
        />
      </Section>
      <Section titulo="BIOS / UEFI">
        <KeyValueList
          datos={[
            { etiqueta: 'Fabricante', valor: b?.fabricante },
            { etiqueta: 'Versión', valor: b?.version, mono: true },
            { etiqueta: 'Fecha', valor: fecha(b?.fecha) },
            { etiqueta: 'Modo de arranque', valor: b?.modoArranque },
          ]}
        />
        <Disclosure titulo="Detalles técnicos" resumen="Serie y revisión de la placa, SMBIOS">
          <KeyValueList
            datos={[
              { etiqueta: 'Serie de la placa', valor: p?.numeroSerie, mono: true },
              { etiqueta: 'Revisión de la placa', valor: p?.version, mono: true },
              { etiqueta: 'Versión SMBIOS', valor: b?.versionSMBIOS, mono: true },
            ]}
          />
        </Disclosure>
      </Section>
    </>
  );
}
