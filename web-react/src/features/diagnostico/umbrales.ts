/** Umbrales centralizados de diagnóstico y recomendaciones. */
export const UMBRALES = {
  /** % libre por debajo del cual un volumen genera advertencia / problema. */
  espacioLibreAviso: 10,
  espacioLibreProblema: 5,
  /** % de capacidad original de la batería. */
  bateriaAviso: 70,
  bateriaProblema: 50,
  /** Días sin reiniciar. */
  diasEncendidoAviso: 14,
  /** Memoria mínima recomendada para Windows 10/11 de uso general. */
  memoriaMinimaGB: 8,
  /** Antigüedad del firmware a partir de la cual se sugiere revisar actualizaciones. */
  aniosBiosRevisar: 4,
  /** Días sin reportar para considerar un equipo desactualizado en el inventario. */
  diasSinReportar: 7,
} as const;
