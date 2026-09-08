import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PageService } from './page.service';
import { Page } from '../entity/page.entity';
import { TestimonialSubmission } from '../entity/testimonial-submission.entity';
import { Form } from '../../forms/entity/form.entity';
import {
  PageSectionType,
  TestimonialSubmissionStatus,
} from '../enum/page.enum';
import { CloudinaryService } from '../../utility/service/cloudinary.service';
import { CreatePageDto } from '../dto/page.dto';

const mockPageRepo = {
  create: jest.fn((v) => v),
  save: jest.fn((v) => Promise.resolve({ id: 'page-1', ...v })),
  find: jest.fn(),
  findOneBy: jest.fn(),
  remove: jest.fn(),
};
const mockFormRepo = {
  findOneBy: jest.fn(),
};
const mockTestimonialSubmissionRepo = {
  create: jest.fn((v) => v),
  save: jest.fn((v) => Promise.resolve({ id: 'submission-1', ...v })),
  find: jest.fn().mockResolvedValue([]),
  findOneBy: jest.fn(),
};
const mockCloudinaryService = {
  uploadBuffer: jest.fn(),
  deleteByPublicId: jest.fn(),
};

describe('PageService', () => {
  let service: PageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTestimonialSubmissionRepo.find.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PageService,
        { provide: getRepositoryToken(Page), useValue: mockPageRepo },
        { provide: getRepositoryToken(Form), useValue: mockFormRepo },
        {
          provide: getRepositoryToken(TestimonialSubmission),
          useValue: mockTestimonialSubmissionRepo,
        },
        { provide: CloudinaryService, useValue: mockCloudinaryService },
      ],
    }).compile();
    service = module.get(PageService);
  });

  const heroSection = {
    id: 'sec-1',
    type: PageSectionType.HERO,
    content: { title: 'Higher Ground 2026' },
  };
  const faqSection = {
    id: 'sec-2',
    type: PageSectionType.FAQ,
    content: {
      items: [{ question: 'Is parking available?', answer: 'Yes.' }],
    },
  };

  function makeDto(overrides: Partial<CreatePageDto> = {}): CreatePageDto {
    return {
      slug: 'higher-ground-2026',
      title: 'Higher Ground 2026',
      sections: [heroSection, faqSection],
      ...overrides,
    } as CreatePageDto;
  }

  describe('create', () => {
    it('creates a page with valid sections', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(service.create(makeDto())).resolves.toBeDefined();
      expect(mockPageRepo.save).toHaveBeenCalled();
    });

    it('rejects a slug already in use', async () => {
      mockPageRepo.findOneBy.mockResolvedValue({ id: 'other-page' });
      await expect(service.create(makeDto())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a HERO section missing title', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              { id: 'sec-1', type: PageSectionType.HERO, content: {} },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a HERO section with ctaLabel but no ctaUrl', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              {
                id: 'sec-1',
                type: PageSectionType.HERO,
                content: { title: 'Higher Ground 2026', ctaLabel: 'Register' },
              },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a HERO section with both ctaLabel and ctaUrl', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              {
                id: 'sec-1',
                type: PageSectionType.HERO,
                content: {
                  title: 'Higher Ground 2026',
                  ctaLabel: 'Register',
                  ctaUrl: 'https://example.com/register',
                },
              },
            ],
          }),
        ),
      ).resolves.toBeDefined();
    });

    it('rejects a STATS section with an empty items array', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              {
                id: 'sec-1',
                type: PageSectionType.STATS,
                content: { items: [] },
              },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a SPEAKERS item missing a name', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              {
                id: 'sec-1',
                type: PageSectionType.SPEAKERS,
                content: { items: [{ title: 'Host' }] },
              },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a SCHEDULE day with no entries', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              {
                id: 'sec-1',
                type: PageSectionType.SCHEDULE,
                content: { days: [{ label: 'Day 1', entries: [] }] },
              },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a valid SCHEDULE section', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              {
                id: 'sec-1',
                type: PageSectionType.SCHEDULE,
                content: {
                  days: [
                    {
                      label: 'Day 1',
                      entries: [{ time: '10 AM', title: 'Opening' }],
                    },
                  ],
                },
              },
            ],
          }),
        ),
      ).resolves.toBeDefined();
    });

    it('rejects a REGISTRATION section with no formId', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              { id: 'sec-1', type: PageSectionType.REGISTRATION, content: {} },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a REGISTRATION section whose formId doesn't exist", async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      mockFormRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              {
                id: 'sec-1',
                type: PageSectionType.REGISTRATION,
                content: { formId: 'unknown-form' },
              },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a REGISTRATION section whose formId exists', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      mockFormRepo.findOneBy.mockResolvedValue({ id: 'form-1' });
      await expect(
        service.create(
          makeDto({
            sections: [
              {
                id: 'sec-1',
                type: PageSectionType.REGISTRATION,
                content: { formId: 'form-1' },
              },
            ],
          }),
        ),
      ).resolves.toBeDefined();
    });

    it('rejects a TESTIMONIALS item missing a quote', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              {
                id: 'sec-1',
                type: PageSectionType.TESTIMONIALS,
                content: { items: [{ name: 'Jane' }] },
              },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a FAQ item missing an answer', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              {
                id: 'sec-1',
                type: PageSectionType.FAQ,
                content: { items: [{ question: 'Is parking available?' }] },
              },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an ABOUT section missing body', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              {
                id: 'sec-1',
                type: PageSectionType.ABOUT,
                content: { heading: 'About the conference' },
              },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts an ABOUT section with a valid split layout + image position', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              {
                id: 'sec-1',
                type: PageSectionType.ABOUT,
                content: {
                  heading: 'About',
                  body: 'Body',
                  imageUrl: 'https://cdn/img.png',
                  layout: 'split',
                  imagePosition: 'left',
                },
              },
            ],
          }),
        ),
      ).resolves.toBeDefined();
    });

    it('rejects an ABOUT section with an invalid layout value', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              {
                id: 'sec-1',
                type: PageSectionType.ABOUT,
                content: { heading: 'About', body: 'Body', layout: 'sideways' },
              },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a MERCH section missing imageUrl', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              { id: 'sec-1', type: PageSectionType.MERCH, content: {} },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a MERCH section with linkLabel but no linkUrl', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              {
                id: 'sec-1',
                type: PageSectionType.MERCH,
                content: {
                  imageUrl: 'https://cdn/merch.png',
                  linkLabel: 'Shop now',
                },
              },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a valid MERCH section', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(
          makeDto({
            sections: [
              {
                id: 'sec-1',
                type: PageSectionType.MERCH,
                content: {
                  imageUrl: 'https://cdn/merch.png',
                  linkLabel: 'Shop now',
                  linkUrl: 'https://shop.example.com',
                },
              },
            ],
          }),
        ),
      ).resolves.toBeDefined();
    });

    it('defaults theme to minimal and accentColor to null when omitted', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await service.create(makeDto());
      expect(mockPageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'minimal',
          accentColor: null,
          draftTheme: 'minimal',
          draftAccentColor: null,
        }),
      );
    });

    it('sets theme/accentColor on both live and draft when provided', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await service.create(makeDto({ theme: 'bold', accentColor: '#f97316' }));
      expect(mockPageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'bold',
          accentColor: '#f97316',
          draftTheme: 'bold',
          draftAccentColor: '#f97316',
        }),
      );
    });
  });

  function makeExistingPage(overrides: Partial<Page> = {}): Partial<Page> {
    return {
      id: 'page-1',
      slug: 'higher-ground-2026',
      title: 'Higher Ground 2026',
      seoDescription: null,
      ogImageUrl: null,
      ogImagePublicId: null,
      sections: [heroSection],
      isPublished: false,
      draftTitle: 'Higher Ground 2026',
      draftSeoDescription: null,
      draftOgImageUrl: null,
      draftOgImagePublicId: null,
      draftSections: [heroSection],
      previewToken: 'preview-token-1',
      ...overrides,
    };
  }

  describe('update', () => {
    it('writes title/seoDescription/sections to their draft* counterparts, never live', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(makeExistingPage());
      await service.update('page-1', {
        title: 'Updated Title',
        seoDescription: 'Updated description',
        sections: [faqSection],
      });
      expect(mockPageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Higher Ground 2026',
          seoDescription: null,
          sections: [heroSection],
          draftTitle: 'Updated Title',
          draftSeoDescription: 'Updated description',
          draftSections: [faqSection],
        }),
      );
    });

    it('leaves draftSections untouched when sections is omitted', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(makeExistingPage());
      await service.update('page-1', { title: 'Updated Title' });
      expect(mockPageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          sections: [heroSection],
          draftSections: [heroSection],
        }),
      );
    });

    it('re-validates sections when provided', async () => {
      mockPageRepo.findOneBy.mockResolvedValueOnce(makeExistingPage());
      await expect(
        service.update('page-1', {
          sections: [{ id: 'sec-1', type: PageSectionType.HERO, content: {} }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows keeping the same slug without a duplicate error', async () => {
      mockPageRepo.findOneBy.mockResolvedValueOnce(makeExistingPage());
      await expect(
        service.update('page-1', { slug: 'higher-ground-2026' }),
      ).resolves.toBeDefined();
      expect(mockPageRepo.findOneBy).toHaveBeenCalledTimes(1);
    });

    it('rejects changing the slug to one already used by another page', async () => {
      mockPageRepo.findOneBy
        .mockResolvedValueOnce(makeExistingPage())
        .mockResolvedValueOnce({ id: 'page-2' });
      await expect(
        service.update('page-1', { slug: 'taken-slug' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('slug and isPublished still write live immediately, unlike content fields', async () => {
      mockPageRepo.findOneBy.mockResolvedValueOnce(makeExistingPage());
      await service.update('page-1', {
        slug: 'higher-ground-2026',
        isPublished: true,
      });
      expect(mockPageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isPublished: true }),
      );
    });

    it('routes theme/accentColor to draftTheme/draftAccentColor, not live', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(
        makeExistingPage({ theme: 'minimal', accentColor: null }),
      );
      await service.update('page-1', { theme: 'bold', accentColor: '#f97316' });
      expect(mockPageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'minimal',
          accentColor: null,
          draftTheme: 'bold',
          draftAccentColor: '#f97316',
        }),
      );
    });
  });

  describe('publish', () => {
    it('copies every draft* field onto its live counterpart and sets isPublished', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(
        makeExistingPage({
          title: 'Old Title',
          seoDescription: 'Old description',
          sections: [heroSection],
          isPublished: false,
          draftTitle: 'New Title',
          draftSeoDescription: 'New description',
          draftSections: [heroSection, faqSection],
        }),
      );
      await service.publish('page-1');
      expect(mockPageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Title',
          seoDescription: 'New description',
          sections: [heroSection, faqSection],
          isPublished: true,
        }),
      );
    });

    it('re-validates draftSections before publishing (e.g. a linked form deleted after the draft was saved)', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(
        makeExistingPage({
          draftSections: [
            {
              id: 'sec-1',
              type: PageSectionType.REGISTRATION,
              content: { formId: 'deleted-form' },
            },
          ],
        }),
      );
      mockFormRepo.findOneBy.mockResolvedValue(null);
      await expect(service.publish('page-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deletes the previous live OG image only when publishing actually replaces it', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(
        makeExistingPage({
          ogImagePublicId: 'old-live-public-id',
          draftOgImageUrl: 'https://cdn/new.png',
          draftOgImagePublicId: 'new-public-id',
        }),
      );
      await service.publish('page-1');
      expect(mockCloudinaryService.deleteByPublicId).toHaveBeenCalledWith(
        'old-live-public-id',
        'image',
      );
    });

    it('does not touch Cloudinary when the OG image is unchanged', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(
        makeExistingPage({
          ogImagePublicId: 'same-public-id',
          draftOgImageUrl: 'https://cdn/same.png',
          draftOgImagePublicId: 'same-public-id',
        }),
      );
      await service.publish('page-1');
      expect(mockCloudinaryService.deleteByPublicId).not.toHaveBeenCalled();
    });

    it('copies draftTheme/draftAccentColor onto the live columns', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(
        makeExistingPage({
          theme: 'minimal',
          accentColor: null,
          draftTheme: 'bold',
          draftAccentColor: '#f97316',
        }),
      );
      await service.publish('page-1');
      expect(mockPageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'bold', accentColor: '#f97316' }),
      );
    });
  });

  describe('getForPublic', () => {
    it('returns a mapped dto for a published page', async () => {
      mockPageRepo.findOneBy.mockResolvedValue({
        id: 'page-1',
        slug: 'higher-ground-2026',
        title: 'Higher Ground 2026',
        seoDescription: null,
        ogImageUrl: null,
        sections: [heroSection],
        isPublished: true,
      });
      const result = await service.getForPublic('higher-ground-2026');
      expect(result).toEqual({
        id: 'page-1',
        slug: 'higher-ground-2026',
        title: 'Higher Ground 2026',
        seoDescription: null,
        ogImageUrl: null,
        sections: [heroSection],
      });
    });

    it('404s for an unpublished or unknown slug', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(service.getForPublic('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getForPreview', () => {
    it('returns draft content, not live, when the token matches', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(
        makeExistingPage({
          isPublished: false,
          title: 'Live Title',
          sections: [heroSection],
          draftTitle: 'Draft Title',
          draftSections: [heroSection, faqSection],
          previewToken: 'correct-token',
        }),
      );
      const result = await service.getForPreview(
        'higher-ground-2026',
        'correct-token',
      );
      expect(result).toEqual(
        expect.objectContaining({
          title: 'Draft Title',
          sections: [heroSection, faqSection],
        }),
      );
    });

    it('404s on a wrong token', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(
        makeExistingPage({ previewToken: 'correct-token' }),
      );
      await expect(
        service.getForPreview('higher-ground-2026', 'wrong-token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('404s on a missing token', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(
        makeExistingPage({ previewToken: 'correct-token' }),
      );
      await expect(
        service.getForPreview('higher-ground-2026', ''),
      ).rejects.toThrow(NotFoundException);
    });

    it('404s for an unknown slug regardless of token', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.getForPreview('missing', 'any-token'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listPublished', () => {
    it('returns only published pages, mapped to the minimal shape', async () => {
      mockPageRepo.find.mockResolvedValue([
        {
          slug: 'higher-ground-2026',
          title: 'Higher Ground 2026',
          seoDescription: 'A conference',
          updatedAt: new Date('2026-01-01'),
        },
      ]);
      const result = await service.listPublished();
      expect(mockPageRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isPublished: true } }),
      );
      expect(result).toEqual([
        {
          slug: 'higher-ground-2026',
          title: 'Higher Ground 2026',
          seoDescription: 'A conference',
          updatedAt: new Date('2026-01-01'),
        },
      ]);
    });
  });

  describe('image uploads', () => {
    it('setOgImage writes draftOgImage*, not the live columns', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(
        makeExistingPage({
          ogImagePublicId: 'live-public-id',
          draftOgImagePublicId: 'old-draft-public-id',
        }),
      );
      mockCloudinaryService.uploadBuffer.mockResolvedValue({
        secureUrl: 'https://cdn/new.png',
        publicId: 'new-draft-public-id',
      });
      await service.setOgImage('page-1', {
        buffer: Buffer.from(''),
        mimetype: 'image/png',
      } as Express.Multer.File);
      expect(mockPageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ogImagePublicId: 'live-public-id',
          draftOgImageUrl: 'https://cdn/new.png',
          draftOgImagePublicId: 'new-draft-public-id',
        }),
      );
    });

    it('deletes the replaced draft image when it differs from the live one', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(
        makeExistingPage({
          ogImagePublicId: 'live-public-id',
          draftOgImagePublicId: 'old-draft-public-id',
        }),
      );
      mockCloudinaryService.uploadBuffer.mockResolvedValue({
        secureUrl: 'https://cdn/new.png',
        publicId: 'new-draft-public-id',
      });
      await service.setOgImage('page-1', {
        buffer: Buffer.from(''),
        mimetype: 'image/png',
      } as Express.Multer.File);
      expect(mockCloudinaryService.deleteByPublicId).toHaveBeenCalledWith(
        'old-draft-public-id',
        'image',
      );
    });

    it('does NOT delete the replaced draft image when it is still the live image', async () => {
      // The draft image was never changed since publish, so it's identical
      // to the live one — uploading a new draft image must not delete the
      // asset the published page still points at.
      mockPageRepo.findOneBy.mockResolvedValue(
        makeExistingPage({
          ogImagePublicId: 'shared-public-id',
          draftOgImagePublicId: 'shared-public-id',
        }),
      );
      mockCloudinaryService.uploadBuffer.mockResolvedValue({
        secureUrl: 'https://cdn/new.png',
        publicId: 'new-draft-public-id',
      });
      await service.setOgImage('page-1', {
        buffer: Buffer.from(''),
        mimetype: 'image/png',
      } as Express.Multer.File);
      expect(mockCloudinaryService.deleteByPublicId).not.toHaveBeenCalled();
    });

    it('removeOgImage clears draftOgImage* only, guarded the same way', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(
        makeExistingPage({
          ogImagePublicId: 'live-public-id',
          draftOgImagePublicId: 'old-draft-public-id',
        }),
      );
      await service.removeOgImage('page-1');
      expect(mockPageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ogImagePublicId: 'live-public-id',
          draftOgImageUrl: null,
          draftOgImagePublicId: null,
        }),
      );
      expect(mockCloudinaryService.deleteByPublicId).toHaveBeenCalledWith(
        'old-draft-public-id',
        'image',
      );
    });

    it('uploadSectionImage returns a reference without touching the page row', async () => {
      mockPageRepo.findOneBy.mockResolvedValue({ id: 'page-1' });
      mockCloudinaryService.uploadBuffer.mockResolvedValue({
        secureUrl: 'https://cdn/speaker.png',
        publicId: 'speaker-public-id',
      });
      const result = await service.uploadSectionImage('page-1', {
        buffer: Buffer.from(''),
        mimetype: 'image/png',
      } as Express.Multer.File);
      expect(result).toEqual({
        url: 'https://cdn/speaker.png',
        publicId: 'speaker-public-id',
      });
      expect(mockPageRepo.save).not.toHaveBeenCalled();
    });
  });

  const testimonialsSection = {
    id: 'sec-testimonials',
    type: PageSectionType.TESTIMONIALS,
    content: {
      items: [{ quote: 'God is good.', name: 'Jane' }],
      acceptSubmissions: true,
    },
  };

  describe('submitTestimonial', () => {
    it('creates a PENDING submission for a section that accepts them', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(
        makeExistingPage({
          isPublished: true,
          sections: [testimonialsSection],
        }),
      );
      await service.submitTestimonial('higher-ground-2026', {
        sectionId: 'sec-testimonials',
        quote: 'It changed my life.',
        name: 'Sam',
      });
      expect(mockTestimonialSubmissionRepo.save).toHaveBeenCalled();
      expect(mockTestimonialSubmissionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sectionId: 'sec-testimonials',
          quote: 'It changed my life.',
          name: 'Sam',
        }),
      );
    });

    it('rejects when the section does not exist on the page', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(
        makeExistingPage({
          isPublished: true,
          sections: [testimonialsSection],
        }),
      );
      await expect(
        service.submitTestimonial('higher-ground-2026', {
          sectionId: 'no-such-section',
          quote: 'It changed my life.',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockTestimonialSubmissionRepo.save).not.toHaveBeenCalled();
    });

    it('rejects when the section has not opted into acceptSubmissions', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(
        makeExistingPage({
          isPublished: true,
          sections: [
            {
              id: 'sec-testimonials',
              type: PageSectionType.TESTIMONIALS,
              content: { items: [] },
            },
          ],
        }),
      );
      await expect(
        service.submitTestimonial('higher-ground-2026', {
          sectionId: 'sec-testimonials',
          quote: 'It changed my life.',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('404s for an unpublished or unknown slug', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.submitTestimonial('missing', {
          sectionId: 'sec-testimonials',
          quote: 'It changed my life.',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listTestimonialSubmissions / moderateTestimonialSubmission', () => {
    it('lists submissions for a page, optionally filtered by status', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(makeExistingPage());
      mockTestimonialSubmissionRepo.find.mockResolvedValue([
        { id: 'sub-1', status: TestimonialSubmissionStatus.PENDING },
      ]);
      const result = await service.listTestimonialSubmissions(
        'page-1',
        TestimonialSubmissionStatus.PENDING,
      );
      expect(mockTestimonialSubmissionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            page: { id: 'page-1' },
            status: TestimonialSubmissionStatus.PENDING,
          },
        }),
      );
      expect(result).toEqual([
        { id: 'sub-1', status: TestimonialSubmissionStatus.PENDING },
      ]);
    });

    it('moderates a submission by flipping its status', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(makeExistingPage());
      mockTestimonialSubmissionRepo.findOneBy.mockResolvedValue({
        id: 'sub-1',
        status: TestimonialSubmissionStatus.PENDING,
      });
      await service.moderateTestimonialSubmission('page-1', 'sub-1', {
        status: TestimonialSubmissionStatus.APPROVED,
      });
      expect(mockTestimonialSubmissionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sub-1',
          status: TestimonialSubmissionStatus.APPROVED,
        }),
      );
    });

    it('404s when moderating a submission that does not exist', async () => {
      mockPageRepo.findOneBy.mockResolvedValue(makeExistingPage());
      mockTestimonialSubmissionRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.moderateTestimonialSubmission('page-1', 'missing-sub', {
          status: TestimonialSubmissionStatus.APPROVED,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('approved testimonial submissions merged into public output', () => {
    it('getForPublic appends APPROVED submissions to a section that accepts them', async () => {
      mockPageRepo.findOneBy.mockResolvedValue({
        id: 'page-1',
        slug: 'higher-ground-2026',
        title: 'Higher Ground 2026',
        seoDescription: null,
        ogImageUrl: null,
        theme: 'minimal',
        accentColor: null,
        sections: [testimonialsSection],
        isPublished: true,
      });
      mockTestimonialSubmissionRepo.find.mockResolvedValue([
        { sectionId: 'sec-testimonials', quote: 'Amazing.', name: 'Sam' },
      ]);
      const result = await service.getForPublic('higher-ground-2026');
      expect(mockTestimonialSubmissionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: TestimonialSubmissionStatus.APPROVED,
          }),
        }),
      );
      expect(result.sections[0].content.items).toEqual([
        { quote: 'God is good.', name: 'Jane' },
        { quote: 'Amazing.', name: 'Sam' },
      ]);
    });

    it('does not query submissions when no section accepts them', async () => {
      mockPageRepo.findOneBy.mockResolvedValue({
        id: 'page-1',
        slug: 'higher-ground-2026',
        title: 'Higher Ground 2026',
        seoDescription: null,
        ogImageUrl: null,
        theme: 'minimal',
        accentColor: null,
        sections: [heroSection],
        isPublished: true,
      });
      await service.getForPublic('higher-ground-2026');
      expect(mockTestimonialSubmissionRepo.find).not.toHaveBeenCalled();
    });
  });
});
