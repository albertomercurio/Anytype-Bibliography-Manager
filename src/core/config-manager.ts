import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface Config {
  anytype: {
    apiKey: string;
    spaceId: string;
    host: string;
    port: string;
  };
  ai?: {
    openaiApiKey?: string;
    anthropicApiKey?: string;
  };
  settings: {
    debug: boolean;
    maxRetryAttempts: number;
    duplicateThreshold: number;
  };
}

export class ConfigManager {
  private configDir: string;
  private configPath: string;

  constructor() {
    this.configDir = path.join(os.homedir(), '.anytype-bib');
    this.configPath = path.join(this.configDir, 'config.json');
  }

  /**
   * Ensures the config directory exists
   */
  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): Config | null {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }
      const configData = fs.readFileSync(this.configPath, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      console.error('Error reading config file:', error);
      return null;
    }
  }

  /**
   * Save configuration to file
   */
  saveConfig(config: Config): void {
    try {
      this.ensureConfigDir();
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error}`);
    }
  }

  /**
   * Update specific configuration values
   */
  updateConfig(updates: Partial<Config>): void {
    const currentConfig = this.getConfig() || this.getDefaultConfig();
    const newConfig = this.mergeConfig(currentConfig, updates);
    this.saveConfig(newConfig);
  }

  /**
   * Check if configuration exists and is valid
   */
  isConfigured(): boolean {
    const config = this.getConfig();
    return !!(config?.anytype?.apiKey && config?.anytype?.spaceId);
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): Config {
    return {
      anytype: {
        apiKey: '',
        spaceId: '',
        host: 'localhost',
        port: '31009'
      },
      ai: {
        openaiApiKey: '',
        anthropicApiKey: ''
      },
      settings: {
        debug: false,
        maxRetryAttempts: 3,
        duplicateThreshold: 0.8
      }
    };
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(target: Config, source: Partial<Config>): Config {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key as keyof Config] !== undefined) {
        if (typeof source[key as keyof Config] === 'object' && !Array.isArray(source[key as keyof Config])) {
          result[key as keyof Config] = {
            ...result[key as keyof Config],
            ...source[key as keyof Config]
          } as any;
        } else {
          result[key as keyof Config] = source[key as keyof Config] as any;
        }
      }
    }
    
    return result;
  }

  /**
   * Delete configuration file
   */
  deleteConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
      }
    } catch (error) {
      throw new Error(`Failed to delete configuration: ${error}`);
    }
  }

  /**
   * Get configuration file path for display
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Validate configuration completeness
   */
  validateConfig(): { valid: boolean; missing: string[] } {
    const config = this.getConfig();
    const missing: string[] = [];

    if (!config) {
      return { valid: false, missing: ['Configuration file not found'] };
    }

    if (!config.anytype?.apiKey) missing.push('Anytype API key');
    if (!config.anytype?.spaceId) missing.push('Anytype Space ID');

    return { valid: missing.length === 0, missing };
  }

  /**
   * Create configuration from environment variables (for migration)
   */
  static fromEnvironment(): Config | null {
    if (!process.env.ANYTYPE_API_KEY || !process.env.ANYTYPE_SPACE_ID) {
      return null;
    }

    return {
      anytype: {
        apiKey: process.env.ANYTYPE_API_KEY,
        spaceId: process.env.ANYTYPE_SPACE_ID,
        host: process.env.ANYTYPE_HOST || 'localhost',
        port: process.env.ANYTYPE_PORT || '31009'
      },
      ai: {
        openaiApiKey: process.env.OPENAI_API_KEY || '',
        anthropicApiKey: process.env.ANTHROPIC_API_KEY || ''
      },
      settings: {
        debug: process.env.DEBUG === 'true',
        maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
        duplicateThreshold: parseFloat(process.env.DUPLICATE_THRESHOLD || '0.8')
      }
    };
  }
}