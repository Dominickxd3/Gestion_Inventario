import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 0: usuarios de la plataforma y auditoría.
 * Se ejecuta con el usuario `scangp_migraciones` (dueño del esquema itam).
 * La auditoría queda inmutable para la API: `scangp_app` no puede modificar ni borrar registros.
 */
export class Identidad1764240000000 implements MigrationInterface {
  name = 'Identidad1764240000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE [itam].[usuario] (
        [id] uniqueidentifier NOT NULL,
        [nombre_usuario] nvarchar(64) NOT NULL,
        [nombre] nvarchar(128) NOT NULL,
        [correo] nvarchar(256) NULL,
        [rol] varchar(16) NOT NULL,
        [hash_password] varchar(256) NOT NULL,
        [activo] bit NOT NULL CONSTRAINT [DF_usuario_activo] DEFAULT 1,
        [debe_cambiar_password] bit NOT NULL CONSTRAINT [DF_usuario_debe_cambiar_password] DEFAULT 1,
        [credenciales_cambiadas_en] datetime2(3) NOT NULL,
        [intentos_fallidos] int NOT NULL CONSTRAINT [DF_usuario_intentos_fallidos] DEFAULT 0,
        [bloqueado_hasta] datetime2(3) NULL,
        [ultimo_acceso] datetime2(3) NULL,
        [creado_en] datetime2(3) NOT NULL CONSTRAINT [DF_usuario_creado_en] DEFAULT getdate(),
        [creado_por] uniqueidentifier NULL,
        [actualizado_en] datetime2(3) NOT NULL CONSTRAINT [DF_usuario_actualizado_en] DEFAULT getdate(),
        [version] int NOT NULL,
        CONSTRAINT [PK_usuario] PRIMARY KEY ([id]),
        CONSTRAINT [CK_usuario_rol] CHECK ([rol] IN ('ADMIN', 'TECNICO', 'CONSULTA'))
      )`);
    await q.query(`CREATE UNIQUE INDEX [UQ_usuario_nombre_usuario] ON [itam].[usuario] ([nombre_usuario])`);

    await q.query(`
      CREATE TABLE [itam].[auditoria] (
        [id] uniqueidentifier NOT NULL,
        [fecha] datetime2(3) NOT NULL,
        [usuario_id] uniqueidentifier NULL,
        [usuario_nombre] nvarchar(64) NULL,
        [ip] varchar(45) NULL,
        [accion] varchar(64) NOT NULL,
        [entidad] varchar(64) NULL,
        [entidad_id] nvarchar(64) NULL,
        [resultado] varchar(16) NOT NULL,
        [antes] nvarchar(MAX) NULL,
        [despues] nvarchar(MAX) NULL,
        [detalle] nvarchar(1000) NULL,
        CONSTRAINT [PK_auditoria] PRIMARY KEY ([id]),
        CONSTRAINT [CK_auditoria_resultado] CHECK ([resultado] IN ('OK', 'ERROR', 'DENEGADO')),
        CONSTRAINT [CK_auditoria_antes_json] CHECK ([antes] IS NULL OR ISJSON([antes]) = 1),
        CONSTRAINT [CK_auditoria_despues_json] CHECK ([despues] IS NULL OR ISJSON([despues]) = 1)
      )`);
    await q.query(`CREATE INDEX [IX_auditoria_fecha] ON [itam].[auditoria] ([fecha])`);
    await q.query(`CREATE INDEX [IX_auditoria_entidad] ON [itam].[auditoria] ([entidad], [entidad_id])`);
    await q.query(`CREATE INDEX [IX_auditoria_usuario] ON [itam].[auditoria] ([usuario_id], [fecha])`);

    // Trazabilidad: la API puede insertar auditoría pero nunca modificarla ni borrarla;
    // los usuarios se desactivan, no se borran; el historial de migraciones solo lo toca este usuario.
    await q.query(`DENY UPDATE, DELETE ON [itam].[auditoria] TO [scangp_app]`);
    await q.query(`DENY DELETE ON [itam].[usuario] TO [scangp_app]`);
    await q.query(`DENY INSERT, UPDATE, DELETE ON [itam].[migraciones] TO [scangp_app]`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`REVOKE INSERT, UPDATE, DELETE ON [itam].[migraciones] TO [scangp_app]`);
    await q.query(`DROP TABLE [itam].[auditoria]`);
    await q.query(`DROP TABLE [itam].[usuario]`);
  }
}
