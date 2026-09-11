import { MigrationInterface, QueryRunner } from 'typeorm';

// Control-plane — `public`, never a `search_path` target. Holds the signup
// details provision() needs (admin name/email, plan, branch-invite linkage)
// for a self-serve signup held AWAITING_APPROVAL — see Tenant entity's own
// comment for why this can't just stay transient in the queue job payload
// the way it does for the non-gated flow.
export class AddTenantPendingSignupParams1794254400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE tenants ADD pending_signup_params jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE tenants DROP COLUMN pending_signup_params`,
    );
  }
}
