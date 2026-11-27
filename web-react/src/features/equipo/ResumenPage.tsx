import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Disclosure, Icon, KeyValueList, Section, StatusBadge } from '../../components/ui';
import { explicarDeteccion, formatoChasis, infoTipo } from '../../lib/tipoEquipo';
import { fechaHora, plural, unir } from '../../lib/formato';
import { peorEstado } from '../../lib/estados';
import { diagnosticar, resumirDiagnostico } from '../diagnostico/rules';
import { recomendar } from '../recomendaciones/rules';
import { evaluarCompatibilidad } from '../compatibilidad/rules';
import { useEquipoActual } from './contexto';
import { resumenAlmacenamiento, resumenGraficos, resumenMemoria, resumenProcesador, resumenSistema } from './resumenComponentes';

export function ResumenPage() {
  const equipo = useEquipoActual();
  const inv = equipo.inventario;
  const eq = inv.equipo;
  const diag = resumirDiagnostico(diagnosticar(inv));
  const recs = recomendar(inv);
  const compat = evaluarCompatibilidad(inv).flatMap((g) => g.comprobaciones);
  const estadoCompat = peorEstado(compat.map((c) => (c.estado === 'desconocido' ? 'ok' : c.estado)));
  const red = inv.red?.find((r) => r.conectado) ?? inv.red?.[0];

  return (
    <>
      <Section titulo="Lo esencial">
        <KeyValueList
          datos={[
            { etiqueta: 'Procesador', valor: resumenProcesador(inv) },
            { etiqueta: 'Memoria (RAM)', valor: resumenMemoria(inv) },
            { etiqueta: 'Almacenamiento', valor: resumenAlmacenamiento(inv) },
            { etiqueta: 'Gráficos', valor: resumenGraficos(inv) },
            { etiqueta: 'Sistema operativo', valor: resumenSistema(inv) },
          ]}
        />
      </Section>

      <Section titulo="Análisis" descripcion="Calculado a partir del último reporte">
        <ul className="lista-enlaces">
          <li>
            <Link to="diagnostico">
              <span>Diagnóstico</span>
              <StatusBadge
                estado={diag.estado}
                texto={unir([`${diag.correctos} correctos`, diag.avisos && plural(diag.avisos, 'advertencia', 'advertencias'), diag.problemas && plural(diag.problemas, 'problema', 'problemas')], ' · ') ?? ''}
              />
              <Icon icono={ChevronRight} />
            </Link>
          </li>
          <li>
            <Link to="recomendaciones">
              <span>Recomendaciones</span>
              <span className="texto-secundario">{recs.length ? plural(recs.length, 'sugerencia', 'sugerencias') : 'Ninguna'}</span>
              <Icon icono={ChevronRight} />
            </Link>
          </li>
          <li>
            <Link to="compatibilidad">
              <span>Compatibilidad</span>
              <StatusBadge estado={estadoCompat} texto={estadoCompat === 'ok' ? 'Sin conflictos detectados' : 'Revisar'} />
              <Icon icono={ChevronRight} />
            </Link>
          </li>
        </ul>
      </Section>

      <Section titulo="Identificación">
        <KeyValueList
          datos={[
            { etiqueta: 'Nombre del equipo', valor: eq.nombreEquipo },
            { etiqueta: 'Usuario', valor: eq.usuario, motivo: 'no-detectado' },
            { etiqueta: 'Tipo', valor: unir([infoTipo(eq.tipo).etiqueta, formatoChasis(inv)?.etiqueta], ' · ') },
            { etiqueta: 'Fabricante', valor: eq.fabricante },
            { etiqueta: 'Modelo', valor: eq.modelo },
            { etiqueta: 'Número de serie', valor: eq.numeroSerie, mono: true },
          ]}
        />
        <Disclosure titulo="Detalles técnicos" resumen="UUID, red, dominio, detección">
          <KeyValueList
            datos={[
              { etiqueta: 'UUID', valor: eq.uuid, mono: true },
              { etiqueta: 'Código de modelo', valor: eq.modeloCodigo, mono: true },
              { etiqueta: 'Etiqueta de activo', valor: eq.etiquetaActivo },
              { etiqueta: 'Dominio o grupo', valor: unir([eq.dominio, eq.enDominio ? '(dominio)' : null]) },
              { etiqueta: 'Dirección IP', valor: red?.ips?.filter((i) => i.includes('.')).join(', '), mono: true },
              { etiqueta: 'Dirección MAC', valor: red?.mac, mono: true },
              { etiqueta: 'Tipo detectado por', valor: explicarDeteccion(eq.tipoDeteccion) },
              { etiqueta: 'Instalación de Windows', valor: fechaHora(inv.sistemaOperativo?.fechaInstalacion) },
              { etiqueta: 'Versión de ScanGP', valor: inv.agenteVersion, mono: true },
              { etiqueta: 'Primer registro', valor: fechaHora(equipo.primerRegistro) },
            ]}
          />
        </Disclosure>
      </Section>
    </>
  );
}
