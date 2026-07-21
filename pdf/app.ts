import 'dotenv/config';
import * as Minio from 'minio';
import { md5Hex, shouldSkipUpload } from './upload';
import { buildKey } from './pdf';

const LOCALES = ['de', 'fr', 'it'];

const SOURCE_DOCUMENT = process.env.SOURCE_DOCUMENT!;

const LOCALE_URLS: Record<string, string | undefined> = {
    de: process.env.PDF_URL_DE || undefined,
    fr: process.env.PDF_URL_FR || undefined,
    it: process.env.PDF_URL_IT || undefined,
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

async function downloadPdf(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return Buffer.from(await res.arrayBuffer());
}

async function uploadToS3(key: string, buf: Buffer): Promise<void> {
    const md5 = md5Hex(buf);

    let existingEtag: string | null = null;
    try {
        existingEtag = (await s3.statObject(S3_BUCKET, key)).etag;
    } catch (err: any) {
        if (err.code !== 'NotFound') throw err;
    }

    if (shouldSkipUpload(md5, existingEtag)) {
        console.log(`  [unchanged] ${key}`);
        return;
    }

    await s3.putObject(S3_BUCKET, key, buf, buf.length, { 'Content-Type': 'application/pdf' });
    console.log(`  [uploaded] ${key}`);
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

async function main(): Promise<void> {
    for (const locale of LOCALES) {
        const url = LOCALE_URLS[locale];
        if (!url) continue;

        console.log(`[${locale}] Downloading ${url}`);
        const buf = await downloadPdf(url);
        const key = buildKey(locale, SOURCE_DOCUMENT, S3_PREFIX);
        await uploadToS3(key, buf);

        await removeStaleObjects(locale, new Set([key]));
    }

    console.log('Done.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
