import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as Minio from 'minio';
import type { Section } from './types';
import { parseV3Response, parseV4Response, StrapiV4Response } from './parse';

const SUPPORTED_LOCALES = ['de', 'fr', 'it'];
const BASE_URL = process.env.STRAPI_BASE_URL ?? 'http://localhost:1337/api';
// v3: legacy Strapi (thilo) - flat array response, auto-populated relations, `_locale` param.
// v4: modern Strapi (hering) - `{data: [...]}` response, explicit `populate`/`fields`, `locale` param.
const API_VERSION = process.env.STRAPI_API_VERSION ?? 'v4';
const OUTPUT_DIR = path.join(__dirname, 'output');

const SOURCE_DOCUMENT = process.env.SOURCE_DOCUMENT!;
const SOURCE_URL_TEMPLATE = process.env.SOURCE_URL_TEMPLATE!;

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

async function uploadToS3(key: string, body: string, contentType: string): Promise<void> {
    const fullKey = S3_PREFIX ? `${S3_PREFIX}/${key}` : key;
    const buf = Buffer.from(body, 'utf8');
    await s3.putObject(S3_BUCKET, fullKey, buf, buf.length, { 'Content-Type': contentType });
}

async function fetchSectionsV3(locale: string): Promise<Section[]> {
    const url = `${BASE_URL}/sections?_locale=${locale}`;
    console.log(`\nFetching ${url} …`);
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching ${url}`);
    }
    return parseV3Response(await res.json());
}

const V4_QUERY =
    'populate[chapters][fields][0]=title&' +
    'populate[chapters][fields][1]=content&' +
    'populate[chapters][fields][2]=menuName&' +
    'populate[chapters][populate][responsible][fields][0]=name&' +
    'populate[chapters][populate][responsible][fields][1]=abbreviation&' +
    'fields[0]=title&' +
    'fields[1]=menuName&' +
    'fields[2]=createdAt&' +
    'fields[3]=updatedAt&' +
    'fields[4]=sorting&' +
    'status=published';

async function fetchSectionsV4(locale: string): Promise<Section[]> {
    const url = `${BASE_URL}/sections?${V4_QUERY}&locale=${locale}`;
    console.log(`\nFetching ${url} …`);
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching ${url}`);
    }
    return parseV4Response(await res.json() as StrapiV4Response);
}

function fetchSections(locale: string): Promise<Section[]> {
    return API_VERSION === 'v4' ? fetchSectionsV4(locale) : fetchSectionsV3(locale);
}

function buildSourceUrl(section: Section, locale: string): string {
    return SOURCE_URL_TEMPLATE
        .replace('{slug}', section.slug)
        .replace('{locale}', locale)
        .replace('{document_id}', section.document_id ?? '');
}

function buildFrontmatter(section: Section, sourceUrl: string): string {
    const lines = [
        '---',
        `title: ${JSON.stringify(section.title)}`,
        `created_at: ${JSON.stringify(section.created_at)}`,
        `updated_at: ${JSON.stringify(section.updated_at)}`,
        `source_document: ${JSON.stringify(SOURCE_DOCUMENT)}`,
        `source_url: ${JSON.stringify(sourceUrl)}`,
        '---',
        '',
    ];
    return lines.join('\n');
}

const RESPONSIBLE_LABELS: Record<string, string> = {
    de: 'Verantwortlich',
    fr: 'Responsable',
    it: 'Responsabile',
};

function buildMarkdown(section: Section, locale: string): string {
    const lines: string[] = [];

    const sourceUrl = buildSourceUrl(section, locale);
    lines.push(buildFrontmatter(section, sourceUrl));
    lines.push(`# ${section.title}`);
    lines.push('');

    if (section.content) {
        lines.push(section.content.trim());
        lines.push('');
    }

    const publishedChapters = (section.chapters ?? [])
        .filter(c => c.published_at !== null)
        .sort((a, b) => (a.sorting ?? 0) - (b.sorting ?? 0));

    for (const chapter of publishedChapters) {
        lines.push(`## ${chapter.title}`);
        lines.push('');
        if (chapter.content) {
            lines.push(chapter.content.trim());
            lines.push('');
        }
        if (chapter.responsible && chapter.responsible.length > 0) {
            const names = chapter.responsible.map(r => `${r.name} (${r.abbreviation})`).join(', ');
            const label = RESPONSIBLE_LABELS[locale] ?? 'Responsible';
            lines.push(`**${label}:** ${names}`);
            lines.push('');
        }
    }

    return lines.join('\n');
}

async function main(): Promise<void> {
    let grandTotalSections = 0;
    let grandTotalChapters = 0;

    for (const locale of SUPPORTED_LOCALES) {
        const sections = await fetchSections(locale);

        const published = sections
            .filter(s => s.published_at !== null)
            .sort((a, b) => a.sorting - b.sorting);
        console.log(`[${locale}] Sections total: ${sections.length}, published: ${published.length}`);

        const localeDir = path.join(OUTPUT_DIR, locale);
        fs.mkdirSync(localeDir, { recursive: true });

        let totalChapters = 0;

        for (const [index, section] of published.entries()) {
            const filename = `${SOURCE_DOCUMENT}-${index + 1}-${section.slug}.md`;
            const mdPath = path.join(localeDir, filename);

            const markdown = buildMarkdown(section, locale);
            fs.writeFileSync(mdPath, markdown, 'utf8');

            // Upload to S3
            await uploadToS3(`${locale}/${filename}`, markdown, 'text/markdown');

            const chapterCount = (section.chapters ?? []).filter(
                c => c.published_at !== null
            ).length;
            totalChapters += chapterCount;

            console.log(
                `  [${locale}/${section.slug}] ${section.title}  (${chapterCount} chapters) – uploaded`
            );
        }

        console.log(`[${locale}] Done. Sections: ${published.length}, chapters: ${totalChapters}`);
        grandTotalSections += published.length;
        grandTotalChapters += totalChapters;
    }

    console.log('');
    console.log(`All locales done. Total sections: ${grandTotalSections}, total chapters: ${grandTotalChapters}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
