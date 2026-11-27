export type MotivoNoDisponible = 'no-detectado' | 'requiere-admin' | 'no-soportado' | 'no-aplica' | 'sin-registrar';

const TEXTOS: Record<MotivoNoDisponible, { texto: string; explicacion: string }> = {
  'sin-registrar': {
    texto: 'Sin registrar',
    explicacion: 'Dato administrativo que TI todavía no completó. Se edita desde la ficha.',
  },
  'no-detectado': {
    texto: 'No detectado',
    explicacion: 'ScanGP no pudo leer este dato en el equipo o el fabricante no lo informa.',
  },
  'requiere-admin': {
    texto: 'Requiere administrador',
    explicacion: 'Windows solo entrega este dato si ScanGP se ejecuta como administrador.',
  },
  'no-soportado': {
    texto: 'No disponible',
    explicacion: 'La versión actual de ScanGP no recopila este dato.',
  },
  'no-aplica': {
    texto: 'No aplica',
    explicacion: 'Este dato no corresponde a este tipo de equipo.',
  },
};

/** Valor ausente con su motivo. Nunca se reemplaza por un valor de ejemplo. */
export function Unavailable({ motivo = 'no-detectado' }: { motivo?: MotivoNoDisponible }) {
  const t = TEXTOS[motivo];
  return (
    <span className="no-disponible" title={t.explicacion}>
      {t.texto}
      <span className="visualmente-oculto">. {t.explicacion}</span>
    </span>
  );
}
