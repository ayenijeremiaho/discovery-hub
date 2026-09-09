import { MigrationInterface, QueryRunner } from 'typeorm';

// Control-plane — `public`, never a `search_path` target.
// The Pages rollout endpoints used to check TENANTS_READ/WRITE instead of
// their own permission (see PlatformAdminController's own comment) —
// PAGES_READ/WRITE now gate them instead. Without this backfill, any role
// that currently reaches Pages only via TENANTS_READ/WRITE would lose that
// access the moment the guard change deploys. Not scoped to a specific role
// name (role names have changed before — see RenamePlatformSuperAdminRole)
// — applies to every existing role, granting PAGES_READ wherever
// TENANTS_READ is already present, and PAGES_WRITE wherever TENANTS_WRITE
// is. Idempotent: only appends what's missing.
export class SplitPagesRolloutPermission1793995200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE platform_admin_roles
       SET permissions = array_append(permissions, 'pages:read')
       WHERE 'tenants:read' = ANY(permissions)
         AND NOT ('pages:read' = ANY(permissions))`,
    );
    await queryRunner.query(
      `UPDATE platform_admin_roles
       SET permissions = array_append(permissions, 'pages:write')
       WHERE 'tenants:write' = ANY(permissions)
         AND NOT ('pages:write' = ANY(permissions))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE platform_admin_roles
       SET permissions = array_remove(permissions, 'pages:read')`,
    );
    await queryRunner.query(
      `UPDATE platform_admin_roles
       SET permissions = array_remove(permissions, 'pages:write')`,
    );
  }
}
