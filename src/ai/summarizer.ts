import * as dotenv from 'dotenv';

dotenv.config();

export interface AIProvider {
  summarizePDF(pdfPath: string): Promise<string | null>;
  resolveAuthorAmbiguity(candidates: any[], context: string): Promise<number>;
}

export class OpenAISummarizer implements AIProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }
  }

  async summarizePDF(_pdfPath: string): Promise<string | null> {
    // TODO: Implement PDF text extraction and OpenAI summarization
    console.log('OpenAI PDF summarization not yet implemented');
    return null;
  }

  async resolveAuthorAmbiguity(_candidates: any[], _context: string): Promise<number> {
    // TODO: Use OpenAI to help resolve author ambiguity
    return 0;
  }
}

export class AnthropicSummarizer implements AIProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured');
    }
  }

  async summarizePDF(_pdfPath: string): Promise<string | null> {
    // TODO: Implement PDF text extraction and Claude summarization
    console.log('Claude PDF summarization not yet implemented');
    return null;
  }

  async resolveAuthorAmbiguity(_candidates: any[], _context: string): Promise<number> {
    // TODO: Use Claude to help resolve author ambiguity
    return 0;
  }
}

export class AISummarizer {
  private provider: AIProvider | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.provider = new OpenAISummarizer();
    } else if (process.env.ANTHROPIC_API_KEY) {
      this.provider = new AnthropicSummarizer();
    }
  }

  isAvailable(): boolean {
    return this.provider !== null;
  }

  async summarizePDF(pdfPath: string): Promise<string | null> {
    if (!this.provider) {
      return null;
    }
    return this.provider.summarizePDF(pdfPath);
  }

  async resolveAuthorAmbiguity(candidates: any[], context: string): Promise<number> {
    if (!this.provider) {
      return 0;
    }
    return this.provider.resolveAuthorAmbiguity(candidates, context);
  }
}