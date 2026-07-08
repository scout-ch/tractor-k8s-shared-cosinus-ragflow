import type { BookStackBook, DocItem } from './types';

// Chapters carry no draft/template flag of their own in the BookStack API - only
// loose pages (`type: "page"` directly under `contents[]`) do, so only those are filtered.
export function flattenBook(book: BookStackBook): DocItem[] {
    const docs: DocItem[] = [];

    for (const item of book.contents) {
        if (item.type === 'chapter') {
            docs.push({
                kind: 'chapter',
                id: item.id,
                name: item.name,
                slug: item.slug,
                bookName: book.name,
                bookSlug: book.slug,
                createdAt: item.created_at,
                updatedAt: item.updated_at,
            });
        } else if (item.type === 'page' && !item.draft && !item.template) {
            docs.push({
                kind: 'page',
                id: item.id,
                name: item.name,
                slug: item.slug,
                bookName: book.name,
                bookSlug: book.slug,
                createdAt: item.created_at,
                updatedAt: item.updated_at,
            });
        }
    }

    return docs;
}

export function buildSourceUrl(doc: DocItem, locale: string, baseUrl: string): string {
    const kindSegment = doc.kind === 'chapter' ? 'chapter' : 'page';
    return `${baseUrl}/${locale}/books/${doc.bookSlug}/${kindSegment}/${doc.slug}`;
}

export function buildFrontmatter(doc: DocItem, sourceUrl: string, sourceDocument: string): string {
    const lines = ['---', `title: ${JSON.stringify(`${doc.bookName} – ${doc.name}`)}`];
    if (doc.createdAt) {
        lines.push(`created_at: ${JSON.stringify(doc.createdAt)}`);
    }
    if (doc.updatedAt) {
        lines.push(`updated_at: ${JSON.stringify(doc.updatedAt)}`);
    }
    lines.push(`source_document: ${JSON.stringify(sourceDocument)}`, `source_url: ${JSON.stringify(sourceUrl)}`, '---', '');
    return lines.join('\n');
}
