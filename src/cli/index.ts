#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { BibliographyManager } from '../core/bibliography-manager';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('anytype-bib')
  .description('Automated bibliography management for Anytype with DOI extraction and BibTeX generation')
  .version('1.0.0')
  .option('-v, --verbose', 'enable verbose output')
  .option('--dry-run', 'show what would be done without making changes')
  .addHelpText('after', `
Examples:
  $ anytype-bib add 10.1103/PhysRevLett.124.010503
  $ anytype-bib add --auto-resolve --pdf paper.pdf 10.1038/nature12345
  $ anytype-bib batch dois.txt --auto-resolve
  $ anytype-bib setup
  $ anytype-bib test

Get started:
  1. Run 'anytype-bib setup' to configure your Anytype connection
  2. Use 'anytype-bib add <DOI>' to add a single reference
  3. Use 'anytype-bib batch <file>' to add multiple references

For more help on a specific command, use:
  anytype-bib <command> --help
`);

program
  .command('add')
  .description('Add a new reference to Anytype from a DOI')
  .argument('[doi]', 'DOI of the reference (e.g., 10.1103/PhysRevLett.124.010503)')
  .option('-p, --pdf <path>', 'Path to PDF file to attach')
  .option('-a, --auto-resolve', 'Automatically resolve duplicates by using existing authors/journals')
  .option('-s, --skip-duplicates', 'Skip duplicate checking entirely')
  .option('--ai', 'Use AI for enhanced processing (requires OpenAI or Anthropic API key)')
  .addHelpText('after', `
Examples:
  $ anytype-bib add 10.1103/PhysRevLett.124.010503
  $ anytype-bib add --auto-resolve 10.1038/nature12345
  $ anytype-bib add --pdf ~/Downloads/paper.pdf 10.1103/PhysRevX.14.021022
  $ anytype-bib add --skip-duplicates --ai 10.1103/PhysRevA.107.053505

Interactive mode (if no DOI provided):
  $ anytype-bib add

The command will:
  1. Fetch metadata from CrossRef/DataCite
  2. Check for duplicate articles, authors, and journals
  3. Create objects in Anytype with proper relationships
  4. Generate BibTeX citation
`)
  .action(async (doi, options) => {
    try {
      if (!doi) {
        const answer = await inquirer.prompt([{
          type: 'input',
          name: 'doi',
          message: 'Enter the DOI:',
          validate: (input) => input.trim().length > 0 || 'DOI is required'
        }]);
        doi = answer.doi;
      }

      const manager = new BibliographyManager();
      await manager.processReference(doi, {
        pdfPath: options.pdf,
        autoResolveAuthors: options.autoResolve,
        autoResolveJournals: options.autoResolve,
        skipDuplicateCheck: options.skipDuplicates,
        useAI: options.ai
      });
    } catch (error: any) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('Add multiple references from a file containing DOIs')
  .argument('<file>', 'Path to file containing DOIs (one per line, # for comments)')
  .option('-a, --auto-resolve', 'Automatically resolve duplicates for all references')
  .option('-c, --continue-on-error', 'Continue processing if one reference fails')
  .addHelpText('after', `
Examples:
  $ anytype-bib batch dois.txt
  $ anytype-bib batch --auto-resolve research-papers.txt
  $ anytype-bib batch --continue-on-error all-papers.txt

File format (dois.txt):
  # My research papers
  10.1103/PhysRevLett.124.010503
  10.1038/nature12345
  10.1103/PhysRevX.14.021022
  # More papers below...
  10.1103/PhysRevA.107.053505

The batch command will:
  1. Process each DOI sequentially
  2. Show progress and statistics
  3. Skip commented lines starting with #
  4. Stop on first error (unless --continue-on-error)
`)
  .action(async (file, options) => {
    try {
      if (!fs.existsSync(file)) {
        throw new Error(`File not found: ${file}`);
      }

      const content = fs.readFileSync(file, 'utf-8');
      const dois = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));

      console.log(chalk.blue(`📚 Processing ${dois.length} references...\n`));

      const manager = new BibliographyManager();
      let successful = 0;
      let failed = 0;

      for (let i = 0; i < dois.length; i++) {
        console.log(chalk.gray(`\n[${i + 1}/${dois.length}]`));
        try {
          await manager.processReference(dois[i], {
            autoResolveAuthors: options.autoResolve,
            autoResolveJournals: options.autoResolve
          });
          successful++;
        } catch (error: any) {
          console.error(chalk.red('Failed:'), error.message);
          failed++;
        }
      }

      console.log(chalk.blue('\n📊 Batch processing complete:'));
      console.log(chalk.green(`  ✓ Successful: ${successful}`));
      if (failed > 0) {
        console.log(chalk.red(`  ✗ Failed: ${failed}`));
      }
    } catch (error: any) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Set up Anytype API configuration interactively')
  .option('--reset', 'Reset existing configuration')
  .addHelpText('after', `
Examples:
  $ anytype-bib setup
  $ anytype-bib setup --reset

What you'll need:
  1. Anytype desktop app running and logged in
  2. Your Anytype API key (from Anytype settings)
  3. Your Space ID (from Anytype app)
  4. Optionally: OpenAI or Anthropic API key for AI features

The setup will create a .env file with your configuration.
`)
  .action(async (options) => {
    console.log(chalk.blue('🔧 Anytype Bibliography Manager Setup\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiKey',
        message: 'Enter your Anytype API key:',
        validate: (input) => input.trim().length > 0 || 'API key is required'
      },
      {
        type: 'input',
        name: 'spaceId',
        message: 'Enter your Anytype Space ID:',
        validate: (input) => input.trim().length > 0 || 'Space ID is required'
      },
      {
        type: 'input',
        name: 'host',
        message: 'Anytype host:',
        default: 'localhost'
      },
      {
        type: 'input',
        name: 'port',
        message: 'Anytype port:',
        default: '31009'
      },
      {
        type: 'confirm',
        name: 'aiSetup',
        message: 'Would you like to set up AI integration? (optional)',
        default: false
      }
    ]);

    let envContent = `# Anytype Configuration
ANYTYPE_API_KEY=${answers.apiKey}
ANYTYPE_SPACE_ID=${answers.spaceId}
ANYTYPE_HOST=${answers.host}
ANYTYPE_PORT=${answers.port}

`;

    if (answers.aiSetup) {
      const aiAnswers = await inquirer.prompt([
        {
          type: 'list',
          name: 'aiProvider',
          message: 'Select AI provider:',
          choices: ['OpenAI', 'Anthropic', 'None']
        },
        {
          type: 'input',
          name: 'apiKey',
          message: (answers) => `Enter your ${answers.aiProvider} API key:`,
          when: (answers) => answers.aiProvider !== 'None'
        }
      ]);

      if (aiAnswers.aiProvider === 'OpenAI') {
        envContent += `# AI Integration
OPENAI_API_KEY=${aiAnswers.apiKey || ''}
ANTHROPIC_API_KEY=

`;
      } else if (aiAnswers.aiProvider === 'Anthropic') {
        envContent += `# AI Integration
OPENAI_API_KEY=
ANTHROPIC_API_KEY=${aiAnswers.apiKey || ''}

`;
      }
    } else {
      envContent += `# AI Integration
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

`;
    }

    envContent += `# Advanced Settings
DEBUG=false
MAX_RETRY_ATTEMPTS=3
DUPLICATE_THRESHOLD=0.8
`;

    const envPath = path.join(process.cwd(), '.env');
    fs.writeFileSync(envPath, envContent);

    console.log(chalk.green('\n✅ Configuration saved to .env file'));
    console.log(chalk.gray('You can now use the "add" command to add references.'));
  });

program
  .command('test')
  .description('Test Anytype API connection and show space statistics')
  .option('-q, --quiet', 'Show only connection status')
  .addHelpText('after', `
Examples:
  $ anytype-bib test
  $ anytype-bib test --quiet

This command will:
  1. Test your API connection to Anytype
  2. Show statistics about your space (articles, authors, journals, books)
  3. Verify your configuration is working

Run this after setup to ensure everything is configured correctly.
`)
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔍 Testing Anytype connection...\n'));

      const { AnytypeClient } = await import('../anytype/client');
      const client = new AnytypeClient();

      // Test search
      const objects = await client.searchByType('reference');
      console.log(chalk.green('✓ API connection successful'));
      console.log(`  Found ${objects.length} articles in your space`);

      // Show some stats
      const persons = await client.searchByType('human');
      const journals = await client.searchByType('journal');
      const books = await client.searchByType('book');

      console.log(chalk.blue('\n📊 Space statistics:'));
      console.log(`  Articles: ${objects.length}`);
      console.log(`  People: ${persons.length}`);
      console.log(`  Journals: ${journals.length}`);
      console.log(`  Books: ${books.length}`);

    } catch (error: any) {
      console.error(chalk.red('❌ Connection failed:'), error.message);
      console.log(chalk.yellow('\nPlease check:'));
      console.log('  1. Anytype desktop app is running');
      console.log('  2. You are logged into your account');
      console.log('  3. Your API key is correct');
      console.log('  4. Run "anytype-bib setup" to reconfigure');
      process.exit(1);
    }
  });

// Add search command for exploring existing content
program
  .command('search')
  .description('Search for existing references in your Anytype space')
  .argument('[query]', 'Search query (author name, title keywords, journal)')
  .option('-t, --type <type>', 'Filter by type: article, author, journal, book', 'article')
  .option('-l, --limit <number>', 'Maximum number of results', '10')
  .addHelpText('after', `
Examples:
  $ anytype-bib search "quantum optics"
  $ anytype-bib search --type author "Einstein"
  $ anytype-bib search --type journal "Physical Review"
  $ anytype-bib search --limit 20 "machine learning"

This helps you explore what's already in your Anytype space.
`)
  .action(async (query, options) => {
    try {
      const { AnytypeClient } = await import('../anytype/client');
      const client = new AnytypeClient();

      const typeMap: { [key: string]: string } = {
        'article': 'reference',
        'author': 'human',
        'journal': 'journal',
        'book': 'book'
      };

      const typeKey = typeMap[options.type] || 'reference';
      const limit = parseInt(options.limit) || 10;

      console.log(chalk.blue(`🔍 Searching for ${options.type}s...`));

      const results = await client.searchByType(typeKey, limit);

      if (query) {
        // Filter by query if provided
        const filtered = results.filter(obj =>
          obj.name?.toLowerCase().includes(query.toLowerCase())
        );

        console.log(chalk.green(`\n✓ Found ${filtered.length} ${options.type}s matching "${query}":`));
        filtered.forEach((obj, i) => {
          console.log(`${i + 1}. ${obj.name}`);
        });
      } else {
        console.log(chalk.green(`\n✓ Found ${results.length} ${options.type}s:`));
        results.forEach((obj, i) => {
          console.log(`${i + 1}. ${obj.name}`);
        });
      }

    } catch (error: any) {
      console.error(chalk.red('❌ Search failed:'), error.message);
      process.exit(1);
    }
  });

// Add stats command
program
  .command('stats')
  .description('Show detailed statistics about your bibliography')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  $ anytype-bib stats
  $ anytype-bib stats --json

Shows counts and recent additions for all bibliography types.
`)
  .action(async (options) => {
    try {
      const { AnytypeClient } = await import('../anytype/client');
      const client = new AnytypeClient();

      console.log(chalk.blue('📊 Gathering bibliography statistics...\n'));

      const [articles, authors, journals, books] = await Promise.all([
        client.searchByType('reference'),
        client.searchByType('human'),
        client.searchByType('journal'),
        client.searchByType('book')
      ]);

      const stats = {
        articles: articles.length,
        authors: authors.length,
        journals: journals.length,
        books: books.length,
        total: articles.length + authors.length + journals.length + books.length,
        recent_articles: articles.slice(0, 5).map(a => a.name),
        recent_authors: authors.slice(0, 5).map(a => a.name)
      };

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log(chalk.green('📚 Bibliography Statistics:'));
        console.log(`  Articles: ${chalk.cyan(stats.articles)}`);
        console.log(`  Authors: ${chalk.cyan(stats.authors)}`);
        console.log(`  Journals: ${chalk.cyan(stats.journals)}`);
        console.log(`  Books: ${chalk.cyan(stats.books)}`);
        console.log(`  Total: ${chalk.cyan(stats.total)}`);

        if (stats.recent_articles.length > 0) {
          console.log(chalk.blue('\n📖 Recent Articles:'));
          stats.recent_articles.forEach((title, i) => {
            console.log(`  ${i + 1}. ${title}`);
          });
        }
      }

    } catch (error: any) {
      console.error(chalk.red('❌ Stats failed:'), error.message);
      process.exit(1);
    }
  });

program.parse();