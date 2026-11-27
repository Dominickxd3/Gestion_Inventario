import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '../../components/ui';

/** Comando en tipografía monoespaciada con botón para copiar. */
export function ComandoCopiable({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* el usuario puede seleccionarlo y copiarlo a mano */
    }
  };
  return (
    <div className="comando">
      <code aria-label={etiqueta}>{texto}</code>
      <Button variante="fantasma" icono={copiado ? Check : Copy} onClick={copiar} aria-label={copiado ? 'Copiado' : `Copiar ${etiqueta}`} />
    </div>
  );
}
