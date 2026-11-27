import { useEffect, useRef } from 'react';
import { Toast } from 'primereact/toast';
import { useEquipos } from '../../hooks/EquiposContext';
import { infoTipo } from '../../lib/tipoEquipo';

/** Notifica cuando un equipo se registra por primera vez mientras la web está abierta. */
export function AvisoEquiposNuevos() {
  const { equipos } = useEquipos();
  const toast = useRef<Toast>(null);
  const conocidos = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!equipos) return;
    if (conocidos.current) {
      equipos
        .filter((e) => !conocidos.current!.has(e.id))
        .forEach((e) =>
          toast.current?.show({
            severity: 'success',
            summary: 'Equipo registrado',
            detail: `${e.resumen.nombreEquipo} · ${infoTipo(e.resumen.tipo).etiqueta}`,
            life: 6000,
          }),
        );
    }
    conocidos.current = new Set(equipos.map((e) => e.id));
  }, [equipos]);

  return <Toast ref={toast} position="bottom-center" />;
}
