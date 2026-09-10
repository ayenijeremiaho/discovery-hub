import { MigrationInterface, QueryRunner } from 'typeorm';

// Same shape as AddChurchCalendarToProPlans — plans.features is a plain
// text[] snapshotted at seed time, so adding PlanFeature.DEPARTMENT_GOALS
// to the enum does nothing for already-seeded plan rows without this.
// Covers every Pro variant so the feature isn't inconsistently available
// depending on which Pro plan a tenant happens to be subscribed to.
// Idempotent: only appends where missing.
export class AddDepartmentGoalsToProPlans1794081600000 implements MigrationInterface {
  private readonly planIds = ['pro', 'pro-annual', 'pro-usd', 'pro-usd-annual'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const planId of this.planIds) {
      await queryRunner.query(
        `
        UPDATE plans
        SET features = array_append(features, 'department_goals')
        WHERE id = $1
          AND NOT ('department_goals' = ANY(features))
        `,
        [planId],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const planId of this.planIds) {
      await queryRunner.query(
        `
        UPDATE plans
        SET features = array_remove(features, 'department_goals')
        WHERE id = $1
        `,
        [planId],
      );
    }
  }
}
