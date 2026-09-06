import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkerProfile } from '../../member/entity/worker-profile.entity';
import { WorkerStatusEnum } from '../../member/enums/worker-status.enum';
import { DepartmentCapability } from '../enums/department-capability.enum';

// Collapses what used to be 7 near-identical assertIsXDeptWorker() methods
// scattered across services (attendance, evangelism, sunday-school,
// prayer-request, service-session, children-church, follow-up) into one
// shared check. A member has a capability if either their primary or
// secondary department's capabilities array includes it.
@Injectable()
export class DepartmentAccessService {
  constructor(
    @InjectRepository(WorkerProfile)
    private readonly workerProfileRepo: Repository<WorkerProfile>,
  ) {}

  async hasCapability(
    memberId: string,
    capability: DepartmentCapability,
  ): Promise<boolean> {
    const profile = await this.workerProfileRepo.findOne({
      where: { member: { id: memberId } },
      relations: ['department', 'secondaryDepartment'],
    });
    if (!profile) return false;
    return (
      !!profile.department?.capabilities?.includes(capability) ||
      !!profile.secondaryDepartment?.capabilities?.includes(capability)
    );
  }

  async assertHasCapability(
    memberId: string,
    capability: DepartmentCapability,
    message?: string,
  ): Promise<void> {
    if (await this.hasCapability(memberId, capability)) return;
    throw new ForbiddenException(
      message ??
        `Only workers in a department with the '${capability}' capability can perform this action`,
    );
  }

  // The reverse of hasCapability — "who has capability X" rather than "does
  // this one member have it" — for notification fan-out (e.g. a Sunday
  // School class with no assigned teacher: notify every SS-capability
  // worker instead of nobody). Mirrors the raw capability-join pattern
  // already used inline in FollowUpService.pickRoundRobinAssignee and
  // ServiceSessionService, centralized here so a third call site doesn't
  // repeat it.
  async findMemberIdsWithCapability(
    capability: DepartmentCapability,
  ): Promise<string[]> {
    const rows = await this.workerProfileRepo
      .createQueryBuilder('wp')
      .select('member.id', 'memberId')
      .innerJoin('wp.member', 'member')
      .leftJoin('wp.department', 'd')
      .leftJoin('wp.secondaryDepartment', 'sd')
      .where('(:cap = ANY(d.capabilities) OR :cap = ANY(sd.capabilities))', {
        cap: capability,
      })
      .andWhere('wp.status = :status', { status: WorkerStatusEnum.ACTIVE })
      .getRawMany<{ memberId: string }>();
    return rows.map((r) => r.memberId);
  }
}
