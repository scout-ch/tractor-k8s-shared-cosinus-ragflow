import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as Minio from 'minio';
import type { BookStackBook, BookStackBookListItem, BookStackListResponse, DocKind } from './types';
import { flattenBook, buildSourceUrl, buildFrontmatter } from './bookstack';

const SUPPORTED_LOCALES = ['de', 'fr', 'it'];
// cudesch.scout.ch is three separate BookStack instances, one per locale, each with its own
// API token, but they all share the same domain for both the API and the public reader URLs.
const BASE_URL = process.env.CUDESCH_BASE_URL ?? 'https://cudesch.scout.ch';
const OUTPUT_DIR = path.join(__dirname, 'output');

const SOURCE_DOCUMENT = process.env.SOURCE_DOCUMENT ?? 'cudesch';

const TOKENS: Record<string, string> = {
    de: process.env.CUDESCH_API_TOKEN_DE!,
    fr: process.env.CUDESCH_API_TOKEN_FR!,
    it: process.env.CUDESCH_API_TOKEN_IT!,
};

const S3_BUCKET = process.env.S3_BUCKET!;
const S3_PREFIX = process.env.S3_PREFIX ?? '';

const endpointUrl = new URL(process.env.S3_ENDPOINT!);
const s3 = new Minio.Client({
    endPoint: endpointUrl.hostname,
    port: endpointUrl.port ? parseInt(endpointUrl.port) : undefined,
    useSSL: endpointUrl.protocol === 'https:',
    region: process.env.S3_REGION ?? 'fsn1',
    accessKey: process.env.S3_ACCESS_KEY_ID!,
    secretKey: process.env.S3_SECRET_ACCESS_KEY!,
});

async function uploadToS3(key: string, body: string, contentType: string): Promise<string> {
    const fullKey = S3_PREFIX ? `${S3_PREFIX}/${key}` : key;
    const buf = Buffer.from(body, 'utf8');
    await s3.putObject(S3_BUCKET, fullKey, buf, buf.length, { 'Content-Type': contentType });
    return fullKey;
}

async function removeStaleObjects(locale: string, producedKeys: Set<string>): Promise<void> {
    const prefix = `${S3_PREFIX ? S3_PREFIX + '/' : ''}${locale}/`;
    const stale: string[] = [];
    for await (const obj of s3.listObjectsV2(S3_BUCKET, prefix, true)) {
        if (obj.name && !producedKeys.has(obj.name)) {
            stale.push(obj.name);
        }
    }
    if (stale.length > 0) {
        await s3.removeObjects(S3_BUCKET, stale);
        console.log(`  [${locale}] Removed ${stale.length} stale object(s).`);
    }
}

// BookStack returns 429 (rate limit) or occasional 5xx under load - one retry covers both.
async function authFetch(url: string, token: string): Promise<Response> {
    const headers = { Authorization: `Token ${token}` };
    const res = await fetch(url, { headers });
    if (res.ok) return res;
    if (res.status === 429 || res.status >= 500) {
        const retryAfterHeader = res.headers.get('Retry-After');
        const delayMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 2000;
        console.warn(`  HTTP ${res.status} fetching ${url}, retrying in ${delayMs}ms…`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        const retryRes = await fetch(url, { headers });
        if (retryRes.ok) return retryRes;
        throw new Error(`HTTP ${retryRes.status} fetching ${url} (after retry)`);
    }
    throw new Error(`HTTP ${res.status} fetching ${url}`);
}

async function listBooks(base: string, token: string): Promise<BookStackBookListItem[]> {
    const books: BookStackBookListItem[] = [];
    let offset = 0;
    for (;;) {
        const res = await authFetch(`${base}/books?count=500&offset=${offset}`, token);
        const body = await res.json() as BookStackListResponse<BookStackBookListItem>;
        books.push(...body.data);
        offset += body.data.length;
        if (body.data.length === 0 || offset >= body.total) break;
    }
    return books;
}

async function getBook(base: string, token: string, id: number): Promise<BookStackBook> {
    const res = await authFetch(`${base}/books/${id}`, token);
    return await res.json() as BookStackBook;
}

async function exportMarkdown(base: string, token: string, kind: DocKind, id: number): Promise<string> {
    const endpoint = kind === 'chapter' ? 'chapters' : 'pages';
    const res = await authFetch(`${base}/${endpoint}/${id}/export/markdown`, token);
    return await res.text();
}

async function main(): Promise<void> {
    let grandTotalDocs = 0;

    for (const locale of SUPPORTED_LOCALES) {
        const token = TOKENS[locale];
        const base = `${BASE_URL}/${locale}/api`;

        console.log(`\n[${locale}] Fetching book list…`);
        const books = await listBooks(base, token);
        console.log(`[${locale}] Books: ${books.length}`);

        const localeDir = path.join(OUTPUT_DIR, locale);
        fs.mkdirSync(localeDir, { recursive: true });

        const producedKeys = new Set<string>();
        let docCount = 0;

        for (const [bookIdx, bookRef] of books.entries()) {
            const book = await getBook(base, token, bookRef.id);
            const docs = flattenBook(book);

            for (const [itemIdx, doc] of docs.entries()) {
                const content = await exportMarkdown(base, token, doc.kind, doc.id);
                const sourceUrl = buildSourceUrl(doc, locale, BASE_URL);
                const markdown = buildFrontmatter(doc, sourceUrl, SOURCE_DOCUMENT) +
                    `# ${doc.bookName} – ${doc.name}\n\n${content.trim()}\n`;

                const filename = `${SOURCE_DOCUMENT}-${bookIdx + 1}-${book.slug}-${itemIdx + 1}-${doc.slug}.md`;
                fs.writeFileSync(path.join(localeDir, filename), markdown, 'utf8');

                const fullKey = await uploadToS3(`${locale}/${filename}`, markdown, 'text/markdown');
                producedKeys.add(fullKey);
                docCount++;
            }

            console.log(`  [${locale}/${book.slug}] ${book.name} (${docs.length} docs) – uploaded`);
        }

        await removeStaleObjects(locale, producedKeys);

        console.log(`[${locale}] Done. Books: ${books.length}, documents: ${docCount}`);
        grandTotalDocs += docCount;
    }

    console.log('');
    console.log(`All locales done. Total documents: ${grandTotalDocs}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
