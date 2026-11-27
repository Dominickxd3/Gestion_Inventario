import { useCallback, useEffect, useRef, useState } from 'react';

export interface EstadoPolling<T> {
  data: T | undefined;
  error: Error | undefined;
  cargando: boolean;
  actualizado: number | undefined;
  recargar: () => void;
}

/**
 * Consulta periódica. Conserva los últimos datos aunque falle una consulta
 * (así la interfaz sigue mostrando información durante una desconexión).
 * `clave` reinicia el estado cuando cambia (p. ej. el id del equipo).
 */
export function usePolling<T>(
  cargar: (signal: AbortSignal) => Promise<T>,
  intervaloMs: number,
  clave: string = '',
): EstadoPolling<T> {
  const [estado, setEstado] = useState<Omit<EstadoPolling<T>, 'recargar'>>({
    data: undefined,
    error: undefined,
    cargando: true,
    actualizado: undefined,
  });
  const [vuelta, setVuelta] = useState(0);
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  useEffect(() => {
    setEstado({ data: undefined, error: undefined, cargando: true, actualizado: undefined });
  }, [clave]);

  useEffect(() => {
    let vivo = true;
    let temporizador: number | undefined;
    let control: AbortController | undefined;

    const ejecutar = async () => {
      control = new AbortController();
      try {
        const data = await cargarRef.current(control.signal);
        if (vivo) setEstado({ data, error: undefined, cargando: false, actualizado: Date.now() });
      } catch (e) {
        if (!vivo || (e as Error).name === 'AbortError') return;
        setEstado((s) => ({ ...s, error: e as Error, cargando: false }));
      }
      if (vivo) temporizador = window.setTimeout(ejecutar, intervaloMs);
    };
    ejecutar();

    return () => {
      vivo = false;
      window.clearTimeout(temporizador);
      control?.abort();
    };
  }, [clave, intervaloMs, vuelta]);

  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  return { ...estado, recargar };
}
