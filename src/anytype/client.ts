import axios, { AxiosInstance } from 'axios';
import { AnytypeObject } from '../types/anytype';
import { ConfigManager } from '../core/config-manager';

export class AnytypeClient {
  private client: AxiosInstance;
  private spaceId: string;
  private typeKeys: {
    article: string;
    person: string;
    journal: string;
    book: string;
  };

  constructor() {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();

    if (!config) {
      throw new Error('Configuration not found. Please run "anytype-bib setup" first.');
    }

    const { apiKey, host, port, spaceId } = config.anytype;

    if (!apiKey) {
      throw new Error('Anytype API key not configured. Please run "anytype-bib setup".');
    }

    if (!spaceId) {
      throw new Error('Anytype Space ID not configured. Please run "anytype-bib setup".');
    }

    this.spaceId = spaceId;

    // Use type keys from config, fallback to defaults
    this.typeKeys = {
      article: config.typeKeys?.article || 'reference',
      person: config.typeKeys?.person || 'human',
      journal: config.typeKeys?.journal || 'journal',
      book: config.typeKeys?.book || 'book'
    };

    this.client = axios.create({
      baseURL: `http://${host}:${port}/v1`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Anytype-Version': '2025-05-20'
      }
    });
  }

  getTypeKeys() {
    return this.typeKeys;
  }

  async searchObjects(filters: any[], limit = 100, offset = 0): Promise<AnytypeObject[]> {
    try {
      const response = await this.client.post(`/spaces/${this.spaceId}/search?limit=${limit}&offset=${offset}`, {
        filters
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Error searching objects:', error);
      return [];
    }
  }

  async searchByType(typeKey: string, limit = 100, offset = 0): Promise<AnytypeObject[]> {
    try {
      const response = await this.client.post(`/spaces/${this.spaceId}/search?limit=${limit}&offset=${offset}`, {
        types: [typeKey],
        sort: {
          property_key: 'last_modified_date',
          direction: 'desc'
        }
      });

      return response.data.data || [];
    } catch (error) {
      console.error('Error searching by type:', error);
      return [];
    }
  }

  async discoverObjectTypes(): Promise<{ [typeName: string]: string }> {
    try {
      // Get all object types available in the space
      const response = await this.client.get(`/spaces/${this.spaceId}/types`);
      const types = response.data.data || [];

      const typeMap: { [typeName: string]: string } = {};
      const targetTypes = ['article', 'person', 'journal', 'book', 'human'];

      for (const type of types) {
        const typeName = type.name?.toLowerCase();
        const typeKey = type.key;

        if (!typeName || !typeKey) continue;

        // Map common variations to our expected names
        if (typeName.includes('article') || typeName.includes('paper') || typeName.includes('reference')) {
          typeMap['article'] = typeKey;
        } else if (typeName.includes('person') || typeName.includes('author') || typeName.includes('human') || typeName.includes('people')) {
          typeMap['person'] = typeKey;
        } else if (typeName.includes('journal') || typeName.includes('publication')) {
          typeMap['journal'] = typeKey;
        } else if (typeName.includes('book')) {
          typeMap['book'] = typeKey;
        }

        // Also check for exact matches with our target types
        if (targetTypes.includes(typeName)) {
          if (typeName === 'human') {
            typeMap['person'] = typeKey;
          } else {
            typeMap[typeName] = typeKey;
          }
        }
      }

      return typeMap;
    } catch (error) {
      console.error('Error discovering object types:', error);
      return {};
    }
  }

  async searchArticlesByDOI(doi: string): Promise<AnytypeObject[]> {
    try {
      // Try searching with the DOI as query first
      const response = await this.client.post(`/spaces/${this.spaceId}/search?limit=100`, {
        query: doi,
        types: [this.typeKeys.article]
      });

      let results = response.data.data || [];

      // Filter for exact DOI match
      const exactMatches = results.filter((obj: any) => {
        const doiProp = obj.properties?.find((p: any) => p.key === 'doi');
        if (!doiProp) return false;

        const objDoi = doiProp.text || doiProp.value || '';
        return objDoi.toLowerCase() === doi.toLowerCase();
      });

      // If we found exact matches, return them
      if (exactMatches.length > 0) {
        return exactMatches;
      }

      // Otherwise, do a broader search without query to catch all articles
      // But limit to reasonable number with pagination
      let allArticles: any[] = [];
      let hasMore = true;
      let offset = 0;
      const limit = 100;

      while (hasMore && allArticles.length < 500) {
        try {
          const response = await this.client.post(`/spaces/${this.spaceId}/search?limit=${limit}&offset=${offset}`, {
            types: [this.typeKeys.article]
          });

          const pageResults = response.data.data || [];
          hasMore = response.data.has_more || false;
          offset += limit;

          allArticles = allArticles.concat(pageResults);
        } catch (error) {
          console.error('Error in article pagination:', error);
          break;
        }
      }

      // Filter for exact DOI match
      return allArticles.filter((obj: any) => {
        const doiProp = obj.properties?.find((p: any) => p.key === 'doi');
        if (!doiProp) return false;

        const objDoi = doiProp.text || doiProp.value || '';
        return objDoi.toLowerCase() === doi.toLowerCase();
      });
    } catch (error) {
      console.error('Error searching articles by DOI:', error);
      return [];
    }
  }

  async searchPersonsByName(lastName: string, firstName?: string): Promise<AnytypeObject[]> {
    try {
      let allResults: AnytypeObject[] = [];
      const seenIds = new Set<string>();

      // Helper to normalize text by removing accents
      const removeAccents = (text: string): string => {
        return text
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
      };

      // Strategy 1: Try query-based searches with different accent variations
      // This catches results the API can find through its text search
      const searchQueries = new Set<string>();
      const fullName = [firstName, lastName].filter(Boolean).join(' ');

      searchQueries.add(fullName);
      searchQueries.add(removeAccents(fullName));

      if (lastName) {
        searchQueries.add(lastName);
        searchQueries.add(removeAccents(lastName));
      }

      for (const searchQuery of searchQueries) {
        let hasMore = true;
        let offset = 0;
        const limit = 100;

        while (hasMore && allResults.length < 500) {
          try {
            const response = await this.client.post(`/spaces/${this.spaceId}/search?limit=${limit}&offset=${offset}`, {
              query: searchQuery,
              types: [this.typeKeys.person],
              sort: {
                property_key: 'last_modified_date',
                direction: 'desc'
              }
            });

            const results = response.data.data || [];
            hasMore = response.data.has_more || false;
            offset += limit;

            for (const result of results) {
              if (!seenIds.has(result.id)) {
                seenIds.add(result.id);
                allResults.push(result);
              }
            }

            if (allResults.length >= 500 || !hasMore) break;
          } catch (error) {
            break;
          }
        }
      }

      // Strategy 2: Also fetch all persons (up to a reasonable limit) to ensure
      // we don't miss results due to accent handling issues in the API
      let hasMore = true;
      let offset = 0;
      const limit = 100;

      while (hasMore && allResults.length < 1000) {
        try {
          const response = await this.client.post(`/spaces/${this.spaceId}/search?limit=${limit}&offset=${offset}`, {
            types: [this.typeKeys.person],
            sort: {
              property_key: 'last_modified_date',
              direction: 'desc'
            }
          });

          const results = response.data.data || [];
          hasMore = response.data.has_more || false;
          offset += limit;

          for (const result of results) {
            if (!seenIds.has(result.id)) {
              seenIds.add(result.id);
              allResults.push(result);
            }
          }

          if (!hasMore) break;
        } catch (error) {
          break;
        }
      }


      // Helper function to normalize text for comparison
      const normalizeText = (text: string): string => {
        return text
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      // Helper function to check if a name is an abbreviation of another
      const isAbbreviation = (abbr: string, full: string): boolean => {
        const normAbbr = normalizeText(abbr);
        const normFull = normalizeText(full);

        if (normAbbr.length > normFull.length) return false;

        // Single letter abbreviation
        if (normAbbr.length === 1) {
          return normFull.startsWith(normAbbr);
        }

        // Multi-part abbreviation (e.g., "J. P." for "Jean Pierre")
        const abbrParts = normAbbr.split(/[\s.-]+/);
        const fullParts = normFull.split(/[\s-]+/);

        if (abbrParts.length > fullParts.length) return false;

        return abbrParts.every((part, i) => {
          if (i >= fullParts.length) return false;
          return fullParts[i].startsWith(part);
        });
      };

      // Filter results for better matching
      if (!lastName) return allResults;

      return allResults.filter((obj: any) => {
        const lastNameProp = obj.properties?.find((p: any) => p.key === 'last_name');
        const lastNameValue = lastNameProp?.text || lastNameProp?.value || '';

        const firstNameProp = obj.properties?.find((p: any) => p.key === 'first_name');
        const firstNameValue = firstNameProp?.text || firstNameProp?.value || '';

        const mainName = obj.name || '';

        // Normalize with accent removal for comparison
        const normalizedSearchLast = normalizeText(lastName);
        const normalizedSearchFirst = firstName ? normalizeText(firstName) : '';
        const normalizedStoredLast = normalizeText(lastNameValue);
        const normalizedStoredFirst = normalizeText(firstNameValue);
        const normalizedMainName = normalizeText(mainName);

        // Strategy 1: Check structured properties if they exist
        if (lastNameValue) {
          const lastMatch = normalizedSearchLast === normalizedStoredLast;

          if (!firstName) {
            // Only last name provided, match on last name
            return lastMatch;
          }

          if (firstNameValue) {
            // Both names provided and stored, check for match or abbreviation
            const firstMatch = normalizedSearchFirst === normalizedStoredFirst ||
                             isAbbreviation(normalizedSearchFirst, normalizedStoredFirst) ||
                             isAbbreviation(normalizedStoredFirst, normalizedSearchFirst);
            return lastMatch && firstMatch;
          }

          // Last name matches but no first name in storage - partial match
          return lastMatch;
        }

        // Strategy 2: Parse and check the main name field
        if (mainName) {
          const mainNameWords = normalizedMainName.split(/\s+/);
          const searchFullName = [normalizedSearchFirst, normalizedSearchLast].filter(Boolean).join(' ');
          const searchWords = searchFullName.split(/\s+/);

          // Check for exact full name match
          if (normalizedMainName === searchFullName) return true;

          // Check if all search words appear in main name (handling abbreviations)
          const allSearchWordsFound = searchWords.every(searchWord =>
            mainNameWords.some(mainWord =>
              mainWord === searchWord ||
              isAbbreviation(searchWord, mainWord) ||
              isAbbreviation(mainWord, searchWord)
            )
          );

          if (allSearchWordsFound) return true;

          // Special case: Check if last name appears as a complete word
          const lastNameFound = mainNameWords.some(word =>
            word === normalizedSearchLast ||
            (word.includes(normalizedSearchLast) && word.length <= normalizedSearchLast.length + 2)
          );

          if (!firstName) return lastNameFound;

          // If first name provided, check both
          const firstNameFound = mainNameWords.some(word =>
            word === normalizedSearchFirst ||
            isAbbreviation(normalizedSearchFirst, word) ||
            isAbbreviation(word, normalizedSearchFirst)
          );

          return lastNameFound && firstNameFound;
        }

        return false;
      });
    } catch (error) {
      console.error('Error searching persons by name:', error);
      return [];
    }
  }

  async searchPersonsByOrcid(orcid: string): Promise<AnytypeObject[]> {
    try {
      // First try searching with ORCID as query
      const response = await this.client.post(`/spaces/${this.spaceId}/search?limit=100`, {
        query: orcid,
        types: [this.typeKeys.person]
      });

      const results = response.data.data || [];

      // Filter for exact ORCID match
      const exactMatches = results.filter((obj: any) => {
        const orcidProp = obj.properties?.find((p: any) => p.key === 'orcid');
        if (!orcidProp) return false;

        const objOrcid = orcidProp.text || orcidProp.value || '';
        return objOrcid === orcid;
      });

      return exactMatches;
    } catch (error) {
      console.error('Error searching persons by ORCID:', error);
      return [];
    }
  }

  async searchJournalsByName(name: string): Promise<AnytypeObject[]> {
    try {
      let allResults: AnytypeObject[] = [];
      const seenIds = new Set<string>();
      let hasMore = true;
      let offset = 0;
      const limit = 100;

      // First try with query search
      while (hasMore) {
        try {
          const response = await this.client.post(`/spaces/${this.spaceId}/search?limit=${limit}&offset=${offset}`, {
            query: name,
            types: [this.typeKeys.journal],
            sort: {
              property_key: 'last_modified_date',
              direction: 'desc'
            }
          });

          const results = response.data.data || [];
          hasMore = response.data.has_more || false;
          offset += limit;

          // Deduplicate by ID
          for (const result of results) {
            if (!seenIds.has(result.id)) {
              seenIds.add(result.id);
              allResults.push(result);
            }
          }

          // Stop if we have enough results
          if (allResults.length >= 200 || !hasMore) break;
        } catch (error) {
          console.error('Error in journal search pagination:', error);
          break;
        }
      }

      // If no results, get all journals for similarity checking
      if (allResults.length === 0) {
        hasMore = true;
        offset = 0;

        while (hasMore) {
          try {
            const response = await this.client.post(`/spaces/${this.spaceId}/search?limit=${limit}&offset=${offset}`, {
              types: [this.typeKeys.journal]
            });

            const results = response.data.data || [];
            hasMore = response.data.has_more || false;
            offset += limit;

            for (const result of results) {
              if (!seenIds.has(result.id)) {
                seenIds.add(result.id);
                allResults.push(result);
              }
            }

            // Stop if we have enough results
            if (allResults.length >= 200 || !hasMore) break;
          } catch (error) {
            console.error('Error in journal fallback search:', error);
            break;
          }
        }
      }

      return allResults;
    } catch (error) {
      console.error('Error searching journals by name:', error);
      return [];
    }
  }

  async createObject(typeKey: string, name: string, properties: Array<{ key: string; [key: string]: any }>): Promise<string | null> {
    try {
      const requestBody: any = {
        type_key: typeKey,
        name
      };

      if (properties.length > 0) {
        requestBody.properties = properties;
      }

      const response = await this.client.post(`/spaces/${this.spaceId}/objects`, requestBody);
      return response.data.object?.id || null;
    } catch (error: any) {
      console.error('Error creating object:', error.response?.data || error.message);
      return null;
    }
  }

  async updateObject(objectId: string, properties: Record<string, any>): Promise<boolean> {
    try {
      await this.client.patch(`/spaces/${this.spaceId}/objects/${objectId}`, {
        properties
      });
      return true;
    } catch (error: any) {
      console.error('Error updating object:', error.response?.data || error.message);
      return false;
    }
  }

  async createArticle(article: {
    title: string;
    doi: string;
    authors?: string[];
    year?: number;
    journal?: string;
    url?: string;
    bibtex?: string;
  }): Promise<string | null> {
    const properties: Array<{ key: string; [key: string]: any }> = [
      { key: 'title', text: article.title },
      { key: 'doi', text: article.doi.toLowerCase() }
    ];

    if (article.authors?.length) {
      properties.push({ key: 'authors', objects: article.authors });
    }
    if (article.year) {
      properties.push({ key: 'year', number: article.year });
    }
    if (article.journal) {
      properties.push({ key: 'journal', objects: [article.journal] });
    }
    if (article.url) {
      properties.push({ key: 'url', url: article.url });
    }
    if (article.bibtex) {
      properties.push({ key: 'bib_te_x', text: article.bibtex });
    }

    return this.createObject(this.typeKeys.article, article.title, properties);
  }

  async createPerson(person: {
    firstName?: string;
    lastName?: string;
    orcid?: string;
    email?: string;
  }): Promise<string | null> {
    const name = [person.firstName, person.lastName].filter(Boolean).join(' ');
    const properties: Array<{ key: string; [key: string]: any }> = [];

    if (person.firstName) {
      properties.push({ key: 'first_name', text: person.firstName });
    }
    if (person.lastName) {
      properties.push({ key: 'last_name', text: person.lastName });
    }
    if (person.orcid) {
      properties.push({ key: 'orcid', text: person.orcid });
    }
    if (person.email) {
      properties.push({ key: 'email', email: person.email });
    }

    return this.createObject(this.typeKeys.person, name, properties);
  }

  async createJournal(name: string): Promise<string | null> {
    return this.createObject(this.typeKeys.journal, name, []);
  }

  async createBook(book: {
    title: string;
    authors?: string[];
    year?: number;
    bibtex?: string;
  }): Promise<string | null> {
    const properties: Array<{ key: string; [key: string]: any }> = [];

    if (book.authors?.length) {
      properties.push({ key: 'authors', objects: book.authors });
    }
    if (book.year) {
      properties.push({ key: 'year', number: book.year });
    }
    if (book.bibtex) {
      properties.push({ key: 'bib_te_x', text: book.bibtex });
    }

    return this.createObject(this.typeKeys.book, book.title, properties);
  }
}