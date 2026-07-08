export interface BookStackListResponse<T> {
    data: T[];
    total: number;
}

export interface BookStackBookListItem {
    id: number;
    name: string;
    slug: string;
}

export interface BookStackPageRef {
    id: number;
    name: string;
    slug: string;
    book_id: number;
    chapter_id: number | null;
    draft: boolean;
    template: boolean;
}

export interface BookStackContentItem {
    id: number;
    name: string;
    slug: string;
    book_id: number;
    type: 'chapter' | 'page';
    chapter_id?: number | null;
    draft?: boolean;
    template?: boolean;
    created_at?: string;
    updated_at?: string;
    pages?: BookStackPageRef[];
}

export interface BookStackBook {
    id: number;
    name: string;
    slug: string;
    contents: BookStackContentItem[];
}

export type DocKind = 'chapter' | 'page';

export interface DocItem {
    kind: DocKind;
    id: number;
    name: string;
    slug: string;
    bookName: string;
    bookSlug: string;
    createdAt?: string;
    updatedAt?: string;
}
