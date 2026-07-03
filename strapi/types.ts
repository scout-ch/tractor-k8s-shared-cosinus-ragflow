export interface Chapter {
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

export interface Section {
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
