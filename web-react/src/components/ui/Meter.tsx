interface Props {
  /** 0 a 100 */
  valor: number;
  etiqueta: string;
  /** A partir de este porcentaje la barra se muestra como alerta. */
  umbralAlerta?: number;
}

/** Medidor lineal accesible (uso de un volumen, salud de batería...). */
export function Meter({ valor, etiqueta, umbralAlerta = 90 }: Props) {
  const v = Math.max(0, Math.min(100, Math.round(valor)));
  return (
    <div
      className={`medidor ${v >= umbralAlerta ? 'medidor-alerta' : ''}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      aria-label={etiqueta}
    >
      <div className="medidor-relleno" style={{ width: `${v}%` }} />
    </div>
  );
}
