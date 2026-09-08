import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPageThemeFields1796713200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pages
        ADD theme character varying NOT NULL DEFAULT 'minimal',
        ADD accent_color character varying,
        ADD draft_theme character varying NOT NULL DEFAULT 'minimal',
        ADD draft_accent_color character varying
    `);
    await queryRunner.query(`
      UPDATE pages SET draft_theme = theme, draft_accent_color = accent_color
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pages
        DROP COLUMN theme,
        DROP COLUMN accent_color,
        DROP COLUMN draft_theme,
        DROP COLUMN draft_accent_color
    `);
  }
}
