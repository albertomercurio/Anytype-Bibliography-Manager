/**
 * Shared text utility functions to avoid code duplication
 */

/**
 * Normalize text by removing accents, punctuation, and standardizing whitespace
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Remove accents from text while preserving case
 */
export function removeAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Check if one string is an abbreviation of another
 */
export function isAbbreviation(abbr: string, full: string): boolean {
  const normAbbr = normalizeText(abbr);
  const normFull = normalizeText(full);

  if (normAbbr.length > normFull.length) return false;

  let checkAbbr = normAbbr;
  if (checkAbbr.endsWith('.')) {
    checkAbbr = checkAbbr.slice(0, -1);
  }

  // Single letter abbreviation
  if (checkAbbr.length === 1) {
    return normFull.startsWith(checkAbbr);
  }

  // Multi-part abbreviation (e.g., "J. P." for "Jean Pierre")
  const abbrParts = checkAbbr.split(/[\s.-]+/);
  const fullParts = normFull.split(/[\s-]+/);

  if (abbrParts.length > fullParts.length) return false;

  return abbrParts.every((part, i) => {
    if (i >= fullParts.length) return false;
    return fullParts[i].startsWith(part);
  });
}

/**
 * Parse a full name into first and last name components
 * Handles compound last names with prefixes like "Van", "De", etc.
 */
export function parseFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  } else if (parts.length === 1) {
    return { firstName: '', lastName: parts[0] };
  } else if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  } else {
    // For 3+ parts, use heuristics to identify compound last names
    const lastNamePrefixes = new Set([
      'di', 'de', 'van', 'von', 'del', 'da', 'la', 'le', 'el', 'al',
      'bin', 'ibn', 'mac', 'mc', 'o', 'san', 'santa', 'dos', 'das',
      'du', 'der', 'den', 'ter', 'ten'
    ]);

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

/**
 * Sanitize text for use in BibTeX cite keys
 */
export function sanitizeForCiteKey(text: string): string {
  return text
    .replace(/^(the|a|an)\b/i, '') // Remove articles first
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Escape special LaTeX characters in text
 */
export function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[&%$#_{}]/g, '\\$&')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}