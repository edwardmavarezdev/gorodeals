import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrige la constraint `chk_users_email_format` de la tabla `users`.
 *
 * La migracion `CreateUsersAndAuth` la creo con el escape `\.` dentro de un
 * template literal de TypeScript. En JavaScript `'\.'` es `'.'`, asi que el
 * punto llego a PostgreSQL sin escapar y la expresion regular aceptaba
 * cualquier caracter en lugar de un punto literal.
 *
 * Se sustituye la constraint por la version escapada. Es idempotente: si ya
 * coincide con la definicion correcta, no se vuelve a tocar.
 */
export class FixUsersEmailFormatCheck1768000000000 implements MigrationInterface {
  name = 'FixUsersEmailFormatCheck1768000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP CONSTRAINT IF EXISTS "chk_users_email_format"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD CONSTRAINT "chk_users_email_format"
        CHECK ("email" ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP CONSTRAINT IF EXISTS "chk_users_email_format"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD CONSTRAINT "chk_users_email_format"
        CHECK ("email" ~ '^[^@[:space:]]+@[^@[:space:]]+.[^@[:space:]]+$')
    `);
  }
}
