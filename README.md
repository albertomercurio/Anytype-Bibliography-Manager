# Anytype Bibliography Manager

Automated bibliography management for Anytype with DOI extraction, BibTeX generation, and intelligent duplicate detection.

## Features

- 📚 **DOI Metadata Extraction**: Automatically fetch article/book metadata from CrossRef and DataCite
- 🔖 **BibTeX Generation**: Create properly formatted BibTeX entries with LaTeX-compatible author formatting
- 🔧 **BibTeX Refresh**: Re-update BibTeX data for existing articles with improved formatting and metadata
- 🔍 **Intelligent Duplicate Detection**: Smart matching for authors (including ORCID), journals (including abbreviations), and articles
- 👥 **Author Management**: Handle author name variations, abbreviations, and ORCID identifiers
- 📖 **Journal Recognition**: Detect journal abbreviations and variations
- 🤖 **AI Integration** (optional): Use OpenAI or Anthropic for enhanced processing
- 🧪 **Comprehensive Testing**: Full test suite for validation and integration testing

## Prerequisites

### System Requirements
- Node.js 18+ and npm
- Anytype desktop app (v0.46.7+)
- Active Anytype account with API access

### Required Anytype Object Types
Your Anytype space must have the following object types configured with their respective properties:

| Object Type | Key | Required Properties | Property Types |
|-------------|-----|-------------------|----------------|
| **Article** | `reference` | `title`, `authors`, `journal`, `year`, `doi`, `url`, `bib_te_x` | text, objects, objects, number, text, url, text |
| **Person** | `human` | `first_name`, `last_name`, `orcid` | text, text, text |
| **Journal** | `journal` | (auto-managed by title) | - |
| **Book** | `book` | `authors`, `year`, `bib_te_x` | objects, number, text |

> **Note**: The tool automatically discovers these object types during setup. If any are missing, you'll need to create them in your Anytype space before using the tool. The project is written in TypeScript and needs to be compiled before installation.

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

### Refresh BibTeX data for existing articles

Update BibTeX formatting and metadata for articles already in your Anytype space:

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

**What it does:**
- Finds all articles in your Anytype space that have DOIs
- Re-fetches metadata from CrossRef/DataCite for each article
- Regenerates BibTeX with updated formatting and metadata
- Updates only the BibTeX field (other metadata remains unchanged)
- Shows before/after comparison when using `--dry-run`

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
   - Citation keys: `LastYYYYTitle` (sanitized for LaTeX compatibility)
3. **Duplicate Detection**:
   - Articles: Exact DOI matching
   - Authors: ORCID (if available), name similarity, abbreviation detection
   - Journals: Name normalization, abbreviation recognition
4. **Interactive Resolution**: When duplicates are found, you can choose to use existing objects, create new ones, or skip

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

### Quick Tests (Recommended)
```bash
npm run test:quick
# or simply:
npm test
```
Validates core functionality like text processing, name parsing, and BibTeX formatting without requiring API access.

### Simple Integration Tests (Recommended)
```bash
npm run test:simple
```
Tests DOI resolution, BibTeX generation, Anytype API connection, and duplicate detection with real APIs.

### Full Integration Tests
```bash
npm run test:integration
```
Complete end-to-end tests that create temporary spaces. **Note**: Test spaces require manual cleanup from Anytype UI.

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
- Ensure Anytype desktop app is running and you're logged in
- Verify your API key is correct
- Run `anytype-bib setup` to reconfigure

### "Configuration not found"
- Run `anytype-bib setup` to create initial configuration
- Configuration is stored globally in `~/.anytype-bib/config.json`

### "Type 'reference' not found"
- Ensure your space has the required object types (see Prerequisites section)
- Run `anytype-bib setup` again to rediscover object types
- The tool automatically detects object types during setup

### Duplicate detection issues
- Adjust the duplicate threshold in `~/.anytype-bib/config.json`:
  ```json
  "duplicateThreshold": 0.8  // 0.0-1.0, default 0.8
  ```

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Build the project
npm run build

# Run tests
npm test

# Install locally for testing (after building)
npm link
```

For development, use `npm run dev` which runs TypeScript source directly with hot reload.

## Roadmap

- [ ] PDF upload support (pending Anytype API)
- [ ] AI-powered paper summaries
- [ ] arXiv integration
- [ ] Export bibliography to various formats
- [ ] Web interface
- [x] Comprehensive test suite
- [x] Code refactoring and optimization
