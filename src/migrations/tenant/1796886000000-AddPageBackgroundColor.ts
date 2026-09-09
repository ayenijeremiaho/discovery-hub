import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPageBackgroundColor1796886000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pages
        ADD background_color character varying,
        ADD draft_background_color character varying
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pages
        DROP COLUMN background_color,
        DROP COLUMN draft_background_color
    `);
  }
}
