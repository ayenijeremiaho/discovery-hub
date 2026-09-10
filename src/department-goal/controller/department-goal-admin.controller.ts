import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../admin/guard/admin.guard';
import { RequiresPermission } from '../../admin/decorator/requires-permission.decorator';
import { AdminPermission } from '../../admin/enum/admin-permission.enum';
import { CurrentAdmin } from '../../admin/decorator/current-admin.decorator';
import { Admin } from '../../admin/entity/admin.entity';
import { RequiresModule } from '../../church-settings/decorator/requires-module.decorator';
import { ModuleEnabledGuard } from '../../church-settings/guard/module-enabled.guard';
import { DepartmentGoalService } from '../service/department-goal.service';
import {
  CreateGoalCycleDto,
  SubmitRatingDto,
  UpdateGoalCycleDto,
  UpdateGoalDto,
} from '../dto/department-goal.dto';

// ModuleEnabledGuard alone, deliberately not stacked with PlanGuard — the
// latter never consults Tenant.moduleOverrides, so a platform-admin comp
// override for a non-Pro tenant would still 403. This module has no
// numeric usage cap to justify PlanGuard's extra check; plan membership is
// already resolved by ModuleEnabledGuard itself.
@RequiresModule('department_goals')
@UseGuards(AdminGuard, ModuleEnabledGuard)
@Controller('department-goals')
export class DepartmentGoalAdminController {
  constructor(private readonly goalService: DepartmentGoalService) {}

  @RequiresPermission(AdminPermission.DEPARTMENT_GOALS_WRITE)
  @Post('cycles')
  createCycle(@Body() dto: CreateGoalCycleDto, @CurrentAdmin() admin: Admin) {
    return this.goalService.createCycle(dto, admin);
  }

  @RequiresPermission(AdminPermission.DEPARTMENT_GOALS_READ)
  @Get('cycles')
  getAllCycles() {
    return this.goalService.getAllCycles();
  }

  @RequiresPermission(AdminPermission.DEPARTMENT_GOALS_WRITE)
  @Patch('cycles/:id')
  updateCycle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoalCycleDto,
    @CurrentAdmin() admin: Admin,
  ) {
    return this.goalService.updateCycle(id, dto, admin);
  }

  @RequiresPermission(AdminPermission.DEPARTMENT_GOALS_READ)
  @Get('cycles/:id/goals')
  getGoalsForCycle(@Param('id', ParseUUIDPipe) id: string) {
    return this.goalService.getGoalsForCycle(id);
  }

  @RequiresPermission(AdminPermission.DEPARTMENT_GOALS_WRITE)
  @Patch('cycles/:id/goals/:goalId')
  correctGoal(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Body() dto: UpdateGoalDto,
    @CurrentAdmin() admin: Admin,
  ) {
    return this.goalService.correctGoal(id, goalId, dto, admin);
  }

  @RequiresPermission(AdminPermission.DEPARTMENT_GOALS_WRITE)
  @Post('cycles/:id/goals/:goalId/church-rating')
  submitChurchRating(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Body() dto: SubmitRatingDto,
    @CurrentAdmin() admin: Admin,
  ) {
    return this.goalService.submitChurchRating(id, goalId, dto, admin);
  }

  @RequiresPermission(AdminPermission.DEPARTMENT_GOALS_READ)
  @Get('cycles/:id/report')
  getReport(@Param('id', ParseUUIDPipe) id: string) {
    return this.goalService.getReport(id);
  }
}
