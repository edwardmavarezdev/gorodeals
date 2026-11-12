import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea las tablas de identidad de la Fase 4.
 *
 * - `users`: cuentas de GoRoDeals. `email` es NOT NULL UNIQUE con CHECK de
 *   formato y de normalizacion (minusculas). `password_hash` es NULL para
 *   cuentas que solo usan login social.
 * - `social_accounts`: vinculo con Steam (OpenID) y Google (OAuth 2.0).
 *   UNIQUE (`provider`, `provider_account_id`).
 * - `refresh_tokens`: sesiones. Solo se persiste el SHA-256 del token opaco,
 *   nunca el token en claro.
 *
 * Es reversible: el `down` borra las tablas en orden inverso.
 */
export class CreateUsersAndAuth1767000000000 implements MigrationInterface {
  name = 'CreateUsersAndAuth1767000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" text NOT NULL,
        "password_hash" text NULL,
        "display_name" text NOT NULL,
        "role" text NOT NULL DEFAULT 'user',
        "email_verified_at" timestamptz NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_email" UNIQUE ("email"),
        CONSTRAINT "chk_users_email_format" CHECK ("email" ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'),
        CONSTRAINT "chk_users_email_lowercase" CHECK ("email" = lower("email")),
        CONSTRAINT "chk_users_role" CHECK ("role" IN ('user', 'admin'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "social_accounts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "provider" text NOT NULL,
        "provider_account_id" text NOT NULL,
        "nickname" text NULL,
        "avatar_url" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_social_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "uq_social_accounts_provider_account" UNIQUE ("provider", "provider_account_id"),
        CONSTRAINT "fk_social_accounts_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "chk_social_accounts_provider" CHECK ("provider" IN ('steam', 'google'))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_social_accounts_user_id" ON "social_accounts" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "token_hash" text NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz NULL,
        "user_agent" text NULL,
        "ip" inet NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "uq_refresh_tokens_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_expires_at" ON "refresh_tokens" ("expires_at")`,
    );
    /**
     * Indice parcial de las sesiones vivas: es el unico estado que se
     * consulta en cada peticion de refresh y de logout.
     */
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_active" ON "refresh_tokens" ("user_id") WHERE "revoked_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "social_accounts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
