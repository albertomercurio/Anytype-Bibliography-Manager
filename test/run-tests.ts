#!/usr/bin/env tsx

import { IntegrationTestSuite } from './integration.test';
import chalk from 'chalk';
import { program } from 'commander';

program
  .name('anytype-bib-test')
  .description('Run integration tests for Anytype Bibliography Manager')
  .version('1.0.0');

program
  .command('integration')
  .description('Run full integration test suite')
  .action(async () => {
    console.log(chalk.blue.bold('Starting Anytype Bibliography Manager Test Suite'));
    console.log(chalk.gray('This will create a temporary test space and run comprehensive tests.\\n'));

    try {
      const suite = new IntegrationTestSuite();
      await suite.run();
    } catch (error: any) {
      console.error(chalk.red('Test suite failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('simple')
  .description('Run simple integration tests (recommended)')
  .action(async () => {
    console.log(chalk.blue.bold('Starting Simple Integration Tests'));
    console.log(chalk.gray('This tests core functionality without creating test spaces.\\n'));

    try {
      const { SimpleIntegrationTest } = require('./simple-integration.test');
      const test = new SimpleIntegrationTest();
      await test.run();
    } catch (error: any) {
      console.error(chalk.red('Test failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('quick')
  .description('Run quick validation tests (without creating test space)')
  .action(async () => {
    console.log(chalk.blue.bold('Running Quick Validation Tests\\n'));

    // Import test modules
    const { normalizeText, parseFullName, isAbbreviation, sanitizeForCiteKey, escapeLatex } = require('../src/utils/text-utils');
    const { BibTeXFormatter } = require('../src/core/bibtex-formatter');

    let passed = 0;
    let failed = 0;

    // Test text utilities
    console.log(chalk.yellow('Testing text utilities...'));

    const textTests = [
      {
        name: 'Normalize text with accents',
        test: () => normalizeText('Émile Lévy') === 'emile levy',
        expected: 'emile levy',
        actual: normalizeText('Émile Lévy')
      },
      {
        name: 'Parse simple name',
        test: () => {
          const result = parseFullName('John Smith');
          return result.firstName === 'John' && result.lastName === 'Smith';
        },
        expected: { firstName: 'John', lastName: 'Smith' },
        actual: parseFullName('John Smith')
      },
      {
        name: 'Parse compound last name',
        test: () => {
          const result = parseFullName('Ludwig van Beethoven');
          return result.firstName === 'Ludwig' && result.lastName === 'van Beethoven';
        },
        expected: { firstName: 'Ludwig', lastName: 'van Beethoven' },
        actual: parseFullName('Ludwig van Beethoven')
      },
      {
        name: 'Check abbreviation',
        test: () => isAbbreviation('J.', 'John'),
        expected: true,
        actual: isAbbreviation('J.', 'John')
      },
      {
        name: 'Check non-abbreviation',
        test: () => !isAbbreviation('James', 'John'),
        expected: false,
        actual: isAbbreviation('James', 'John')
      },
      {
        name: 'Sanitize for cite key',
        test: () => sanitizeForCiteKey('The Löwe-Hölder') === 'LoweHolder',
        expected: 'LoweHolder',
        actual: sanitizeForCiteKey('The Löwe-Hölder')
      },
      {
        name: 'Escape LaTeX special characters',
        test: () => escapeLatex('Test & example_text') === 'Test \\& example\\_text',
        expected: 'Test \\& example\\_text',
        actual: escapeLatex('Test & example_text')
      }
    ];

    for (const testCase of textTests) {
      try {
        if (testCase.test()) {
          console.log(chalk.green(`  ✓ ${testCase.name}`));
          passed++;
        } else {
          console.log(chalk.red(`  ✗ ${testCase.name}`));
          console.log(chalk.gray(`    Expected: ${JSON.stringify(testCase.expected)}`));
          console.log(chalk.gray(`    Actual: ${JSON.stringify(testCase.actual)}`));
          failed++;
        }
      } catch (error: any) {
        console.log(chalk.red(`  ✗ ${testCase.name} - Error: ${error.message}`));
        failed++;
      }
    }

    // Test BibTeX formatting
    console.log(chalk.yellow('\\nTesting BibTeX formatter...'));

    const formatter = new BibTeXFormatter();
    const testMetadata = {
      doi: '10.1234/test.2024',
      title: 'Test Article: A Study',
      authors: [
        { fullName: 'John Smith', givenName: 'John', familyName: 'Smith' },
        { fullName: 'Jane Doe', givenName: 'Jane', familyName: 'Doe' }
      ],
      year: 2024,
      journal: 'Test Journal',
      volume: '42',
      issue: '3',
      pages: '123-145',
      url: 'https://doi.org/10.1234/test.2024',
      type: 'article' as const,
      publisher: 'Test Publisher'
    };

    try {
      const bibtex = formatter.formatEntry(testMetadata);
      const parsed = formatter.parseBibTeX(bibtex);

      const bibtexTests = [
        {
          name: 'BibTeX has correct entry type',
          test: () => parsed.type === 'article'
        },
        {
          name: 'BibTeX has cite key',
          test: () => parsed.key && parsed.key.length > 0
        },
        {
          name: 'BibTeX has title field',
          test: () => parsed.fields['title'] && parsed.fields['title'].includes('Test Article')
        },
        {
          name: 'BibTeX has formatted authors',
          test: () => parsed.fields['author'] && parsed.fields['author'].includes('Smith, John') && parsed.fields['author'].includes('Doe, Jane')
        },
        {
          name: 'BibTeX has year field',
          test: () => parsed.fields['year'] === '2024'
        },
        {
          name: 'BibTeX has DOI field',
          test: () => parsed.fields['doi'] === '10.1234/test.2024'
        }
      ];

      for (const testCase of bibtexTests) {
        if (testCase.test()) {
          console.log(chalk.green(`  ✓ ${testCase.name}`));
          passed++;
        } else {
          console.log(chalk.red(`  ✗ ${testCase.name}`));
          failed++;
        }
      }
    } catch (error: any) {
      console.log(chalk.red(`  ✗ BibTeX formatting failed: ${error.message}`));
      failed++;
    }

    // Print summary
    console.log(chalk.blue.bold(`\\n📊 Quick Test Results\\n`));
    console.log(chalk.green(`  Passed: ${passed}`));
    console.log(chalk.red(`  Failed: ${failed}`));
    console.log(chalk.cyan(`  Total:  ${passed + failed}`));

    if (failed === 0) {
      console.log(chalk.green('\\n✅ All quick tests passed!'));
    } else {
      console.log(chalk.red(`\\n❌ ${failed} test(s) failed`));
      process.exit(1);
    }
  });

program.parse();

// If no command specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}