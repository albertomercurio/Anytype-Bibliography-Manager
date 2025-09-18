import { distance } from 'fastest-levenshtein';
import { AnytypeObject } from '../types/anytype';
import { AnytypeClient } from '../anytype/client';

export interface DuplicateCandidate {
  object: AnytypeObject;
  similarity: number;
  matchType: 'exact' | 'high' | 'medium' | 'low';
  matchReason: string;
}

// Helper function to normalize text for comparison (remove accents, punctuation, etc.)
function normalizeText(text: string): string {
  return text
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Helper function to calculate similarity between two strings (0-1)
function compareStrings(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 && str2.length === 0) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;
  
  // First try normalized comparison
  const norm1 = normalizeText(str1);
  const norm2 = normalizeText(str2);
  
  if (norm1 === norm2) return 1.0; // Perfect match for normalized text (same semantic meaning)
  
  const maxLength = Math.max(str1.length, str2.length);
  const editDistance = distance(norm1, norm2);
  return 1 - (editDistance / maxLength);
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

      // First, try to match using structured first_name/last_name properties
      if (lastName && personLastName) {
        const lastNameSimilarity = compareStrings(
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

      // Fallback: check full name similarity (important for objects with only main name field)
      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      if (fullName && personName) {
        const fullNameSimilarity = compareStrings(
          fullName.toLowerCase(),
          personName.toLowerCase()
        );
        if (fullNameSimilarity > similarity) {
          similarity = fullNameSimilarity;
          matchReason = 'Full name similarity with main name field';
        }
      }

      // Additional fallback: if structured properties are empty, parse the main name
      if (similarity === 0 && personName && (!personFirstName && !personLastName)) {
        const parsedName = this.parseFullName(personName);
        if (parsedName.lastName && lastName) {
          const lastNameSim = compareStrings(
            lastName.toLowerCase(),
            parsedName.lastName.toLowerCase()
          );
          
          if (lastNameSim >= 0.95) {
            if (firstName && parsedName.firstName) {
              const firstNameSim = this.compareFirstNames(firstName, parsedName.firstName);
              similarity = (lastNameSim + firstNameSim) / 2;
              matchReason = 'Parsed name match from main name field';
            } else {
              similarity = lastNameSim * 0.7;
              matchReason = 'Parsed last name match from main name field';
            }
          }
        }
      }

      // For person matching, use a lower threshold to catch more potential matches
      // since names can have variations, abbreviations, etc.
      const personThreshold = Math.min(this.threshold * 0.7, 0.6);
      
      if (similarity >= personThreshold) {
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

      const similarity = compareStrings(
        normalizedInput,
        normalizedJournal
      );

      let matchReason = '';
      let isAbbreviation = false;
      
      if (similarity === 1.0) {
        matchReason = 'Exact name match';
        isAbbreviation = false; // Exact match takes precedence over abbreviation
      } else if (this.areJournalAbbreviations(name, journalName)) {
        matchReason = 'Known abbreviation match';
        isAbbreviation = true;
      } else if (similarity >= 0.9) {
        matchReason = 'Very similar name';
      } else if (similarity >= this.threshold) {
        matchReason = 'Similar name';
      }

      if (similarity >= this.threshold || isAbbreviation) {
        candidates.push({
          object: journal,
          similarity: isAbbreviation ? 0.95 : similarity,
          matchType: isAbbreviation ? 'high' : this.getMatchType(similarity),
          matchReason: isAbbreviation ? 'Known abbreviation match' : matchReason
        });
      }
    }

    return candidates.sort((a, b) => b.similarity - a.similarity);
  }

  private compareFirstNames(name1: string, name2: string): number {
    const n1 = normalizeText(name1);
    const n2 = normalizeText(name2);

    if (n1 === n2) return 1.0;

    if (this.isAbbreviation(n1, n2) || this.isAbbreviation(n2, n1)) {
      return 0.85;
    }

    return compareStrings(name1, name2);
  }

  private isAbbreviation(abbr: string, full: string): boolean {
    // Normalize both strings for comparison
    const normAbbr = normalizeText(abbr);
    const normFull = normalizeText(full);
    
    if (normAbbr.length > normFull.length) return false;

    let checkAbbr = normAbbr;
    if (checkAbbr.endsWith('.')) {
      checkAbbr = checkAbbr.slice(0, -1);
    }

    if (checkAbbr.length === 1) {
      return normFull.startsWith(checkAbbr);
    }

    const abbrParts = checkAbbr.split(/[\s.-]+/);
    const fullParts = normFull.split(/[\s-]+/);

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
      'physical review letters': ['phys rev lett', 'prl', 'phys. rev. lett.', 'phys rev lett.'],
      'physical review x': ['phys rev x', 'prx', 'phys. rev. x', 'phys rev x.'],
      'physical review a': ['phys rev a', 'pra', 'phys. rev. a', 'physical review a'],
      'physical review b': ['phys rev b', 'prb', 'phys. rev. b', 'physical review b'],
      'physical review d': ['phys rev d', 'prd', 'phys. rev. d', 'physical review d'],
      'physical review e': ['phys rev e', 'pre', 'phys. rev. e', 'physical review e'],
      'reviews of modern physics': ['rev mod phys', 'rmp', 'rev. mod. phys.'],
      'nature': ['nat', 'nat.'],
      'science': ['sci', 'sci.'],
      'nature physics': ['nat phys', 'nat. phys.', 'nature phys'],
      'nature communications': ['nat commun', 'nat. commun.', 'nature commun', 'nat. communications'],
      'nature methods': ['nat methods', 'nat. methods', 'nature methods'],
      'journal of the american chemical society': ['j am chem soc', 'jacs', 'j. am. chem. soc.'],
      'angewandte chemie': ['angew chem', 'angew. chem.', 'angewandte chemie international edition'],
      'proceedings of the national academy of sciences': ['proc natl acad sci', 'pnas', 'proc. natl. acad. sci.']
    };

    const n1 = this.normalizeJournalName(name1);
    const n2 = this.normalizeJournalName(name2);

    for (const [full, abbrevs] of Object.entries(commonAbbreviations)) {
      const normalizedFull = this.normalizeJournalName(full);
      const normalizedAbbrevs = abbrevs.map(a => this.normalizeJournalName(a));

      if ((n1 === normalizedFull && normalizedAbbrevs.includes(n2)) ||
          (n2 === normalizedFull && normalizedAbbrevs.includes(n1)) ||
          (normalizedAbbrevs.includes(n1) && normalizedAbbrevs.includes(n2))) {
        return true;
      }
    }

    return false;
  }

  private parseFullName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/);
    
    if (parts.length === 0) {
      return { firstName: '', lastName: '' };
    } else if (parts.length === 1) {
      return { firstName: '', lastName: parts[0] };
    } else if (parts.length === 2) {
      return { firstName: parts[0], lastName: parts[1] };
    } else {
      // For 3+ parts, use heuristics to identify compound last names
      // Common patterns: "Di", "De", "Van", "Von", "Del", "Da", "La", "Le", etc.
      const lastNamePrefixes = new Set(['di', 'de', 'van', 'von', 'del', 'da', 'la', 'le', 'el', 'al', 'bin', 'ibn', 'mac', 'mc', 'o', 'san', 'santa']);
      
      // Find the start of the last name (look for prefixes)
      let lastNameStartIndex = parts.length - 1;
      
      for (let i = parts.length - 2; i >= 1; i--) {
        const part = parts[i].toLowerCase();
        if (lastNamePrefixes.has(part) || part.endsWith('.')) {
          lastNameStartIndex = i;
        } else {
          break;
        }
      }
      
      const lastName = parts.slice(lastNameStartIndex).join(' ');
      const firstName = parts.slice(0, lastNameStartIndex).join(' ');
      return { firstName, lastName };
    }
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