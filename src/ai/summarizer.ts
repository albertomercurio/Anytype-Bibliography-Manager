import { ConfigManager } from '../core/config-manager';

export interface AIProvider {
  summarizePDF(pdfPath: string): Promise<string | null>;
  resolveAuthorAmbiguity(candidates: any[], context: string): Promise<number>;
}

export class OpenAISummarizer implements AIProvider {
  private apiKey: string;

  constructor() {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    this.apiKey = config?.ai?.openaiApiKey || '';
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured. Run "anytype-bib setup" to configure AI integration.');
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
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    this.apiKey = config?.ai?.anthropicApiKey || '';
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured. Run "anytype-bib setup" to configure AI integration.');
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
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    
    if (config?.ai?.openaiApiKey) {
      this.provider = new OpenAISummarizer();
    } else if (config?.ai?.anthropicApiKey) {
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