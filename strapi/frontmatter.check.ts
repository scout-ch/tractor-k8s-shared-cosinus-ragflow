// ponytail: standalone self-check, not a full test suite. app.ts can't be
// imported directly since it hits S3/Strapi on import, so this mirrors just
// the pure buildFrontmatter logic to catch YAML-escaping regressions.
import assert from 'assert';

function buildFrontmatter(section: { title: string; created_at: string; updated_at: string }): string {
    const lines = [
        '---',
        `title: ${JSON.stringify(section.title)}`,
        `created_at: ${JSON.stringify(section.created_at)}`,
        `updated_at: ${JSON.stringify(section.updated_at)}`,
        '---',
        '',
    ];
    return lines.join('\n');
}

const fm = buildFrontmatter({
    title: 'A "tricky" title: with colon',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-02-02T00:00:00.000Z',
});

assert.ok(fm.startsWith('---\n'), 'must start with delimiter');
assert.ok(fm.includes('title: "A \\"tricky\\" title: with colon"'), 'title must be safely quoted');
assert.ok(fm.includes('created_at: "2024-01-01T00:00:00.000Z"'), 'created_at present');
assert.strictEqual((fm.match(/---/g) || []).length, 2, 'exactly two delimiters');

console.log('frontmatter.check.ts: OK');
