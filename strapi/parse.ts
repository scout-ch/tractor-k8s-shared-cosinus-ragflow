import type { Section, Responsible } from './types';

// v3 (thilo): flat array, already shaped like Section[] - no transformation needed.
export function parseV3Response(json: unknown): Section[] {
    return json as Section[];
}

export interface StrapiV4Chapter {
    title: string;
    content: string | null;
    responsible?: Responsible[];
}

export interface StrapiV4Section {
    title: string;
    menuName: string;
    createdAt: string;
    updatedAt: string;
    chapters: StrapiV4Chapter[];
}

export interface StrapiV4Response {
    data: StrapiV4Section[];
}

// hering has no `slug` field on sections/chapters - derive one from menuName instead.
export function slugify(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// v4 (hering): `{data: [...]}` response - map into the same normalized Section shape as v3.
export function parseV4Response(body: StrapiV4Response): Section[] {
    // status=published is already applied server-side, so published_at just needs to be non-null.
    return body.data.map(section => ({
        title: section.title,
        content: null,
        slug: slugify(section.menuName),
        published_at: section.createdAt,
        created_at: section.createdAt,
        updated_at: section.updatedAt,
        chapters: section.chapters.map(chapter => ({
            title: chapter.title,
            content: chapter.content,
            published_at: section.createdAt,
            responsible: chapter.responsible,
        })),
    }));
}
