import { MigrationInterface, QueryRunner } from 'typeorm';

// Control-plane — `public`, never a `search_path` target. activated_at
// marks the moment onboardingStatus first reached ACTIVE (see Tenant
// entity's own comment for why this isn't just created_at);
// founder_welcome_email_sent_at is FounderWelcomeEmailScheduler's
// once-only guard.
export class AddTenantActivatedAtAndFounderWelcomeEmail1794340800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE tenants
         ADD activated_at timestamptz,
         ADD founder_welcome_email_sent_at timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE tenants
         DROP COLUMN activated_at,
         DROP COLUMN founder_welcome_email_sent_at`,
    );
  }
}
