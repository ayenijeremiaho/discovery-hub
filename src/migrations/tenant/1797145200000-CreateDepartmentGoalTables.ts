import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDepartmentGoalTables1797145200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE department_goal_cycles (
          id             UUID          NOT NULL DEFAULT gen_random_uuid(),
          name           VARCHAR       NOT NULL,
          start_date     DATE          NOT NULL,
          grace_deadline DATE          NOT NULL,
          end_date       DATE          NOT NULL,
          is_active      BOOLEAN       NOT NULL DEFAULT true,
          created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
          updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
          CONSTRAINT "PK_department_goal_cycles" PRIMARY KEY (id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE department_goals (
          id                        UUID          NOT NULL DEFAULT gen_random_uuid(),
          cycle_id                  UUID          NOT NULL,
          department_id             UUID          NOT NULL,
          title                     VARCHAR       NOT NULL,
          description               TEXT,
          church_rating             SMALLINT,
          church_rating_reason      TEXT,
          church_rated_at           TIMESTAMPTZ,
          church_rated_by_admin_id  UUID,
          self_rating               SMALLINT,
          self_rating_reason        TEXT,
          self_rated_at             TIMESTAMPTZ,
          self_rated_by_member_id   UUID,
          created_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),
          updated_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),
          CONSTRAINT "PK_department_goals" PRIMARY KEY (id),
          CONSTRAINT "FK_department_goals_cycle_id" FOREIGN KEY (cycle_id)
              REFERENCES department_goal_cycles (id) ON DELETE CASCADE,
          CONSTRAINT "FK_department_goals_department_id" FOREIGN KEY (department_id)
              REFERENCES departments (id) ON DELETE RESTRICT,
          CONSTRAINT "FK_department_goals_church_rated_by_admin_id" FOREIGN KEY (church_rated_by_admin_id)
              REFERENCES admins (id) ON DELETE SET NULL,
          CONSTRAINT "FK_department_goals_self_rated_by_member_id" FOREIGN KEY (self_rated_by_member_id)
              REFERENCES members (id) ON DELETE SET NULL
      )
    `);

    // Composite, not a standalone cycle_id index — DepartmentGoalService's
    // hottest read path (getCurrentForMember, called on every load of a
    // member's or HOD's goals page) filters on cycle_id AND department_id
    // together. A composite index with cycle_id leading still fully serves
    // the cycle_id-only queries (getGoalsForCycle, getReport) via the
    // leftmost-prefix rule, so a separate single-column cycle_id index
    // would just be redundant weight on every write.
    await queryRunner.query(`
      CREATE INDEX "IDX_department_goals_cycle_id_department_id" ON department_goals (cycle_id, department_id)
    `);
    // Kept as its own index (not covered by the composite above, since
    // department_id isn't the leading column) — needed so the RESTRICT FK
    // on departments.id doesn't force a full table scan of department_goals
    // every time an admin attempts to delete a department.
    await queryRunner.query(`
      CREATE INDEX "IDX_department_goals_department_id" ON department_goals (department_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_department_goals_department_id"`);
    await queryRunner.query(
      `DROP INDEX "IDX_department_goals_cycle_id_department_id"`,
    );
    await queryRunner.query(`DROP TABLE department_goals`);
    await queryRunner.query(`DROP TABLE department_goal_cycles`);
  }
}
