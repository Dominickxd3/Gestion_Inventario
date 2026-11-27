# Registro automático y trazabilidad de ScanGP

Al recibir POST /api/inventario, la API identifica el dispositivo, guarda su lectura y registra automáticamente su activo y los componentes con serie útil. Está activado por defecto; SCANGP_REGISTRO_AUTOMATICO=false conserva el modo manual.

## Flujo

1. ScanGP se ejecuta en cada máquina y envía el inventario. El alta automática no hace por sí sola un escaneo remoto de la red.
2. La identidad del equipo sigue la prioridad UUID válido, serie válida, MAC o nombre. Los valores conocidos de relleno se ignoran.
3. Se conserva el vínculo existente. Si no existe, se intenta la etiqueta BIOS y después una serie inequívoca de un activo previo. Si no hay coincidencia, se genera un código patrimonial y se completan nombre, tipo, fabricante, modelo y especificaciones detectadas.
4. Se registran discos internos, RAM extraíble y monitores con serie útil. Su identidad es tipo + serie normalizada. Repetir el escaneo reutiliza activo, componente e instalación vigente.
5. RAM soldada, piezas sin serie útil, CPU, gráficos y placa base se describen en la ficha del equipo. No se inventan identidades para rastrearlas entre máquinas.
6. Una instalación creada por el escaneo queda confirmada desde esa lectura. El historial registra alta, instalación y equipo asociado.
7. Si una pieza conocida aparece en otra máquina, el traslado automático requiere que el último escaneo válido de origen ya no la contenga y sea posterior a su instalación allí. Se cierra el período anterior y se abre otro, conservando ambos equipos. Si el destino se escaneó antes que el origen, otro reporte del destino completa el traslado.
8. Si ambos equipos dicen tener la misma pieza, queda una discrepancia. Piezas dadas de baja o en mantenimiento tampoco se reactivan automáticamente. Una ausencia sola no determina almacén, mantenimiento ni baja: requiere revisión.
9. Se guardan cambios de series y características aunque el modelo o la capacidad sean iguales. Cada escaneo cambiado conserva la instantánea completa.

## Dónde analizarlo

- Activos: cada máquina con código patrimonial.
- Ficha del activo > Componentes: piezas actuales; Mostrar retirados incluye las anteriores.
- Ficha del componente: períodos desde/hasta y equipos donde estuvo instalado.
- Equipo detectado > Historial: cambios del hardware y datos detectados.
- Discrepancias: identidad o situación que necesita revisión.

Los campos administrativos que no aporta ScanGP (responsable, ubicación precisa, factura y costo) se completan manualmente. El estado técnico inicial es Sin evaluar: detectar una pieza no certifica su salud.

## Consistencia y pruebas

El escaneo, alta, catálogo, instalación e historial automático se escriben en una transacción. Un bloqueo de aplicación de SQL Server serializa las altas automáticas concurrentes para evitar duplicados de catálogo y piezas. Se mantienen los índices únicos existentes.

Las pruebas unitarias cubren diez máquinas, repetición, reutilización de activos, conflictos, despiece, traslado, almacén, baja/mantenimiento y lecturas fallidas. La suite registro-automatico.e2e-spec.ts comprueba el flujo real y el historial en SQL Server usando únicamente la base separada de pruebas. Requiere las credenciales de migraciones configuradas.

Los equipos detectados antes de este cambio se completan al iniciar la API usando el último inventario guardado; también se completan al recibir otro escaneo. El completado histórico solo registra piezas faltantes: no mueve ni reinstala piezas conocidas basándose en lecturas antiguas. Vincular manualmente un activo también completa sus piezas faltantes. Los datos históricos anteriores sin identidad de componente no permiten reconstruir movimientos que nunca se registraron.
