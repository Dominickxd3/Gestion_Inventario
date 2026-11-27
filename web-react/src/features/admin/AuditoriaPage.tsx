import { useState } from 'react';
import { Eye } from 'lucide-react';
import { KeyValueList, PageHeader, ModalFlotante, StatusBadge } from '../../components/ui';
import { TablaCrud } from '../../components/crud/TablaCrud';
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

/** Registro inmutable de operaciones (solo ADMIN). Solo lectura. */
export function AuditoriaPage() {
  const [pagina, setPagina] = useState(1);
  const [accion, setAccion] = useState('');
  const [detalle, setDetalle] = useState<RegistroAuditoria | null>(null);

  const consulta = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) });
  if (accion.trim()) consulta.set('accion', accion.trim());
  const datos = usePolling((s) => getJson<Pagina<RegistroAuditoria>>(`/auditoria?${consulta}`, s), 30_000, consulta.toString());

  return (
    <>
      <PageHeader titulo="Auditoría" subtitulo="Quién hizo qué y cuándo. Los registros no se pueden modificar ni borrar." />
      <TablaCrud<RegistroAuditoria>
        titulo="Registros de auditoría"
        filas={datos.data?.items}
        error={datos.error}
        onReintentar={datos.recargar}
        busqueda={{ valor: accion, onCambio: (v) => { setAccion(v); setPagina(1); }, placeholder: 'Acción: auth.login, usuarios, POST…' }}
        servidor={{ total: datos.data?.total ?? 0, pagina, porPagina: POR_PAGINA, onPagina: setPagina }}
        acciones={[{ etiqueta: 'Ver detalle', icono: Eye, onClick: setDetalle }]}
        onFila={setDetalle}
        vacio={accion ? 'Ningún registro coincide con el filtro.' : 'Aún no hay registros.'}
        columnas={[
          { encabezado: 'Fecha', ancho: '168px', valor: (r) => fechaHora(r.fecha) },
          { encabezado: 'Usuario', valor: (r) => r.usuarioNombre },
          { encabezado: 'Acción', mono: true, valor: (r) => r.accion },
          { encabezado: 'Entidad', valor: (r) => [r.entidad, r.entidadId?.slice(0, 8)].filter(Boolean).join(' · '), secundaria: true },
          { encabezado: 'Resultado', valor: (r) => <StatusBadge estado={RESULTADO[r.resultado].estado} texto={RESULTADO[r.resultado].texto} /> },
          { encabezado: 'IP', mono: true, valor: (r) => r.ip, secundaria: true },
        ]}
      />
      {detalle && (
        <ModalFlotante titulo="Detalle del registro" onCerrar={() => setDetalle(null)}>
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
        </ModalFlotante>
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
