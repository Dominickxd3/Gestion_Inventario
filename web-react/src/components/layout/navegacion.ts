/** Destino seguro cuando la pestaña no tiene una pantalla anterior de la aplicación. */
export function destinoAnterior(pathname: string): string {
  const partes = pathname.split('/').filter(Boolean);
  const modulo = partes[0];
  if (modulo === 'equipos' && partes.length > 2) return '/equipos/' + partes[1];
  if (['equipos', 'activos', 'componentes', 'personas', 'mantenimiento'].includes(modulo) && partes.length > 1) return '/' + modulo;
  return '/';
}
