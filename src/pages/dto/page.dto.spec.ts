// Needed here (unlike clergy-title.dto.spec.ts's simpler DTOs) because
// PageSectionDto's `style` field uses class-transformer's @Type() decorator,
// which calls Reflect.getMetadata at class-definition time — normally
// polyfilled as a side effect of importing @nestjs/core/@nestjs/common
// (as every *.service.spec.ts in this codebase transitively does), but this
// spec imports only class-validator/class-transformer + the DTO itself, so
// nothing else pulls the polyfill in first.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePageDto } from './page.dto';
import { PageSectionType } from '../enum/page.enum';

// `style` is validated via a real nested class (SectionStyleDto), unlike
// `content` (a bare object, checked per-type in PageService instead) —
// these tests exist specifically because that distinction is easy to get
// wrong: a plain `style?: Record<string, unknown>` property type annotation
// with no @ValidateNested()/@Type() would get silently stripped by the
// global ValidationPipe's `whitelist: true` (see main.ts), and an unknown
// key inside it would 400 under `forbidNonWhitelisted: true` rather than
// being dropped — both behaviors are asserted below so a regression in
// either direction fails loudly instead of shipping unnoticed.
function makeSectionsDto(style: Record<string, unknown>) {
  return plainToInstance(CreatePageDto, {
    slug: 'conf-2026',
    title: 'Conference 2026',
    sections: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: PageSectionType.STATS,
        content: { items: [{ label: 'Attendees', value: '500+' }] },
        style,
      },
    ],
  });
}

async function validateDto(dto: CreatePageDto) {
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe('SectionStyleDto (via CreatePageDto.sections[].style)', () => {
  it('accepts a fully-populated valid style', async () => {
    const errors = await validateDto(
      makeSectionsDto({
        align: 'center',
        columns: 3,
        size: 'lg',
        accentColor: '#f97316',
        spacing: 'lg',
        layout: 'split',
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects a spacing value outside sm/md/lg', async () => {
    const errors = await validateDto(makeSectionsDto({ spacing: 'xl' }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts layout: stacked or split', async () => {
    expect(
      await validateDto(makeSectionsDto({ layout: 'stacked' })),
    ).toHaveLength(0);
    expect(
      await validateDto(makeSectionsDto({ layout: 'split' })),
    ).toHaveLength(0);
  });

  it('rejects a layout value outside stacked/split', async () => {
    const errors = await validateDto(makeSectionsDto({ layout: 'grid' }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts an empty style object (every field optional)', async () => {
    const errors = await validateDto(makeSectionsDto({}));
    expect(errors).toHaveLength(0);
  });

  it('rejects an align value outside the allowed set', async () => {
    const errors = await validateDto(makeSectionsDto({ align: 'justify' }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a columns value outside 1-4', async () => {
    const errors = await validateDto(makeSectionsDto({ columns: 5 }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a size value outside the allowed set', async () => {
    const errors = await validateDto(makeSectionsDto({ size: 'huge' }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-hex accentColor', async () => {
    const errors = await validateDto(
      makeSectionsDto({ accentColor: 'orange' }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('400s (via forbidNonWhitelisted) on an unknown key inside style, rather than silently dropping it', async () => {
    const errors = await validateDto(
      makeSectionsDto({ align: 'center', rotation: 45 } as unknown as Record<
        string,
        unknown
      >),
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('PageSectionDto.hidden', () => {
  function makeDto(hidden: unknown) {
    return plainToInstance(CreatePageDto, {
      slug: 'conf-2026',
      title: 'Conference 2026',
      sections: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: PageSectionType.HERO,
          content: { title: 'Conference 2026' },
          hidden,
        },
      ],
    });
  }

  it('accepts hidden: true', async () => {
    const errors = await validateDto(makeDto(true));
    expect(errors).toHaveLength(0);
  });

  it('accepts hidden: false', async () => {
    const errors = await validateDto(makeDto(false));
    expect(errors).toHaveLength(0);
  });

  it('accepts an omitted hidden (defaults to visible)', async () => {
    const errors = await validateDto(
      plainToInstance(CreatePageDto, {
        slug: 'conf-2026',
        title: 'Conference 2026',
        sections: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            type: PageSectionType.HERO,
            content: { title: 'Conference 2026' },
          },
        ],
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-boolean hidden', async () => {
    const errors = await validateDto(makeDto('yes'));
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CreatePageDto.fontFamily', () => {
  function makeDto(fontFamily: unknown) {
    return plainToInstance(CreatePageDto, {
      slug: 'conf-2026',
      title: 'Conference 2026',
      fontFamily,
      sections: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: PageSectionType.HERO,
          content: { title: 'Conference 2026' },
        },
      ],
    });
  }

  it('accepts a value from the curated PAGE_FONTS list', async () => {
    const errors = await validateDto(makeDto('poppins'));
    expect(errors).toHaveLength(0);
  });

  it('accepts an omitted fontFamily', async () => {
    const dto = plainToInstance(CreatePageDto, {
      slug: 'conf-2026',
      title: 'Conference 2026',
      sections: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: PageSectionType.HERO,
          content: { title: 'Conference 2026' },
        },
      ],
    });
    const errors = await validateDto(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a font not in the curated list (not free text)', async () => {
    const errors = await validateDto(makeDto('Comic Sans MS'));
    expect(errors.length).toBeGreaterThan(0);
  });
});
