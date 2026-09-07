import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPagesPublishedIndex1796626800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Partial, not a plain btree on the whole column — every query that
    // filters on is_published (PageService.getForPublic, listPublished)
    // only ever asks for `= true`; a `false` row (drafts, most pages most
    // of the time) never needs to appear in this index at all, keeping it
    // smaller than a full-column index would be.
    await queryRunner.query(`
      CREATE INDEX "IDX_pages_is_published" ON pages (is_published)
      WHERE is_published = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_pages_is_published"`);
  }
}
