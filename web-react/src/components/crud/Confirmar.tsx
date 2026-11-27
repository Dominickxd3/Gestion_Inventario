import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog } from 'primereact/dialog';
import { CircleHelp, TriangleAlert } from 'lucide-react';
import { Button, Icon } from '../ui';
import { AvisosProvider } from '../ui/alertas';

interface Pregunta {
  titulo: string;
  mensaje: string;
  accion: string;
  peligro?: boolean;
}
const Contexto = createContext<((p: Pregunta) => Promise<boolean>) | null>(null);

/** Confirmación explícita; salir de la ventana nunca acepta una acción. */
export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [pregunta, setPregunta] = useState<Pregunta | null>(null);
  const resolver = useRef<((r: boolean) => void) | null>(null);
  const preguntar = useCallback((p: Pregunta) => {
    resolver.current?.(false);
    setPregunta(p);
    return new Promise<boolean>((r) => { resolver.current = r; });
  }, []);
  const responder = useCallback((r: boolean) => {
    resolver.current?.(r);
    resolver.current = null;
    setPregunta(null);
  }, []);
  useEffect(() => () => { resolver.current?.(false); }, []);
  return (
    <Contexto.Provider value={preguntar}>
      <AvisosProvider>{children}</AvisosProvider>
      <Dialog
        visible={!!pregunta}
        onHide={() => responder(false)}
        header={pregunta?.titulo}
        className="dialogo-confirmar"
        aria-describedby="confirmar-descripcion"
        position="center"
        modal blockScroll draggable={false} resizable={false}
        dismissableMask={false} closeOnEscape={false}
        baseZIndex={1200}
        footer={
          <div className="confirmar-acciones">
            <button type="button" className="boton boton-secundario" autoFocus onClick={() => responder(false)}>Cancelar</button>
            <Button variante="primario" className={pregunta?.peligro ? 'boton-peligro-primario' : undefined} onClick={() => responder(true)}>{pregunta?.accion}</Button>
          </div>
        }
      >
        <div className={pregunta?.peligro ? 'confirmar-mensaje confirmar-peligro' : 'confirmar-mensaje'}>
          <Icon icono={pregunta?.peligro ? TriangleAlert : CircleHelp} />
          <p id="confirmar-descripcion">{pregunta?.mensaje}</p>
        </div>
      </Dialog>
    </Contexto.Provider>
  );
}
export function useConfirmar() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useConfirmar debe usarse dentro de ConfirmarProvider');
  return c;
}
