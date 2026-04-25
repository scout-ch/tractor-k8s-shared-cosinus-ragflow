import * as fs from 'fs';
import * as path from 'path';

const SUPPORTED_LOCALES = ['de', 'fr', 'it'];
const BASE_URL = 'https://api.thilo.scouts.ch';
const OUTPUT_DIR = path.join(__dirname, 'output');

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

            const metadata = buildMetadata(section);
            fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

            const chapterCount = (section.chapters ?? []).filter(
                c => c.published_at !== null
            ).length;
            totalChapters += chapterCount;

            console.log(
                `  [${locale}/${section.id}] ${section.title}  (${chapterCount} chapters)`
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
