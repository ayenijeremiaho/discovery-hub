import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../utility/entity/base.entity';
import { PageSectionType, SectionStyle } from '../enum/page.enum';

// { id, type, content } — `id` is client-generated (uuid), not a DB row id:
// sections live in a plain jsonb array (no relation), so there's nothing for
// TypeORM to assign an id to. `content`'s shape depends on `type` and is
// validated in PageService.assertValidSection (a switch per type), the same
// pattern Form.postSubmitOutcomes/optionMetadata already use for jsonb
// content a decorator alone can't cross-check — see PageSectionDto's own
// comment for why this isn't a class-transformer discriminated union.
export interface PageSection {
  id: string;
  type: PageSectionType;
  content: Record<string, unknown>;
  // Optional per-section style overrides — validated at the DTO boundary
  // (page.dto.ts's SectionStyleDto), stored as a jsonb sibling to `content`.
  // Unlike `content`, whose shape depends on `type`, style's shape is fixed
  // regardless of section type — which fields actually apply per type is a
  // discuva-admin UI concern, not something this entity or its DTO enforce.
  style?: SectionStyle;
  // A hidden section stays fully saved but never reaches a visitor —
  // PageService.getForPublic/getForPreview both filter it out of the
  // sections array they return, so discuva-member never needs to know this
  // field exists at all. PageAdminController's raw GET /pages/:id (the
  // builder's own read) returns it untouched, same as every other field.
  hidden?: boolean;
}

@Entity({ name: 'pages' })
export class Page extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Url-safe (^[a-z0-9-]+$), unique per tenant schema — this is what a
  // church shares in an ad: member.<subdomain>.<baseDomain>/p/<slug>.
  @Index({ unique: true })
  @Column()
  slug: string;

  @Column()
  title: string;

  // Falls back to a generic description when unset — see
  // PagePublicController's generateMetadata precedent on the member app
  // side for how this feeds Open Graph/Twitter Card previews.
  @Column({ name: 'seo_description', nullable: true })
  seoDescription: string | null;

  @Column({ name: 'og_image_url', nullable: true })
  ogImageUrl: string | null;

  @Column({ name: 'og_image_public_id', nullable: true })
  ogImagePublicId: string | null;

  // A page is only reachable at GET pages/public/:slug once true — lets an
  // admin build/save a draft without it going live.
  @Column({ name: 'is_published', default: false })
  isPublished: boolean;

  // Whole-array replace on every save (like Form.postSubmitOutcomes, not
  // diff-synced like Form.fields) — there's no per-section DB row to diff
  // against, and the builder always sends the complete current array.
  //
  // This is the LIVE, publicly-served value — PageService.update() never
  // writes here directly once a page has been saved before; it writes
  // draftSections (below) instead, and only PageService.publish() copies
  // draftSections onto this. Same story for title/seoDescription/
  // ogImageUrl/ogImagePublicId just below: each has a draft* counterpart
  // that's what the admin builder actually edits, so an already-published
  // page can be edited freely without changing what a visitor sees until
  // an explicit publish.
  @Column({ type: 'jsonb', default: [] })
  sections: PageSection[];

  // See `sections`'s own comment above for why these draft* columns exist.
  // draftTitle is NOT NULL (title always has a value, mirroring `title`
  // itself); the rest are nullable, matching their live counterparts.
  @Column({ name: 'draft_title' })
  draftTitle: string;

  @Column({ name: 'draft_seo_description', type: 'text', nullable: true })
  draftSeoDescription: string | null;

  @Column({ name: 'draft_og_image_url', nullable: true })
  draftOgImageUrl: string | null;

  @Column({ name: 'draft_og_image_public_id', nullable: true })
  draftOgImagePublicId: string | null;

  @Column({ name: 'draft_sections', type: 'jsonb', default: [] })
  draftSections: PageSection[];

  // Opaque, unguessable (a UUID) — the secret an admin-only "Preview" link
  // carries as a query param so PagePublicController can serve draftSections
  // to whoever holds the link, without requiring them to be logged in as an
  // admin at all (the link IS the credential). Never returned on
  // PublicPageDto — only the admin-facing response DTO includes it.
  @Column({ name: 'preview_token', unique: true })
  previewToken: string;

  // 'minimal' (default, today's thin/light/white look, unchanged) or
  // 'bold' (dark background, bold/uppercase headings, accentColor picked
  // out for emphasis) — a whole-page choice, not per-section, so every
  // section renders one consistent visual language. See
  // SectionRenderer on the member app side for how each section branches
  // on this.
  @Column({ default: 'minimal' })
  theme: string;

  // Only meaningful when theme is 'bold' — a hex color used for borders,
  // badges, active states, and buttons across every section. Null under
  // 'minimal', where nothing needs an accent color.
  @Column({ name: 'accent_color', nullable: true })
  accentColor: string | null;

  // Only meaningful when theme is 'bold' — the section background itself,
  // church-picked rather than the single fixed dark color this started
  // with (a real gap for a multi-tenant product: every church has its own
  // brand). Null falls back to that original default (see
  // discuva-member's DEFAULT_BOLD_BG). Foreground text color is never
  // stored — it's computed from this value's luminance at render time
  // (discuva-member's resolveBoldColors), so whatever a church picks stays
  // legible without them needing to think about contrast themselves.
  @Column({ name: 'background_color', nullable: true })
  backgroundColor: string | null;

  @Column({ name: 'draft_theme', default: 'minimal' })
  draftTheme: string;

  @Column({ name: 'draft_accent_color', nullable: true })
  draftAccentColor: string | null;

  @Column({ name: 'draft_background_color', nullable: true })
  draftBackgroundColor: string | null;

  // A curated identifier (page.dto.ts's PAGE_FONTS), not a free-text font
  // name — see SectionStyleDto's own file comment for why per-section fonts
  // aren't supported. Null falls back to a sensible per-theme default
  // (discuva-member's Part E font-rendering work), same "null = default"
  // convention as backgroundColor.
  @Column({ name: 'font_family', nullable: true })
  fontFamily: string | null;

  @Column({ name: 'draft_font_family', nullable: true })
  draftFontFamily: string | null;
}
