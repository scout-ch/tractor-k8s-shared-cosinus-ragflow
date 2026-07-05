// ponytail: standalone self-check, not a full test suite. Guards the one thing
// that regularly breaks when a Strapi instance's API version changes: the
// v3 (flat array, thilo) vs v4 (`{data: [...]}`, hering) response shapes.
import assert from 'assert';
import { parseV3Response, parseV4Response, slugify } from './parse';
import type { Section } from './types';

// --- slugify --------------------------------------------------------------

assert.strictEqual(slugify('Vorbereitung'), 'vorbereitung');
assert.strictEqual(slugify('Administration des participant·e·s'), 'administration-des-participant-e-s');
assert.strictEqual(slugify('Abschluss des J+S-Angebots'), 'abschluss-des-j-s-angebots');
assert.strictEqual(slugify('Préparation'), 'preparation');

// --- v3: flat array, no transformation -------------------------------------

const v3Fixture: Section[] = [
    {
        title: 'Auftrag',
        content: 'Section body',
        slug: 'auftrag',
        published_at: '2024-01-01T00:00:00.000Z',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-02T00:00:00.000Z',
        chapters: [
            { title: 'Kapitel 1', content: 'Chapter body', published_at: '2024-01-01T00:00:00.000Z' },
            { title: 'Kapitel 2 (draft)', content: 'Draft body', published_at: null },
        ],
    },
];

const v3Result = parseV3Response(v3Fixture);
assert.deepStrictEqual(v3Result, v3Fixture, 'v3 response must pass through unchanged');

// --- v4: {data: [...]}, mapped and slugified --------------------------------

const v4Fixture = {
    data: [
        {
            title: 'A. Vorbereitung der Lagersaison',
            menuName: 'Vorbereitung',
            createdAt: '2025-08-17T19:16:37.685Z',
            updatedAt: '2025-08-23T17:20:14.365Z',
            chapters: [
                {
                    title: 'Rahmenbedingungen für Lager',
                    content: 'Chapter body',
                    responsible: [{ name: 'Lagerleiter*in', abbreviation: 'LL' }],
                },
            ],
        },
        {
            title: 'E. Administration des participant·e·s',
            menuName: 'Administration des participant·e·s',
            createdAt: '2025-08-17T19:17:02.686Z',
            updatedAt: '2025-08-23T22:47:59.524Z',
            chapters: [],
        },
    ],
};

const v4Result = parseV4Response(v4Fixture);
assert.strictEqual(v4Result.length, 2, 'must map every section');

const [vorbereitung, administration] = v4Result;
assert.strictEqual(vorbereitung.slug, 'vorbereitung', 'slug must be derived from menuName');
assert.strictEqual(vorbereitung.content, null, 'v4 sections have no content field');
assert.strictEqual(vorbereitung.published_at, vorbereitung.created_at, 'published_at must be non-null (server already filtered)');
assert.strictEqual(vorbereitung.chapters[0].responsible?.[0].abbreviation, 'LL', 'responsible must pass through');
assert.strictEqual(administration.slug, 'administration-des-participant-e-s', 'slug must strip diacritics/interpunct');
assert.strictEqual(administration.chapters.length, 0);

console.log('parse.check.ts: OK');
