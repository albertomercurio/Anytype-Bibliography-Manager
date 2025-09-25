import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface PropertyInfo {
  id: string;
  name: string;
  format: string;
}

export interface TypeInfo {
  id: string;
  name: string;
  properties: {
    [propertyName: string]: PropertyInfo;
  };
}

export interface Config {
  anytype: {
    apiKey: string;
    spaceId: string;
    host: string;
    port: string;
  };
  types?: {
    article?: TypeInfo;
    person?: TypeInfo;
    journal?: TypeInfo;
    book?: TypeInfo;
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
    // Check for test config override first
    const testConfigPath = process.env.ANYTYPE_BIB_CONFIG || process.env.ANYTYPE_BIB_TEST_CONFIG;
    if (testConfigPath && fs.existsSync(testConfigPath)) {
      this.configPath = testConfigPath;
      this.configDir = path.dirname(testConfigPath);
    } else {
      this.configDir = path.join(os.homedir(), '.anytype-bib');
      this.configPath = path.join(this.configDir, 'config.json');
    }
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
    const currentConfig = this.getConfig();
    if (!currentConfig) {
      throw new Error('No configuration found. Run setup first.');
    }
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
}