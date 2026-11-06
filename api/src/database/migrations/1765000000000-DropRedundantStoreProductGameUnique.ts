import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unifica el contrato de unicidad de `store_products`.
 *
 * La tabla declaraba dos restricciones UNIQUE:
 *
 * - `uq_store_products_store_product (store_name, store_product_id)`: la
 *   clave natural de la oferta. Un appid de Steam pertenece a un unico juego
 *   del catalogo.
 * - `uq_store_products_game_store_product (game_id, store_name,
 *   store_product_id)`: redundante, porque la primera ya implica que no hay
 *   dos ofertas con el mismo (tienda, id de producto).
 *
 * La segunda solo se quejaba con su propio error: sincronizar el mismo appid
 * contra otro `game_id` fallaba con un `QueryFailedError` de Postgres que
 * incluia el nombre de la tabla y de la restriccion, y ese texto crudo
 * acababa devuelto al cliente en `items[].message`.
 *
 * Se deja `uq_store_products_store_product` como clave natural y se elimina
 * la redundante. El upsert de Steam usa `ON CONFLICT (store_name,
 * store_product_id)`, que sigue siendo el destino del conflicto.
 *
 * Es reversible: el `down` vuelve a crear la restriccion eliminada.
 */
export class DropRedundantStoreProductGameUnique1765000000000 implements MigrationInterface {
  name = 'DropRedundantStoreProductGameUnique1765000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "store_products" DROP CONSTRAINT IF EXISTS "uq_store_products_game_store_product"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "store_products" ADD CONSTRAINT "uq_store_products_game_store_product" UNIQUE ("game_id", "store_name", "store_product_id")`,
    );
  }
}
