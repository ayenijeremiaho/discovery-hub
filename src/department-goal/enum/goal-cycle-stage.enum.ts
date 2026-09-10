// Computed, never stored — see DepartmentGoalService.getEffectiveStage, the
// single place this is derived. INACTIVE is deliberately distinct from
// REVIEWED: a church-deactivated cycle blocks ratings too, not just goal
// edits, so a cancelled cycle can't still be rated after the fact.
export enum GoalCycleStage {
  OPENING = 'OPENING',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEWED = 'REVIEWED',
  INACTIVE = 'INACTIVE',
}
