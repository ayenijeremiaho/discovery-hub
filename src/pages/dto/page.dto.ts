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
  SectionStyle,
  TestimonialSubmissionStatus,
} from '../enum/page.enum';

// Not a real schema constraint — DTO-level only, same reasoning
// PageSectionType's own file comment gives for `content` being jsonb: the
// theme toolkit is fixed today (two whole-page looks), not something a
// migration is needed to extend later.
export const PAGE_THEMES = ['minimal', 'bold'] as const;
export type PageTheme = (typeof PAGE_THEMES)[number];

// A small, fixed set of self-hostable Google Fonts (see discuva-member's
// Part E font-rendering work) — next/font/google needs statically-imported
// specifiers, so this can't be free text the way accentColor is; picking
// from a short curated list is what keeps a per-page font swap cheap to
// render well. Page-level only, not per-section (a page-builder that lets
// each block pick its own typeface reads as amateurish, not flexible).
export const PAGE_FONTS = [
  'inter',
  'poppins',
  'playfair',
  'bebas-neue',
] as const;
export type PageFont = (typeof PAGE_FONTS)[number];

export const SECTION_STYLE_ALIGNS = ['left', 'center', 'right'] as const;
export const SECTION_STYLE_COLUMNS = [1, 2, 3, 4] as const;
export const SECTION_STYLE_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export const SECTION_STYLE_SPACINGS = ['sm', 'md', 'lg'] as const;
export const SECTION_STYLE_LAYOUTS = ['stacked', 'split'] as const;

// A FOOTER section's optional content.socialLinks — a small fixed set
// (validated in PageService.assertValidSections) rather than free text, so
// discuva-member can map each one to a recognizable icon instead of a
// generic link.
export const FOOTER_SOCIAL_PLATFORMS = [
  'instagram',
  'facebook',
  'youtube',
  'tiktok',
  'x',
  'website',
] as const;

// Bounded per-section overrides, applicable to some section types and not
// others (discuva-admin's sections-editor.tsx owns the single "which knobs
// for which type" table — this DTO validates structurally only and doesn't
// know or enforce that mapping, same division of labor content's per-type
// shape has with PageService.assertValidSections). All 6 fields optional —
// an unset field just falls back to the section's existing default styling.
// `spacing` is the one exception to "applicable to some types" — it's a
// universal layout concern discuva-admin offers on every section type, not
// gated per type the way align/columns/size/accentColor/layout are.
export class SectionStyleDto implements SectionStyle {
  @IsOptional()
  @IsIn(SECTION_STYLE_ALIGNS)
  align?: (typeof SECTION_STYLE_ALIGNS)[number];

  @IsOptional()
  @IsIn(SECTION_STYLE_COLUMNS)
  columns?: (typeof SECTION_STYLE_COLUMNS)[number];

  @IsOptional()
  @IsIn(SECTION_STYLE_SIZES)
  size?: (typeof SECTION_STYLE_SIZES)[number];

  @IsOptional()
  @IsHexColor()
  accentColor?: string | null;

  @IsOptional()
  @IsIn(SECTION_STYLE_SPACINGS)
  spacing?: (typeof SECTION_STYLE_SPACINGS)[number];

  @IsOptional()
  @IsIn(SECTION_STYLE_LAYOUTS)
  layout?: (typeof SECTION_STYLE_LAYOUTS)[number];
}

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

  // A hidden section stays fully saved (content, style, position in the
  // list) but is dropped from what a visitor/preview ever sees — see
  // PageService.getForPublic/getForPreview's own filtering comment. Distinct
  // from deleting it: an admin building out next month's section ahead of
  // time, or temporarily pulling one down without losing its content, never
  // needs the "delete section" confirm plus rebuilding it from scratch.
  // Unvalidated beyond the boolean itself — a hidden section's `content`
  // still goes through the same per-type checks as a visible one, since
  // hiding is a visibility switch, not an excuse to leave content half-done.
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  // Unlike `content`, `style` is a fixed shape regardless of section type,
  // so a real nested DTO validates it directly — but it still needs
  // @ValidateNested()/@Type() (not just a property type annotation) to
  // survive the global `whitelist: true` boundary; a plain object literal
  // here would otherwise get silently stripped before validation even runs.
  @IsOptional()
  @ValidateNested()
  @Type(() => SectionStyleDto)
  style?: SectionStyleDto;
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

  @IsOptional()
  @IsHexColor()
  backgroundColor?: string | null;

  @IsOptional()
  @IsIn(PAGE_FONTS)
  fontFamily?: PageFont | null;

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

  @IsOptional()
  @IsHexColor()
  backgroundColor?: string | null;

  @IsOptional()
  @IsIn(PAGE_FONTS)
  fontFamily?: PageFont | null;

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

// Reuses an existing page as the starting point for a new one — copies its
// current draft (title, sections/style, theme/colors/font) into a brand-new
// Page, unpublished, under a fresh slug. `slug` is required (the same
// uniqueness constraint every Page has, so there's no sane auto-generated
// default); `title` is optional and falls back to "<source title> (Copy)"
// in PageService.duplicate.
export class DuplicatePageDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;
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
  backgroundColor: string | null;
  fontFamily: string | null;
  // Backs the automatic minimal footer (name + copyright) shown when a page
  // has no FOOTER section, and a FOOTER section's own "show contact info"
  // toggle — see PageService.resolveChurchInfo. Not admin-editable per
  // page; always the current tenant's own info.
  church: {
    name: string;
    address: string | null;
    supportEmail: string | null;
  };
  sections: {
    id: string;
    type: PageSectionType;
    content: Record<string, unknown>;
    style?: SectionStyle;
  }[];
}
