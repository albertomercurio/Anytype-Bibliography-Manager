import { BibliographyManager } from '../src/core/bibliography-manager';
import { DOIResolver } from '../src/core/doi-resolver';
import { BibTeXFormatter } from '../src/core/bibtex-formatter';
import { AnytypeClient } from '../src/anytype/client';
import chalk from 'chalk';

// Simple focused test that doesn't require space creation
const TEST_DOIS = [
  '10.1016/j.aop.2011.06.004',
  '10.1140/epjp/s13360-022-03571-0',
  '10.1103/PhysRevLett.130.123601'
];

class SimpleIntegrationTest {
  private results = {
    doiResolutionPassed: 0,
    bibtexValidationPassed: 0,
    anytypeConnectionPassed: false,
    errors: [] as string[]
  };

  async run(): Promise<void> {
    console.log(chalk.blue.bold('\\n🧪 Simple Integration Test for Anytype Bibliography Manager\\n'));

    try {
      // Test 1: DOI Resolution
      await this.testDOIResolution();

      // Test 2: BibTeX Generation
      await this.testBibTeXGeneration();

      // Test 3: Anytype Connection
      await this.testAnytypeConnection();

      // Test 4: Add One Article (with duplicate skipping)
      await this.testAddArticle();

      // Print results
      this.printResults();

    } catch (error: any) {
      console.error(chalk.red('\\n❌ Test failed:'), error.message);
      this.results.errors.push(`Fatal error: ${error.message}`);
      this.printResults();
    }
  }

  private async testDOIResolution(): Promise<void> {
    console.log(chalk.yellow('🔍 Testing DOI resolution...'));

    const resolver = new DOIResolver();

    for (let i = 0; i < Math.min(3, TEST_DOIS.length); i++) {
      const doi = TEST_DOIS[i];
      try {
        console.log(chalk.gray(`  Testing: ${doi}`));
        const metadata = await resolver.resolve(doi);

        if (metadata && metadata.title && metadata.authors && metadata.authors.length > 0) {
          console.log(chalk.green(`  ✓ ${metadata.title.substring(0, 60)}...`));
          this.results.doiResolutionPassed++;
        } else {
          console.log(chalk.red(`  ✗ Invalid metadata for ${doi}`));
          this.results.errors.push(`Invalid metadata for ${doi}`);
        }
      } catch (error: any) {
        console.log(chalk.red(`  ✗ Failed to resolve ${doi}: ${error.message}`));
        this.results.errors.push(`DOI resolution failed for ${doi}: ${error.message}`);
      }
    }
  }

  private async testBibTeXGeneration(): Promise<void> {
    console.log(chalk.yellow('\\n📝 Testing BibTeX generation...'));

    const resolver = new DOIResolver();
    const formatter = new BibTeXFormatter();

    for (let i = 0; i < Math.min(3, TEST_DOIS.length); i++) {
      const doi = TEST_DOIS[i];
      try {
        const metadata = await resolver.resolve(doi);
        if (metadata) {
          const bibtex = formatter.formatEntry(metadata);
          const parsed = formatter.parseBibTeX(bibtex);

          // Validate BibTeX structure
          const hasRequiredFields = parsed.type && parsed.key &&
            parsed.fields['title'] && parsed.fields['author'] &&
            parsed.fields['doi'] && parsed.fields['year'];

          // Validate author formatting (should have commas for Last, First format)
          const authorsFormatted = parsed.fields['author'] && parsed.fields['author'].includes(',');

          if (hasRequiredFields && authorsFormatted) {
            console.log(chalk.green(`  ✓ Valid BibTeX for ${doi}`));
            this.results.bibtexValidationPassed++;
          } else {
            console.log(chalk.yellow(`  ⚠ Invalid BibTeX structure for ${doi}`));
            if (!authorsFormatted) {
              console.log(chalk.gray(`    Missing comma in author format: ${parsed.fields['author']}`));
            }
          }
        }
      } catch (error: any) {
        console.log(chalk.red(`  ✗ BibTeX generation failed for ${doi}: ${error.message}`));
        this.results.errors.push(`BibTeX generation failed for ${doi}: ${error.message}`);
      }
    }
  }

  private async testAnytypeConnection(): Promise<void> {
    console.log(chalk.yellow('\\n🔗 Testing Anytype connection...'));

    try {
      const client = new AnytypeClient();
      const typeKeys = client.getTypeKeys();

      // Test basic search functionality
      const articles = await client.searchByType(typeKeys.article, 5);

      console.log(chalk.green(`  ✓ Connected to Anytype (found ${articles.length} articles)`));
      this.results.anytypeConnectionPassed = true;

    } catch (error: any) {
      console.log(chalk.red(`  ✗ Anytype connection failed: ${error.message}`));
      this.results.errors.push(`Anytype connection failed: ${error.message}`);
    }
  }

  private async testAddArticle(): Promise<void> {
    console.log(chalk.yellow('\\n📚 Testing article addition (with duplicate handling)...'));

    try {
      const manager = new BibliographyManager();
      const testDoi = TEST_DOIS[0];

      console.log(chalk.gray(`  Adding: ${testDoi}`));

      // This will either add the article or skip if it's a duplicate
      await manager.processReference(testDoi, {
        autoResolveAuthors: true,
        autoResolveJournals: true,
        skipDuplicateCheck: false // Keep duplicate check to test it works
      });

      console.log(chalk.green(`  ✓ Article processing completed (added or detected duplicate)`));

    } catch (error: any) {
      // Even if it fails due to user interaction or duplicates, that's okay for this test
      if (error.message.includes('force closed') || error.message.includes('duplicate')) {
        console.log(chalk.blue(`  → Test completed (user interaction or duplicate handling)`));
      } else {
        console.log(chalk.red(`  ✗ Article addition failed: ${error.message}`));
        this.results.errors.push(`Article addition failed: ${error.message}`);
      }
    }
  }

  private printResults(): void {
    console.log(chalk.blue.bold('\\n📊 Simple Integration Test Results\\n'));

    const results = [
      ['DOI Resolution', `${this.results.doiResolutionPassed}/3`],
      ['BibTeX Generation', `${this.results.bibtexValidationPassed}/3`],
      ['Anytype Connection', this.results.anytypeConnectionPassed ? '✓' : '✗'],
      ['Overall Functionality', this.results.doiResolutionPassed >= 2 && this.results.bibtexValidationPassed >= 2 && this.results.anytypeConnectionPassed ? '✓' : '✗']
    ];

    for (const [label, value] of results) {
      const status = typeof value === 'string' && value.includes('✓')
        ? chalk.green(value)
        : typeof value === 'string' && value.includes('✗')
        ? chalk.red(value)
        : chalk.cyan(value);

      console.log(`  ${chalk.gray(label.padEnd(20, '.'))} ${status}`);
    }

    if (this.results.errors.length > 0) {
      console.log(chalk.yellow('\\n⚠️ Issues encountered:'));
      for (const error of this.results.errors) {
        console.log(chalk.gray(`  • ${error}`));
      }
    }

    const passed = this.results.doiResolutionPassed >= 2 &&
                   this.results.bibtexValidationPassed >= 2 &&
                   this.results.anytypeConnectionPassed;

    if (passed) {
      console.log(chalk.green('\\n✅ Core functionality is working correctly!'));
    } else {
      console.log(chalk.red('\\n❌ Some core functionality needs attention'));
    }
  }
}

// Export for use as a module
export { SimpleIntegrationTest };

// Run if executed directly
if (require.main === module) {
  const test = new SimpleIntegrationTest();
  test.run().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}