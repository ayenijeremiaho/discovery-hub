import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GameStatusEnum } from '../enum/game-status.enum';

export class CreateGameDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  churchClassId?: string;
}

export class UpdateGameDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  churchClassId?: string;
}

export class GameQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(GameStatusEnum)
  status?: GameStatusEnum;
}

export class CreateGameQuestionDto {
  @IsString()
  @IsNotEmpty()
  questionText: string;

  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  options: string[];

  @IsInt()
  @Min(0)
  correctOptionIndex: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(10000)
  points?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(300)
  timeLimitSeconds?: number;
}

export class UpdateGameQuestionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  questionText?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  correctOptionIndex?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(10000)
  points?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(300)
  timeLimitSeconds?: number;
}

export class SubmitAnswerDto {
  @IsInt()
  @Min(0)
  selectedOptionIndex: number;
}

export class ReorderQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  questionIds: string[];
}
