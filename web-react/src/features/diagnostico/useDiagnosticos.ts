import { useCallback } from 'react';
import { useDetalles } from '../../hooks/useDetalles';
import type { EquipoListado } from '../../types/api';
import { diagnosticar, resumirDiagnostico, type ResumenDiagnostico } from './rules';

/** Diagnóstico resumido de cada equipo de una lista (para Inicio y la tabla de equipos). */
export function useDiagnosticos(equipos: EquipoListado[] | undefined) {
  const { obtener, listo } = useDetalles(equipos);
  const diagnosticoDe = useCallback(
    (id: string): ResumenDiagnostico | undefined => {
      const d = obtener(id);
      return d ? resumirDiagnostico(diagnosticar(d.inventario)) : undefined;
    },
    [obtener],
  );
  return { diagnosticoDe, listo };
}
