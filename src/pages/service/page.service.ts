import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import 'multer';
import { Page, PageSection } from '../entity/page.entity';
import { TestimonialSubmission } from '../entity/testimonial-submission.entity';
import { Form } from '../../forms/entity/form.entity';
import {
  CreatePageDto,
  ModerateTestimonialSubmissionDto,
  PageSectionDto,
  PageTheme,
  PublicPageDto,
  SubmitTestimonialDto,
  UpdatePageDto,
} from '../dto/page.dto';
import {
  PageSectionType,
  TestimonialSubmissionStatus,
} from '../enum/page.enum';
import { CloudinaryService } from '../../utility/service/cloudinary.service';

@Injectable()
export class PageService {
  constructor(
    @InjectRepository(Page)
    private readonly pageRepo: Repository<Page>,
    @InjectRepository(Form)
    private readonly formRepo: Repository<Form>,
    @InjectRepository(TestimonialSubmission)
    private readonly testimonialSubmissionRepo: Repository<TestimonialSubmission>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(dto: CreatePageDto): Promise<Page> {
    await this.assertSlugAvailable(dto.slug);
    await this.assertValidSections(dto.sections);
    // Live and draft start identical — nothing is live yet for a brand-new
    // page, so there's no content to protect from an in-progress edit the
    // way update() protects an already-published page (see its own
    // comment). isPublished still independently gates reachability.
    const page = this.pageRepo.create({
      slug: dto.slug,
      title: dto.title,
      seoDescription: dto.seoDescription ?? null,
      isPublished: dto.isPublished ?? false,
      theme: dto.theme ?? 'minimal',
      accentColor: dto.accentColor ?? null,
      sections: dto.sections,
      draftTitle: dto.title,
      draftSeoDescription: dto.seoDescription ?? null,
      draftTheme: dto.theme ?? 'minimal',
      draftAccentColor: dto.accentColor ?? null,
      draftSections: dto.sections,
    });
    return this.pageRepo.save(page);
  }

  async getAll(): Promise<Page[]> {
    return this.pageRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getById(id: string): Promise<Page> {
    const page = await this.pageRepo.findOneBy({ id });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  // Only a published page is ever reachable here — an unpublished draft
  // 404s the same as a slug that doesn't exist at all, so a visitor can
  // never distinguish "never existed" from "not live yet". Unlike Forms'
  // PublicFormDto, nothing is stripped from `sections` (see PublicPageDto's
  // own comment).
  async getForPublic(slug: string): Promise<PublicPageDto> {
    const page = await this.pageRepo.findOneBy({ slug, isPublished: true });
    if (!page) throw new NotFoundException('Page not found');
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      seoDescription: page.seoDescription,
      ogImageUrl: page.ogImageUrl,
      theme: page.theme as PageTheme,
      accentColor: page.accentColor,
      sections: await this.withApprovedTestimonials(page, page.sections),
    };
  }

  // The shareable "Preview" link's target — same PublicPageDto shape as
  // getForPublic, sourced from draft* instead, so an admin sees exactly
  // what a visitor will see once they publish. No isPublished check: a
  // page that's never been published at all is still previewable. The
  // token is the only gate — anyone without it gets the same 404 a
  // nonexistent slug would, same "don't reveal which reason" posture
  // getForPublic already takes for unpublished vs. nonexistent.
  async getForPreview(slug: string, token: string): Promise<PublicPageDto> {
    const page = await this.pageRepo.findOneBy({ slug });
    if (!page || !token || page.previewToken !== token) {
      throw new NotFoundException('Page not found');
    }
    return {
      id: page.id,
      slug: page.slug,
      title: page.draftTitle,
      seoDescription: page.draftSeoDescription,
      ogImageUrl: page.draftOgImageUrl,
      theme: page.draftTheme as PageTheme,
      accentColor: page.draftAccentColor,
      sections: await this.withApprovedTestimonials(page, page.draftSections),
    };
  }

  // A TESTIMONIALS section with content.acceptSubmissions === true also
  // shows visitor-submitted testimonies once an admin approves them —
  // merged in here, server-side, so discuva-member's rendering never needs
  // a second fetch: it just sees a possibly-longer `items` array. Submitted
  // items carry no photoUrl (public submission never accepts an image
  // upload — see SubmitTestimonialDto's own comment).
  private async withApprovedTestimonials(
    page: Page,
    sections: PageSection[],
  ): Promise<PageSection[]> {
    const testimonialSectionIds = sections
      .filter(
        (s) =>
          s.type === PageSectionType.TESTIMONIALS &&
          s.content?.acceptSubmissions === true,
      )
      .map((s) => s.id);
    if (testimonialSectionIds.length === 0) return sections;

    const approved = await this.testimonialSubmissionRepo.find({
      where: {
        page: { id: page.id },
        sectionId: In(testimonialSectionIds),
        status: TestimonialSubmissionStatus.APPROVED,
      },
      order: { createdAt: 'ASC' },
    });

    return sections.map((s) => {
      if (!testimonialSectionIds.includes(s.id)) return s;
      const existingItems = Array.isArray(s.content.items)
        ? s.content.items
        : [];
      const submittedItems = approved
        .filter((sub) => sub.sectionId === s.id)
        .map((sub) => ({ quote: sub.quote, name: sub.name ?? undefined }));
      return {
        ...s,
        content: { ...s.content, items: [...existingItems, ...submittedItems] },
      };
    });
  }

  // Feeds discuva-member's sitemap/robots/llms.txt routes — every published
  // page for the tenant resolved by TenantMiddleware off the incoming
  // request, same as getForPublic. Deliberately minimal: only what a
  // crawler/LLM index actually needs, never draft content or the token.
  async listPublished(): Promise<
    {
      slug: string;
      title: string;
      seoDescription: string | null;
      updatedAt: Date;
    }[]
  > {
    const pages = await this.pageRepo.find({
      where: { isPublished: true },
      order: { updatedAt: 'DESC' },
    });
    return pages.map((p) => ({
      slug: p.slug,
      title: p.title,
      seoDescription: p.seoDescription,
      updatedAt: p.updatedAt,
    }));
  }

  // title/seoDescription/sections write to their draft* counterparts only —
  // an already-published page can be edited freely without a single Save
  // changing what a visitor sees. slug and isPublished are the exception:
  // slug is a URL/identity concern, not content, and isPublished is a
  // reachability switch, not content either — both keep writing live
  // immediately, same as before. publish() is what copies draft* onto the
  // live columns.
  async update(id: string, dto: UpdatePageDto): Promise<Page> {
    const page = await this.getById(id);

    if (dto.slug !== undefined && dto.slug !== page.slug) {
      await this.assertSlugAvailable(dto.slug, id);
      page.slug = dto.slug;
    }
    if (dto.title !== undefined) page.draftTitle = dto.title;
    if (dto.seoDescription !== undefined) {
      page.draftSeoDescription = dto.seoDescription;
    }
    if (dto.isPublished !== undefined) page.isPublished = dto.isPublished;
    if (dto.theme !== undefined) page.draftTheme = dto.theme;
    if (dto.accentColor !== undefined) page.draftAccentColor = dto.accentColor;
    if (dto.sections !== undefined) {
      await this.assertValidSections(dto.sections);
      page.draftSections = dto.sections;
    }

    return this.pageRepo.save(page);
  }

  // Copies every draft* field onto its live counterpart and marks the page
  // reachable — the only place draftSections/draftTitle/etc. ever reach a
  // real visitor. Deletes the previous live OG image from Cloudinary if
  // publishing swaps it for a different one (safe here — nothing else
  // could still be pointing at it once this save commits).
  async publish(id: string): Promise<Page> {
    const page = await this.getById(id);
    await this.assertValidSections(page.draftSections);

    const previousOgImagePublicId = page.ogImagePublicId;

    page.title = page.draftTitle;
    page.seoDescription = page.draftSeoDescription;
    page.ogImageUrl = page.draftOgImageUrl;
    page.ogImagePublicId = page.draftOgImagePublicId;
    page.theme = page.draftTheme;
    page.accentColor = page.draftAccentColor;
    page.sections = page.draftSections;
    page.isPublished = true;

    const saved = await this.pageRepo.save(page);

    if (
      previousOgImagePublicId &&
      previousOgImagePublicId !== saved.ogImagePublicId
    ) {
      this.cloudinaryService.deleteByPublicId(previousOgImagePublicId, 'image');
    }

    return saved;
  }

  async delete(id: string): Promise<void> {
    const page = await this.getById(id);
    await this.pageRepo.remove(page);
  }

  private async assertSlugAvailable(
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.pageRepo.findOneBy({ slug });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException(`The slug "${slug}" is already in use`);
    }
  }

  // Per-type structural validation the DTO's envelope-only decorators can't
  // express (`content`'s shape depends on `type`) — same reasoning
  // FormService.assertValidOptionMetadata/assertValidPostSubmitOutcomes
  // validate jsonb content in the service rather than via decorators.
  // REGISTRATION's formId is the one genuinely cross-referential check
  // (must reference a Form that actually exists in this tenant).
  private async assertValidSections(sections: PageSectionDto[]): Promise<void> {
    for (const section of sections) {
      const label = `Section "${section.type}"`;
      switch (section.type) {
        case PageSectionType.HERO:
          this.requireString(section.content, 'title', label);
          this.optionalString(section.content, 'subtitle', label);
          this.optionalString(section.content, 'dateRangeText', label);
          this.optionalString(section.content, 'backgroundImageUrl', label);
          this.assertPaired(section.content, 'ctaLabel', 'ctaUrl', label);
          break;
        case PageSectionType.ABOUT:
          this.requireString(section.content, 'heading', label);
          this.requireString(section.content, 'body', label);
          this.optionalString(section.content, 'imageUrl', label);
          this.optionalEnum(
            section.content,
            'layout',
            ['stacked', 'split'],
            label,
          );
          this.optionalEnum(
            section.content,
            'imagePosition',
            ['left', 'right'],
            label,
          );
          break;
        case PageSectionType.STATS:
          this.requireArray(section.content, 'items', label, (item, i) => {
            const itemLabel = `${label}, item #${i + 1}`;
            this.requireString(item, 'label', itemLabel);
            this.requireString(item, 'value', itemLabel);
          });
          break;
        case PageSectionType.SPEAKERS:
          this.optionalString(section.content, 'heading', label);
          this.requireArray(section.content, 'items', label, (item, i) => {
            const itemLabel = `${label}, speaker #${i + 1}`;
            this.requireString(item, 'name', itemLabel);
            this.optionalString(item, 'title', itemLabel);
            this.optionalString(item, 'photoUrl', itemLabel);
          });
          break;
        case PageSectionType.SCHEDULE:
          this.optionalString(section.content, 'heading', label);
          this.requireArray(section.content, 'days', label, (day, i) => {
            const dayLabel = `${label}, day #${i + 1}`;
            this.requireString(day, 'label', dayLabel);
            this.requireArray(day, 'entries', dayLabel, (entry, j) => {
              const entryLabel = `${dayLabel}, entry #${j + 1}`;
              this.optionalString(entry, 'time', entryLabel);
              this.requireString(entry, 'title', entryLabel);
            });
          });
          break;
        case PageSectionType.REGISTRATION: {
          this.optionalString(section.content, 'heading', label);
          this.optionalString(section.content, 'body', label);
          this.optionalString(section.content, 'ctaLabel', label);
          const formId = this.requireString(section.content, 'formId', label);
          const form = await this.formRepo.findOneBy({ id: formId });
          if (!form) {
            throw new BadRequestException(
              `${label}: formId references a form that doesn't exist`,
            );
          }
          break;
        }
        case PageSectionType.TESTIMONIALS:
          this.optionalString(section.content, 'heading', label);
          this.requireArray(section.content, 'items', label, (item, i) => {
            const itemLabel = `${label}, testimonial #${i + 1}`;
            this.requireString(item, 'quote', itemLabel);
            this.optionalString(item, 'name', itemLabel);
            this.optionalString(item, 'photoUrl', itemLabel);
          });
          break;
        case PageSectionType.FAQ:
          this.optionalString(section.content, 'heading', label);
          this.requireArray(section.content, 'items', label, (item, i) => {
            const itemLabel = `${label}, question #${i + 1}`;
            this.requireString(item, 'question', itemLabel);
            this.requireString(item, 'answer', itemLabel);
          });
          break;
        case PageSectionType.MERCH:
          this.requireString(section.content, 'imageUrl', label);
          this.optionalString(section.content, 'heading', label);
          this.assertPaired(section.content, 'linkLabel', 'linkUrl', label);
          break;
      }
    }
  }

  private requireString(
    content: Record<string, unknown>,
    key: string,
    label: string,
  ): string {
    const value = content[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${label}: "${key}" is required`);
    }
    return value;
  }

  private optionalString(
    content: Record<string, unknown>,
    key: string,
    label: string,
  ): void {
    const value = content[key];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw new BadRequestException(`${label}: "${key}" must be a string`);
    }
  }

  private optionalEnum(
    content: Record<string, unknown>,
    key: string,
    allowed: readonly string[],
    label: string,
  ): void {
    const value = content[key];
    if (value === undefined || value === null) return;
    if (typeof value !== 'string' || !allowed.includes(value)) {
      throw new BadRequestException(
        `${label}: "${key}" must be one of ${allowed.join(', ')}`,
      );
    }
  }

  // Both fields together or neither — same "nothing to click, nowhere to
  // send them" reasoning as FormService.assertValidGeneralAction.
  private assertPaired(
    content: Record<string, unknown>,
    labelKey: string,
    urlKey: string,
    label: string,
  ): void {
    const ctaLabel = content[labelKey];
    const ctaUrl = content[urlKey];
    if (!ctaLabel && !ctaUrl) return;
    if (!ctaLabel || !ctaUrl) {
      throw new BadRequestException(
        `${label}: "${labelKey}" and "${urlKey}" must both be set, or both left empty`,
      );
    }
  }

  private requireArray(
    content: Record<string, unknown>,
    key: string,
    label: string,
    checkItem: (item: Record<string, unknown>, index: number) => void,
  ): void {
    const value = content[key];
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException(
        `${label}: "${key}" needs at least one entry`,
      );
    }
    value.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new BadRequestException(
          `${label}: "${key}" entry #${index + 1} is invalid`,
        );
      }
      checkItem(item as Record<string, unknown>, index);
    });
  }

  // Mirrors FormService.setCoverImage's "delete the previous asset only
  // after the new one is safely saved" ordering.
  // Writes draftOgImagePublicId, not the live column — see update()'s own
  // comment. The replaced image is only deleted from Cloudinary if it isn't
  // ALSO the current live ogImagePublicId; otherwise the still-published
  // page would lose its image the moment a draft replacement is uploaded,
  // before that draft is ever published.
  async setOgImage(id: string, file: Express.Multer.File): Promise<Page> {
    const page = await this.getById(id);
    const previousDraftPublicId = page.draftOgImagePublicId;
    const uploaded = await this.cloudinaryService.uploadBuffer(
      file.buffer,
      'page-images',
      undefined,
      file.mimetype,
    );
    page.draftOgImageUrl = uploaded.secureUrl;
    page.draftOgImagePublicId = uploaded.publicId;
    const saved = await this.pageRepo.save(page);
    if (
      previousDraftPublicId &&
      previousDraftPublicId !== saved.ogImagePublicId
    ) {
      this.cloudinaryService.deleteByPublicId(previousDraftPublicId, 'image');
    }
    return saved;
  }

  async removeOgImage(id: string): Promise<Page> {
    const page = await this.getById(id);
    const previousDraftPublicId = page.draftOgImagePublicId;
    page.draftOgImageUrl = null;
    page.draftOgImagePublicId = null;
    const saved = await this.pageRepo.save(page);
    if (
      previousDraftPublicId &&
      previousDraftPublicId !== saved.ogImagePublicId
    ) {
      this.cloudinaryService.deleteByPublicId(previousDraftPublicId, 'image');
    }
    return saved;
  }

  // Generic upload used by every image slot in every section type (hero
  // background, each speaker photo, gallery images) — returns a reference
  // only, doesn't touch the Page row itself; the caller embeds the url into
  // whichever section's content it belongs to on the next save. Admin-only
  // (AdminGuard), unlike Forms' visitor-facing attachment uploads, so the
  // volume of an abandoned upload (started, page edit never saved) is low
  // enough that no orphan-cleanup sweep is built for v1 — an accepted
  // tradeoff, not an oversight.
  async uploadSectionImage(
    id: string,
    file: Express.Multer.File,
  ): Promise<{ url: string; publicId: string }> {
    await this.getById(id);
    const uploaded = await this.cloudinaryService.uploadBuffer(
      file.buffer,
      'page-images',
      undefined,
      file.mimetype,
    );
    return { url: uploaded.secureUrl, publicId: uploaded.publicId };
  }

  // Public, unauthenticated — a visitor submitting their own testimony on a
  // live page. Rejects unless the referenced section actually exists on
  // this exact page, is a TESTIMONIALS section, and has opted in via
  // content.acceptSubmissions, so a stale/guessed sectionId can't attach a
  // submission to a section that was never configured to accept one.
  // Always lands as PENDING — see withApprovedTestimonials for how an
  // APPROVED row later surfaces on the public page.
  async submitTestimonial(
    slug: string,
    dto: SubmitTestimonialDto,
  ): Promise<void> {
    const page = await this.pageRepo.findOneBy({ slug, isPublished: true });
    if (!page) throw new NotFoundException('Page not found');

    const section = page.sections.find((s) => s.id === dto.sectionId);
    if (
      !section ||
      section.type !== PageSectionType.TESTIMONIALS ||
      section.content?.acceptSubmissions !== true
    ) {
      throw new BadRequestException(
        'This page is not accepting testimonial submissions',
      );
    }

    const submission = this.testimonialSubmissionRepo.create({
      page,
      sectionId: dto.sectionId,
      quote: dto.quote,
      name: dto.name ?? null,
    });
    await this.testimonialSubmissionRepo.save(submission);
  }

  async listTestimonialSubmissions(
    pageId: string,
    status?: TestimonialSubmissionStatus,
  ): Promise<TestimonialSubmission[]> {
    await this.getById(pageId);
    return this.testimonialSubmissionRepo.find({
      where: { page: { id: pageId }, ...(status ? { status } : {}) },
      order: { createdAt: 'DESC' },
    });
  }

  async moderateTestimonialSubmission(
    pageId: string,
    submissionId: string,
    dto: ModerateTestimonialSubmissionDto,
  ): Promise<TestimonialSubmission> {
    await this.getById(pageId);
    const submission = await this.testimonialSubmissionRepo.findOneBy({
      id: submissionId,
      page: { id: pageId },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    submission.status = dto.status;
    return this.testimonialSubmissionRepo.save(submission);
  }
}
