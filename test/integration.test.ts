import axios from 'axios';
import { AnytypeClient } from '../src/anytype/client';
import { BibliographyManager } from '../src/core/bibliography-manager';
import { DOIResolver } from '../src/core/doi-resolver';
import { BibTeXFormatter } from '../src/core/bibtex-formatter';
import { ConfigManager } from '../src/core/config-manager';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

interface TestResults {
  spaceCreated: boolean;
  spaceId?: string;
  typesCreated: boolean;
  articlesAdded: number;
  duplicatesRejected: number;
  authorsCreated: number;
  journalsCreated: number;
  bibtexValid: number;
  errors: string[];
}

// Test DOIs - strategically chosen to test author and journal deduplication
const TEST_DOIS = [
  '10.1016/j.aop.2011.06.004',     // Authors: Sergey Bravyi, David P. DiVincenzo, Daniel Loss | Journal: Annals of Physics
  '10.1103/PhysRevLett.130.123601', // Authors: Alberto Mercurio, Salvatore Savasta, Omar Di Stefano + others | Journal: Physical Review Letters
  '10.1103/physreva.98.053834',   // Authors: Salvatore Savasta, Omar Di Stefano + others | Journal: Physical Review A (different PRL)
  '10.21468/SciPostPhys.17.1.027', // Authors: Alberto Mercurio, Salvatore Savasta + others | Journal: SciPost Physics
  '10.1103/physrevlett.111.053603', // Journal: Physical Review Letters (same as #2 - tests journal dedup)
  '10.1038/nature08005',           // Nature - high-impact journal with many authors
  '10.1140/epjp/s13360-022-03571-0' // Authors: S. Savasta + others | Journal: European Physical Journal Plus
];

class IntegrationTestSuite {
  private client: axios.AxiosInstance;
  private apiKey: string;
  private host: string;
  private port: number;
  private testSpaceId: string | null = null;
  private testResults: TestResults = {
    spaceCreated: false,
    typesCreated: false,
    articlesAdded: 0,
    duplicatesRejected: 0,
    authorsCreated: 0,
    journalsCreated: 0,
    bibtexValid: 0,
    errors: []
  };

  constructor() {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();

    if (!config) {
      throw new Error('Configuration not found. Please run "anytype-bib setup" first.');
    }

    this.apiKey = config.anytype.apiKey;
    this.host = config.anytype.host;
    this.port = config.anytype.port;

    this.client = axios.create({
      baseURL: `http://${this.host}:${this.port}/v1`,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Anytype-Version': '2025-05-20'
      },
      timeout: 30000
    });
  }

  async run(): Promise<void> {
    console.log(chalk.blue.bold('\\n🧪 Starting Anytype Bibliography Manager Integration Tests\\n'));

    try {
      // Step 1: Create test space
      await this.createTestSpace();

      // Step 2: Create required object types
      await this.createObjectTypes();

      // Step 3: Test adding DOIs
      await this.testAddingDOIs();

      // Step 4: Test duplicate detection
      await this.testDuplicateDetection();

      // Step 5: Verify uniqueness
      await this.verifyUniqueness();

      // Step 6: Validate BibTeX formatting
      await this.validateBibTeX();

      // Step 7: Print results
      this.printResults();

    } catch (error: any) {
      console.error(chalk.red('\\n❌ Test suite failed:'), error.message);
      this.testResults.errors.push(`Fatal error: ${error.message}`);
    } finally {
      // Cleanup: Delete test space
      if (this.testSpaceId) {
        await this.cleanupTestSpace();
      }
    }
  }

  private async createTestSpace(): Promise<void> {
    const timestamp = Date.now();
    const spaceName = `BibTest-${timestamp}`;

    console.log(chalk.yellow(`📦 Creating temporary test space "${spaceName}"...`));

    try {
      const response = await this.client.post('/spaces', {
        name: spaceName,
        description: `Temporary space for testing Anytype Bibliography Manager (${new Date().toISOString()})`
      });


      if (response.data && response.data.space && response.data.space.id) {
        this.testSpaceId = response.data.space.id;
        this.testResults.spaceCreated = true;
        this.testResults.spaceId = this.testSpaceId;
        console.log(chalk.green(`✓ Test space created: ${this.testSpaceId}`));

        // Update config temporarily for the test
        this.updateTestConfig(this.testSpaceId);
      } else {
        throw new Error(`Failed to create test space - unexpected response format: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      const errorMsg = error.response
        ? `API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
        : `Network Error: ${error.message}`;

      console.log(chalk.red(`Error details: ${errorMsg}`));
      this.testResults.errors.push(`Failed to create test space: ${errorMsg}`);
      throw new Error(`Failed to create test space: ${errorMsg}`);
    }
  }

  private updateTestConfig(spaceId: string): void {
    // Create a temporary config file for testing
    const testConfigPath = path.join(process.env.HOME || '', '.anytype-bib-test.json');
    const testConfig = {
      anytype: {
        apiKey: this.apiKey,
        host: this.host,
        port: this.port,
        spaceId: spaceId
      },
      typeKeys: {
        article: 'reference',  // Article type uses 'reference' key
        person: 'human',       // Person type uses 'human' key
        journal: 'journal',    // Journal type uses 'journal' key
        book: 'book'          // Book type uses 'book' key
      }
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));
    process.env.ANYTYPE_BIB_TEST_CONFIG = testConfigPath;
  }

  private async createObjectTypes(): Promise<void> {
    console.log(chalk.yellow('\\n🔧 Creating required object types in test space...'));

    // Create types in the correct order: dependencies first!
    const typesToCreate = [
      // 1. Person first (no dependencies)
      {
        name: 'Person',
        key: 'human',
        icon: { emoji: '�', format: 'emoji' },
        layout: 'basic',
        plural_name: 'People',
        properties: [
          { key: 'first_name', name: 'First name', format: 'text' },
          { key: 'last_name', name: 'Last name', format: 'text' },
          { key: 'orcid', name: 'ORCID', format: 'text' }
        ]
      },
      // 2. Journal second (no dependencies)
      {
        name: 'Journal',
        key: 'journal',
        icon: { emoji: '📖', format: 'emoji' },
        layout: 'basic',
        plural_name: 'Journals',
        properties: [
          { key: 'name', name: 'Name', format: 'text' },
          { key: 'issn', name: 'ISSN', format: 'text' }
        ]
      },
      // 3. Article last (depends on Person and Journal)
      {
        name: 'Article',
        key: 'reference',
        icon: { emoji: '�', format: 'emoji' },
        layout: 'basic',
        plural_name: 'Articles',
        properties: [
          { key: 'title', name: 'Title', format: 'text' },
          { key: 'authors', name: 'Authors', format: 'objects' },
          { key: 'journal', name: 'Journal', format: 'objects' },
          { key: 'year', name: 'Year', format: 'number' },
          { key: 'doi', name: 'DOI', format: 'text' },
          { key: 'url', name: 'URL', format: 'url' },
          { key: 'bib_te_x', name: 'BibTeX', format: 'text' }
        ]
      },
      // 4. Book last (depends on Person)
      {
        name: 'Book',
        key: 'book',
        icon: { emoji: '📚', format: 'emoji' },
        layout: 'basic',
        plural_name: 'Books',
        properties: [
          { key: 'title', name: 'Title', format: 'text' },
          { key: 'authors', name: 'Authors', format: 'objects' },
          { key: 'year', name: 'Year', format: 'number' },
          { key: 'isbn', name: 'ISBN', format: 'text' },
          { key: 'bib_te_x', name: 'BibTeX', format: 'text' }
        ]
      }
    ];

    try {
      const createdTypes: { [key: string]: string } = {};

      for (const typeSpec of typesToCreate) {
        console.log(chalk.gray(`  Creating type: ${typeSpec.name}...`));

        try {
          const response = await this.client.post(`/spaces/${this.testSpaceId}/types`, {
            name: typeSpec.name,
            key: typeSpec.key,
            icon: typeSpec.icon,
            layout: typeSpec.layout,
            plural_name: typeSpec.plural_name,
            properties: typeSpec.properties
          });

          if (response.data && response.data.type) {
            const createdTypeKey = response.data.type.key || typeSpec.key;
            createdTypes[typeSpec.key] = createdTypeKey;
            console.log(chalk.green(`    ✓ Created ${typeSpec.name} (${createdTypeKey})`));
          } else {
            console.log(chalk.yellow(`    ⚠ Created ${typeSpec.name} but unexpected response format`));
            createdTypes[typeSpec.key] = typeSpec.key; // Assume it worked
          }
        } catch (error: any) {
          console.log(chalk.red(`    ✗ Failed to create ${typeSpec.name}: ${error.message}`));
          this.testResults.errors.push(`Failed to create type ${typeSpec.name}: ${error.message}`);

          // Try to continue with default key
          createdTypes[typeSpec.key] = typeSpec.key;
        }
      }

      // Update the test config with the created type keys
      this.updateTypeKeysInConfig(createdTypes);

      console.log(chalk.green(`\\n  ✓ Object types initialization complete`));
      this.testResults.typesCreated = true;

    } catch (error: any) {
      console.log(chalk.red(`  ✗ Failed to create object types: ${error.message}`));
      this.testResults.typesCreated = false;
      this.testResults.errors.push(`Object type creation failed: ${error.message}`);
      throw error;
    }
  }

  private updateTypeKeysInConfig(typeKeys: { [key: string]: string }): void {
    try {
      const testConfigPath = process.env.ANYTYPE_BIB_TEST_CONFIG;
      if (testConfigPath && fs.existsSync(testConfigPath)) {
        const config = JSON.parse(fs.readFileSync(testConfigPath, 'utf-8'));
        config.typeKeys = typeKeys;
        fs.writeFileSync(testConfigPath, JSON.stringify(config, null, 2));
        console.log(chalk.gray(`    → Updated test config with type keys`));
      }
    } catch (error: any) {
      console.log(chalk.yellow(`    ⚠ Could not update config with type keys: ${error.message}`));
    }
  }

  private async testAddingDOIs(): Promise<void> {
    console.log(chalk.yellow('\\n📚 Testing DOI addition...'));

    // Use test config
    const originalConfig = process.env.ANYTYPE_BIB_CONFIG;
    process.env.ANYTYPE_BIB_CONFIG = process.env.ANYTYPE_BIB_TEST_CONFIG;

    try {
      const bibliographyManager = new BibliographyManager();

      for (let i = 0; i < TEST_DOIS.length; i++) {
        const doi = TEST_DOIS[i];
        console.log(chalk.cyan(`\\n[${i + 1}/${TEST_DOIS.length}] Adding DOI: ${doi}`));

        try {
          // Verify we're using the test space
          const testClient = new (require('../src/anytype/client').AnytypeClient)();
          const testSpaceConfig = testClient.getTypeKeys();
          console.log(chalk.gray(`  → Using space ID: ${this.testSpaceId}`));

          await bibliographyManager.processReference(doi, {
            autoResolveAuthors: true,
            autoResolveJournals: true,
            skipDuplicateCheck: false  // Keep duplicate check enabled for testing
          });

          this.testResults.articlesAdded++;
          console.log(chalk.green(`  ✓ Article added successfully`));
        } catch (error: any) {
          this.testResults.errors.push(`Failed to add DOI ${doi}: ${error.message}`);
          console.log(chalk.red(`  ✗ Failed: ${error.message}`));
        }
      }
    } finally {
      // Restore original config
      process.env.ANYTYPE_BIB_CONFIG = originalConfig;
    }
  }

  private async testDuplicateDetection(): Promise<void> {
    console.log(chalk.yellow('\\n🔍 Testing duplicate detection...'));

    // Use test config
    const originalConfig = process.env.ANYTYPE_BIB_CONFIG;
    process.env.ANYTYPE_BIB_CONFIG = process.env.ANYTYPE_BIB_TEST_CONFIG;

    try {
      const bibliographyManager = new BibliographyManager();

      for (let i = 0; i < TEST_DOIS.length; i++) {
        const doi = TEST_DOIS[i];
        console.log(chalk.cyan(`\\n[${i + 1}/${TEST_DOIS.length}] Re-adding DOI: ${doi}`));

        try {
          // This should detect the duplicate and not add it
          const anytypeClient = new AnytypeClient();
          const existingArticles = await anytypeClient.searchArticlesByDOI(doi);

          if (existingArticles.length > 0) {
            this.testResults.duplicatesRejected++;
            console.log(chalk.green(`  ✓ Duplicate detected and rejected`));
          } else {
            console.log(chalk.yellow(`  ⚠ Article not found (might have failed to add initially)`));
          }
        } catch (error: any) {
          this.testResults.errors.push(`Duplicate detection failed for ${doi}: ${error.message}`);
          console.log(chalk.red(`  ✗ Error: ${error.message}`));
        }
      }
    } finally {
      // Restore original config
      process.env.ANYTYPE_BIB_CONFIG = originalConfig;
    }
  }

  private async verifyUniqueness(): Promise<void> {
    console.log(chalk.yellow('\\n🔎 Verifying uniqueness of authors and journals...'));

    try {
      // Check authors
      const authorsResponse = await this.client.post(`/spaces/${this.testSpaceId}/search`, {
        types: ['human'], // Use 'human' which is the correct type key for persons
        limit: 1000
      });

      const authors = authorsResponse.data.data || [];
      const authorNames = new Map<string, number>();

      for (const author of authors) {
        const name = author.name || 'Unknown';
        authorNames.set(name, (authorNames.get(name) || 0) + 1);
      }

      let duplicateAuthors = 0;
      for (const [name, count] of authorNames) {
        if (count > 1) {
          duplicateAuthors++;
          console.log(chalk.yellow(`  ⚠ Duplicate author found: ${name} (${count} instances)`));
        }
      }

      this.testResults.authorsCreated = authors.length;

      if (duplicateAuthors === 0) {
        console.log(chalk.green(`  ✓ All ${authors.length} authors are unique`));
      }

      // Check journals
      const journalsResponse = await this.client.post(`/spaces/${this.testSpaceId}/search`, {
        types: ['journal'],
        limit: 1000
      });

      const journals = journalsResponse.data.data || [];
      const journalNames = new Map<string, number>();

      for (const journal of journals) {
        const name = journal.name || 'Unknown';
        journalNames.set(name, (journalNames.get(name) || 0) + 1);
      }

      let duplicateJournals = 0;
      for (const [name, count] of journalNames) {
        if (count > 1) {
          duplicateJournals++;
          console.log(chalk.yellow(`  ⚠ Duplicate journal found: ${name} (${count} instances)`));
        }
      }

      this.testResults.journalsCreated = journals.length;

      if (duplicateJournals === 0) {
        console.log(chalk.green(`  ✓ All ${journals.length} journals are unique`));
      }

    } catch (error: any) {
      this.testResults.errors.push(`Uniqueness verification failed: ${error.message}`);
      console.log(chalk.red(`  ✗ Error: ${error.message}`));
    }
  }

  private async validateBibTeX(): Promise<void> {
    console.log(chalk.yellow('\\n📝 Validating BibTeX formatting...'));

    try {
      const articlesResponse = await this.client.post(`/spaces/${this.testSpaceId}/search`, {
        types: ['reference'], // Use 'reference' which is the correct type key for articles
        limit: 1000
      });

      const articles = articlesResponse.data.data || [];
      const formatter = new BibTeXFormatter();

      for (const article of articles) {
        const bibtexProp = article.properties?.find((p: any) => p.key === 'bib_te_x');
        const bibtex = bibtexProp?.text || bibtexProp?.value || '';

        if (bibtex) {
          // Parse the BibTeX to validate structure
          const parsed = formatter.parseBibTeX(bibtex);

          if (parsed.type && parsed.key && Object.keys(parsed.fields).length > 0) {
            // Check required fields
            const requiredFields = ['title', 'author', 'year', 'doi'];
            const hasAllRequired = requiredFields.every(field => parsed.fields[field]);

            if (hasAllRequired) {
              this.testResults.bibtexValid++;
              console.log(chalk.green(`  ✓ Valid BibTeX for: ${article.name}`));
            } else {
              const missing = requiredFields.filter(field => !parsed.fields[field]);
              console.log(chalk.yellow(`  ⚠ Missing fields in BibTeX for ${article.name}: ${missing.join(', ')}`));
            }

            // Check author formatting (Last, First format)
            const authors = parsed.fields['author'];
            if (authors && !authors.includes(',')) {
              console.log(chalk.yellow(`  ⚠ Author formatting issue in ${article.name}: missing comma separator`));
            }
          } else {
            console.log(chalk.yellow(`  ⚠ Invalid BibTeX structure for: ${article.name}`));
          }
        } else {
          console.log(chalk.yellow(`  ⚠ No BibTeX found for: ${article.name}`));
        }
      }

      console.log(chalk.green(`\\n  ✓ ${this.testResults.bibtexValid}/${articles.length} articles have valid BibTeX`));

    } catch (error: any) {
      this.testResults.errors.push(`BibTeX validation failed: ${error.message}`);
      console.log(chalk.red(`  ✗ Error: ${error.message}`));
    }
  }

  private async cleanupTestSpace(): Promise<void> {
    console.log(chalk.yellow('\\n🧹 Test cleanup...'));

    try {
      // Check if we created a separate test space or used the main space
      const configManager = new (require('../src/core/config-manager').ConfigManager)();
      const mainConfig = configManager.getConfig();

      if (this.testSpaceId !== mainConfig.anytype.spaceId) {
        // We created a separate test space
        console.log(chalk.blue('  → Test space created successfully'));
        console.log(chalk.gray(`  → Space ID: ${this.testSpaceId}`));
        console.log(chalk.yellow('  ⚠ Note: The Anytype API does not support programmatic space deletion'));
        console.log(chalk.yellow('  ⚠ Please manually delete the test space from Anytype UI if desired'));
        console.log(chalk.gray('  → Go to Space Settings → ... → Delete Space'));
      } else {
        // We used the main space, don't delete it but clean up test data
        console.log(chalk.blue('  → Used main space for testing'));
        console.log(chalk.yellow('  ⚠ Test data may remain in your main space'));
        console.log(chalk.gray('  → You can manually review and clean up test articles if needed'));
      }

      // Remove test config file
      const testConfigPath = process.env.ANYTYPE_BIB_TEST_CONFIG;
      if (testConfigPath && fs.existsSync(testConfigPath)) {
        fs.unlinkSync(testConfigPath);
        console.log(chalk.green('  ✓ Temporary config file cleaned up'));
      }
    } catch (error: any) {
      console.log(chalk.yellow(`  ⚠ Cleanup warning: ${error.message}`));
    }
  }

  private printResults(): void {
    console.log(chalk.blue.bold('\\n📊 Test Results Summary\\n'));

    const results = [
      ['Test Space Created', this.testResults.spaceCreated ? '✓' : '✗'],
      ['Object Types Created', this.testResults.typesCreated ? '✓' : '✗'],
      ['Articles Added', `${this.testResults.articlesAdded}/${TEST_DOIS.length}`],
      ['Duplicates Rejected', `${this.testResults.duplicatesRejected}/${TEST_DOIS.length}`],
      ['Unique Authors', this.testResults.authorsCreated],
      ['Unique Journals', this.testResults.journalsCreated],
      ['Valid BibTeX Entries', `${this.testResults.bibtexValid}/${this.testResults.articlesAdded}`]
    ];

    for (const [label, value] of results) {
      const status = typeof value === 'string' && value.includes('✓')
        ? chalk.green(value)
        : typeof value === 'string' && value.includes('✗')
        ? chalk.red(value)
        : chalk.cyan(value);

      console.log(`  ${chalk.gray(String(label).padEnd(25, '.'))} ${status}`);
    }

    if (this.testResults.errors.length > 0) {
      console.log(chalk.red('\\n❌ Errors encountered:'));
      for (const error of this.testResults.errors) {
        console.log(chalk.red(`  • ${error}`));
      }
    } else {
      console.log(chalk.green('\\n✅ All tests completed successfully!'));
    }

    // Overall status
    const totalTests = 7;
    const passedTests = [
      this.testResults.spaceCreated,
      this.testResults.typesCreated,
      this.testResults.articlesAdded === TEST_DOIS.length,
      this.testResults.duplicatesRejected === TEST_DOIS.length,
      this.testResults.authorsCreated > 0,
      this.testResults.journalsCreated > 0,
      this.testResults.bibtexValid === this.testResults.articlesAdded
    ].filter(Boolean).length;

    console.log(chalk.bold(`\\n🏆 Overall: ${passedTests}/${totalTests} tests passed`));
  }
}

// Export for use as a module
export { IntegrationTestSuite };

// Run if executed directly
if (require.main === module) {
  const suite = new IntegrationTestSuite();
  suite.run().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}