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
      const response = await this.client.post(`/spaces/${this.spaceId}/search`, {
        filters,
        limit,
        offset
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Error searching objects:', error);
      return [];
    }
  }

  async searchByType(typeKey: string, limit = 100, offset = 0): Promise<AnytypeObject[]> {
    try {
      const response = await this.client.post(`/spaces/${this.spaceId}/search`, {
        types: [typeKey],
        limit,
        offset,
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
      const response = await this.client.post(`/spaces/${this.spaceId}/search`, {
        types: [this.typeKeys.article],
        limit: 1000  // Increase limit to get more results
      });

      const results = response.data.data || [];
      // Filter client-side since API property filters don't work
      return results.filter((obj: any) => {
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
      // Helper function to generate accent variations
      const generateAccentVariations = (text: string): string[] => {
        const variations = new Set([text]); // Start with original
        
        // Add normalized version (no accents)
        const normalized = text
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        variations.add(normalized);
        
        // Add common accent variations for specific characters
        const accentMap: { [key: string]: string[] } = {
          'a': ['a', 'à', 'á', 'â', 'ã', 'ä', 'å'],
          'e': ['e', 'è', 'é', 'ê', 'ë'],
          'i': ['i', 'ì', 'í', 'î', 'ï'],
          'o': ['o', 'ò', 'ó', 'ô', 'õ', 'ö'],
          'u': ['u', 'ù', 'ú', 'û', 'ü'],
          'c': ['c', 'ç'],
          'n': ['n', 'ñ']
        };
        
        // Generate variations by replacing characters
        let textVariations = [text.toLowerCase()];
        for (const [base, accents] of Object.entries(accentMap)) {
          const newVariations: string[] = [];
          for (const variant of textVariations) {
            if (variant.includes(base) || accents.some(a => variant.includes(a))) {
              for (const replacement of accents) {
                const newVariant = variant.replace(new RegExp(`[${accents.join('')}]`, 'g'), replacement);
                newVariations.push(newVariant);
              }
            }
          }
          textVariations = [...textVariations, ...newVariations];
        }
        
        textVariations.forEach(v => variations.add(v));
        return Array.from(variations);
      };

      // Try multiple search strategies
      let allResults: any[] = [];
      const seenIds = new Set<string>();
      
      if (lastName) {
        // Strategy 1: Search with accent variations of lastName
        const lastNameVariations = generateAccentVariations(lastName);
        
        for (const variation of lastNameVariations) {
          try {
            const response = await this.client.post(`/spaces/${this.spaceId}/search`, {
              types: [this.typeKeys.person],
              query: variation,
              limit: 1000
            });
            const results = response.data.data || [];
            
            // Deduplicate by ID
            for (const result of results) {
              if (!seenIds.has(result.id)) {
                seenIds.add(result.id);
                allResults.push(result);
              }
            }
          } catch (error) {
            // Continue with next variation if one fails
          }
        }
        
        // Strategy 2: If we have firstName, also try searching with firstName
        if (firstName) {
          const firstNameVariations = generateAccentVariations(firstName);
          
          for (const variation of firstNameVariations) {
            try {
              const response = await this.client.post(`/spaces/${this.spaceId}/search`, {
                types: [this.typeKeys.person],
                query: variation,
                limit: 1000
              });
              const results = response.data.data || [];
              
              // Deduplicate by ID
              for (const result of results) {
                if (!seenIds.has(result.id)) {
                  seenIds.add(result.id);
                  allResults.push(result);
                }
              }
            } catch (error) {
              // Continue with next variation if one fails
            }
          }
        }
      } else {
        // If no lastName provided, get all persons (fallback)
        const response = await this.client.post(`/spaces/${this.spaceId}/search`, {
          types: [this.typeKeys.person],
          limit: 1000
        });
        allResults = response.data.data || [];
      }
      
      // Helper function to normalize text for comparison
      const normalizeText = (text: string): string => {
        return text
          .normalize('NFD') // Decompose accented characters
          .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
          .toLowerCase()
          .trim();
      };

      // Filter results client-side for more precise matching
      return allResults.filter((obj: any) => {
        if (!lastName) return true;

        const lastNameProp = obj.properties?.find((p: any) => p.key === 'last_name');
        const lastNameValue = lastNameProp?.text || lastNameProp?.value || '';
        
        const firstNameProp = obj.properties?.find((p: any) => p.key === 'first_name');
        const firstNameValue = firstNameProp?.text || firstNameProp?.value || '';
        
        // Get the main name field as a fallback
        const mainName = obj.name || '';

        // Normalize names for comparison
        const normalizedLastName = normalizeText(lastName);
        const normalizedFirstName = firstName ? normalizeText(firstName) : '';
        const normalizedMainName = normalizeText(mainName);

        // Helper function to check if names are similar (exact match or one contains the other as a word)
        const isNameMatch = (searchName: string, storedName: string): boolean => {
          if (!searchName || !storedName) return false;
          
          const normalizedSearch = normalizeText(searchName);
          const normalizedStored = normalizeText(storedName);
          
          // Exact match
          if (normalizedSearch === normalizedStored) return true;
          
          // Check if one is contained as a complete word in the other
          const searchWords = normalizedSearch.split(/\s+/);
          const storedWords = normalizedStored.split(/\s+/);
          
          // Check if all words in search appear in stored (for searches like "S" matching "Salvatore")
          const searchInStored = searchWords.every(searchWord => 
            storedWords.some(storedWord => 
              storedWord.startsWith(searchWord) || searchWord.startsWith(storedWord)
            )
          );
          
          // Check if all words in stored appear in search
          const storedInSearch = storedWords.every(storedWord => 
            searchWords.some(searchWord => 
              searchWord.startsWith(storedWord) || storedWord.startsWith(searchWord)
            )
          );
          
          return searchInStored || storedInSearch;
        };

        // Check if we match based on structured first_name/last_name properties
        const lastNameMatch = isNameMatch(lastName, lastNameValue);
        let firstNameMatch = true; // Default to true if no firstName provided
        
        if (firstName && firstNameValue) {
          firstNameMatch = isNameMatch(firstName, firstNameValue);
        }

        // If we have structured data and it matches, return true
        if (lastNameValue && lastNameMatch && firstNameMatch) {
          return true;
        }

        // Fallback: check the main name field if structured data is not available or doesn't match
        if (mainName) {
          const fullSearchName = [firstName, lastName].filter(Boolean).join(' ');
          const mainNameMatch = isNameMatch(fullSearchName, mainName);
          
          if (mainNameMatch) return true;
          
          // Additional fallback: check if last name appears as a word in main name
          const lastNameInMainName = normalizedMainName.split(/\s+/).some(word => 
            word === normalizedLastName || word.startsWith(normalizedLastName) || normalizedLastName.startsWith(word)
          );
          
          if (firstName) {
            const firstNameInMainName = normalizedMainName.split(/\s+/).some(word => 
              word === normalizedFirstName || word.startsWith(normalizedFirstName) || normalizedFirstName.startsWith(word)
            );
            return lastNameInMainName && firstNameInMainName;
          }
          
          return lastNameInMainName;
        }

        // If we only had structured data and it didn't match, return false
        return lastNameMatch && firstNameMatch;
      });
    } catch (error) {
      console.error('Error searching persons by name:', error);
      return [];
    }
  }

  async searchPersonsByOrcid(orcid: string): Promise<AnytypeObject[]> {
    try {
      const response = await this.client.post(`/spaces/${this.spaceId}/search`, {
        types: [this.typeKeys.person]
      });

      const results = response.data.data || [];
      // Filter client-side since API property filters don't work
      return results.filter((obj: any) => {
        const orcidProp = obj.properties?.find((p: any) => p.key === 'orcid');
        if (!orcidProp) return false;

        const objOrcid = orcidProp.text || orcidProp.value || '';
        return objOrcid === orcid;
      });
    } catch (error) {
      console.error('Error searching persons by ORCID:', error);
      return [];
    }
  }

  async searchJournalsByName(name: string): Promise<AnytypeObject[]> {
    // Get all journals and filter client-side since API property filters don't work
    try {
      const response = await this.client.post(`/spaces/${this.spaceId}/search`, {
        types: [this.typeKeys.journal],
        limit: 1000  // Increase limit to get more results
      });

      const allJournals = response.data.data || [];

      // First try exact match
      const exactMatches = allJournals.filter((obj: any) =>
        obj.name && obj.name.toLowerCase() === name.toLowerCase()
      );

      if (exactMatches.length > 0) {
        return exactMatches;
      }

      // Return all journals for similarity checking
      return allJournals;
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