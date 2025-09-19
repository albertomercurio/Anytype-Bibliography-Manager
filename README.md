# Anytype Bibliography Manager

Automated bibliography management for Anytype with DOI extraction, BibTeX generation, and intelligent duplicate detection.

## Features

- 📚 **DOI Metadata Extraction**: Automatically fetch article/book metadata from CrossRef and DataCite
- 🔖 **BibTeX Generation**: Create properly formatted BibTeX entries with LaTeX-compatible author formatting
- 🔧 **BibTeX Repair**: Fix author formatting in existing articles to ensure LaTeX compatibility
- 🔍 **Intelligent Duplicate Detection**: Smart matching for authors (including ORCID), journals (including abbreviations), and articles
- 👥 **Author Management**: Handle author name variations, abbreviations, and ORCID identifiers
- 📖 **Journal Recognition**: Detect journal abbreviations and variations
- 🤖 **AI Integration** (optional): Use OpenAI or Anthropic for enhanced processing
- 🧪 **Comprehensive Testing**: Full test suite for validation and integration testing
- 🛠 **Code Quality**: Refactored codebase with shared utilities and improved error handling
- 📄 **PDF Support** (planned): Attach PDFs to references

## Prerequisites

- Node.js 18+ and npm
- Anytype desktop app (v0.46.7+)
- Active Anytype account with API access
- A Research space with object types for articles, people, journals, and books (the tool will automatically discover these during setup)

> **Note**: The project is written in TypeScript and needs to be compiled before installation. All build tools are included as dependencies.

## Installation

```bash
# Clone the repository
git clone https://github.com/albertomercurio/Anytype-Bibliography-Manager.git
cd Anytype-Bibliography-Manager

# Install dependencies
npm install

# Build the project (compile TypeScript to JavaScript)
npm run build

# Install globally (recommended)
npm install -g .

# Or for development (with hot reload)
npm install
npm run dev  # This runs the tool directly from TypeScript source
```

After global installation, you can use `anytype-bib` from anywhere in your terminal.

## Setup

### 1. Get your Anytype API Key

1. Open Anytype desktop app
2. Go to Settings → API Keys
3. Click "Create new"
4. Copy the generated API key

### 2. Configure the tool

Run the setup command:

```bash
anytype-bib setup
```

This will prompt you for:
- Your Anytype API key
- Your Space ID (visible in the test output)
- Optional AI provider configuration

The setup process will also automatically discover the object types in your Anytype space that correspond to articles, people, journals, and books. If the tool can't find the appropriate object types, you may need to create them in your Anytype space.

Configuration is stored in `~/.anytype-bib/config.json` and works from any directory.

### 3. Test the connection

```bash
anytype-bib test
```

## Usage

### Add a single reference

```bash
# Interactive mode
anytype-bib add

# With DOI directly
anytype-bib add 10.1103/PhysRevLett.130.213604

# With options
anytype-bib add 10.1103/PhysRevLett.130.213604 --auto-resolve --pdf paper.pdf
```

### Batch import

Create a file with DOIs (one per line):

```text
10.1103/PhysRevLett.130.213604
10.1038/s41467-025-59152-z
10.1103/RevModPhys.86.1391
```

Then run:

```bash
anytype-bib batch dois.txt --auto-resolve
```

### Fix BibTeX formatting for existing articles

If you have existing articles that were created before the BibTeX author formatting was fixed, you can update them to use the correct LaTeX-compatible format:

```bash
# Preview what would be changed (recommended first step)
anytype-bib refresh-bibtex --dry-run

# Update first 10 articles with preview
anytype-bib refresh-bibtex --limit 10 --dry-run

# Update first 10 articles
anytype-bib refresh-bibtex --limit 10 --yes

# Update all articles (will ask for confirmation)
anytype-bib refresh-bibtex

# Update all articles without confirmation
anytype-bib refresh-bibtex --yes
```

**Why this is needed:** Earlier versions of the tool generated BibTeX with author names in the format "FirstName LastName and FirstName LastName". The correct LaTeX format is "LastName, FirstName and LastName, FirstName". This command fixes existing entries to use the proper format that LaTeX bibliography processors expect.

**What it does:**
- Finds all articles in your Anytype space that have DOIs
- Re-fetches metadata from CrossRef/DataCite for each article
- Regenerates BibTeX with the correct author formatting
- Updates only the BibTeX field (other metadata remains unchanged)
- Shows before/after comparison when using `--dry-run`

**Example of the fix:**
```diff
# Before (old format)
- author = {John Smith and Jane Doe and Robert Johnson}

# After (correct format) 
+ author = {Smith, John and Doe, Jane and Johnson, Robert}
```

### Command Options

**For `add` and `batch` commands:**
- `--auto-resolve`: Automatically use existing authors/journals when duplicates are found
- `--skip-duplicates`: Skip duplicate checking entirely
- `--pdf <path>`: Attach a PDF file (coming soon)
- `--ai`: Use AI for enhanced processing (requires API key)

**For `refresh-bibtex` command:**
- `--dry-run`: Preview changes without updating anything in Anytype
- `--limit <number>`: Process only the first N articles (useful for testing)
- `--yes`: Skip confirmation prompt and proceed automatically

## How It Works

1. **DOI Resolution**: Fetches metadata from CrossRef (primary) or DataCite (fallback)
2. **BibTeX Generation**: Creates formatted BibTeX with:
   - Title in double braces `{{title}}` to preserve capitalization
   - Authors in LaTeX format: `LastName, FirstName and LastName, FirstName`
   - Cite key format: `LastYYYYTitle` (sanitized for LaTeX compatibility)
3. **Duplicate Detection**:
   - Articles: Exact DOI matching
   - Authors: ORCID (if available), name similarity, abbreviation detection
   - Journals: Name normalization, abbreviation recognition
4. **Interactive Resolution**: When duplicates are found, you can:
   - Use existing object
   - Create new anyway
   - Skip

## Configuration

Configuration is stored in `~/.anytype-bib/config.json` and includes:

```json
{
  "anytype": {
    "apiKey": "your_api_key",
    "spaceId": "your_space_id",
    "host": "localhost",
    "port": "31009"
  },
  "typeKeys": {
    "article": "reference",
    "person": "human", 
    "journal": "journal",
    "book": "book"
  },
  "ai": {
    "openaiApiKey": "optional",
    "anthropicApiKey": "optional"
  },
  "settings": {
    "debug": false,
    "maxRetryAttempts": 3,
    "duplicateThreshold": 0.8
  }
}
```

The `typeKeys` section is automatically populated during setup by discovering the object types in your Anytype space. The tool looks for object types with names like "Article", "Person", "Author", "Journal", "Book", etc., and maps them to the appropriate functions.

### Migration from .env files

If you have an existing `.env` file, run `anytype-bib setup` and it will offer to migrate your configuration automatically.

## Testing

The project includes comprehensive tests to ensure reliability:

### Quick Tests (Recommended)
Run fast validation tests without requiring API access:
```bash
npm run test:quick
# or simply:
npm test
```

These validate core functionality like text processing, name parsing, and BibTeX formatting.

### Simple Integration Tests (Recommended)
Run focused integration tests that verify core functionality without creating test spaces:
```bash
npm run test:simple
```

These tests validate:
- DOI resolution from CrossRef/DataCite APIs
- BibTeX generation with proper formatting  
- Anytype API connection and basic queries
- Core duplicate detection functionality

### Full Integration Tests
Run complete end-to-end tests with temporary space creation:
```bash
npm run test:integration
```

These tests create a temporary space and test the complete workflow, but require manual cleanup afterward.

### Integration Tests
Run complete tests with temporary space creation:
```bash
npm run test:integration
```

This creates a temporary space and tests:
- Temporary space creation with unique name (e.g., "BibTest-1234567890")
- Addition of 4 representative DOIs (reduced to avoid rate limits)
- Duplicate detection testing by re-adding same DOIs
- Author and journal uniqueness verification
- BibTeX formatting validation
- **Note**: Test spaces need manual cleanup from Anytype UI (API doesn't support space deletion)

See [test/README.md](test/README.md) for detailed test documentation.

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload (no build required)
npm run dev

# Build the project
npm run build

# Run quick tests
npm test

# Run simple integration tests (recommended)
npm run test:simple

# Run full integration tests
npm run test:integration

# Lint code
npm run lint

# Install locally for testing (after building)
npm link
```

For development, use `npm run dev` which runs the TypeScript source directly with hot reload. For production use, run `npm run build` first to compile the TypeScript to JavaScript.

## Troubleshooting

### "API connection failed"
- Ensure Anytype desktop app is running
- Verify you're logged into your account
- Check your API key is correct
- Run `anytype-bib setup` to reconfigure

### "Configuration not found"
- Run `anytype-bib setup` to create initial configuration
- Configuration is stored globally in `~/.anytype-bib/config.json`

### "Type 'reference' not found"
- Ensure your space has object types for articles, people, journals, and books
- Run `anytype-bib setup` again to rediscover object types in your space
- The tool automatically detects object types with names like "Article", "Person", "Journal", "Book", etc.
- If you have custom names, the tool will try to match them intelligently during setup

### Duplicate detection too aggressive/loose
- Adjust the duplicate threshold in your configuration:
  ```bash
  # Edit ~/.anytype-bib/config.json and change:
  "duplicateThreshold": 0.8  // 0.0-1.0, default 0.8
  ```

### BibTeX author formatting issues in LaTeX
- **Problem**: LaTeX bibliography processors don't sort or format authors correctly
- **Cause**: Older versions of this tool generated BibTeX with "FirstName LastName" format
- **Solution**: Run `anytype-bib refresh-bibtex --dry-run` to preview fixes, then `anytype-bib refresh-bibtex --yes` to update all articles
- **Result**: Authors will be formatted as "LastName, FirstName and LastName, FirstName" which is the standard LaTeX format

## Code Quality Improvements

This version includes significant code improvements:

### ✅ Refactoring Completed
- **Eliminated Code Duplication**: Extracted shared utilities for name parsing, text normalization, and string sanitization
- **Improved Error Handling**: Better error messages and validation throughout
- **Enhanced Type Safety**: More precise TypeScript types for better development experience
- **Optimized API Calls**: Reduced redundant searches and improved pagination efficiency
- **Comprehensive Testing**: Added quick validation tests and full integration test suite

### 📊 Test Coverage
- **Quick Tests**: Validate core logic without external dependencies
- **Integration Tests**: End-to-end testing with real Anytype API
- **BibTeX Validation**: Ensures proper LaTeX-compatible formatting
- **Duplicate Detection**: Verifies author and journal uniqueness

### 🛠 Development Tools
- Automated test suite for continuous validation
- Improved build process with better error reporting

## Roadmap

- [ ] PDF upload support (pending Anytype API)
- [ ] AI-powered paper summaries
- [ ] arXiv integration
- [ ] Export bibliography to various formats
- [ ] Web interface
- [ ] Mobile app support
- [x] Comprehensive test suite
- [x] Code refactoring and optimization
