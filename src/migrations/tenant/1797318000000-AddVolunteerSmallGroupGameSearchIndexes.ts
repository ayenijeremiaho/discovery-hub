import { MigrationInterface, QueryRunner } from 'typeorm';

// Matches the trgm-index pattern AddSearchIndexesAndDropRedundant already
// established for members/member_directory_profiles — the new admin-list
// search on these three modules (volunteer.service.ts, small-group.service.ts,
// game.service.ts) is ILIKE '%term%', which a plain btree can't serve.
// volunteer_opportunities.status is already covered by the existing
// IDX_volunteer_opportunities_status_date composite index, so only games and
// small_groups need a new index for their status-type filter.
export class AddVolunteerSmallGroupGameSearchIndexes1797318000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_opportunities_title_trgm" ON volunteer_opportunities USING gin (title gin_trgm_ops);`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_opportunities_description_trgm" ON volunteer_opportunities USING gin (description gin_trgm_ops);`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_small_groups_name_trgm" ON small_groups USING gin (name gin_trgm_ops);`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_small_groups_description_trgm" ON small_groups USING gin (description gin_trgm_ops);`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_small_groups_meeting_format" ON small_groups (meeting_format);`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_games_title_trgm" ON games USING gin (title gin_trgm_ops);`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_games_description_trgm" ON games USING gin (description gin_trgm_ops);`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_games_status" ON games (status);`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_games_status";`);
    await queryRunner.query(`DROP INDEX "IDX_games_description_trgm";`);
    await queryRunner.query(`DROP INDEX "IDX_games_title_trgm";`);

    await queryRunner.query(`DROP INDEX "IDX_small_groups_meeting_format";`);
    await queryRunner.query(`DROP INDEX "IDX_small_groups_description_trgm";`);
    await queryRunner.query(`DROP INDEX "IDX_small_groups_name_trgm";`);

    await queryRunner.query(
      `DROP INDEX "IDX_volunteer_opportunities_description_trgm";`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_volunteer_opportunities_title_trgm";`,
    );
  }
}
