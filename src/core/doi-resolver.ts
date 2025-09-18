import axios from 'axios';
import { CrossrefResponse, CrossrefAuthor, DOIMetadata, AuthorInfo } from '../types/crossref';

export class DOIResolver {
  private crossrefBaseUrl = 'https://api.crossref.org/works';
  private dataciteBaseUrl = 'https://api.datacite.org/dois';

  async resolve(doi: string): Promise<DOIMetadata | null> {
    const cleanDoi = this.cleanDoi(doi);

    try {
      const metadata = await this.fetchFromCrossref(cleanDoi);
      if (metadata) return metadata;
    } catch {
      console.log(`CrossRef lookup failed for ${cleanDoi}, trying DataCite...`);
    }

    try {
      const metadata = await this.fetchFromDataCite(cleanDoi);
      if (metadata) return metadata;
    } catch {
      console.error(`All DOI lookups failed for ${cleanDoi}`);
    }

    return null;
  }

  private cleanDoi(doi: string): string {
    doi = doi.trim();

    if (doi.startsWith('http://dx.doi.org/')) {
      doi = doi.substring('http://dx.doi.org/'.length);
    } else if (doi.startsWith('https://dx.doi.org/')) {
      doi = doi.substring('https://dx.doi.org/'.length);
    } else if (doi.startsWith('http://doi.org/')) {
      doi = doi.substring('http://doi.org/'.length);
    } else if (doi.startsWith('https://doi.org/')) {
      doi = doi.substring('https://doi.org/'.length);
    } else if (doi.startsWith('doi:')) {
      doi = doi.substring(4);
    }

    return doi;
  }

  private async fetchFromCrossref(doi: string): Promise<DOIMetadata | null> {
    const response = await axios.get<CrossrefResponse>(`${this.crossrefBaseUrl}/${doi}`, {
      headers: {
        'User-Agent': 'Anytype-Bibliography-Manager/1.0 (mailto:support@anytype.io)'
      }
    });

    if (response.data.status !== 'ok') {
      return null;
    }

    const work = response.data.message;
    const authors = this.extractAuthors(work.author || work.editor || []);
    const year = this.extractYear(work);
    const journal = work['container-title']?.[0] || work.publisher;
    const type = this.determineType(work.type);

    return {
      doi,
      title: work.title[0] || 'Untitled',
      authors,
      year,
      journal,
      publisher: work.publisher,
      volume: work.volume,
      issue: work.issue,
      pages: work.page,
      url: work.URL,
      type
    };
  }

  private async fetchFromDataCite(doi: string): Promise<DOIMetadata | null> {
    const response = await axios.get(`${this.dataciteBaseUrl}/${doi}`, {
      headers: {
        'Accept': 'application/vnd.api+json'
      }
    });

    const attributes = response.data.data.attributes;
    const authors = this.extractDataCiteAuthors(attributes.creators || []);
    const year = attributes.publicationYear;
    const journal = attributes.container?.title;
    const type = this.determineDataCiteType(attributes.types?.resourceTypeGeneral);

    return {
      doi,
      title: attributes.titles[0]?.title || 'Untitled',
      authors,
      year,
      journal,
      publisher: attributes.publisher,
      url: attributes.url,
      type
    };
  }

  private extractAuthors(authors: CrossrefAuthor[]): AuthorInfo[] {
    return authors.map(author => {
      let fullName: string;
      let givenName: string | undefined;
      let familyName: string | undefined;

      if (author.family && author.given) {
        givenName = author.given;
        familyName = author.family;
        fullName = `${givenName} ${familyName}`;
      } else if (author.name) {
        fullName = author.name;
      } else if (author.family) {
        familyName = author.family;
        fullName = familyName;
      } else {
        fullName = 'Unknown Author';
      }

      return {
        fullName,
        givenName,
        familyName,
        orcid: author.ORCID
      };
    });
  }

  private extractDataCiteAuthors(creators: any[]): AuthorInfo[] {
    return creators.map(creator => {
      const name = creator.name || `${creator.givenName || ''} ${creator.familyName || ''}`.trim();
      return {
        fullName: name || 'Unknown Author',
        givenName: creator.givenName,
        familyName: creator.familyName,
        orcid: creator.nameIdentifiers?.find((id: any) => id.nameIdentifierScheme === 'ORCID')?.nameIdentifier
      };
    });
  }

  private extractYear(work: any): number | undefined {
    const published = work['published-print'] || work['published-online'];
    if (published && published['date-parts'] && published['date-parts'][0]) {
      return published['date-parts'][0][0];
    }
    return undefined;
  }

  private determineType(crossrefType: string): 'article' | 'book' | 'chapter' | 'other' {
    const typeMap: Record<string, 'article' | 'book' | 'chapter' | 'other'> = {
      'journal-article': 'article',
      'proceedings-article': 'article',
      'book': 'book',
      'monograph': 'book',
      'book-chapter': 'chapter',
      'book-section': 'chapter'
    };
    return typeMap[crossrefType] || 'other';
  }

  private determineDataCiteType(resourceType?: string): 'article' | 'book' | 'chapter' | 'other' {
    const typeMap: Record<string, 'article' | 'book' | 'chapter' | 'other'> = {
      'Text': 'article',
      'Book': 'book',
      'BookChapter': 'chapter',
      'JournalArticle': 'article'
    };
    return typeMap[resourceType || ''] || 'other';
  }
}