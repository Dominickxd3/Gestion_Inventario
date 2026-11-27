import { useMemo, useState } from 'react';
import { ScanSearch, Search } from 'lucide-react';
import { useEquipos } from '../../hooks/EquiposContext';
import { Button, EmptyState, ErrorState, Icon, LoadingState, PageHeader } from '../../components/ui';
import { ORDEN_TIPOS, TIPOS } from '../../lib/tipoEquipo';
import { plural } from '../../lib/formato';
import type { Estado } from '../../lib/estados';
import { useDiagnosticos } from '../diagnostico/useDiagnosticos';
import { EquiposTable } from './EquiposTable';

const CAMPOS_BUSQUEDA = ['nombreEquipo', 'usuario', 'numeroSerie', 'procesador', 'modelo', 'fabricante', 'ip', 'mac'] as const;

export function EquiposPage() {
  const { equipos, cargando, error, recargar } = useEquipos();
  const { diagnosticoDe } = useDiagnosticos(equipos);
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState<'' | Estado>('');

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (equipos ?? []).filter((e) => {
      if (tipo && e.resumen.tipo !== tipo) return false;
      if (estado && diagnosticoDe(e.id)?.estado !== estado) return false;
      return !q || CAMPOS_BUSQUEDA.some((c) => String(e.resumen[c] ?? '').toLowerCase().includes(q));
    });
  }, [equipos, busqueda, tipo, estado, diagnosticoDe]);

  const accion = (
    <Button variante="primario" icono={ScanSearch} a="/detectar">
      Detectar equipo
    </Button>
  );

  return (
    <>
      <PageHeader titulo="Equipos" subtitulo="Todos los equipos registrados con ScanGP" acciones={accion} />

      {!equipos ? (
        cargando ? (
          <LoadingState filas={8} />
        ) : (
          <ErrorState mensaje={error?.message ?? 'Error desconocido'} onReintentar={recargar} />
        )
      ) : equipos.length === 0 ? (
        <EmptyState icono={ScanSearch} titulo="Aún no hay equipos registrados" descripcion="Usa el asistente para registrar el primero." accion={accion} />
      ) : (
        <>
          <div className="filtros" role="search">
            <label className="campo campo-busqueda">
              <Icon icono={Search} />
              <span className="visualmente-oculto">Buscar</span>
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, usuario, serie, procesador…"
              />
            </label>
            <label className="campo">
              <span className="visualmente-oculto">Tipo de equipo</span>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="">Todos los tipos</option>
                {ORDEN_TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {TIPOS[t].etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              <span className="visualmente-oculto">Estado</span>
              <select value={estado} onChange={(e) => setEstado(e.target.value as '' | Estado)}>
                <option value="">Todos los estados</option>
                <option value="ok">Correcto</option>
                <option value="aviso">Advertencia</option>
                <option value="problema">Problema</option>
              </select>
            </label>
            <span className="filtros-total" aria-live="polite">
              {plural(filtrados.length, 'equipo', 'equipos')}
            </span>
          </div>
          <EquiposTable equipos={filtrados} diagnosticoDe={diagnosticoDe} />
        </>
      )}
    </>
  );
}
