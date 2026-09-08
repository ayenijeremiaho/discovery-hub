// The fixed section toolkit a Page is built from — see Page.sections' own
// comment for how each type's `content` shape is validated. Adding a new
// type later is additive (new enum value + PageService.assertValidSection
// branch), not a schema change, since content is jsonb.
export enum PageSectionType {
  HERO = 'HERO',
  ABOUT = 'ABOUT',
  STATS = 'STATS',
  SPEAKERS = 'SPEAKERS',
  SCHEDULE = 'SCHEDULE',
  // content.formId embeds an existing Form inline (rendered via the same
  // FormFillFields/PaginatedFormFillFields components a form's own public
  // fill page already uses) rather than reimplementing registration.
  REGISTRATION = 'REGISTRATION',
  TESTIMONIALS = 'TESTIMONIALS',
  FAQ = 'FAQ',
  // A single promotional image/poster plus an optional CTA link — e.g. a
  // merch flyer or a pre-order banner.
  MERCH = 'MERCH',
}

// The only status values allowed for TestimonialSubmission.status — plain
// string column, never a native PG enum, matching every other status field
// in this codebase.
export enum TestimonialSubmissionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}
