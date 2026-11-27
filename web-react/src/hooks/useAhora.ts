import { useEffect, useState } from 'react';

/** Devuelve la hora actual y re-renderiza cada `intervaloMs` (para textos "hace X min"). */
export function useAhora(intervaloMs = 30_000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), intervaloMs);
    return () => window.clearInterval(t);
  }, [intervaloMs]);
  return ahora;
}
