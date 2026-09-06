import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSundaySchoolQuestionsTable1796454000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE sunday_school_questions (
          id                       UUID          NOT NULL DEFAULT gen_random_uuid(),
          sunday_school_class_id   UUID          NOT NULL,
          asked_by_id              UUID          NOT NULL,
          question_text            TEXT          NOT NULL,
          answer_text              TEXT,
          answered_by_id           UUID,
          answered_at              TIMESTAMPTZ,
          created_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
          updated_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
          CONSTRAINT "PK_sunday_school_questions" PRIMARY KEY (id),
          CONSTRAINT "FK_sunday_school_questions_sunday_school_class_id" FOREIGN KEY (sunday_school_class_id) REFERENCES sunday_school_classes(id) ON DELETE CASCADE,
          CONSTRAINT "FK_sunday_school_questions_asked_by_id" FOREIGN KEY (asked_by_id) REFERENCES members(id) ON DELETE CASCADE,
          CONSTRAINT "FK_sunday_school_questions_answered_by_id" FOREIGN KEY (answered_by_id) REFERENCES members(id) ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sunday_school_questions_sunday_school_class_id" ON sunday_school_questions (sunday_school_class_id)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sunday_school_questions_asked_by_id" ON sunday_school_questions (asked_by_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_sunday_school_questions_asked_by_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_sunday_school_questions_sunday_school_class_id"`,
    );
    await queryRunner.query(`DROP TABLE sunday_school_questions`);
  }
}
