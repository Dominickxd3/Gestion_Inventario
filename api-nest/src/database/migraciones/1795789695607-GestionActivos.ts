import { MigrationInterface, QueryRunner } from "typeorm";
import { TIPOS_ACTIVO_BASE, TIPOS_COMPONENTE_BASE } from "../../catalogo/catalogo.entities";
import { uuid7 } from "../../common/uuid7";

/** Tablas de historia: la API solo puede insertar en ellas. */
const SOLO_INSERCION = ["movimiento", "escaneo", "cambio_detectado", "movimiento_almacen"];
/** Tablas con estado: se actualizan, pero no se borran. */
const SIN_BORRADO = [
    "activo", "componente", "instalacion", "asignacion", "orden_mantenimiento", "discrepancia", "dispositivo_detectado",
    "persona", "garantia", "documento", "tipo_activo", "tipo_componente", "marca", "modelo", "sede", "area", "ubicacion",
    "articulo", "organizacion_config",
];
const SECUENCIAS = ["seq_activo", "seq_componente", "seq_orden"];

/**
 * Fases 1 a 6: descubrimiento persistente, catálogo, organización, activos, componentes, asignaciones,
 * mantenimiento, almacén, garantías y documentos. Generada por TypeORM a partir de las entidades
 * y completada con secuencias, datos base y permisos.
 */

export class GestionActivos1795789695607 implements MigrationInterface {
    name = 'GestionActivos1795789695607'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tipo_activo" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_e65e3f71f20569c134181540fe9" DEFAULT getdate(), "creado_por" uniqueidentifier, "codigo" varchar(32) NOT NULL, "nombre" nvarchar(64) NOT NULL, "detectable" bit NOT NULL CONSTRAINT "DF_39aecf355e57920601395031f58" DEFAULT 0, "activo" bit NOT NULL CONSTRAINT "DF_97b66df92bb57ba57ce35bf1787" DEFAULT 1, CONSTRAINT "PK_5e057d9fb167dea03e7f3da3dfe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_tipo_activo_codigo" ON "tipo_activo" ("codigo") `);
        await queryRunner.query(`CREATE TABLE "tipo_componente" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_51b47efef9d605bf07846b214b8" DEFAULT getdate(), "creado_por" uniqueidentifier, "codigo" varchar(32) NOT NULL, "nombre" nvarchar(64) NOT NULL, "activo" bit NOT NULL CONSTRAINT "DF_0d07a46b6fdc6babf9b2d1fc645" DEFAULT 1, CONSTRAINT "PK_0d2798ba754fb6a30c7dbde64dd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_tipo_componente_codigo" ON "tipo_componente" ("codigo") `);
        await queryRunner.query(`CREATE TABLE "marca" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_dd69984b963187d5a7348807bdf" DEFAULT getdate(), "creado_por" uniqueidentifier, "actualizado_en" datetime2(3) NOT NULL CONSTRAINT "DF_3223a2353d1c556fa6a9f1ff379" DEFAULT getdate(), "version" int NOT NULL, "nombre" nvarchar(80) NOT NULL, "activo" bit NOT NULL CONSTRAINT "DF_cb4379abc3d023804ec582c7623" DEFAULT 1, CONSTRAINT "PK_d41856ffd597050edc69ea5188d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_marca_nombre" ON "marca" ("nombre") `);
        await queryRunner.query(`CREATE TABLE "modelo" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_b76342039be6e612d9507721c0e" DEFAULT getdate(), "creado_por" uniqueidentifier, "actualizado_en" datetime2(3) NOT NULL CONSTRAINT "DF_4f13c17a06442074f0fc42bd718" DEFAULT getdate(), "version" int NOT NULL, "marca_id" uniqueidentifier NOT NULL, "tipo_activo_id" uniqueidentifier NOT NULL, "nombre" nvarchar(120) NOT NULL, "especificaciones" nvarchar(MAX), "activo" bit NOT NULL CONSTRAINT "DF_fb6d4487434ea0c5702fac7a1e9" DEFAULT 1, CONSTRAINT "PK_4d5d3a7d7efe7e5f03944aa15d5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_modelo_marca_nombre" ON "modelo" ("marca_id", "nombre") `);
        await queryRunner.query(`CREATE TABLE "sede" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_f1b5bdbacfd9d396254ac030e05" DEFAULT getdate(), "creado_por" uniqueidentifier, "actualizado_en" datetime2(3) NOT NULL CONSTRAINT "DF_7c4477baa934c16e22e96765089" DEFAULT getdate(), "version" int NOT NULL, "nombre" nvarchar(120) NOT NULL, "direccion" nvarchar(250), "prefijo_red" varchar(45), "activo" bit NOT NULL CONSTRAINT "DF_ead13bc489d2976445a00d8137a" DEFAULT 1, CONSTRAINT "PK_7d4d2fa286af7315120c92eb3e0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_sede_nombre" ON "sede" ("nombre") `);
        await queryRunner.query(`CREATE TABLE "area" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_6e46fa72ca97848ad642539c85f" DEFAULT getdate(), "creado_por" uniqueidentifier, "actualizado_en" datetime2(3) NOT NULL CONSTRAINT "DF_3ee865afbb1691acc0d917d0cd9" DEFAULT getdate(), "version" int NOT NULL, "nombre" nvarchar(120) NOT NULL, "activo" bit NOT NULL CONSTRAINT "DF_b48a89cae737bdb8b916e04bae8" DEFAULT 1, CONSTRAINT "PK_39d5e4de490139d6535d75f42ff" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_area_nombre" ON "area" ("nombre") `);
        await queryRunner.query(`CREATE TABLE "ubicacion" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_ede7fcc3ca58097aac27c68474e" DEFAULT getdate(), "creado_por" uniqueidentifier, "actualizado_en" datetime2(3) NOT NULL CONSTRAINT "DF_835f5ab381050f3136fd2e5bc08" DEFAULT getdate(), "version" int NOT NULL, "nombre" nvarchar(120) NOT NULL, "tipo" nvarchar(32) CONSTRAINT CHK_03a10d6dc40392ce66e96041ac_ENUM CHECK(tipo IN ('PUESTO','ALMACEN','TALLER','PROVEEDOR','OTRO')) NOT NULL, "sede_id" uniqueidentifier NOT NULL, "area_id" uniqueidentifier, "activo" bit NOT NULL CONSTRAINT "DF_8ebe05917238f0e3c1697449fcf" DEFAULT 1, CONSTRAINT "PK_6ed79468fe4f565d8be642742a3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_ubicacion_sede_nombre" ON "ubicacion" ("sede_id", "nombre") `);
        await queryRunner.query(`CREATE TABLE "persona" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_34328ab64b4b71c880661faa6d1" DEFAULT getdate(), "creado_por" uniqueidentifier, "actualizado_en" datetime2(3) NOT NULL CONSTRAINT "DF_ff569390fd6e19ea9ec19446609" DEFAULT getdate(), "version" int NOT NULL, "nombre" nvarchar(160) NOT NULL, "documento" nvarchar(32), "correo" nvarchar(256), "cargo" nvarchar(120), "area_id" uniqueidentifier, "usuario_windows" nvarchar(128), "activo" bit NOT NULL CONSTRAINT "DF_656a404cbf2e6566e36b1dd8dab" DEFAULT 1, CONSTRAINT "PK_13aefc75f60510f2be4cd243d71" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_persona_documento" ON "persona" ("documento") WHERE [documento] IS NOT NULL`);
        await queryRunner.query(`CREATE TABLE "organizacion_config" ("id" int NOT NULL, "nombre" nvarchar(160) NOT NULL, "prefijo_activo" varchar(12) NOT NULL, "prefijo_componente" varchar(12) NOT NULL, "prefijo_orden" varchar(12) NOT NULL, "digitos_codigo" int NOT NULL, "dias_sin_reporte" int NOT NULL, "dias_aviso_garantia" int NOT NULL, CONSTRAINT "PK_08de82c1628045dc68486d448b0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "activo" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_7809714caaabbf256b642e9118e" DEFAULT getdate(), "creado_por" uniqueidentifier, "actualizado_en" datetime2(3) NOT NULL CONSTRAINT "DF_2182933d53cdb2c32d5363d3fe4" DEFAULT getdate(), "version" int NOT NULL, "codigo_patrimonial" varchar(32) NOT NULL, "nombre" nvarchar(128) NOT NULL, "tipo_activo_id" uniqueidentifier NOT NULL, "modelo_id" uniqueidentifier, "numero_serie" nvarchar(80), "ubicacion_id" uniqueidentifier, "ciclo_vida" nvarchar(32) CONSTRAINT CHK_c904a424436590e08f777c97e9_ENUM CHECK(ciclo_vida IN ('EN_SERVICIO','FUERA_DE_SERVICIO','DADO_DE_BAJA')) NOT NULL CONSTRAINT "DF_a6715193dedae49d9875b191518" DEFAULT 'EN_SERVICIO', "estado_tecnico" nvarchar(32) CONSTRAINT CHK_e0d839d6882ffd1bbff5d9bb6e_ENUM CHECK(estado_tecnico IN ('SIN_EVALUAR','OPERATIVO','CON_FALLAS','AVERIADO','IRREPARABLE')) NOT NULL CONSTRAINT "DF_576f8baabdc2fc5a980bf8f7bb4" DEFAULT 'SIN_EVALUAR', "fecha_adquisicion" date, "proveedor" nvarchar(160), "numero_factura" nvarchar(64), "costo" decimal(12,2), "especificaciones" nvarchar(MAX), "observaciones" nvarchar(2000), "fecha_baja" datetime2(3), CONSTRAINT "PK_03c863be6303a15dfea29c371a2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_activo_codigo_patrimonial" ON "activo" ("codigo_patrimonial") `);
        await queryRunner.query(`CREATE INDEX "IX_activo_nombre" ON "activo" ("nombre") `);
        await queryRunner.query(`CREATE INDEX "IX_activo_numero_serie" ON "activo" ("numero_serie") `);
        await queryRunner.query(`CREATE INDEX "IX_activo_estado" ON "activo" ("ciclo_vida", "estado_tecnico") `);
        await queryRunner.query(`CREATE TABLE "movimiento" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_4096c8763258f760fd22950fcd2" DEFAULT getdate(), "creado_por" uniqueidentifier, "entidad" nvarchar(32) CONSTRAINT CHK_a3de2b3f1cb40c15efc7f9621a_ENUM CHECK(entidad IN ('ACTIVO','COMPONENTE')) NOT NULL, "entidad_id" uniqueidentifier NOT NULL, "fecha" datetime2(3) NOT NULL, "tipo" varchar(40) NOT NULL, "motivo" varchar(40), "descripcion" nvarchar(500) NOT NULL, "observacion" nvarchar(1000), "detalle" nvarchar(MAX), "referencia_tipo" varchar(32), "referencia_id" uniqueidentifier, "usuario_nombre" nvarchar(64), CONSTRAINT "PK_809988d143ce94a95f3d30164ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IX_movimiento_entidad" ON "movimiento" ("entidad", "entidad_id", "fecha") `);
        await queryRunner.query(`CREATE TABLE "dispositivo_detectado" ("id" varchar(16) NOT NULL, "clave" nvarchar(200) NOT NULL, "nombre_equipo" nvarchar(256) NOT NULL, "resumen" nvarchar(MAX), "primer_registro" datetime2(3) NOT NULL, "ultimo_reporte" datetime2(3) NOT NULL, "total_reportes" int NOT NULL, "ip_origen" varchar(45), "ultimo_escaneo_id" uniqueidentifier, "activo_id" uniqueidentifier, "archivado" bit NOT NULL CONSTRAINT "DF_11db8290a50cae37f87722ef3bf" DEFAULT 0, CONSTRAINT "PK_dispositivo_detectado" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IX_dispositivo_ultimo_reporte" ON "dispositivo_detectado" ("ultimo_reporte") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_dispositivo_activo" ON "dispositivo_detectado" ("activo_id") WHERE [activo_id] IS NOT NULL`);
        await queryRunner.query(`CREATE TABLE "escaneo" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_02b58915a250ae78b66333fc91f" DEFAULT getdate(), "creado_por" uniqueidentifier, "dispositivo_id" varchar(16) NOT NULL, "recibido_en" datetime2(3) NOT NULL, "ip_origen" varchar(45), "agente_version" varchar(32), "datos_hash" char(64) NOT NULL, "datos" nvarchar(MAX) NOT NULL, CONSTRAINT "PK_129e8cf7013953f92414951e95c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IX_escaneo_dispositivo" ON "escaneo" ("dispositivo_id", "recibido_en") `);
        await queryRunner.query(`CREATE TABLE "cambio_detectado" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_46072da48f1edacb6182f84e4c3" DEFAULT getdate(), "creado_por" uniqueidentifier, "dispositivo_id" varchar(16) NOT NULL, "escaneo_id" uniqueidentifier, "fecha" datetime2(3) NOT NULL, "campo" varchar(40) NOT NULL, "anterior" nvarchar(500), "nuevo" nvarchar(500), CONSTRAINT "PK_001e446ac440d10f492a5e33666" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IX_cambio_detectado_dispositivo" ON "cambio_detectado" ("dispositivo_id", "fecha") `);
        await queryRunner.query(`CREATE TABLE "discrepancia" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_f56a138f47c33269eca7a3dde5c" DEFAULT getdate(), "creado_por" uniqueidentifier, "activo_id" uniqueidentifier NOT NULL, "dispositivo_id" varchar(16) NOT NULL, "escaneo_id" uniqueidentifier, "tipo" nvarchar(32) CONSTRAINT CHK_2eb6ba681ec82618a6aaff1eb4_ENUM CHECK(tipo IN ('COMPONENTE_NUEVO','COMPONENTE_MOVIDO','COMPONENTE_AUSENTE','ATRIBUTO_DIFERENTE','USUARIO_DISTINTO')) NOT NULL, "clave" nvarchar(200) NOT NULL, "descripcion" nvarchar(500) NOT NULL, "detalle" nvarchar(MAX), "estado" nvarchar(32) CONSTRAINT CHK_9188a4a525919f7a551c738a0a_ENUM CHECK(estado IN ('PENDIENTE','ACEPTADA','RECHAZADA','RESUELTA_AUTO')) NOT NULL CONSTRAINT "DF_f2b5e64a0f0ca730acb7a12a2ef" DEFAULT 'PENDIENTE', "resuelta_en" datetime2(3), "resuelta_por" nvarchar(64), "resolucion" nvarchar(1000), CONSTRAINT "PK_7deef6df85760b5e231fc9b12ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IX_discrepancia_estado" ON "discrepancia" ("estado", "activo_id") `);
        await queryRunner.query(`CREATE TABLE "componente" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_b831c558a8398dac6f927c91127" DEFAULT getdate(), "creado_por" uniqueidentifier, "actualizado_en" datetime2(3) NOT NULL CONSTRAINT "DF_92961b9823927f3caa1e5b8a379" DEFAULT getdate(), "version" int NOT NULL, "codigo" varchar(32) NOT NULL, "tipo_componente_id" uniqueidentifier NOT NULL, "marca" nvarchar(80), "modelo" nvarchar(160), "numero_serie" nvarchar(120), "huella" nvarchar(160), "capacidad" nvarchar(40), "atributos" nvarchar(MAX), "situacion" nvarchar(32) CONSTRAINT CHK_43fc2785b66885882d11dbafdb_ENUM CHECK(situacion IN ('INSTALADO','EN_ALMACEN','EN_MANTENIMIENTO','DADO_DE_BAJA')) NOT NULL CONSTRAINT "DF_8f1c5585eed7d525b57d0b7ff6e" DEFAULT 'EN_ALMACEN', "estado_tecnico" nvarchar(32) CONSTRAINT CHK_81b9e1cb7673738fa04dcda40f_ENUM CHECK(estado_tecnico IN ('SIN_EVALUAR','OPERATIVO','CON_FALLAS','AVERIADO','IRREPARABLE')) NOT NULL CONSTRAINT "DF_24bd86c89affdf14ff65c41d924" DEFAULT 'OPERATIVO', "ubicacion_id" uniqueidentifier, "observaciones" nvarchar(1000), CONSTRAINT "PK_a11d0193701e517e964d99ceac1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_componente_codigo" ON "componente" ("codigo") `);
        await queryRunner.query(`CREATE INDEX "IX_componente_numero_serie" ON "componente" ("numero_serie") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_componente_huella" ON "componente" ("huella") WHERE [huella] IS NOT NULL`);
        await queryRunner.query(`CREATE TABLE "instalacion" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_5d3523c7637f5cc0f28929a5d04" DEFAULT getdate(), "creado_por" uniqueidentifier, "componente_id" uniqueidentifier NOT NULL, "activo_id" uniqueidentifier NOT NULL, "desde" datetime2(3) NOT NULL, "hasta" datetime2(3), "motivo_instalacion" varchar(40), "motivo_retiro" varchar(40), "orden_mantenimiento_id" uniqueidentifier, "confirmada_en" datetime2(3), CONSTRAINT "PK_e235cc17d35a19af706ff15c5d1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IX_instalacion_activo" ON "instalacion" ("activo_id", "hasta") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_instalacion_vigente" ON "instalacion" ("componente_id") WHERE [hasta] IS NULL`);
        await queryRunner.query(`CREATE TABLE "asignacion" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_1cdf22e4705a0c909171ebf27d0" DEFAULT getdate(), "creado_por" uniqueidentifier, "activo_id" uniqueidentifier NOT NULL, "tipo" nvarchar(32) CONSTRAINT CHK_4a512594c5f393559981b6d711_ENUM CHECK(tipo IN ('PERMANENTE','PRESTAMO','TEMPORAL_REEMPLAZO')) NOT NULL, "persona_id" uniqueidentifier, "area_id" uniqueidentifier, "desde" datetime2(3) NOT NULL, "hasta_previsto" date, "hasta" datetime2(3), "motivo_cierre" varchar(40), "orden_mantenimiento_id" uniqueidentifier, "observaciones" nvarchar(1000), CONSTRAINT "PK_ffb1cb0124bf91ae194ef53cb78" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IX_asignacion_persona" ON "asignacion" ("persona_id", "hasta") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_asignacion_vigente" ON "asignacion" ("activo_id") WHERE [hasta] IS NULL`);
        await queryRunner.query(`CREATE TABLE "orden_mantenimiento" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_2c5eb02ea6797bbea264a71b6d2" DEFAULT getdate(), "creado_por" uniqueidentifier, "actualizado_en" datetime2(3) NOT NULL CONSTRAINT "DF_f80212796d934e80b270c9e8bf8" DEFAULT getdate(), "version" int NOT NULL, "codigo" varchar(32) NOT NULL, "activo_id" uniqueidentifier NOT NULL, "tipo" nvarchar(32) CONSTRAINT CHK_a9c26f53c8ecfeebffcb223331_ENUM CHECK(tipo IN ('PREVENTIVO','CORRECTIVO')) NOT NULL, "motivo" nvarchar(32) CONSTRAINT CHK_ded2337535c5d5b50f09910676_ENUM CHECK(motivo IN ('FALLA_TECNICA','PREVENTIVO','GARANTIA','ACTUALIZACION','DANO_FISICO','REASIGNACION','OTRO')) NOT NULL, "estado" nvarchar(32) CONSTRAINT CHK_eb97c1cff7e9f0623596c48341_ENUM CHECK(estado IN ('ABIERTA','EN_CURSO','EN_ESPERA','CERRADA','CANCELADA')) NOT NULL CONSTRAINT "DF_55ffef9247ec5a05053627134c0" DEFAULT 'ABIERTA', "falla_reportada" nvarchar(2000), "diagnostico" nvarchar(2000), "solucion" nvarchar(2000), "tecnico" nvarchar(128), "proveedor_externo" nvarchar(160), "fecha_apertura" datetime2(3) NOT NULL, "fecha_cierre" datetime2(3), "costo" decimal(12,2), "resultado" nvarchar(32) CONSTRAINT CHK_b71db369eabfc294a026ab2007_ENUM CHECK(resultado IN ('SIN_EVALUAR','OPERATIVO','CON_FALLAS','AVERIADO','IRREPARABLE')), "ubicacion_anterior_id" uniqueidentifier, CONSTRAINT "PK_fa8372cc51b8f7ddd5677f2c471" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_orden_codigo" ON "orden_mantenimiento" ("codigo") `);
        await queryRunner.query(`CREATE INDEX "IX_orden_estado" ON "orden_mantenimiento" ("estado", "fecha_apertura") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_orden_abierta" ON "orden_mantenimiento" ("activo_id") WHERE [estado] IN ('ABIERTA', 'EN_CURSO', 'EN_ESPERA')`);
        await queryRunner.query(`CREATE TABLE "articulo" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_41e948f7eb26b67f567d1f925bd" DEFAULT getdate(), "creado_por" uniqueidentifier, "actualizado_en" datetime2(3) NOT NULL CONSTRAINT "DF_846aed088479c56680d97b9b6b3" DEFAULT getdate(), "version" int NOT NULL, "nombre" nvarchar(160) NOT NULL, "unidad" nvarchar(20) NOT NULL, "stock_minimo" int NOT NULL CONSTRAINT "DF_6778487b0700f522df7e0234994" DEFAULT 0, "activo" bit NOT NULL CONSTRAINT "DF_aac2dcc6bed4081efc5eed3204b" DEFAULT 1, CONSTRAINT "PK_2354d420054cd5a54e75da7bf97" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_articulo_nombre" ON "articulo" ("nombre") `);
        await queryRunner.query(`CREATE TABLE "existencia" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_76de766e709da61f570555d0ab0" DEFAULT getdate(), "creado_por" uniqueidentifier, "actualizado_en" datetime2(3) NOT NULL CONSTRAINT "DF_a09e97cf80244ff610203f5e580" DEFAULT getdate(), "version" int NOT NULL, "articulo_id" uniqueidentifier NOT NULL, "ubicacion_id" uniqueidentifier NOT NULL, "cantidad" int NOT NULL, CONSTRAINT "PK_ba78639392a6eec0e541760e5b5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_existencia" ON "existencia" ("articulo_id", "ubicacion_id") `);
        await queryRunner.query(`CREATE TABLE "movimiento_almacen" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_a089a926c7a4680c3ec93231073" DEFAULT getdate(), "creado_por" uniqueidentifier, "articulo_id" uniqueidentifier NOT NULL, "ubicacion_id" uniqueidentifier NOT NULL, "tipo" nvarchar(32) CONSTRAINT CHK_ea8f1599f89a9e4f35d1b9dfa9_ENUM CHECK(tipo IN ('ENTRADA','SALIDA','AJUSTE')) NOT NULL, "cantidad" int NOT NULL, "saldo" int NOT NULL, "fecha" datetime2(3) NOT NULL, "motivo" nvarchar(500), "orden_mantenimiento_id" uniqueidentifier, "activo_id" uniqueidentifier, "usuario_nombre" nvarchar(64), CONSTRAINT "PK_d1347fde9d4382eb14fbbbd2510" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IX_movimiento_almacen" ON "movimiento_almacen" ("articulo_id", "fecha") `);
        await queryRunner.query(`CREATE TABLE "garantia" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_249a5aefe833be5c228bf78f5ef" DEFAULT getdate(), "creado_por" uniqueidentifier, "actualizado_en" datetime2(3) NOT NULL CONSTRAINT "DF_4bcb695211b80310f868fca3080" DEFAULT getdate(), "version" int NOT NULL, "activo_id" uniqueidentifier, "componente_id" uniqueidentifier, "tipo" nvarchar(32) CONSTRAINT CHK_031533362e156b70e123636c25_ENUM CHECK(tipo IN ('FABRICANTE','EXTENDIDA','SOPORTE','OTRA')) NOT NULL, "proveedor" nvarchar(160) NOT NULL, "numero_contrato" nvarchar(80), "inicio" date NOT NULL, "fin" date NOT NULL, "observaciones" nvarchar(1000), "vigente" bit NOT NULL CONSTRAINT "DF_afd25d514e673389012cabbffdc" DEFAULT 1, CONSTRAINT "CK_garantia_objetivo" CHECK ([activo_id] IS NOT NULL OR [componente_id] IS NOT NULL), CONSTRAINT "PK_2fd6d4b2c39388c76288afb0bf1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IX_garantia_fin" ON "garantia" ("fin") `);
        await queryRunner.query(`CREATE TABLE "documento" ("id" uniqueidentifier NOT NULL, "creado_en" datetime2(3) NOT NULL CONSTRAINT "DF_32f144942a5e429545bfaf81d75" DEFAULT getdate(), "creado_por" uniqueidentifier, "entidad" nvarchar(32) CONSTRAINT CHK_035cbc1cf9afcf9b1c4bb05b0a_ENUM CHECK(entidad IN ('ACTIVO','COMPONENTE','ORDEN','ASIGNACION','GARANTIA','PERSONA')) NOT NULL, "entidad_id" uniqueidentifier NOT NULL, "tipo" nvarchar(32) CONSTRAINT CHK_2d6df04a4c82602e41a941e877_ENUM CHECK(tipo IN ('FACTURA','ACTA_ENTREGA','INFORME_TECNICO','GARANTIA','FOTO','OTRO')) NOT NULL, "nombre_archivo" nvarchar(255) NOT NULL, "tipo_mime" varchar(128) NOT NULL, "tamano_bytes" int NOT NULL, "sha256" char(64) NOT NULL, "descripcion" nvarchar(500), "anulado" bit NOT NULL CONSTRAINT "DF_2f8126b80d6fa1284dc1098412c" DEFAULT 0, CONSTRAINT "PK_14a00534ba5a1136f420342c965" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IX_documento_entidad" ON "documento" ("entidad", "entidad_id") `);
        await queryRunner.query(`ALTER TABLE "modelo" ADD CONSTRAINT "FK_4c37f522af7b6d5fdd22f386a56" FOREIGN KEY ("marca_id") REFERENCES "marca"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "modelo" ADD CONSTRAINT "FK_d2133f705fdd50fe65efa550eb4" FOREIGN KEY ("tipo_activo_id") REFERENCES "tipo_activo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ubicacion" ADD CONSTRAINT "FK_33b57737a90e0703d2f8dd5aa18" FOREIGN KEY ("sede_id") REFERENCES "sede"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ubicacion" ADD CONSTRAINT "FK_1f4c7c20b655648e9069ded29fd" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "persona" ADD CONSTRAINT "FK_9d93684d114601bf008700f99b6" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "activo" ADD CONSTRAINT "FK_f892187ab102272dad6b438652a" FOREIGN KEY ("tipo_activo_id") REFERENCES "tipo_activo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "activo" ADD CONSTRAINT "FK_1efb8b722a5c72530319e388d44" FOREIGN KEY ("modelo_id") REFERENCES "modelo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "activo" ADD CONSTRAINT "FK_5b72883e0b128bad71b1841abfa" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicacion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "componente" ADD CONSTRAINT "FK_ac25fc1c2f297e7429ec2f3c8c0" FOREIGN KEY ("tipo_componente_id") REFERENCES "tipo_componente"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "componente" ADD CONSTRAINT "FK_5112900d40125f19034ba8b7712" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicacion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "instalacion" ADD CONSTRAINT "FK_6b95a99047561c998e2dfc8fe76" FOREIGN KEY ("componente_id") REFERENCES "componente"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "instalacion" ADD CONSTRAINT "FK_80b7a3a6f81cd7f6a48495579c6" FOREIGN KEY ("activo_id") REFERENCES "activo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asignacion" ADD CONSTRAINT "FK_c9ce11573701fa632dcf1440acd" FOREIGN KEY ("activo_id") REFERENCES "activo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asignacion" ADD CONSTRAINT "FK_a61860d081c16bf59bb930c3b1a" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asignacion" ADD CONSTRAINT "FK_747d6e4910567bdc96d3716adc4" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orden_mantenimiento" ADD CONSTRAINT "FK_7acac1945078a539389fdeca181" FOREIGN KEY ("activo_id") REFERENCES "activo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "existencia" ADD CONSTRAINT "FK_de8ef1661ff1068142a8ea2703c" FOREIGN KEY ("articulo_id") REFERENCES "articulo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "existencia" ADD CONSTRAINT "FK_f0197ff8808e2311c3fb0d7eaba" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicacion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        // Correlativos de códigos (TI-000001, C-000001, OT-000001).
        for (const s of SECUENCIAS) await queryRunner.query(`CREATE SEQUENCE [itam].[${s}] AS int START WITH 1 INCREMENT BY 1`);

        // Datos base.
        for (const [codigo, nombre, detectable] of TIPOS_ACTIVO_BASE) {
            await queryRunner.query(
                `INSERT INTO "tipo_activo" ("id", "codigo", "nombre", "detectable", "activo") VALUES (@0, @1, @2, @3, 1)`,
                [uuid7(), codigo, nombre, detectable],
            );
        }
        for (const [codigo, nombre] of TIPOS_COMPONENTE_BASE) {
            await queryRunner.query(`INSERT INTO "tipo_componente" ("id", "codigo", "nombre", "activo") VALUES (@0, @1, @2, 1)`, [
                uuid7(),
                codigo,
                nombre,
            ]);
        }
        await queryRunner.query(
            `INSERT INTO "organizacion_config" ("id", "nombre", "prefijo_activo", "prefijo_componente", "prefijo_orden", "digitos_codigo", "dias_sin_reporte", "dias_aviso_garantia") VALUES (1, N'Mi organización', 'TI-', 'C-', 'OT-', 6, 7, 30)`,
        );

        // Trazabilidad: la historia solo admite inserciones y nada se borra físicamente
        // (las bajas son estados). Solo las existencias de almacén se pueden borrar.
        for (const t of SOLO_INSERCION) await queryRunner.query(`DENY UPDATE, DELETE ON [itam].[${t}] TO [scangp_app]`);
        for (const t of SIN_BORRADO) await queryRunner.query(`DENY DELETE ON [itam].[${t}] TO [scangp_app]`);
        await queryRunner.query(`DENY INSERT ON [itam].[organizacion_config] TO [scangp_app]`);
        // NEXT VALUE FOR requiere UPDATE sobre la secuencia: ya lo concede el GRANT sobre el esquema itam (db/setup.sql).
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const s of SECUENCIAS) await queryRunner.query(`DROP SEQUENCE [itam].[${s}]`);
        await queryRunner.query(`ALTER TABLE "existencia" DROP CONSTRAINT "FK_f0197ff8808e2311c3fb0d7eaba"`);
        await queryRunner.query(`ALTER TABLE "existencia" DROP CONSTRAINT "FK_de8ef1661ff1068142a8ea2703c"`);
        await queryRunner.query(`ALTER TABLE "orden_mantenimiento" DROP CONSTRAINT "FK_7acac1945078a539389fdeca181"`);
        await queryRunner.query(`ALTER TABLE "asignacion" DROP CONSTRAINT "FK_747d6e4910567bdc96d3716adc4"`);
        await queryRunner.query(`ALTER TABLE "asignacion" DROP CONSTRAINT "FK_a61860d081c16bf59bb930c3b1a"`);
        await queryRunner.query(`ALTER TABLE "asignacion" DROP CONSTRAINT "FK_c9ce11573701fa632dcf1440acd"`);
        await queryRunner.query(`ALTER TABLE "instalacion" DROP CONSTRAINT "FK_80b7a3a6f81cd7f6a48495579c6"`);
        await queryRunner.query(`ALTER TABLE "instalacion" DROP CONSTRAINT "FK_6b95a99047561c998e2dfc8fe76"`);
        await queryRunner.query(`ALTER TABLE "componente" DROP CONSTRAINT "FK_5112900d40125f19034ba8b7712"`);
        await queryRunner.query(`ALTER TABLE "componente" DROP CONSTRAINT "FK_ac25fc1c2f297e7429ec2f3c8c0"`);
        await queryRunner.query(`ALTER TABLE "activo" DROP CONSTRAINT "FK_5b72883e0b128bad71b1841abfa"`);
        await queryRunner.query(`ALTER TABLE "activo" DROP CONSTRAINT "FK_1efb8b722a5c72530319e388d44"`);
        await queryRunner.query(`ALTER TABLE "activo" DROP CONSTRAINT "FK_f892187ab102272dad6b438652a"`);
        await queryRunner.query(`ALTER TABLE "persona" DROP CONSTRAINT "FK_9d93684d114601bf008700f99b6"`);
        await queryRunner.query(`ALTER TABLE "ubicacion" DROP CONSTRAINT "FK_1f4c7c20b655648e9069ded29fd"`);
        await queryRunner.query(`ALTER TABLE "ubicacion" DROP CONSTRAINT "FK_33b57737a90e0703d2f8dd5aa18"`);
        await queryRunner.query(`ALTER TABLE "modelo" DROP CONSTRAINT "FK_d2133f705fdd50fe65efa550eb4"`);
        await queryRunner.query(`ALTER TABLE "modelo" DROP CONSTRAINT "FK_4c37f522af7b6d5fdd22f386a56"`);
        await queryRunner.query(`DROP INDEX "IX_documento_entidad" ON "documento"`);
        await queryRunner.query(`DROP TABLE "documento"`);
        await queryRunner.query(`DROP INDEX "IX_garantia_fin" ON "garantia"`);
        await queryRunner.query(`DROP TABLE "garantia"`);
        await queryRunner.query(`DROP INDEX "IX_movimiento_almacen" ON "movimiento_almacen"`);
        await queryRunner.query(`DROP TABLE "movimiento_almacen"`);
        await queryRunner.query(`DROP INDEX "UQ_existencia" ON "existencia"`);
        await queryRunner.query(`DROP TABLE "existencia"`);
        await queryRunner.query(`DROP INDEX "UQ_articulo_nombre" ON "articulo"`);
        await queryRunner.query(`DROP TABLE "articulo"`);
        await queryRunner.query(`DROP INDEX "UQ_orden_abierta" ON "orden_mantenimiento"`);
        await queryRunner.query(`DROP INDEX "IX_orden_estado" ON "orden_mantenimiento"`);
        await queryRunner.query(`DROP INDEX "UQ_orden_codigo" ON "orden_mantenimiento"`);
        await queryRunner.query(`DROP TABLE "orden_mantenimiento"`);
        await queryRunner.query(`DROP INDEX "UQ_asignacion_vigente" ON "asignacion"`);
        await queryRunner.query(`DROP INDEX "IX_asignacion_persona" ON "asignacion"`);
        await queryRunner.query(`DROP TABLE "asignacion"`);
        await queryRunner.query(`DROP INDEX "UQ_instalacion_vigente" ON "instalacion"`);
        await queryRunner.query(`DROP INDEX "IX_instalacion_activo" ON "instalacion"`);
        await queryRunner.query(`DROP TABLE "instalacion"`);
        await queryRunner.query(`DROP INDEX "UQ_componente_huella" ON "componente"`);
        await queryRunner.query(`DROP INDEX "IX_componente_numero_serie" ON "componente"`);
        await queryRunner.query(`DROP INDEX "UQ_componente_codigo" ON "componente"`);
        await queryRunner.query(`DROP TABLE "componente"`);
        await queryRunner.query(`DROP INDEX "IX_discrepancia_estado" ON "discrepancia"`);
        await queryRunner.query(`DROP TABLE "discrepancia"`);
        await queryRunner.query(`DROP INDEX "IX_cambio_detectado_dispositivo" ON "cambio_detectado"`);
        await queryRunner.query(`DROP TABLE "cambio_detectado"`);
        await queryRunner.query(`DROP INDEX "IX_escaneo_dispositivo" ON "escaneo"`);
        await queryRunner.query(`DROP TABLE "escaneo"`);
        await queryRunner.query(`DROP INDEX "UQ_dispositivo_activo" ON "dispositivo_detectado"`);
        await queryRunner.query(`DROP INDEX "IX_dispositivo_ultimo_reporte" ON "dispositivo_detectado"`);
        await queryRunner.query(`DROP TABLE "dispositivo_detectado"`);
        await queryRunner.query(`DROP INDEX "IX_movimiento_entidad" ON "movimiento"`);
        await queryRunner.query(`DROP TABLE "movimiento"`);
        await queryRunner.query(`DROP INDEX "IX_activo_estado" ON "activo"`);
        await queryRunner.query(`DROP INDEX "IX_activo_numero_serie" ON "activo"`);
        await queryRunner.query(`DROP INDEX "IX_activo_nombre" ON "activo"`);
        await queryRunner.query(`DROP INDEX "UQ_activo_codigo_patrimonial" ON "activo"`);
        await queryRunner.query(`DROP TABLE "activo"`);
        await queryRunner.query(`DROP TABLE "organizacion_config"`);
        await queryRunner.query(`DROP INDEX "UQ_persona_documento" ON "persona"`);
        await queryRunner.query(`DROP TABLE "persona"`);
        await queryRunner.query(`DROP INDEX "UQ_ubicacion_sede_nombre" ON "ubicacion"`);
        await queryRunner.query(`DROP TABLE "ubicacion"`);
        await queryRunner.query(`DROP INDEX "UQ_area_nombre" ON "area"`);
        await queryRunner.query(`DROP TABLE "area"`);
        await queryRunner.query(`DROP INDEX "UQ_sede_nombre" ON "sede"`);
        await queryRunner.query(`DROP TABLE "sede"`);
        await queryRunner.query(`DROP INDEX "UQ_modelo_marca_nombre" ON "modelo"`);
        await queryRunner.query(`DROP TABLE "modelo"`);
        await queryRunner.query(`DROP INDEX "UQ_marca_nombre" ON "marca"`);
        await queryRunner.query(`DROP TABLE "marca"`);
        await queryRunner.query(`DROP INDEX "UQ_tipo_componente_codigo" ON "tipo_componente"`);
        await queryRunner.query(`DROP TABLE "tipo_componente"`);
        await queryRunner.query(`DROP INDEX "UQ_tipo_activo_codigo" ON "tipo_activo"`);
        await queryRunner.query(`DROP TABLE "tipo_activo"`);
    }

}
