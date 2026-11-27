/**
 * El campo "capacidad" del componente guarda la medida que distingue a cada tipo de pieza:
 * capacidad en discos y RAM, pulgadas en monitores, vatios en cargadores… Aquí se nombra según el tipo.
 */
interface Medida {
  etiqueta: string;
  ejemplo: string;
}

const MEDIDAS: Record<string, Medida> = {
  RAM: { etiqueta: 'Capacidad', ejemplo: '8 GB, 16 GB…' },
  DISCO: { etiqueta: 'Capacidad', ejemplo: '512 GB, 1 TB…' },
  MONITOR: { etiqueta: 'Tamaño de pantalla', ejemplo: '24", 27"…' },
  BATERIA: { etiqueta: 'Capacidad', ejemplo: '54 Wh, 4000 mAh…' },
  CARGADOR: { etiqueta: 'Potencia', ejemplo: '65 W, 90 W…' },
  GPU: { etiqueta: 'Memoria de video', ejemplo: '4 GB, 8 GB…' },
  RED: { etiqueta: 'Velocidad', ejemplo: '1 Gbps, Wi-Fi 6…' },
  TECLADO: { etiqueta: 'Conexión', ejemplo: 'USB, inalámbrico, Bluetooth…' },
  MOUSE: { etiqueta: 'Conexión', ejemplo: 'USB, inalámbrico, Bluetooth…' },
};

export function medidaDe(tipoCodigo: string | undefined): Medida {
  return (tipoCodigo && MEDIDAS[tipoCodigo]) || { etiqueta: 'Característica principal', ejemplo: 'Tamaño, potencia, capacidad…' };
}

/** Ayuda del alta, cuando aún no se sabe el tipo. */
export const AYUDA_MEDIDA = 'Lo que distingue a la pieza: capacidad en discos y RAM (1 TB), pulgadas en monitores (24"), vatios en cargadores (65 W).';

/** "monitor", "disco / almacenamiento"… para usar dentro de una frase. */
export function tipoEnFrase(nombre: string) {
  return nombre.charAt(0).toLowerCase() + nombre.slice(1);
}
