import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import { AnytypeObject } from '../types/anytype';

dotenv.config();

export class AnytypeClient {
  private client: AxiosInstance;
  private spaceId: string;

  constructor() {
    const apiKey = process.env.ANYTYPE_API_KEY;
    const host = process.env.ANYTYPE_HOST || 'localhost';
    const port = process.env.ANYTYPE_PORT || '31009';
    this.spaceId = process.env.ANYTYPE_SPACE_ID || '';

    if (!apiKey) {
      throw new Error('ANYTYPE_API_KEY is not set in environment variables');
    }

    if (!this.spaceId) {
      throw new Error('ANYTYPE_SPACE_ID is not set in environment variables');
    }

    this.client = axios.create({
      baseURL: `http://${host}:${port}/v1`,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Anytype-Version': '2025-05-20'
      }
    });
  }

  async searchObjects(filters: any[], limit = 100): Promise<AnytypeObject[]> {
    try {
      const response = await this.client.post(`/spaces/${this.spaceId}/search`, {
        filters,
        limit
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Error searching objects:', error);
      return [];
    }
  }

  async searchByType(typeKey: string, limit = 100): Promise<AnytypeObject[]> {
    return this.searchObjects([
      {
        property: 'type',
        condition: 'equals',
        value: typeKey
      }
    ], limit);
  }

  async searchArticlesByDOI(doi: string): Promise<AnytypeObject[]> {
    return this.searchObjects([
      {
        property: 'type',
        condition: 'equals',
        value: 'reference'
      },
      {
        property: 'doi',
        condition: 'equals',
        value: doi.toLowerCase()
      }
    ]);
  }

  async searchPersonsByName(lastName: string, firstName?: string): Promise<AnytypeObject[]> {
    const filters: any[] = [
      {
        property: 'type',
        condition: 'equals',
        value: 'human'
      }
    ];

    if (lastName) {
      filters.push({
        property: 'last_name',
        condition: 'contains',
        value: lastName
      });
    }

    if (firstName) {
      filters.push({
        property: 'first_name',
        condition: 'contains',
        value: firstName
      });
    }

    return this.searchObjects(filters);
  }

  async searchPersonsByOrcid(orcid: string): Promise<AnytypeObject[]> {
    return this.searchObjects([
      {
        property: 'type',
        condition: 'equals',
        value: 'human'
      },
      {
        property: 'orcid',
        condition: 'equals',
        value: orcid
      }
    ]);
  }

  async searchJournalsByName(name: string): Promise<AnytypeObject[]> {
    return this.searchObjects([
      {
        property: 'type',
        condition: 'equals',
        value: 'journal'
      },
      {
        property: 'name',
        condition: 'contains',
        value: name
      }
    ]);
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

    return this.createObject('reference', article.title, properties);
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

    return this.createObject('human', name, properties);
  }

  async createJournal(name: string): Promise<string | null> {
    return this.createObject('journal', name, []);
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

    return this.createObject('book', book.title, properties);
  }
}