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
- A Research space with object types for articles, people, journals, and books (the tool will automatically discover these during setup)

## Installation

```bash
# Clone the repository
git clone https://github.com/albertomercurio/Anytype-Bibliography-Manager.git
cd Anytype-Bibliography-Manager

# Install globally (recommended)
npm install -g .

# Or for development
npm install
npm run build
npm link
```

After installation, you can use `anytype-bib` from anywhere in your terminal instead of `npx tsx src/cli/index.ts`.

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

## Roadmap

- [ ] PDF upload support (pending Anytype API)
- [ ] AI-powered paper summaries
- [ ] arXiv integration
- [ ] Export bibliography to various formats
- [ ] Web interface
- [ ] Mobile app support
