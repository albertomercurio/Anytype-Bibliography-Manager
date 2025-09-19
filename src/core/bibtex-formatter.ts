import { DOIMetadata, AuthorInfo } from '../types/crossref';
import { sanitizeForCiteKey, escapeLatex } from '../utils/text-utils';

export class BibTeXFormatter {
  formatEntry(metadata: DOIMetadata): string {
    const citeKey = this.generateCiteKey(metadata);
    const entryType = this.getEntryType(metadata.type);
    const fields = this.formatFields(metadata);

    const formattedEntry = [
      `@${entryType}{${citeKey},`,
      ...fields.map(field => `  ${field}`),
      '}'
    ].join('\n');

    return formattedEntry;
  }

  private generateCiteKey(metadata: DOIMetadata): string {
    const firstAuthor = metadata.authors[0];
    let lastName = 'Unknown';

    if (firstAuthor?.familyName) {
      lastName = firstAuthor.familyName;
    } else if (firstAuthor?.fullName) {
      const parts = firstAuthor.fullName.split(' ');
      lastName = parts[parts.length - 1] || 'Unknown';
    }

    lastName = this.sanitizeForCiteKey(lastName);

    const year = metadata.year || new Date().getFullYear();

    const titleWords = metadata.title.split(' ');
    let firstTitleWord = titleWords[0] || 'Untitled';
    firstTitleWord = this.sanitizeForCiteKey(firstTitleWord);

    return `${lastName}${year}${firstTitleWord}`;
  }

  private sanitizeForCiteKey(text: string): string {
    return sanitizeForCiteKey(text);
  }

  private getEntryType(type: 'article' | 'book' | 'chapter' | 'other'): string {
    const typeMap = {
      'article': 'article',
      'book': 'book',
      'chapter': 'incollection',
      'other': 'misc'
    };
    return typeMap[type];
  }

  private formatFields(metadata: DOIMetadata): string[] {
    const fields: string[] = [];

    fields.push(`title = {{${this.escapeLatex(metadata.title)}}},`);

    const authorList = this.formatAuthors(metadata.authors);
    if (authorList) {
      fields.push(`author = {${this.escapeLatex(authorList)}},`);
    }

    if (metadata.year) {
      fields.push(`year = {${metadata.year}},`);
    }

    if (metadata.journal) {
      fields.push(`journal = {${this.escapeLatex(metadata.journal)}},`);
    }

    if (metadata.publisher) {
      fields.push(`publisher = {${this.escapeLatex(metadata.publisher)}},`);
    }

    if (metadata.volume) {
      fields.push(`volume = {${metadata.volume}},`);
    }

    if (metadata.issue) {
      fields.push(`number = {${metadata.issue}},`);
    }

    if (metadata.pages) {
      fields.push(`pages = {${metadata.pages}},`);
    }

    fields.push(`doi = {${metadata.doi}},`);

    if (metadata.url) {
      fields.push(`url = {${metadata.url}},`);
    }

    return fields;
  }

  private formatAuthors(authors: AuthorInfo[]): string {
    return authors
      .map(author => {
        if (author.familyName && author.givenName) {
          return `${author.familyName}, ${author.givenName}`;
        } else if (author.familyName) {
          return author.familyName;
        } else if (author.fullName) {
          // Fallback: try to parse fullName into Last, First format
          const parts = author.fullName.trim().split(' ');
          if (parts.length >= 2) {
            const firstName = parts.slice(0, -1).join(' ');
            const lastName = parts[parts.length - 1];
            return `${lastName}, ${firstName}`;
          }
          return author.fullName;
        }
        return 'Unknown';
      })
      .join(' and ');
  }

  private escapeLatex(text: string): string {
    return escapeLatex(text);
  }

  parseBibTeX(bibtex: string): {
    type?: string;
    key?: string;
    fields: Record<string, string>;
  } {
    const match = bibtex.match(/@(\w+)\{([^,]+),/);
    if (!match) {
      return { fields: {} };
    }

    const type = match[1];
    const key = match[2];
    const fields: Record<string, string> = {};

    const fieldRegex = /(\w+)\s*=\s*\{([^}]+)\}/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(bibtex)) !== null) {
      fields[fieldMatch[1]] = fieldMatch[2];
    }

    return { type, key, fields };
  }
}