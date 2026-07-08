export interface Responsible {
    name: string;
    abbreviation: string;
}

export interface Chapter {
    title: string;
    content: string | null;
    published_at: string | null;
    responsible?: Responsible[];
}

export interface Section {
    title: string;
    content: string | null;
    slug: string;
    published_at: string | null;
    created_at: string;
    updated_at: string;
    chapters: Chapter[];
    document_id?: string;
    sorting: number;
}
