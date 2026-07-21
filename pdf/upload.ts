import * as crypto from 'crypto';

export function md5Hex(buf: Buffer): string {
    return crypto.createHash('md5').update(buf).digest('hex');
}

export function shouldSkipUpload(md5: string, existingEtag: string | null): boolean {
    return existingEtag === md5;
}
