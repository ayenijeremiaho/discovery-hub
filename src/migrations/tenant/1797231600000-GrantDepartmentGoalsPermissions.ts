import { MigrationInterface, QueryRunner } from 'typeorm';

// Same class of fix as GrantPagesPermissions/GrantChurchCalendarPermissions
// — new AdminPermission enum values are only auto-granted to a SuperAdmin
// role at the moment it's *created* (Object.values(AdminPermission), a
// one-time snapshot), so every tenant provisioned before this module
// existed needs department_goals:read/department_goals:write backfilled
// explicitly. Done in the same migration wave as the table creation this
// time (not a later, separate fix), to avoid the bug hit with Pages where
// the permission grant was forgotten until after ship.
export class GrantDepartmentGoalsPermissions1797231600000 implements MigrationInterface {
  private readonly permissions = [
    'department_goals:read',
    'department_goals:write',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const permission of this.permissions) {
      await queryRunner.query(
        `
        UPDATE admin_roles
        SET permissions = array_append(permissions, $1)
        WHERE name = 'SuperAdmin'
          AND NOT ($1 = ANY(permissions))
        `,
        [permission],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const permission of this.permissions) {
      await queryRunner.query(
        `
        UPDATE admin_roles
        SET permissions = array_remove(permissions, $1)
        WHERE name = 'SuperAdmin'
        `,
        [permission],
      );
    }
  }
}
