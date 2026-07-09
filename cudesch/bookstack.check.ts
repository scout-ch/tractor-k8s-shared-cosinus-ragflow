// ponytail: standalone self-check, not a full test suite. Guards the one thing that
// regularly breaks when the BookStack response shape shifts: chapter vs. loose-page
// flattening and draft/template filtering.
import assert from 'assert';
import { flattenBook, buildSourceUrl, buildFrontmatter } from './bookstack';
import type { BookStackBook } from './types';

// --- flattenBook ------------------------------------------------------------

const book: BookStackBook = {
    id: 16,
    name: 'Die Biberstufe mit Freud debii',
    slug: 'die-biberstufe-mit-freud-debii',
    contents: [
        {
            id: 50,
            name: 'Personen in der Biberstufe',
            slug: 'personen-in-der-biberstufe',
            book_id: 16,
            type: 'chapter',
            created_at: '2021-12-19T15:22:11.000000Z',
            updated_at: '2021-12-21T19:42:29.000000Z',
            pages: [
                { id: 42, name: 'Leitende', slug: 'leitende', book_id: 16, chapter_id: 50, draft: false, template: false },
            ],
        },
        {
            id: 43,
            name: 'Cool Animals',
            slug: 'cool-animals',
            book_id: 16,
            chapter_id: null,
            type: 'page',
            draft: false,
            template: false,
            created_at: '2021-12-19T18:22:11.000000Z',
            updated_at: '2022-07-29T13:44:15.000000Z',
        },
        {
            id: 44,
            name: 'Draft Page',
            slug: 'draft-page',
            book_id: 16,
            chapter_id: null,
            type: 'page',
            draft: true,
            template: false,
        },
    ],
};

const docs = flattenBook(book);
assert.strictEqual(docs.length, 2, 'draft loose page must be filtered out');
assert.strictEqual(docs[0].kind, 'chapter');
assert.strictEqual(docs[0].name, 'Personen in der Biberstufe');
assert.strictEqual(docs[1].kind, 'page');
assert.strictEqual(docs[1].name, 'Cool Animals');

// --- buildSourceUrl -----------------------------------------------------------

assert.strictEqual(
    buildSourceUrl(docs[0], 'de', 'https://cudesch.scout.ch'),
    'https://cudesch.scout.ch/de/books/die-biberstufe-mit-freud-debii/chapter/personen-in-der-biberstufe'
);
assert.strictEqual(
    buildSourceUrl(docs[1], 'de', 'https://cudesch.scout.ch'),
    'https://cudesch.scout.ch/de/books/die-biberstufe-mit-freud-debii/page/cool-animals'
);

// --- buildFrontmatter -----------------------------------------------------------

const fm = buildFrontmatter(docs[0], 'https://cudesch.scout.ch/de/books/.../chapter/...', book.slug);
assert.ok(fm.startsWith('---\n'), 'must start with delimiter');
assert.ok(
    fm.includes('title: "Die Biberstufe mit Freud debii – Personen in der Biberstufe"'),
    'title must combine book and chapter name'
);
assert.ok(fm.includes('source_document: "die-biberstufe-mit-freud-debii"'));
assert.strictEqual((fm.match(/---/g) || []).length, 2, 'exactly two delimiters');

console.log('bookstack.check.ts: OK');
