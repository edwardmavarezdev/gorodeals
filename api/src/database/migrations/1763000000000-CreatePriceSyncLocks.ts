import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 3.3 - Exclusion mutual del sync de precios.
 *
 * Crea `price_sync_locks`, una tabla de una sola fila logica (`id =
 * 'price_sync'`) que permite que varias instancias de la API no ejecuten el
 * sync de precios a la vez. El bloqueo se toma con un upsert atomico que
 * solo renueva el lock si el anterior esta obsoleto, de modo que una
 * instancia que muere abruptamente no bloquea el sync para siempre.
 */
export class CreatePriceSyncLocks1763000000000 implements MigrationInterface {
  name = 'CreatePriceSyncLocks1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "price_sync_locks" (
        "id" text NOT NULL,
        "locked_at" timestamptz NOT NULL DEFAULT now(),
        "locked_by" text NOT NULL,
        CONSTRAINT "pk_price_sync_locks" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "price_sync_locks"`);
  }
}
