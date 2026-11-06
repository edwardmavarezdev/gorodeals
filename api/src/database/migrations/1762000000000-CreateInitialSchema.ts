import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 2 - Modelo de datos universal.
 * Crea las tablas de catalogo (games), ofertas (store_products), historico
 * (price_history) y sagas (franchises, franchise_play_order).
 *
 * Convenciones aplicadas:
 * - Claves primarias uuid con gen_random_uuid() (nativo en PostgreSQL 13+).
 * - Dinero en numeric(10,2) y porcentajes en numeric(5,2) con CHECK de rango.
 * - Toda FK declara onDelete explicito e indice.
 * - Todos los timestamps son timestamptz en UTC.
 */
export class CreateInitialSchema1762000000000 implements MigrationInterface {
  name = 'CreateInitialSchema1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "games" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "igdb_id" bigint NOT NULL,
        "title" text NOT NULL,
        "slug" text NOT NULL,
        "summary" text,
        "description" text,
        "cover_url" text,
        "screenshots" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "genres" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "platforms" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "release_date" date,
        "metacritic_score" smallint,
        "quality_score" numeric(3,1) NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_games" PRIMARY KEY ("id"),
        CONSTRAINT "uq_games_igdb_id" UNIQUE ("igdb_id"),
        CONSTRAINT "uq_games_slug" UNIQUE ("slug"),
        CONSTRAINT "chk_games_quality_score" CHECK ("quality_score" >= 0 AND "quality_score" <= 10),
        CONSTRAINT "chk_games_metacritic_score" CHECK ("metacritic_score" IS NULL OR ("metacritic_score" >= 0 AND "metacritic_score" <= 100)),
        CONSTRAINT "chk_games_genres" CHECK (jsonb_typeof("genres") = 'array'),
        CONSTRAINT "chk_games_platforms" CHECK (jsonb_typeof("platforms") = 'array'),
        CONSTRAINT "chk_games_screenshots" CHECK (jsonb_typeof("screenshots") = 'array')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_games_title" ON "games" ("title")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_games_quality_score" ON "games" ("quality_score")`,
    );

    await queryRunner.query(`
      CREATE TABLE "store_products" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "game_id" uuid NOT NULL,
        "store_name" text NOT NULL,
        "store_product_id" text NOT NULL,
        "current_price" numeric(10,2) NOT NULL DEFAULT 0,
        "regular_price" numeric(10,2) NOT NULL DEFAULT 0,
        "discount_percent" numeric(5,2) NOT NULL DEFAULT 0,
        "currency" text NOT NULL DEFAULT 'USD',
        "url" text,
        "is_available" boolean NOT NULL DEFAULT true,
        "last_checked_at" timestamptz NOT NULL DEFAULT now(),
        "historical_low_price" numeric(10,2),
        "deal_score" numeric(3,1),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_store_products" PRIMARY KEY ("id"),
        CONSTRAINT "uq_store_products_game_store_product" UNIQUE ("game_id", "store_name", "store_product_id"),
        CONSTRAINT "uq_store_products_store_product" UNIQUE ("store_name", "store_product_id"),
        CONSTRAINT "fk_store_products_game" FOREIGN KEY ("game_id") REFERENCES "games" ("id") ON DELETE CASCADE,
        CONSTRAINT "chk_store_products_store_name" CHECK ("store_name" IN ('steam', 'gog', 'nintendo')),
        CONSTRAINT "chk_store_products_current_price" CHECK ("current_price" >= 0),
        CONSTRAINT "chk_store_products_regular_price" CHECK ("regular_price" >= 0),
        CONSTRAINT "chk_store_products_discount_percent" CHECK ("discount_percent" >= 0 AND "discount_percent" <= 100),
        CONSTRAINT "chk_store_products_historical_low_price" CHECK ("historical_low_price" IS NULL OR "historical_low_price" >= 0),
        CONSTRAINT "chk_store_products_deal_score" CHECK ("deal_score" IS NULL OR ("deal_score" >= 0 AND "deal_score" <= 10)),
        CONSTRAINT "chk_store_products_currency" CHECK ("currency" ~ '^[A-Z]{3}$')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_store_products_game_id" ON "store_products" ("game_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_store_products_deal_score" ON "store_products" ("deal_score")`,
    );

    await queryRunner.query(`
      CREATE TABLE "price_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "store_product_id" uuid NOT NULL,
        "price" numeric(10,2) NOT NULL,
        "regular_price" numeric(10,2),
        "discount_percent" numeric(5,2),
        "source" text NOT NULL DEFAULT 'sync',
        "recorded_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_price_history" PRIMARY KEY ("id"),
        CONSTRAINT "uq_price_history_store_product_recorded_at" UNIQUE ("store_product_id", "recorded_at"),
        CONSTRAINT "fk_price_history_store_product" FOREIGN KEY ("store_product_id") REFERENCES "store_products" ("id") ON DELETE CASCADE,
        CONSTRAINT "chk_price_history_price" CHECK ("price" >= 0),
        CONSTRAINT "chk_price_history_regular_price" CHECK ("regular_price" IS NULL OR "regular_price" >= 0),
        CONSTRAINT "chk_price_history_discount_percent" CHECK ("discount_percent" IS NULL OR ("discount_percent" >= 0 AND "discount_percent" <= 100)),
        CONSTRAINT "chk_price_history_source" CHECK ("source" IN ('sync', 'manual', 'seed', 'import'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_price_history_store_product_id" ON "price_history" ("store_product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_price_history_store_product_recorded_at_desc" ON "price_history" ("store_product_id", "recorded_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE "franchises" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "description" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_franchises" PRIMARY KEY ("id"),
        CONSTRAINT "uq_franchises_slug" UNIQUE ("slug"),
        CONSTRAINT "chk_franchises_slug" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "franchise_play_order" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "franchise_id" uuid NOT NULL,
        "game_id" uuid NOT NULL,
        "position" integer NOT NULL,
        "note" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_franchise_play_order" PRIMARY KEY ("id"),
        CONSTRAINT "uq_franchise_play_order_franchise_position" UNIQUE ("franchise_id", "position"),
        CONSTRAINT "uq_franchise_play_order_franchise_game" UNIQUE ("franchise_id", "game_id"),
        CONSTRAINT "fk_franchise_play_order_franchise" FOREIGN KEY ("franchise_id") REFERENCES "franchises" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_franchise_play_order_game" FOREIGN KEY ("game_id") REFERENCES "games" ("id") ON DELETE CASCADE,
        CONSTRAINT "chk_franchise_play_order_position" CHECK ("position" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_franchise_play_order_franchise_id" ON "franchise_play_order" ("franchise_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_franchise_play_order_game_id" ON "franchise_play_order" ("game_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "franchise_play_order"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "franchises"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "price_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "store_products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "games"`);
  }
}
