import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPageShowHeader1797058800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pages
        ADD show_header boolean NOT NULL DEFAULT false,
        ADD draft_show_header boolean NOT NULL DEFAULT false,
        ADD header_logo_url character varying,
        ADD draft_header_logo_url character varying,
        ADD header_links jsonb NOT NULL DEFAULT '[]',
        ADD draft_header_links jsonb NOT NULL DEFAULT '[]'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pages
        DROP COLUMN show_header,
        DROP COLUMN draft_show_header,
        DROP COLUMN header_logo_url,
        DROP COLUMN draft_header_logo_url,
        DROP COLUMN header_links,
        DROP COLUMN draft_header_links
    `);
  }
}
