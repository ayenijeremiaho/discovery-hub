import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTestimonialSubmissionsTable1796799600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE testimonial_submissions (
          id          UUID          NOT NULL DEFAULT gen_random_uuid(),
          page_id     UUID          NOT NULL,
          section_id  VARCHAR       NOT NULL,
          quote       TEXT          NOT NULL,
          name        VARCHAR,
          status      VARCHAR       NOT NULL DEFAULT 'PENDING',
          created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
          updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
          CONSTRAINT "PK_testimonial_submissions" PRIMARY KEY (id),
          CONSTRAINT "FK_testimonial_submissions_page_id" FOREIGN KEY (page_id)
              REFERENCES pages (id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_testimonial_submissions_page_id_status"
          ON testimonial_submissions (page_id, status)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_testimonial_submissions_page_id_status"`,
    );
    await queryRunner.query(`DROP TABLE testimonial_submissions`);
  }
}
