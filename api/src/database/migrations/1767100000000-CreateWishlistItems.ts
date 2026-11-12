import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabla `wishlist_items` de la lista de deseos (Fase 4.4).
 *
 * - UNIQUE (`user_id`, `game_id`): un juego no se repite en la lista de un
 *   mismo usuario.
 * - Ambas FK en `ON DELETE CASCADE`: al borrar el usuario se borra su lista y
 *   al borrar el juego se borra de las listas.
 *
 * Es reversible: el `down` borra la tabla.
 */
export class CreateWishlistItems1767100000000 implements MigrationInterface {
  name = 'CreateWishlistItems1767100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "wishlist_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "game_id" uuid NOT NULL,
        "store" text NULL,
        "store_item_id" text NULL,
        "note" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_wishlist_items" PRIMARY KEY ("id"),
        CONSTRAINT "uq_wishlist_items_user_game" UNIQUE ("user_id", "game_id"),
        CONSTRAINT "fk_wishlist_items_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_wishlist_items_game" FOREIGN KEY ("game_id")
          REFERENCES "games" ("id") ON DELETE CASCADE,
        CONSTRAINT "chk_wishlist_items_store" CHECK ("store" IS NULL OR "store" IN ('steam', 'gog', 'nintendo'))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_wishlist_items_user_id" ON "wishlist_items" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_wishlist_items_game_id" ON "wishlist_items" ("game_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wishlist_items"`);
  }
}
