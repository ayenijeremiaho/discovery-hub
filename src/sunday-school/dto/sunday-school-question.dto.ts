import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AskQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  questionText: string;
}

export class AnswerQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  answerText: string;
}
