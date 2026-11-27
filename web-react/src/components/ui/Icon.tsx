import type { LucideIcon, LucideProps } from 'lucide-react';

interface Props extends Omit<LucideProps, 'ref'> {
  icono: LucideIcon;
  tamano?: 16 | 20 | 24;
  etiqueta?: string;
}

/** Icono Lucide con tamaño y grosor uniformes. Decorativo salvo que se pase `etiqueta`. */
export function Icon({ icono: Componente, tamano = 16, etiqueta, ...resto }: Props) {
  return (
    <Componente
      size={tamano}
      strokeWidth={1.75}
      aria-hidden={etiqueta ? undefined : true}
      aria-label={etiqueta}
      role={etiqueta ? 'img' : undefined}
      focusable={false}
      {...resto}
    />
  );
}
