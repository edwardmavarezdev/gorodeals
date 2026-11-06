import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajustes de rendimiento derivados de la revision de la Fase 3.
 *
 * 1. Elimina dos indices redundantes de `price_history`. El UNIQUE
 *    `(store_product_id, recorded_at)` ya cubre tanto la busqueda por
 *    producto como el barrido inverso `ORDER BY recorded_at DESC`
 *    (verificado con EXPLAIN: el indice ASC unico sirve el barrido inverso).
 * 2. Anade `idx_store_products_store_name_id` (store_name, id), que soporta
 *    la paginacion por cursor del sync de precios:
 *    `WHERE store_name = $1 AND id > $2::uuid ORDER BY id LIMIT $3`.
 *    Sin el, la consulta hacia Seq Scan (93 ms por pagina).
 * 3. `fillfactor = 70` en `store_products` para que el UPDATE diario del sync
 *    de precios pueda resolverse con HOT updates (WAL 302 MB -> 133 MB y
 *    300k -> 132k tuplas muertas).
 *
 * Es reversible: el `down` restaura los indices eliminados, elimina el indice
 * nuevo y restablece el fillfactor por defecto.
 */
export class OptimizePriceHistoryIndexes1764000000000 implements MigrationInterface {
  name = 'OptimizePriceHistoryIndexes1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_price_history_store_product_recorded_at_desc"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_price_history_store_product_id"`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_store_products_store_name_id" ON "store_products" ("store_name", "id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "store_products" SET (fillfactor = 70)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "idx_price_history_store_product_id" ON "price_history" ("store_product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_price_history_store_product_recorded_at_desc" ON "price_history" ("store_product_id", "recorded_at" DESC)`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_store_products_store_name_id"`,
    );

    await queryRunner.query(`ALTER TABLE "store_products" RESET (fillfactor)`);
  }
}
