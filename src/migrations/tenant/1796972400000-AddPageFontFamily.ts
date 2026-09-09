import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPageFontFamily1796972400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pages
        ADD font_family character varying,
        ADD draft_font_family character varying
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pages
        DROP COLUMN font_family,
        DROP COLUMN draft_font_family
    `);
  }
}
