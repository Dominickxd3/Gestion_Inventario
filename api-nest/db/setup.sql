/*
  Preparación inicial de la base de datos de ScanGP en SQL Server (2019 o posterior).
  Se ejecuta UNA vez por servidor con una cuenta sysadmin. Es idempotente: no borra nada.

  sqlcmd -S .\SQLEXPRESS -E -C -i db\setup.sql ^
         -v DB_NAME="ScanGP" MIGRATIONS_PASSWORD="..." APP_PASSWORD="..."

  Requiere el modo de autenticación mixto (SQL Server y Windows).
  - scangp_migraciones: dueño del esquema; solo lo usa `npm run db:migrate`.
  - scangp_app: usuario con el que corre la API. Lectura/escritura en el esquema itam;
    las migraciones le niegan UPDATE/DELETE sobre las tablas de historia y auditoría.
*/
SET NOCOUNT ON;

IF DB_ID(N'$(DB_NAME)') IS NULL
BEGIN
  PRINT N'Creando base $(DB_NAME)';
  EXEC (N'CREATE DATABASE [$(DB_NAME)] COLLATE Modern_Spanish_CI_AI');
END
GO

IF SUSER_ID(N'scangp_migraciones') IS NULL
  CREATE LOGIN [scangp_migraciones] WITH PASSWORD = N'$(MIGRATIONS_PASSWORD)', DEFAULT_DATABASE = [$(DB_NAME)], CHECK_POLICY = ON;
ELSE
  ALTER LOGIN [scangp_migraciones] WITH PASSWORD = N'$(MIGRATIONS_PASSWORD)';

IF SUSER_ID(N'scangp_app') IS NULL
  CREATE LOGIN [scangp_app] WITH PASSWORD = N'$(APP_PASSWORD)', DEFAULT_DATABASE = [$(DB_NAME)], CHECK_POLICY = ON;
ELSE
  ALTER LOGIN [scangp_app] WITH PASSWORD = N'$(APP_PASSWORD)';
GO

USE [$(DB_NAME)];
GO

IF USER_ID(N'scangp_migraciones') IS NULL CREATE USER [scangp_migraciones] FOR LOGIN [scangp_migraciones];
IF USER_ID(N'scangp_app') IS NULL CREATE USER [scangp_app] FOR LOGIN [scangp_app];
GO

IF SCHEMA_ID(N'itam') IS NULL EXEC (N'CREATE SCHEMA [itam] AUTHORIZATION [scangp_migraciones]');
GO

-- Migraciones: crear y modificar objetos solo dentro de la base.
ALTER ROLE [db_ddladmin] ADD MEMBER [scangp_migraciones];
ALTER ROLE [db_datareader] ADD MEMBER [scangp_migraciones];
ALTER ROLE [db_datawriter] ADD MEMBER [scangp_migraciones];
GRANT REFERENCES TO [scangp_migraciones];
GRANT ALTER ANY SCHEMA TO [scangp_migraciones];
-- Como dueño del esquema itam, scangp_migraciones puede aplicar DENY sobre sus tablas a scangp_app.

-- Aplicación: solo datos del esquema itam.
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::[itam] TO [scangp_app];
ALTER USER [scangp_app] WITH DEFAULT_SCHEMA = [itam];
ALTER USER [scangp_migraciones] WITH DEFAULT_SCHEMA = [itam];
GO

PRINT N'Base $(DB_NAME) lista.';
