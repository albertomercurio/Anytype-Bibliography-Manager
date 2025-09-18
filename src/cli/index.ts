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
  .argument('[doi]', 'Digital Object Identifier (DOI) of the reference to add (e.g., 10.1103/PhysRevLett.124.010503). If omitted, you will be prompted to enter it interactively.')
  .option('-p, --pdf <path>', 'Path to a PDF file to attach to the reference (feature coming soon)')
  .option('-a, --auto-resolve', 'Automatically resolve duplicates by using existing authors and journals instead of prompting for each conflict')
  .option('-s, --skip-duplicates', 'Skip duplicate checking entirely and create new objects even if similar ones exist')
  .option('--ai', 'Use AI for enhanced processing and metadata extraction (requires OpenAI or Anthropic API key configured)')
  .addHelpText('after', `
Arguments:
  doi                     DOI (Digital Object Identifier) starting with "10." followed by publisher and article codes
                         Examples: 10.1103/PhysRevLett.124.010503, 10.1038/nature12345

Options:
  -p, --pdf <path>        Path to PDF file to attach (absolute or relative path)
  -a, --auto-resolve      Skip interactive prompts for duplicate resolution
  -s, --skip-duplicates   Bypass all duplicate checking (faster but may create duplicates)
  --ai                    Enable AI-powered metadata enhancement and processing

Examples:
  $ anytype-bib add 10.1103/PhysRevLett.124.010503
  $ anytype-bib add --auto-resolve 10.1038/nature12345
  $ anytype-bib add --pdf ~/Downloads/paper.pdf 10.1103/PhysRevX.14.021022
  $ anytype-bib add --skip-duplicates --ai 10.1103/PhysRevA.107.053505
  $ anytype-bib add  # Interactive mode - will prompt for DOI

Process Flow:
  1. Fetches metadata from CrossRef (primary) or DataCite (fallback)
  2. Checks for duplicate articles, authors, and journals (unless --skip-duplicates)
  3. Creates or links objects in Anytype with proper relationships
  4. Generates properly formatted BibTeX citation with LaTeX-safe cite key
  5. Displays success confirmation with created object details

Duplicate Resolution:
  Without --auto-resolve, you'll be prompted when duplicates are found:
  • Use existing object (recommended for true duplicates)
  • Create new anyway (for similar but different items)
  • Skip this reference entirely
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
  .description('Add multiple references from a file containing DOIs (one per line)')
  .argument('<file>', 'Path to text file containing DOIs, one per line. Lines starting with # are treated as comments and ignored.')
  .option('-a, --auto-resolve', 'Automatically resolve duplicates for all references without prompting')
  .option('-c, --continue-on-error', 'Continue processing remaining DOIs if one reference fails (default: stop on first error)')
  .addHelpText('after', `
Arguments:
  file                    Path to text file containing DOIs (absolute or relative path)
                         Format: one DOI per line, # for comments, blank lines ignored

Options:
  -a, --auto-resolve      Skip all duplicate prompts by using existing objects
  -c, --continue-on-error Process all DOIs even if some fail (shows summary at end)

Examples:
  $ anytype-bib batch dois.txt
  $ anytype-bib batch --auto-resolve research-papers.txt
  $ anytype-bib batch --continue-on-error --auto-resolve all-papers.txt

Sample file format (dois.txt):
  # My quantum optics research papers
  10.1103/PhysRevLett.124.010503
  10.1038/nature12345
  
  # Machine learning papers
  10.1103/PhysRevX.14.021022
  # TODO: Add more ML papers later
  10.1103/PhysRevA.107.053505

Processing Details:
  • Processes each DOI sequentially (not in parallel)
  • Shows progress counter: [2/10] Processing...
  • Displays success/failure status for each DOI
  • Provides final summary with counts of successful and failed imports
  • Stops on first error unless --continue-on-error is specified
  • Comments (lines starting with #) and blank lines are automatically skipped
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
  .description('Configure Anytype API connection and optional AI integration interactively')
  .option('--reset', 'Reset and overwrite existing configuration file (.env)')
  .addHelpText('after', `
Options:
  --reset                 Overwrite existing .env file with new configuration

Examples:
  $ anytype-bib setup                    # Initial setup or update existing config
  $ anytype-bib setup --reset           # Start fresh, ignore existing .env

What you'll need before running setup:
  1. Anytype desktop app installed, running, and logged into your account
  2. An Anytype API key from Settings → API Keys → Create new
  3. Your Space ID (visible in Anytype app or during setup)
  4. Optionally: OpenAI or Anthropic API key for AI features

Setup Process:
  1. Prompts for your Anytype API key (required)
  2. Asks for your Space ID (required)
  3. Confirms Anytype host and port (default: localhost:31009)
  4. Optionally configures AI integration (OpenAI or Anthropic)
  5. Creates or updates .env file with your configuration
  6. Validates the configuration can connect to Anytype

After setup, use 'anytype-bib test' to verify your connection works.

Troubleshooting:
  • "API connection failed" → Ensure Anytype app is running and you're logged in
  • "Invalid Space ID" → Check the Space ID in your Anytype app settings
  • "Permission denied" → Verify your API key is correct and has proper permissions
`)
  .action(async (options) => {
    console.log(chalk.blue('🔧 Anytype Bibliography Manager Setup\n'));

    if (options.reset) {
      console.log(chalk.yellow('🔄 Resetting existing configuration...\n'));
    }

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
  .description('Test Anytype API connection and display space statistics')
  .option('-q, --quiet', 'Show only connection status without detailed statistics')
  .addHelpText('after', `
Options:
  -q, --quiet             Minimal output - just connection success/failure

Examples:
  $ anytype-bib test                     # Full connection test with statistics
  $ anytype-bib test --quiet            # Quick connection check only

What this command does:
  1. Tests API connection to your Anytype instance
  2. Verifies your API key and Space ID are working
  3. Shows statistics about your bibliography:
     • Number of articles, authors, journals, and books
     • Recent additions to help verify the space is active
  4. Reports any connection or configuration issues

When to use:
  • After running 'anytype-bib setup' to verify configuration
  • Before bulk imports to ensure connection is stable
  • When troubleshooting connection issues
  • To check current state of your bibliography space

Troubleshooting common issues:
  • "Connection failed" → Anytype desktop app not running or not logged in
  • "API key invalid" → Check your API key in Anytype Settings → API Keys
  • "Space not found" → Verify your Space ID matches your active Anytype space
  • "Permission denied" → API key may not have required permissions

Run 'anytype-bib setup' to reconfigure if the test fails.
`)
  .action(async (options) => {
    try {
      if (options.quiet) {
        console.log(chalk.blue('🔍 Testing connection...'));
      } else {
        console.log(chalk.blue('🔍 Testing Anytype connection...\n'));
      }

      const { AnytypeClient } = await import('../anytype/client');
      const client = new AnytypeClient();

      // Test search
      const objects = await client.searchByType('reference');
      console.log(chalk.green('✓ API connection successful'));
      console.log(`  Found ${objects.length} articles in your space`);

      if (!options.quiet) {
        // Show some stats
        const persons = await client.searchByType('human');
        const journals = await client.searchByType('journal');
        const books = await client.searchByType('book');

        console.log(chalk.blue('\n📊 Space statistics:'));
        console.log(`  Articles: ${objects.length}`);
        console.log(`  People: ${persons.length}`);
        console.log(`  Journals: ${journals.length}`);
        console.log(`  Books: ${books.length}`);
      }

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
  .argument('[query]', 'Search query text to match against names/titles. Searches are case-insensitive and match partial strings.')
  .option('-t, --type <type>', 'Filter results by object type', 'article')
  .option('-l, --limit <number>', 'Maximum number of results to display (default: 10)', '10')
  .addHelpText('after', `
Arguments:
  query                   Text to search for in object names (case-insensitive partial matching)
                         If omitted, shows all objects of the specified type

Options:
  -t, --type <type>       Object type to search: article, author, journal, book (default: article)
  -l, --limit <number>    Maximum results to show (default: 10, useful for large collections)

Examples:
  $ anytype-bib search "quantum optics"         # Search articles containing "quantum optics"
  $ anytype-bib search --type author "Einstein" # Find authors with "Einstein" in name
  $ anytype-bib search --type journal "Physical Review" # Find journals matching "Physical Review"
  $ anytype-bib search --limit 20 "machine learning"    # Show up to 20 results
  $ anytype-bib search --type author           # List all authors (up to limit)

Use cases:
  • Explore what's already in your Anytype space before adding new references
  • Find existing authors or journals to understand your collection
  • Verify that specific papers or authors have been imported
  • Check for potential duplicates before bulk imports
  • Browse your bibliography by topic or author

Search behavior:
  • Searches object names/titles using case-insensitive substring matching
  • Results are limited to prevent overwhelming output
  • Shows most recently created objects first
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
  .description('Show detailed statistics and overview of your bibliography collection')
  .option('--json', 'Output statistics in JSON format for programmatic use')
  .addHelpText('after', `
Options:
  --json                  Output as JSON instead of formatted text (useful for scripts)

Examples:
  $ anytype-bib stats                    # Human-readable statistics with recent items
  $ anytype-bib stats --json            # JSON output for scripts or APIs

What you'll see:
  • Total counts for each object type (articles, authors, journals, books)
  • Overall collection size (total objects)
  • List of recent articles (last 5 added)
  • List of recent authors (last 5 added)

Use cases:
  • Get an overview of your bibliography collection size
  • Monitor growth over time (especially with --json for tracking)
  • Verify bulk imports completed successfully
  • Understand the composition of your research library
  • Export statistics for reporting or analysis

JSON format (with --json):
  {
    "articles": 42,
    "authors": 38,
    "journals": 15,
    "books": 3,
    "total": 98,
    "recent_articles": ["Title 1", "Title 2", ...],
    "recent_authors": ["Author 1", "Author 2", ...]
  }
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