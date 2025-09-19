import { AnytypeClient } from '../anytype/client';
import { DOIResolver } from './doi-resolver';
import { BibTeXFormatter } from './bibtex-formatter';
import { DuplicateDetector } from './duplicate-detector';
import { AuthorInfo } from '../types/crossref';
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

      // Use provided familyName/givenName, or parse the full name with better logic
      let lastName = author.familyName;
      let firstName = author.givenName;

      if (!lastName || !firstName) {
        const parsed = this.parseAuthorName(author.fullName);
        lastName = lastName || parsed.lastName;
        firstName = firstName || parsed.firstName;
      }

      // Ensure we have at least a last name
      if (!lastName) {
        lastName = author.fullName || 'Unknown';
      }

      // Check for duplicates
      const duplicates = await this.duplicateDetector.checkPersonDuplicate(
        lastName,
        firstName,
        author.orcid
      );

      let personId: string | null = null;

      if (duplicates.length > 0) {
        const bestMatch = duplicates[0]; // Already sorted by similarity

        if (options.autoResolveAuthors) {
          // Auto-resolve: use the best match if it's high confidence
          if (bestMatch.matchType === 'exact' || bestMatch.similarity >= 0.9) {
            personId = bestMatch.object.id;
            console.log(chalk.gray(`  Using existing author (${bestMatch.matchReason}): ${bestMatch.object.name}`));
          } else if (bestMatch.similarity >= 0.8) {
            // Medium confidence matches - still use but with a note
            personId = bestMatch.object.id;
            console.log(chalk.yellow(`  Using existing author (${Math.round(bestMatch.similarity * 100)}% match): ${bestMatch.object.name}`));
          }
          // If similarity < 0.8, create new author (fall through to creation)
        } else {
          // Interactive mode: prompt user for decision
          console.log(chalk.yellow('  Possible duplicates found:'));

          const choices = [
            ...duplicates.slice(0, 5).map((dup) => ({
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
        }
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

    if (duplicates.length > 0) {
      const bestMatch = duplicates[0]; // Already sorted by similarity

      if (options.autoResolveJournals) {
        // Auto-resolve: use the best match if it's high confidence
        if (bestMatch.matchType === 'exact' || bestMatch.similarity >= 0.9) {
          console.log(chalk.gray(`  Using existing journal (${bestMatch.matchReason}): ${bestMatch.object.name}`));
          return bestMatch.object.id;
        } else if (bestMatch.similarity >= 0.8) {
          // Medium confidence matches - still use but with a note
          console.log(chalk.yellow(`  Using existing journal (${Math.round(bestMatch.similarity * 100)}% match): ${bestMatch.object.name}`));
          return bestMatch.object.id;
        }
        // If similarity < 0.8, create new journal (fall through to creation)
      } else {
        // Interactive mode: prompt user for decision
        console.log(chalk.yellow('  Possible duplicates found:'));

        const choices = [
          ...duplicates.slice(0, 5).map((dup) => ({
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
      }
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

  private parseAuthorName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/);
    
    if (parts.length === 0) {
      return { firstName: '', lastName: '' };
    } else if (parts.length === 1) {
      return { firstName: '', lastName: parts[0] };
    } else if (parts.length === 2) {
      return { firstName: parts[0], lastName: parts[1] };
    } else {
      // For 3+ parts, use heuristics to identify compound last names
      // Common patterns: "Di", "De", "Van", "Von", "Del", "Da", "La", "Le", etc.
      const lastNamePrefixes = new Set(['di', 'de', 'van', 'von', 'del', 'da', 'la', 'le', 'el', 'al', 'bin', 'ibn', 'mac', 'mc', 'o', 'san', 'santa']);
      
      // Find the start of the last name (look for prefixes)
      let lastNameStartIndex = parts.length - 1;
      
      for (let i = parts.length - 2; i >= 1; i--) {
        const part = parts[i].toLowerCase();
        if (lastNamePrefixes.has(part) || part.endsWith('.')) {
          lastNameStartIndex = i;
        } else {
          break;
        }
      }
      
      const lastName = parts.slice(lastNameStartIndex).join(' ');
      const firstName = parts.slice(0, lastNameStartIndex).join(' ');
      return { firstName, lastName };
    }
  }

  async refreshBibTeXEntries(options: {
    limit?: number;
    dryRun?: boolean;
    skipConfirmation?: boolean;
  } = {}): Promise<void> {
    const typeKeys = this.client.getTypeKeys();
    
    // Get all articles
    console.log(chalk.blue('📚 Finding existing articles...'));
    const allArticles = await this.client.searchByType(typeKeys.article, options.limit || 1000);
    
    if (allArticles.length === 0) {
      console.log(chalk.yellow('No articles found in your space.'));
      return;
    }

    console.log(chalk.green(`✓ Found ${allArticles.length} articles`));

    // Filter articles that have DOIs
    const articlesWithDOI = allArticles.filter(article => {
      const doiProp = article.properties?.find(p => p.key === 'doi');
      return doiProp && (doiProp.text || doiProp.value);
    });

    console.log(chalk.blue(`📋 ${articlesWithDOI.length} articles have DOIs that can be refreshed`));

    if (articlesWithDOI.length === 0) {
      console.log(chalk.yellow('No articles with DOIs found. Nothing to refresh.'));
      return;
    }

    // Limit articles if specified
    const articlesToProcess = options.limit ? articlesWithDOI.slice(0, options.limit) : articlesWithDOI;

    if (!options.skipConfirmation && !options.dryRun) {
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: `Update BibTeX for ${articlesToProcess.length} articles?`,
        default: false
      }]);

      if (!proceed) {
        console.log(chalk.gray('Cancelled.'));
        return;
      }
    }
    
    if (options.dryRun) {
      console.log(chalk.cyan(`🔍 Dry run: Will preview changes for ${articlesToProcess.length} articles`));
    }

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    console.log(chalk.blue(`\n🔄 Processing ${articlesToProcess.length} articles...\n`));

    for (let i = 0; i < articlesToProcess.length; i++) {
      const article = articlesToProcess[i];
      const doiProp = article.properties?.find(p => p.key === 'doi');
      const doi = doiProp?.text || doiProp?.value;

      console.log(chalk.gray(`[${i + 1}/${articlesToProcess.length}] ${article.name}`));

      if (!doi) {
        console.log(chalk.yellow('  ⚠️  No DOI found, skipping'));
        skipped++;
        continue;
      }

      try {
        // Fetch fresh metadata from DOI
        const spinner = ora('  Fetching metadata...').start();
        const metadata = await this.doiResolver.resolve(doi);
        spinner.stop();

        if (!metadata) {
          console.log(chalk.red('  ✗ Failed to fetch metadata'));
          failed++;
          continue;
        }

        // Generate new BibTeX
        const newBibTeX = this.bibtexFormatter.formatEntry(metadata);
        
        // Get current BibTeX for comparison
        const currentBibTeXProp = article.properties?.find(p => p.key === 'bib_te_x');
        const currentBibTeX = currentBibTeXProp?.text || currentBibTeXProp?.value || '';

        if (options.dryRun) {
          console.log(chalk.cyan('  📋 Would update BibTeX:'));
          console.log(chalk.gray('    Current authors in BibTeX:'));
          const currentAuthors = this.extractAuthorsFromBibTeX(currentBibTeX);
          console.log(chalk.gray(`      ${currentAuthors}`));
          
          console.log(chalk.gray('    New authors in BibTeX:'));
          const newAuthors = this.extractAuthorsFromBibTeX(newBibTeX);
          console.log(chalk.green(`      ${newAuthors}`));
          updated++;
        } else {
          // Update the BibTeX field
          const success = await this.client.updateObject(article.id, [
            { key: 'bib_te_x', text: newBibTeX }
          ]);

          if (success) {
            console.log(chalk.green('  ✓ BibTeX updated'));
            updated++;
          } else {
            console.log(chalk.red('  ✗ Failed to update'));
            failed++;
          }
        }

      } catch (error: any) {
        console.log(chalk.red(`  ✗ Error: ${error.message}`));
        failed++;
      }
    }

    console.log(chalk.blue('\n📊 Refresh complete:'));
    if (options.dryRun) {
      console.log(chalk.cyan(`  📋 Would update: ${updated}`));
    } else {
      console.log(chalk.green(`  ✓ Updated: ${updated}`));
    }
    if (failed > 0) {
      console.log(chalk.red(`  ✗ Failed: ${failed}`));
    }
    if (skipped > 0) {
      console.log(chalk.yellow(`  ⚠️  Skipped: ${skipped}`));
    }
  }

  private extractAuthorsFromBibTeX(bibtex: string): string {
    const match = bibtex.match(/author\s*=\s*\{([^}]+)\}/);
    return match ? match[1] : 'No authors found';
  }
}