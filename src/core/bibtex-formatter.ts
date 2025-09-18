import { DOIMetadata } from '../types/crossref';

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
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .replace(/^(the|a|an)\b/i, '');
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

    const authorList = metadata.authors
      .map(author => author.fullName)
      .join(' and ');
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

  private escapeLatex(text: string): string {
    return text
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/[&%$#_{}]/g, '\\$&')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
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