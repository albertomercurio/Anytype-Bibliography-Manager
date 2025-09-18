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
  .description('Automated bibliography management for Anytype')
  .version('1.0.0');

program
  .command('add')
  .description('Add a new reference to Anytype')
  .argument('[doi]', 'DOI of the reference')
  .option('-p, --pdf <path>', 'Path to PDF file to attach')
  .option('-a, --auto-resolve', 'Automatically resolve duplicates (use existing)')
  .option('-s, --skip-duplicates', 'Skip duplicate checking')
  .option('--ai', 'Use AI for enhanced processing (requires API key)')
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
  .description('Add multiple references from a file')
  .argument('<file>', 'Path to file containing DOIs (one per line)')
  .option('-a, --auto-resolve', 'Automatically resolve duplicates')
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
  .description('Set up Anytype API configuration')
  .action(async () => {
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
  .description('Test Anytype API connection')
  .action(async () => {
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

program.parse();