import type { ReactNode } from 'react';
import { ModalFlotante } from './ModalFlotante';

interface Props {
  titulo: string;
  abierto: boolean;
  onCerrar: () => void;
  pie?: ReactNode;
  children: ReactNode;
}

/** Compatibilidad para pantallas anteriores: todas las ventanas son flotantes y centradas. */
export function SidePanel({ titulo, abierto, onCerrar, pie, children }: Props) {
  if (!abierto) return null;
  return (
    <ModalFlotante titulo={titulo} onCerrar={onCerrar} pie={pie}>
      {children}
    </ModalFlotante>
  );
}
