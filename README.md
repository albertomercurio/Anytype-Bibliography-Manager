# Anytype Bibliography Manager

Automated bibliography management for Anytype with DOI extraction, BibTeX generation, and intelligent duplicate detection.

## Features

- 📚 **DOI Metadata Extraction**: Automatically fetch article/book metadata from CrossRef and DataCite
- 🔖 **BibTeX Generation**: Create properly formatted BibTeX entries with customizable cite keys
- 🔍 **Intelligent Duplicate Detection**: Smart matching for authors (including ORCID), journals (including abbreviations), and articles
- 👥 **Author Management**: Handle author name variations, abbreviations, and ORCID identifiers
- 📖 **Journal Recognition**: Detect journal abbreviations and variations
- 🤖 **AI Integration** (optional): Use OpenAI or Anthropic for enhanced processing
- 📄 **PDF Support** (planned): Attach PDFs to references

## Prerequisites

- Node.js 18+ and npm
- Anytype desktop app (v0.46.7+)
- Active Anytype account with API access
- A Research space configured with Article, Person, Journal, and Book types

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/anytype-bibliography-manager.git
cd anytype-bibliography-manager

# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Make the CLI globally available (optional)
npm link
```

## Setup

### 1. Get your Anytype API Key

1. Open Anytype desktop app
2. Go to Settings → API Keys
3. Click "Create new"
4. Copy the generated API key

### 2. Configure the tool

Run the setup command:

```bash
npx tsx src/cli/index.ts setup
# or if installed globally:
anytype-bib setup
```

This will prompt you for:
- Your Anytype API key
- Your Space ID (visible in the test output)
- Optional AI provider configuration

### 3. Test the connection

```bash
npx tsx src/cli/index.ts test
```

## Usage

### Add a single reference

```bash
# Interactive mode
npx tsx src/cli/index.ts add

# With DOI directly
npx tsx src/cli/index.ts add "10.1103/PhysRevLett.130.213604"

# With options
npx tsx src/cli/index.ts add "10.1103/PhysRevLett.130.213604" --auto-resolve --pdf paper.pdf
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
npx tsx src/cli/index.ts batch dois.txt --auto-resolve
```

### Command Options

- `--auto-resolve`: Automatically use existing authors/journals when duplicates are found
- `--skip-duplicates`: Skip duplicate checking entirely
- `--pdf <path>`: Attach a PDF file (coming soon)
- `--ai`: Use AI for enhanced processing (requires API key)

## How It Works

1. **DOI Resolution**: Fetches metadata from CrossRef (primary) or DataCite (fallback)
2. **BibTeX Generation**: Creates formatted BibTeX with:
   - Title in double braces `{{title}}` to preserve capitalization
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

The `.env` file contains:

```env
# Anytype Configuration
ANYTYPE_API_KEY=your_key_here
ANYTYPE_SPACE_ID=your_space_id
ANYTYPE_HOST=localhost
ANYTYPE_PORT=31009

# Optional: AI Integration
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Advanced Settings
DEBUG=false
MAX_RETRY_ATTEMPTS=3
DUPLICATE_THRESHOLD=0.8  # Similarity threshold for duplicate detection
```

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Build for production
npm run build
```

## Troubleshooting

### "API connection failed"
- Ensure Anytype desktop app is running
- Verify you're logged into your account
- Check your API key is correct
- Run `anytype-bib setup` to reconfigure

### "Type 'reference' not found"
- Ensure your space has the Article type configured
- The tool expects specific type keys (Article, Person, Journal, Book)

### Duplicate detection too aggressive/loose
- Adjust `DUPLICATE_THRESHOLD` in `.env` (0.0-1.0, default 0.8)

## Roadmap

- [ ] PDF upload support (pending Anytype API)
- [ ] AI-powered paper summaries
- [ ] arXiv integration
- [ ] Export bibliography to various formats
- [ ] Web interface
- [ ] Mobile app support

## License

MIT
