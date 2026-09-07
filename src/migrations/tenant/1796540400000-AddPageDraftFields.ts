import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPageDraftFields1796540400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pages
        ADD draft_title VARCHAR,
        ADD draft_seo_description TEXT,
        ADD draft_og_image_url VARCHAR,
        ADD draft_og_image_public_id VARCHAR,
        ADD draft_sections JSONB NOT NULL DEFAULT '[]',
        ADD preview_token VARCHAR NOT NULL DEFAULT gen_random_uuid()::text
    `);
    await queryRunner.query(`
      UPDATE pages
      SET draft_title = title,
          draft_seo_description = seo_description,
          draft_og_image_url = og_image_url,
          draft_og_image_public_id = og_image_public_id,
          draft_sections = sections
    `);
    await queryRunner.query(`
      ALTER TABLE pages ALTER COLUMN draft_title SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_pages_preview_token" ON pages (preview_token)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_pages_preview_token"`);
    await queryRunner.query(`
      ALTER TABLE pages
        DROP COLUMN draft_title,
        DROP COLUMN draft_seo_description,
        DROP COLUMN draft_og_image_url,
        DROP COLUMN draft_og_image_public_id,
        DROP COLUMN draft_sections,
        DROP COLUMN preview_token
    `);
  }
}
