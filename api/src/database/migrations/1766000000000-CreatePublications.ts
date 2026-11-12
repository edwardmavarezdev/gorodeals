import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea las tablas de la seccion editorial `/publications`.
 *
 * - `publications`: articulos con metadatos, cuerpo en markdown y una
 *   referencia blanda a la saga de la que hablan (`franchise_id` con
 *   `ON DELETE SET NULL`).
 * - `publication_games`: union entre publicacion y juegos, con PK
 *   compuesta y ambas FK en `ON DELETE CASCADE`.
 *
 * Es reversible: el `down` borra la tabla de union y despues la de
 * publicaciones.
 */
export class CreatePublications1766000000000 implements MigrationInterface {
  name = 'CreatePublications1766000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "publications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug" text NOT NULL,
        "title" text NOT NULL,
        "subtitle" text NULL,
        "excerpt" text NOT NULL,
        "body" text NOT NULL,
        "category" text NOT NULL,
        "cover_url" text NULL,
        "author_name" text NOT NULL,
        "reading_minutes" integer NOT NULL,
        "franchise_id" uuid NULL,
        "is_published" boolean NOT NULL DEFAULT true,
        "published_at" timestamptz NOT NULL DEFAULT now(),
        "seo_title" text NULL,
        "seo_description" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_publications" PRIMARY KEY ("id"),
        CONSTRAINT "uq_publications_slug" UNIQUE ("slug"),
        CONSTRAINT "chk_publications_slug" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
        CONSTRAINT "chk_publications_category" CHECK ("category" IN ('guia', 'ruta', 'analisis', 'noticia')),
        CONSTRAINT "chk_publications_reading_minutes" CHECK ("reading_minutes" > 0),
        CONSTRAINT "fk_publications_franchise" FOREIGN KEY ("franchise_id")
          REFERENCES "franchises" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_publications_franchise_id" ON "publications" ("franchise_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_publications_is_published" ON "publications" ("is_published")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_publications_category" ON "publications" ("category")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_publications_published_at" ON "publications" ("published_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "publication_games" (
        "publication_id" uuid NOT NULL,
        "game_id" uuid NOT NULL,
        CONSTRAINT "pk_publication_games" PRIMARY KEY ("publication_id", "game_id"),
        CONSTRAINT "fk_publication_games_publication" FOREIGN KEY ("publication_id")
          REFERENCES "publications" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_publication_games_game" FOREIGN KEY ("game_id")
          REFERENCES "games" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_publication_games_game_id" ON "publication_games" ("game_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "publication_games"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "publications"`);
  }
}
