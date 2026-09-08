import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  PageSectionType,
  TestimonialSubmissionStatus,
} from '../enum/page.enum';

// Not a real schema constraint — DTO-level only, same reasoning
// PageSectionType's own file comment gives for `content` being jsonb: the
// theme toolkit is fixed today (two whole-page looks), not something a
// migration is needed to extend later.
export const PAGE_THEMES = ['minimal', 'bold'] as const;
export type PageTheme = (typeof PAGE_THEMES)[number];

// Envelope-only validation — `content`'s shape depends on `type`, and this
// codebase's existing jsonb-content precedents (Form.optionMetadata,
// Form.postSubmitOutcomes) all validate cross-referential/type-dependent
// shape in the service rather than via a class-transformer discriminated
// union, so PageService.assertValidSection does the same per-type check
// here (a switch on `type`) rather than introducing a first-of-its-kind
// decorator pattern for one new module. See that method for the exact
// required fields per PageSectionType.
export class PageSectionDto {
  @IsUUID()
  id: string;

  @IsEnum(PageSectionType)
  type: PageSectionType;

  @IsObject()
  content: Record<string, unknown>;
}

export class CreatePageDto {
  // Lowercase/url-safe — this is what appears in the shared public link
  // (member.<subdomain>.<baseDomain>/p/<slug>). Uniqueness (per tenant
  // schema) is enforced in PageService.assertSlugAvailable.
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsIn(PAGE_THEMES)
  theme?: PageTheme;

  @IsOptional()
  @IsHexColor()
  accentColor?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageSectionDto)
  sections: PageSectionDto[];
}

export class UpdatePageDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string | null;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsIn(PAGE_THEMES)
  theme?: PageTheme;

  @IsOptional()
  @IsHexColor()
  accentColor?: string | null;

  // Omitted = leave untouched; an array = replace the whole list wholesale
  // — same convention as Form.postSubmitOutcomes on UpdateFormDto (there's
  // no per-section id to diff against).
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'A published page needs at least one section' })
  @ValidateNested({ each: true })
  @Type(() => PageSectionDto)
  sections?: PageSectionDto[];
}

export class SubmitTestimonialDto {
  @IsUUID()
  sectionId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  quote: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

export class ModerateTestimonialSubmissionDto {
  @IsIn([
    TestimonialSubmissionStatus.APPROVED,
    TestimonialSubmissionStatus.REJECTED,
  ])
  status:
    TestimonialSubmissionStatus.APPROVED | TestimonialSubmissionStatus.REJECTED;
}

// What GET pages/public/:slug returns. Unlike Forms' PublicFormDto, nothing
// is stripped from `sections` — every section is content the church chose
// to show publicly, there's no "spoiler" concern like an unselected
// DROPDOWN option's metadata.
export interface PublicPageDto {
  id: string;
  slug: string;
  title: string;
  seoDescription: string | null;
  ogImageUrl: string | null;
  theme: PageTheme;
  accentColor: string | null;
  sections: {
    id: string;
    type: PageSectionType;
    content: Record<string, unknown>;
  }[];
}
