import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseEntity } from '../../utility/entity/base.entity';
import { Page } from './page.entity';
import { TestimonialSubmissionStatus } from '../enum/page.enum';

// A visitor-submitted testimony on a public Page's TESTIMONIALS section
// (only reachable when that section's content.acceptSubmissions is true —
// see PageService.getForPublic/getForPreview for how APPROVED rows get
// merged into that section's content.items before being served). sectionId
// is the section's client-generated jsonb id, not a real FK — sections
// aren't DB rows, they live inside Page.sections/draftSections.
@Entity({ name: 'testimonial_submissions' })
@Index(['page', 'status'])
export class TestimonialSubmission extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Page, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'page_id' })
  page: Page;

  @Column({ name: 'section_id' })
  sectionId: string;

  @Column({ type: 'text' })
  quote: string;

  @Column({ nullable: true })
  name: string | null;

  @Column({ default: TestimonialSubmissionStatus.PENDING })
  status: TestimonialSubmissionStatus;
}
