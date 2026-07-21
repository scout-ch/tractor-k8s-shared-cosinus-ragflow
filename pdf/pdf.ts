// SOURCE_DOCUMENT is an identifier authored directly in helm/values.yaml (not derived from
// external data), so it's used as-is, same as strapi/cudesch use their source_document.
export function buildKey(locale: string, sourceDocument: string, s3Prefix: string): string {
    const prefix = s3Prefix ? `${s3Prefix}/` : '';
    return `${prefix}${locale}/${sourceDocument}.pdf`;
}
