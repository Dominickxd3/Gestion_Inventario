import { useState } from 'react';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { Button, ErrorState, KeyValueList, LoadingState, PageHeader, SidePanel, SpecTable, StatusBadge, TextField } from '../../components/ui';
import { usePolling } from '../../hooks/usePolling';
import { getJson } from '../../services/http';
import { fechaHora } from '../../lib/formato';
import type { Pagina, RegistroAuditoria } from '../../types/identidad';

const POR_PAGINA = 50;
const RESULTADO = {
  OK: { estado: 'ok', texto: 'Correcto' },
  ERROR: { estado: 'problema', texto: 'Error' },
  DENEGADO: { estado: 'aviso', texto: 'Denegado' },
} as const;

/** Registro inmutable de operaciones (solo ADMIN). */
export function AuditoriaPage() {
  const [pagina, setPagina] = useState(1);
  const [accion, setAccion] = useState('');
  const [detalle, setDetalle] = useState<RegistroAuditoria | null>(null);

  const consulta = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) });
  if (accion.trim()) consulta.set('accion', accion.trim());
  const datos = usePolling(
    (s) => getJson<Pagina<RegistroAuditoria>>(`/auditoria?${consulta}`, s),
    30_000,
    consulta.toString(),
  );
  const total = datos.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <PageHeader titulo="Auditoría" subtitulo="Quién hizo qué y cuándo. Los registros no se pueden modificar ni borrar." />

      <div className="barra-tabla">
        <div className="barra-tabla-filtro">
          <TextField
            etiqueta="Filtrar por acción"
            placeholder="p. ej. auth.login, usuarios, DELETE"
            value={accion}
            onChange={(e) => {
              setAccion(e.target.value);
              setPagina(1);
            }}
          />
        </div>
        <span className="texto-terciario">{total.toLocaleString('es')} registros</span>
      </div>

      {datos.error && !datos.data ? (
        <ErrorState mensaje={datos.error.message} onReintentar={datos.recargar} />
      ) : !datos.data ? (
        <LoadingState />
      ) : (
        <SpecTable<RegistroAuditoria>
          titulo="Registros de auditoría"
          filas={datos.data.items}
          vacio={accion ? 'Ningún registro coincide con el filtro.' : 'Aún no hay registros.'}
          columnas={[
            { encabezado: 'Fecha', valor: (r) => fechaHora(r.fecha), ancho: '168px' },
            { encabezado: 'Usuario', valor: (r) => r.usuarioNombre },
            { encabezado: 'Acción', valor: (r) => r.accion, mono: true },
            { encabezado: 'Entidad', valor: (r) => [r.entidad, r.entidadId?.slice(0, 8)].filter(Boolean).join(' · ') || '—' },
            { encabezado: 'Resultado', valor: (r) => <StatusBadge estado={RESULTADO[r.resultado].estado} texto={RESULTADO[r.resultado].texto} /> },
            { encabezado: 'IP', valor: (r) => r.ip, mono: true },
            {
              encabezado: '',
              ancho: '48px',
              valor: (r) => <Button variante="fantasma" icono={Eye} aria-label="Ver detalle" onClick={() => setDetalle(r)} />,
            },
          ]}
        />
      )}

      {paginas > 1 && (
        <nav className="paginacion" aria-label="Paginación">
          <Button icono={ChevronLeft} aria-label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} />
          <span className="texto-secundario">
            Página {pagina} de {paginas}
          </span>
          <Button icono={ChevronRight} aria-label="Página siguiente" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)} />
        </nav>
      )}

      {detalle && (
        <SidePanel titulo="Detalle del registro" abierto onCerrar={() => setDetalle(null)}>
          <KeyValueList
            datos={[
              { etiqueta: 'Fecha', valor: fechaHora(detalle.fecha) },
              { etiqueta: 'Usuario', valor: detalle.usuarioNombre },
              { etiqueta: 'IP', valor: detalle.ip, mono: true },
              { etiqueta: 'Acción', valor: detalle.accion, mono: true },
              { etiqueta: 'Entidad', valor: detalle.entidad },
              { etiqueta: 'Id de la entidad', valor: detalle.entidadId, mono: true },
              { etiqueta: 'Resultado', valor: RESULTADO[detalle.resultado].texto },
              { etiqueta: 'Detalle', valor: detalle.detalle },
            ]}
          />
          {detalle.antes != null && <Json titulo="Antes" valor={detalle.antes} />}
          {detalle.despues != null && <Json titulo="Después" valor={detalle.despues} />}
        </SidePanel>
      )}
    </>
  );
}

function Json({ titulo, valor }: { titulo: string; valor: unknown }) {
  return (
    <div className="json-bloque">
      <p className="campo-etiqueta">{titulo}</p>
      <pre>{JSON.stringify(valor, null, 2)}</pre>
    </div>
  );
}
