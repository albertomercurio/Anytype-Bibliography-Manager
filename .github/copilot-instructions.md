# GitHub Copilot Instructions for Anytype Bibliography Manager

## Architecture Overview

This TypeScript CLI tool manages academic references in Anytype through a layered architecture:

- **CLI Layer** (`src/cli/`): Commander.js-based CLI with chalk styling and inquirer prompts
- **Core Layer** (`src/core/`): Business logic for bibliography management, DOI resolution, duplicate detection, and BibTeX formatting
- **Integration Layer** (`src/anytype/`): Anytype API client for CRUD operations
- **Types** (`src/types/`): TypeScript interfaces for Anytype objects and CrossRef/DataCite APIs

### Key Data Flow

```
DOI → CrossRef/DataCite API → BibTeX Generation → Duplicate Detection → Anytype Object Creation
```

## Development Setup

```bash
# Development with hot reload
npm run dev

# Build TypeScript to JavaScript 
npm run build

# Install globally after build
npm install -g .

# Test binary
anytype-bib test
```

The tool compiles to `dist/` and the binary entry point is `dist/cli/index.js`.

## Core Patterns

### Configuration Management
- Config stored in `~/.anytype-bib/config.json` via `ConfigManager`
- Auto-discovers Anytype object types during setup
- Type mappings: `article` → `reference`, `person` → `human`, etc.

### Error Handling
- Always check configuration exists with `ensureConfigured()`
- Use chalk for colored error messages
- Graceful API failure handling with fallbacks (CrossRef → DataCite)

### Interactive CLI Patterns
```typescript
// Standard pattern for user prompts
const { action } = await inquirer.prompt([{
  type: 'list',
  name: 'action', 
  message: 'What would you like to do?',
  choices: [/* options */]
}]);
```

### Duplicate Detection
- **Articles**: Exact DOI matching
- **Authors**: ORCID preference, then normalized name similarity with Levenshtein distance
- **Journals**: Name normalization handling abbreviations (e.g., "Phys. Rev. Lett." → "Physical Review Letters")

### BibTeX Generation
- Enforces specific format: `{{Title}}` for capitalization preservation
- Citation keys: `LastYYYYTitle` format with ASCII sanitization
- Multi-line formatting for readability

## Critical Integrations

### Anytype API Client
- HTTP client with Bearer token auth to `localhost:31009`
- Object type discovery and CRUD operations
- Property mapping between CrossRef metadata and Anytype fields

### External APIs
- **CrossRef** (primary): DOI metadata resolution
- **DataCite** (fallback): Alternative metadata source
- **AI Services** (optional): OpenAI/Anthropic for enhanced processing

## Development Workflows

### Adding New Features
1. Add types to `src/types/` if needed
2. Implement core logic in `src/core/`
3. Add CLI command in `src/cli/index.ts`
4. Test with `npm run dev <command>`

### Debugging
- Use `--verbose` flag for detailed output
- `--dry-run` flag shows what would be done without changes
- Check `~/.anytype-bib/config.json` for configuration issues

### Code Quality
- ESLint with TypeScript rules (unused vars as errors)
- Strict TypeScript compilation with `noImplicitAny`
- Prefer `const` over `let`, underscore prefix for unused params

## Project-Specific Conventions

### String Normalization
Always use the `normalizeText()` function from `duplicate-detector.ts` for text comparison:
- Removes diacritical marks
- Converts to lowercase  
- Normalizes whitespace and punctuation

### Author Name Handling
- ORCID takes precedence over name matching
- Handle abbreviations: "Salvatore Savasta" vs "S. Savasta"
- ASCII-only conversion for LaTeX compatibility in citation keys

### Journal Recognition
- Distinguish similar journals (Physical Review X vs Physical Review Letters)
- Detect common abbreviations but accept ambiguity when unavoidable
- Store both full name and abbreviation when available

## Common Tasks

### Adding API Endpoints
Extend `AnytypeClient` with new methods following the pattern:
```typescript
async createObject(typeKey: string, properties: any): Promise<AnytypeObject>
```

### Check the Anytype API
Use curl or Postman to explore Anytype's API. Look for documentation at https://developers.anytype.io/docs/reference.

### Enhancing Duplicate Detection
Modify similarity thresholds and matching logic in `DuplicateDetector`. Current threshold: 0.8

### BibTeX Customization
Update `BibTeXFormatter` for new citation key formats or field mappings

This project bridges academic research workflows with Anytype's knowledge management through robust duplicate detection and standardized metadata formatting.