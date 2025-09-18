export interface CrossrefResponse {
  status: string;
  'message-type': string;
  'message-version': string;
  message: CrossrefWork;
}

export interface CrossrefWork {
  DOI: string;
  title: string[];
  author?: CrossrefAuthor[];
  editor?: CrossrefAuthor[];
  'published-print'?: DateParts;
  'published-online'?: DateParts;
  'container-title'?: string[];
  publisher?: string;
  type: string;
  URL?: string;
  ISSN?: string[];
  ISBN?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  abstract?: string;
}

export interface CrossrefAuthor {
  given?: string;
  family?: string;
  name?: string;
  ORCID?: string;
  affiliation?: Array<{
    name: string;
  }>;
}

export interface DateParts {
  'date-parts': number[][];
}

export interface DOIMetadata {
  doi: string;
  title: string;
  authors: AuthorInfo[];
  year?: number;
  journal?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  url?: string;
  type: 'article' | 'book' | 'chapter' | 'other';
}

export interface AuthorInfo {
  fullName: string;
  givenName?: string;
  familyName?: string;
  orcid?: string;
}