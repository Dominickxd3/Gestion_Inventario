import { useEffect, useState, type ReactNode } from 'react';
import { RefreshCw, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Icon } from './Icon';
import { Button } from './Button';

/** Esqueleto con la forma del contenido. Aparece tras 150 ms para evitar parpadeos. */
export function LoadingState({ filas = 4, etiqueta = 'Cargando' }: { filas?: number; etiqueta?: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 150);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="esqueleto" role="status" aria-live="polite">
      <span className="visualmente-oculto">{etiqueta}…</span>
      {visible &&
        Array.from({ length: filas }, (_, i) => (
          <div key={i} className="esqueleto-fila" style={{ width: `${92 - ((i * 17) % 35)}%` }} />
        ))}
    </div>
  );
}

interface ErrorProps {
  titulo?: string;
  mensaje: ReactNode;
  onReintentar?: () => void;
}

export function ErrorState({ titulo = 'No se pudo cargar la información', mensaje, onReintentar }: ErrorProps) {
  return (
    <div className="estado-bloque estado-bloque-error" role="alert">
      <Icon icono={TriangleAlert} tamano={20} />
      <div>
        <p className="estado-bloque-titulo">{titulo}</p>
        <p className="estado-bloque-texto">{mensaje}</p>
      </div>
      {onReintentar && (
        <Button icono={RefreshCw} onClick={onReintentar}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

interface VacioProps {
  icono?: LucideIcon;
  titulo: string;
  descripcion?: ReactNode;
  accion?: ReactNode;
}

export function EmptyState({ icono, titulo, descripcion, accion }: VacioProps) {
  return (
    <div className="estado-vacio">
      {icono && <Icon icono={icono} tamano={24} />}
      <p className="estado-vacio-titulo">{titulo}</p>
      {descripcion && <p className="estado-vacio-texto">{descripcion}</p>}
      {accion && <div className="estado-vacio-accion">{accion}</div>}
    </div>
  );
}
