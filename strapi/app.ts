import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as Minio from 'minio';

const SUPPORTED_LOCALES = ['de', 'fr', 'it'];
const BASE_URL = process.env.STRAPI_BASE_URL ?? 'http://localhost:1337/api';
const OUTPUT_DIR = path.join(__dirname, 'output');

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

interface Chapter {
    id: number;
    title: string;
    content: string | null;
    slug: string;
    slug_with_section: string;
    sorting: number | null;
    menu_name: string;
    locale: string;
    published_at: string | null;
    created_at: string;
    updated_at: string;
    line_height: unknown;
    responsible: unknown[];
    icon: unknown;
    link: unknown;
    section: number;
    [key: string]: unknown;
}

interface Section {
    id: number;
    title: string;
    content: string | null;
    slug: string;
    sorting: number | null;
    menu_name: string;
    locale: string;
    published_at: string | null;
    created_at: string;
    updated_at: string;
    color_primary: string | null;
    color_primary_light: string | null;
    icon: unknown;
    localizations: unknown[];
    chapters: Chapter[];
    [key: string]: unknown;
}

async function fetchSections(locale: string): Promise<Section[]> {
    const url = `${BASE_URL}/sections?_locale=${locale}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching ${url}`);
    }
    return res.json() as Promise<Section[]>;
}

/** Build the markdown document for a section (intro + all chapters). */
function buildMarkdown(section: Section): string {
    const lines: string[] = [];

    lines.push(`# ${section.title}`);
    lines.push('');

    if (section.content) {
        lines.push(section.content.trim());
        lines.push('');
    }

    const publishedChapters = (section.chapters ?? []).filter(
        c => c.published_at !== null
    );

    for (const chapter of publishedChapters) {
        lines.push(`## ${chapter.title}`);
        lines.push('');
        if (chapter.content) {
            lines.push(chapter.content.trim());
            lines.push('');
        }
    }

    return lines.join('\n');
}

/** Build the metadata object – every field except `content` for both section and chapters. */
function buildMetadata(section: Section): object {
    const { content: _sc, chapters, ...sectionMeta } = section;

    const chaptersMeta = (chapters ?? []).map(chapter => {
        const { content: _cc, ...chapterMeta } = chapter;
        return chapterMeta;
    });

    return { ...sectionMeta, chapters: chaptersMeta };
}

async function main(): Promise<void> {
    let grandTotalSections = 0;
    let grandTotalChapters = 0;

    for (const locale of SUPPORTED_LOCALES) {
        const url = `${BASE_URL}/sections?_locale=${locale}`;
        console.log(`\nFetching ${url} …`);
        const sections = await fetchSections(locale);

        const published = sections.filter(s => s.published_at !== null);
        console.log(`[${locale}] Sections total: ${sections.length}, published: ${published.length}`);

        const localeDir = path.join(OUTPUT_DIR, locale);
        fs.mkdirSync(localeDir, { recursive: true });

        let totalChapters = 0;

        for (const section of published) {
            const mdPath = path.join(localeDir, `${section.id}.md`);
            const metaPath = path.join(localeDir, `metadata_${section.id}.json`);

            const markdown = buildMarkdown(section);
            fs.writeFileSync(mdPath, markdown, 'utf8');

            const metadataObj = buildMetadata(section);
            const metadataJson = JSON.stringify(metadataObj, null, 2);
            fs.writeFileSync(metaPath, metadataJson, 'utf8');

            // Upload to S3
            await uploadToS3(`${locale}/${section.id}.md`, markdown, 'text/markdown');
            await uploadToS3(`${locale}/metadata_${section.id}.json`, metadataJson, 'application/json');

            const chapterCount = (section.chapters ?? []).filter(
                c => c.published_at !== null
            ).length;
            totalChapters += chapterCount;

            console.log(
                `  [${locale}/${section.id}] ${section.title}  (${chapterCount} chapters) – uploaded`
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
