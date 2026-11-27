import { MigrationInterface, QueryRunner } from "typeorm";

export class DispositivoUltimoInventario1795789869948 implements MigrationInterface {
    name = 'DispositivoUltimoInventario1795789869948'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dispositivo_detectado" ADD "ultimo_inventario" nvarchar(MAX)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dispositivo_detectado" DROP COLUMN "ultimo_inventario"`);
    }

}
