import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Member } from '../../member/entity/member.entity';
import { SundaySchoolClass } from './sunday-school-class.entity';
import { BaseEntity } from '../../utility/entity/base.entity';

@Entity('sunday_school_questions')
export class SundaySchoolQuestion extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => SundaySchoolClass, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sunday_school_class_id' })
  sundaySchoolClass: SundaySchoolClass;

  @Index()
  @ManyToOne(() => Member, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asked_by_id' })
  askedBy: Member;

  @Column({ type: 'text', name: 'question_text' })
  questionText: string;

  @Column({ type: 'text', name: 'answer_text', nullable: true })
  answerText: string | null;

  @ManyToOne(() => Member, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'answered_by_id' })
  answeredBy: Member | null;

  @Column({ type: 'timestamptz', name: 'answered_at', nullable: true })
  answeredAt: Date | null;
}
