import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { SundaySchoolAttendanceStatus } from '../enums/sunday-school-attendance-status.enum';

export class AttendanceEntryDto {
  @IsUUID('4')
  memberId: string;

  @IsEnum(SundaySchoolAttendanceStatus)
  status: SundaySchoolAttendanceStatus;
}

export class BulkMarkAttendanceDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  attendances: AttendanceEntryDto[];
}
