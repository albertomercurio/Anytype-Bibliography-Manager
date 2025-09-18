import { AnytypeClient } from '../anytype/client';
import { DOIResolver } from './doi-resolver';
import { BibTeXFormatter } from './bibtex-formatter';
import { DuplicateDetector, DuplicateCandidate } from './duplicate-detector';
import { DOIMetadata, AuthorInfo } from '../types/crossref';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';

export interface ProcessingOptions {
  autoResolveAuthors?: boolean;
  autoResolveJournals?: boolean;
  skipDuplicateCheck?: boolean;
  pdfPath?: string;
  useAI?: boolean;
}

export class BibliographyManager {
  private client: AnytypeClient;
  private doiResolver: DOIResolver;
  private bibtexFormatter: BibTeXFormatter;
  private duplicateDetector: DuplicateDetector;

  constructor() {
    this.client = new AnytypeClient();
    this.doiResolver = new DOIResolver();
    this.bibtexFormatter = new BibTeXFormatter();
    this.duplicateDetector = new DuplicateDetector(this.client);
  }

  async processReference(doi: string, options: ProcessingOptions = {}): Promise<void> {
    console.log(chalk.blue('\n📚 Processing reference from DOI...'));

    // Check for existing article with same DOI
    if (!options.skipDuplicateCheck) {
      const spinner = ora('Checking for existing article...').start();
      const duplicates = await this.duplicateDetector.checkArticleDuplicate(doi);
      spinner.stop();

      if (duplicates.length > 0) {
        console.log(chalk.yellow('\n⚠️  Article with this DOI already exists:'));
        console.log(`  ${duplicates[0].object.name}`);

        const { action } = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Skip (do not create duplicate)', value: 'skip' },
            { name: 'Update existing article', value: 'update' },
            { name: 'Create new article anyway', value: 'create' }
          ]
        }]);

        if (action === 'skip') {
          console.log(chalk.gray('Skipped.'));
          return;
        } else if (action === 'update') {
          // TODO: Implement update logic
          console.log(chalk.yellow('Update functionality not yet implemented.'));
          return;
        }
      }
    }

    // Fetch metadata from DOI
    const spinner = ora('Fetching metadata from DOI...').start();
    const metadata = await this.doiResolver.resolve(doi);
    spinner.stop();

    if (!metadata) {
      console.log(chalk.red('❌ Failed to fetch metadata for DOI:'), doi);
      return;
    }

    console.log(chalk.green('✓ Metadata retrieved:'));
    console.log(`  Title: ${chalk.cyan(metadata.title)}`);
    console.log(`  Authors: ${chalk.cyan(metadata.authors.map(a => a.fullName).join(', '))}`);
    console.log(`  Year: ${chalk.cyan(metadata.year || 'Unknown')}`);
    console.log(`  Journal: ${chalk.cyan(metadata.journal || 'Unknown')}`);

    // Generate BibTeX
    const bibtex = this.bibtexFormatter.formatEntry(metadata);
    console.log(chalk.green('\n✓ BibTeX generated'));

    // Process authors
    const authorIds = await this.processAuthors(metadata.authors, options);

    // Process journal
    let journalId: string | undefined;
    if (metadata.journal) {
      journalId = await this.processJournal(metadata.journal, options);
    }

    // Create the article
    const articleSpinner = ora('Creating article in Anytype...').start();
    const articleId = await this.client.createArticle({
      title: metadata.title,
      doi: metadata.doi,
      authors: authorIds,
      year: metadata.year,
      journal: journalId,
      url: metadata.url,
      bibtex
    });
    articleSpinner.stop();

    if (articleId) {
      console.log(chalk.green('✅ Article created successfully!'));
      console.log(`  ID: ${chalk.gray(articleId)}`);
    } else {
      console.log(chalk.red('❌ Failed to create article'));
    }

    // Handle PDF attachment if provided
    if (options.pdfPath) {
      console.log(chalk.yellow('📎 PDF attachment functionality not yet implemented'));
      // TODO: Implement PDF upload when Anytype API supports it
    }
  }

  private async processAuthors(authors: AuthorInfo[], options: ProcessingOptions): Promise<string[]> {
    const authorIds: string[] = [];

    for (const author of authors) {
      console.log(chalk.blue(`\n👤 Processing author: ${author.fullName}`));

      const lastName = author.familyName || author.fullName.split(' ').pop() || '';
      const firstName = author.givenName;

      // Check for duplicates
      const duplicates = await this.duplicateDetector.checkPersonDuplicate(
        lastName,
        firstName,
        author.orcid
      );

      let personId: string | null = null;

      if (duplicates.length > 0 && !options.autoResolveAuthors) {
        console.log(chalk.yellow('  Possible duplicates found:'));

        const choices = [
          ...duplicates.slice(0, 5).map((dup, i) => ({
            name: `${dup.object.name} (${dup.matchReason}, ${Math.round(dup.similarity * 100)}% match)`,
            value: dup.object.id
          })),
          { name: 'Create new author', value: 'new' },
          { name: 'Skip this author', value: 'skip' }
        ];

        const { action } = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: 'Select an option:',
          choices
        }]);

        if (action === 'skip') {
          continue;
        } else if (action !== 'new') {
          personId = action;
          console.log(chalk.gray(`  Using existing author: ${duplicates.find(d => d.object.id === action)?.object.name}`));
        }
      } else if (duplicates.length > 0 && duplicates[0].matchType === 'exact') {
        personId = duplicates[0].object.id;
        console.log(chalk.gray(`  Using existing author (exact match): ${duplicates[0].object.name}`));
      }

      // Create new author if needed
      if (!personId) {
        personId = await this.client.createPerson({
          firstName: author.givenName,
          lastName: author.familyName,
          orcid: author.orcid
        });

        if (personId) {
          console.log(chalk.green(`  ✓ Created new author: ${author.fullName}`));
        } else {
          console.log(chalk.red(`  ✗ Failed to create author: ${author.fullName}`));
        }
      }

      if (personId) {
        authorIds.push(personId);
      }
    }

    return authorIds;
  }

  private async processJournal(journalName: string, options: ProcessingOptions): Promise<string | undefined> {
    console.log(chalk.blue(`\n📖 Processing journal: ${journalName}`));

    // Check for duplicates
    const duplicates = await this.duplicateDetector.checkJournalDuplicate(journalName);

    if (duplicates.length > 0 && !options.autoResolveJournals) {
      console.log(chalk.yellow('  Possible duplicates found:'));

      const choices = [
        ...duplicates.slice(0, 5).map((dup, i) => ({
          name: `${dup.object.name} (${dup.matchReason}, ${Math.round(dup.similarity * 100)}% match)`,
          value: dup.object.id
        })),
        { name: 'Create new journal', value: 'new' },
        { name: 'Skip journal', value: 'skip' }
      ];

      const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'Select an option:',
        choices
      }]);

      if (action === 'skip') {
        return undefined;
      } else if (action !== 'new') {
        console.log(chalk.gray(`  Using existing journal: ${duplicates.find(d => d.object.id === action)?.object.name}`));
        return action;
      }
    } else if (duplicates.length > 0 && duplicates[0].matchType === 'exact') {
      console.log(chalk.gray(`  Using existing journal (exact match): ${duplicates[0].object.name}`));
      return duplicates[0].object.id;
    }

    // Create new journal
    const journalId = await this.client.createJournal(journalName);

    if (journalId) {
      console.log(chalk.green(`  ✓ Created new journal: ${journalName}`));
      return journalId;
    } else {
      console.log(chalk.red(`  ✗ Failed to create journal: ${journalName}`));
      return undefined;
    }
  }
}