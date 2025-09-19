import { distance } from 'fastest-levenshtein';
import { AnytypeObject } from '../types/anytype';
import { AnytypeClient } from '../anytype/client';
import { normalizeText, isAbbreviation, parseFullName } from '../utils/text-utils';

export interface DuplicateCandidate {
  object: AnytypeObject;
  similarity: number;
  matchType: 'exact' | 'high' | 'medium' | 'low';
  matchReason: string;
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

    // Step 1: Check ORCID first if available
    if (orcid) {
      const orcidMatches = await this.client.searchPersonsByOrcid(orcid);
      candidates.push(...orcidMatches.map(person => ({
        object: person,
        similarity: 1.0,
        matchType: 'exact' as const,
        matchReason: 'Exact ORCID match'
      })));
    }

    // Step 2: Get all people and iterate over them
    const allPeople = await this.getAllPeople();

    for (const person of allPeople) {
      // Skip if already found by ORCID
      if (candidates.some(c => c.object.id === person.id)) continue;

      const personLastName = this.getPropertyValue(person, 'last_name') || '';
      const personFirstName = this.getPropertyValue(person, 'first_name') || '';
      const personName = person.name || '';

      let similarity = 0;
      let matchReason = '';

      // Step 3: Check what data is available and use appropriate strategy
      if (personLastName || personFirstName) {
        // Case A: Person has structured first_name/last_name properties - use them
        const lastNameSimilarity = lastName && personLastName
          ? compareStrings(normalizeText(lastName), normalizeText(personLastName))
          : 0;

        const firstNameSimilarity = firstName && personFirstName
          ? this.compareFirstNames(firstName, personFirstName)
          : 0;

        if (lastNameSimilarity >= 0.95) {
          if (firstName && personFirstName) {
            similarity = (lastNameSimilarity + firstNameSimilarity) / 2;
            if (firstNameSimilarity >= 0.95) {
              matchReason = 'Full name match (structured properties)';
            } else if (firstNameSimilarity >= 0.5) {
              matchReason = 'Last name match, possible first name abbreviation (structured)';
            } else {
              matchReason = 'Last name match, different first name (structured)';
            }
          } else if (firstName && !personFirstName) {
            similarity = lastNameSimilarity * 0.8;
            matchReason = 'Last name match, first name not stored (structured)';
          } else {
            similarity = lastNameSimilarity * 0.9;
            matchReason = 'Last name match only (structured)';
          }
        } else if (lastNameSimilarity >= 0.8) {
          similarity = lastNameSimilarity * 0.7;
          matchReason = 'Similar last name (structured)';
        }
      } else if (personName) {
        // Case B: Person only has full name field - compare against that
        const fullSearchName = [firstName, lastName].filter(Boolean).join(' ');
        const fullNameSimilarity = compareStrings(
          normalizeText(fullSearchName),
          normalizeText(personName)
        );

        // Also try parsing the full name to compare parts
        const parsedName = this.parseFullName(personName);
        let parsedSimilarity = 0;

        if (parsedName.lastName && lastName) {
          const parsedLastSim = compareStrings(
            normalizeText(lastName),
            normalizeText(parsedName.lastName)
          );

          if (firstName && parsedName.firstName) {
            const parsedFirstSim = this.compareFirstNames(firstName, parsedName.firstName);
            parsedSimilarity = (parsedLastSim + parsedFirstSim) / 2;
          } else {
            parsedSimilarity = parsedLastSim * 0.8;
          }
        }

        // Use the best similarity from full name comparison approaches
        similarity = Math.max(fullNameSimilarity, parsedSimilarity);

        if (similarity >= 0.95) {
          if (parsedSimilarity > fullNameSimilarity) {
            matchReason = 'Parsed name match from full name field';
          } else {
            matchReason = 'Full name field match';
          }
        } else if (similarity >= 0.8) {
          matchReason = 'Similar full name';
        }
      }
      // Case C: Person has neither structured properties nor full name - skip

      // Only add candidates above threshold
      const personThreshold = 0.6;
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
    return isAbbreviation(abbr, full);
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
    return parseFullName(fullName);
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

  // New method to get all people with pagination
  private async getAllPeople(): Promise<AnytypeObject[]> {
    let allPeople: AnytypeObject[] = [];
    let hasMore = true;
    let offset = 0;
    const limit = 100;

    while (hasMore) {
      try {
        const results = await this.client.searchByType(this.client.getTypeKeys().person, limit, offset);
        
        if (results.length === 0) {
          hasMore = false;
        } else {
          allPeople = allPeople.concat(results);
          offset += limit;
          
          // Safety check to prevent infinite loops
          if (allPeople.length >= 1000) {
            console.warn('Reached safety limit of 1000 people, stopping pagination');
            hasMore = false;
          }
          
          // If we got less than the limit, we're probably at the end
          if (results.length < limit) {
            hasMore = false;
          }
        }
      } catch (error) {
        console.error('Error fetching people page:', error);
        hasMore = false;
      }
    }

    return allPeople;
  }
}