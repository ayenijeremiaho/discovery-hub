import { MigrationInterface, QueryRunner } from 'typeorm';

// Control-plane — `public`, never a `search_path` target.
// PlatformAdminRole.permissions is a plain text[] snapshotted at row-creation
// time (DefaultPlatformAdminSeed only creates the Platform Super Admin row
// once, never re-syncs it against the enum on subsequent boots) — adding
// TENANTS_DELETE to PlatformAdminPermission does nothing for an
// already-seeded role without this. Idempotent: only appends if missing.
export class GrantSuperAdminTenantsDeletePermission1794168000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE platform_admin_roles
       SET permissions = array_append(permissions, 'tenants:delete')
       WHERE name = 'Platform Super Admin'
         AND NOT ('tenants:delete' = ANY(permissions))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE platform_admin_roles
       SET permissions = array_remove(permissions, 'tenants:delete')
       WHERE name = 'Platform Super Admin'`,
    );
  }
}
