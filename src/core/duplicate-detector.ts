import * as stringSimilarity from 'string-similarity';
import { AnytypeObject } from '../types/anytype';
import { AnytypeClient } from '../anytype/client';

export interface DuplicateCandidate {
  object: AnytypeObject;
  similarity: number;
  matchType: 'exact' | 'high' | 'medium' | 'low';
  matchReason: string;
}

export class DuplicateDetector {
  private threshold: number;
  private client: AnytypeClient;

  constructor(client: AnytypeClient, threshold = 0.8) {
    this.client = client;
    this.threshold = threshold;
  }

  async checkArticleDuplicate(doi: string): Promise<DuplicateCandidate[]> {
    const existingArticles = await this.client.searchArticlesByDOI(doi);

    if (existingArticles.length > 0) {
      return existingArticles.map(article => ({
        object: article,
        similarity: 1.0,
        matchType: 'exact',
        matchReason: 'Exact DOI match'
      }));
    }

    return [];
  }

  async checkPersonDuplicate(
    lastName: string,
    firstName?: string,
    orcid?: string
  ): Promise<DuplicateCandidate[]> {
    const candidates: DuplicateCandidate[] = [];

    if (orcid) {
      const orcidMatches = await this.client.searchPersonsByOrcid(orcid);
      candidates.push(...orcidMatches.map(person => ({
        object: person,
        similarity: 1.0,
        matchType: 'exact' as const,
        matchReason: 'Exact ORCID match'
      })));
    }

    const nameMatches = await this.client.searchPersonsByName(lastName);

    for (const person of nameMatches) {
      if (candidates.some(c => c.object.id === person.id)) continue;

      const personLastName = this.getPropertyValue(person, 'last_name') || '';
      const personFirstName = this.getPropertyValue(person, 'first_name') || '';
      const personName = person.name || '';

      let similarity = 0;
      let matchReason = '';

      if (lastName && personLastName) {
        const lastNameSimilarity = stringSimilarity.compareTwoStrings(
          lastName.toLowerCase(),
          personLastName.toLowerCase()
        );

        if (lastNameSimilarity >= 0.95) {
          if (firstName && personFirstName) {
            const firstNameSimilarity = this.compareFirstNames(firstName, personFirstName);
            similarity = (lastNameSimilarity + firstNameSimilarity) / 2;

            if (firstNameSimilarity >= 0.95) {
              matchReason = 'Full name match';
            } else if (firstNameSimilarity >= 0.5) {
              matchReason = 'Last name match, possible first name abbreviation';
            } else {
              matchReason = 'Last name match only';
            }
          } else {
            similarity = lastNameSimilarity * 0.7;
            matchReason = 'Last name match only';
          }
        }
      }

      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      if (fullName && personName) {
        const fullNameSimilarity = stringSimilarity.compareTwoStrings(
          fullName.toLowerCase(),
          personName.toLowerCase()
        );
        if (fullNameSimilarity > similarity) {
          similarity = fullNameSimilarity;
          matchReason = 'Full name similarity';
        }
      }

      if (similarity >= this.threshold * 0.8) {
        candidates.push({
          object: person,
          similarity,
          matchType: this.getMatchType(similarity),
          matchReason
        });
      }
    }

    return candidates.sort((a, b) => b.similarity - a.similarity);
  }

  async checkJournalDuplicate(name: string): Promise<DuplicateCandidate[]> {
    const existingJournals = await this.client.searchJournalsByName(name);
    const candidates: DuplicateCandidate[] = [];

    const normalizedInput = this.normalizeJournalName(name);

    for (const journal of existingJournals) {
      const journalName = journal.name || '';
      const normalizedJournal = this.normalizeJournalName(journalName);

      const similarity = stringSimilarity.compareTwoStrings(
        normalizedInput,
        normalizedJournal
      );

      let matchReason = '';
      if (similarity === 1.0) {
        matchReason = 'Exact name match';
      } else if (this.areJournalAbbreviations(name, journalName)) {
        matchReason = 'Possible abbreviation match';
      } else if (similarity >= 0.9) {
        matchReason = 'Very similar name';
      } else if (similarity >= this.threshold) {
        matchReason = 'Similar name';
      }

      if (similarity >= this.threshold || this.areJournalAbbreviations(name, journalName)) {
        candidates.push({
          object: journal,
          similarity: similarity === 1.0 ? 1.0 : Math.max(similarity, 0.85),
          matchType: this.getMatchType(similarity),
          matchReason
        });
      }
    }

    return candidates.sort((a, b) => b.similarity - a.similarity);
  }

  private compareFirstNames(name1: string, name2: string): number {
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();

    if (n1 === n2) return 1.0;

    if (this.isAbbreviation(n1, n2) || this.isAbbreviation(n2, n1)) {
      return 0.85;
    }

    return stringSimilarity.compareTwoStrings(n1, n2);
  }

  private isAbbreviation(abbr: string, full: string): boolean {
    if (abbr.length > full.length) return false;

    if (abbr.endsWith('.')) {
      abbr = abbr.slice(0, -1);
    }

    if (abbr.length === 1) {
      return full.startsWith(abbr);
    }

    const abbrParts = abbr.split(/[\s.-]+/);
    const fullParts = full.split(/[\s-]+/);

    if (abbrParts.length > fullParts.length) return false;

    return abbrParts.every((part, i) => {
      if (i >= fullParts.length) return false;
      return fullParts[i].startsWith(part);
    });
  }

  private normalizeJournalName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private areJournalAbbreviations(name1: string, name2: string): boolean {
    const commonAbbreviations: Record<string, string[]> = {
      'physical review letters': ['phys rev lett', 'prl', 'phys. rev. lett.'],
      'physical review x': ['phys rev x', 'prx', 'phys. rev. x'],
      'nature': ['nat', 'nat.'],
      'science': ['sci', 'sci.'],
      'nature physics': ['nat phys', 'nat. phys.', 'nature phys'],
      'nature communications': ['nat commun', 'nat. commun.', 'nature commun']
    };

    const n1 = name1.toLowerCase();
    const n2 = name2.toLowerCase();

    for (const [full, abbrevs] of Object.entries(commonAbbreviations)) {
      if ((n1 === full && abbrevs.includes(n2)) ||
          (n2 === full && abbrevs.includes(n1)) ||
          (abbrevs.includes(n1) && abbrevs.includes(n2))) {
        return true;
      }
    }

    return false;
  }

  private getMatchType(similarity: number): 'exact' | 'high' | 'medium' | 'low' {
    if (similarity >= 0.99) return 'exact';
    if (similarity >= 0.9) return 'high';
    if (similarity >= 0.8) return 'medium';
    return 'low';
  }

  private getPropertyValue(obj: AnytypeObject, key: string): string | undefined {
    const prop = obj.properties?.find(p => p.key === key);
    if (!prop) return undefined;

    switch (prop.format) {
      case 'text':
      case 'url':
      case 'email':
        return prop[prop.format] || prop.value;
      case 'number':
        return prop.number?.toString();
      default:
        return prop.value;
    }
  }
}