import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';
import { Toast, type ToastMessage } from 'primereact/toast';

type Avisar = (mensaje: ToastMessage) => void;
const Contexto = createContext<Avisar | null>(null);

/** Vive fuera de los formularios para que el aviso siga visible tras guardar. */
export function AvisosProvider({ children }: { children: ReactNode }) {
  const toast = useRef<Toast>(null);
  const avisar = useCallback<Avisar>((mensaje) => { toast.current?.show(mensaje); }, []);
  return (
    <Contexto.Provider value={avisar}>
      {children}
      <Toast ref={toast} position="top-center" baseZIndex={1500} className="avisos-gestion" />
    </Contexto.Provider>
  );
}

export function useAvisos() {
  const avisar = useContext(Contexto);
  if (!avisar) throw new Error('useAvisos debe usarse dentro de AvisosProvider');
  return avisar;
}
