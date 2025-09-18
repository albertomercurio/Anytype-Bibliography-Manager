export interface AnytypeObject {
  object: string;
  id: string;
  name: string;
  icon?: any;
  archived: boolean;
  space_id: string;
  snippet?: string;
  layout: string;
  type: AnytypeType;
  properties?: AnytypeProperty[];
}

export interface AnytypeType {
  object: string;
  id: string;
  key: string;
  name: string;
  plural_name?: string;
  icon?: any;
  archived: boolean;
  layout: string;
  properties?: AnytypeProperty[];
}

export interface AnytypeProperty {
  object: string;
  id: string;
  key: string;
  name: string;
  format: PropertyFormat;
  [key: string]: any;
}

export type PropertyFormat =
  | 'text'
  | 'number'
  | 'checkbox'
  | 'date'
  | 'url'
  | 'email'
  | 'files'
  | 'objects'
  | 'multi_select';

export interface Article {
  id?: string;
  name: string;
  title: string;
  authors: string[];
  year?: number;
  journal?: string;
  url?: string;
  doi: string;
  bibtex?: string;
  pdfs?: string[];
  read?: boolean;
  tags?: string[];
}

export interface Person {
  id?: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  orcid?: string;
  tags?: string[];
}

export interface Journal {
  id?: string;
  name: string;
  tags?: string[];
}

export interface Book {
  id?: string;
  name: string;
  authors: string[];
  year?: number;
  bibtex?: string;
  pdfs?: string[];
  tags?: string[];
}

export const ANYTYPE_TYPES = {
  ARTICLE: 'bafyreic6dye5yim2yuwyemghaxx3w444div2ezmwzp6y3t6zfxi2efq7ta',
  PERSON: 'bafyreia2ovxa3kagky35fvasvawz72d54u3oxylpnyhkzcytbytatd7b2u',
  JOURNAL: 'bafyreiaok4bz5vryofztkd4u4dchyalkdc2qutzkgeffhrfshwfnb23ism',
  BOOK: 'bafyreiab4o7panfzx3sy7tzbt7q4y2sggliuekxq5kek7wgadbpsunrske'
} as const;