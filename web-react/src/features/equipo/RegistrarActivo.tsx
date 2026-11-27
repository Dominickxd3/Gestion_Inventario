import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, PackagePlus } from 'lucide-react';
import { Button } from '../../components/ui';
import { PanelFormulario, type Campo } from '../../components/forms/PanelFormulario';
import { usePolling } from '../../hooks/usePolling';
import { useSesion } from '../../hooks/SesionContext';
import { api } from '../../services/gestion.service';
import { ESTADOS_TECNICOS, opcionesDe, type ActivoDetalle, type SugerenciaActivo } from '../../types/gestion';
import { useOpcionesTipoActivo, useOpcionesUbicacion } from '../gestion/comun';
import type { EquipoDetalle } from '../../types/api';

/** Botón de la ficha del equipo detectado: ver el activo vinculado o registrarlo como activo. */
export function AccionActivoDetectado({ equipo }: { equipo: EquipoDetalle }) {
  const { puede } = useSesion();
  const [abierto, setAbierto] = useState(false);
  if (equipo.activo) {
    return <Button icono={Boxes} a={`/activos/${equipo.activo.id}`}>Activo {equipo.activo.codigoPatrimonial}</Button>;
  }
  if (!puede('ADMIN', 'TECNICO')) return null;
  return (
    <>
      <Button variante="primario" icono={PackagePlus} onClick={() => setAbierto(true)}>Registrar como activo</Button>
      {abierto && <PanelRegistrar dispositivoId={equipo.id} onCerrar={() => setAbierto(false)} />}
    </>
  );
}

function PanelRegistrar({ dispositivoId, onCerrar }: { dispositivoId: string; onCerrar: () => void }) {
  const sug = usePolling((s) => api.detectados.sugerencia(dispositivoId, s), 600_000, dispositivoId);
  const tipos = useOpcionesTipoActivo();
  const ubicaciones = useOpcionesUbicacion();
  const navegar = useNavigate();
  const s: SugerenciaActivo | undefined = sug.data;
  if (!s) return null;

  const campos: Campo[] = [
    { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
    { nombre: 'tipoActivoId', etiqueta: 'Tipo', tipo: 'select', opciones: tipos, requerido: true },
    { nombre: 'marcaNombre', etiqueta: 'Marca' },
    { nombre: 'modeloNombre', etiqueta: 'Modelo' },
    { nombre: 'numeroSerie', etiqueta: 'Número de serie' },
    { nombre: 'codigoPatrimonial', etiqueta: 'Código patrimonial', ayuda: s.etiquetaActivoBios ? `Tomado de la etiqueta de activo de la BIOS.` : 'Vacío = se genera. Si el equipo ya tiene etiqueta física, escríbela aquí.' },
    { nombre: 'ubicacionId', etiqueta: 'Ubicación', tipo: 'select', opciones: ubicaciones, vacio: 'Sin ubicación' },
    { nombre: 'estadoTecnico', etiqueta: 'Estado técnico', tipo: 'select', opciones: opcionesDe(ESTADOS_TECNICOS), requerido: true },
    ...s.componentes.map((c, i) => ({
      nombre: `comp_${i}`,
      tipo: 'casilla' as const,
      etiqueta: `Registrar ${c.tipo === 'DISCO' ? 'disco' : c.tipo === 'RAM' ? 'memoria' : 'monitor'} ${[c.modelo, c.capacidad].filter(Boolean).join(' ')} · serie ${c.numeroSerie}`,
    })),
  ];
  const inicial = {
    nombre: s.nombre, tipoActivoId: s.tipoActivoId, marcaNombre: s.marcaNombre ?? '', modeloNombre: s.modeloNombre ?? '',
    numeroSerie: s.numeroSerie ?? '', codigoPatrimonial: s.etiquetaActivoBios ?? '', estadoTecnico: 'OPERATIVO',
    ...Object.fromEntries(s.componentes.map((c, i) => [`comp_${i}`, c.tipo !== 'MONITOR'])),
  };

  return (
    <PanelFormulario
      titulo="Registrar como activo"
      descripcion={
        <>
          <p>Datos tomados de ScanGP. Revísalos antes de registrar: desde aquí el activo queda bajo control de TI y los cambios que detecte ScanGP se mostrarán como discrepancias.</p>
          {s.integrados.length > 0 && <p className="texto-terciario">Integrados (no se rastrean): {s.integrados.map((x) => x.descripcion).join('; ')}.</p>}
        </>
      }
      textoEnviar="Registrar activo"
      campos={campos}
      inicial={inicial}
      onEnviar={(d) => {
        const componentes = s.componentes.filter((_, i) => d[`comp_${i}`]);
        const datos = Object.fromEntries(Object.entries(d).filter(([k]) => !k.startsWith('comp_')));
        return api.detectados.alta({ ...datos, dispositivoId, especificaciones: s.especificaciones, componentes });
      }}
      onHecho={(r) => navegar(`/activos/${(r as ActivoDetalle).id}`)}
      onCerrar={onCerrar}
    />
  );
}
