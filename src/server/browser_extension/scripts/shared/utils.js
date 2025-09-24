/**
 * Shared utility functions for the Anytype Bibliography Manager browser extension
 * Note: This file expects constants.js to be loaded first
 */

/**
 * Validate if a string matches the DOI format
 * @param {string} doi - The DOI string to validate
 * @returns {boolean} True if valid DOI format
 */
function isValidDOI(doi) {
  if (!doi) return false;
  
  // Check if it matches the full DOI format with "doi:" prefix
  if (DOI_REGEX.test(doi)) {
    return true;
  }
  
  // Check if it matches DOI format without "doi:" prefix (e.g., "10.1000/xyz123")
  return BARE_DOI_REGEX.test(doi);
}

/**
 * Clean a DOI string by removing the "doi:" prefix if present
 * @param {string} doi - The DOI string to clean
 * @returns {string} Clean DOI without prefix
 */
function cleanDOI(doi) {
  return doi.replace(/^doi:/i, "");
}

/**
 * Extract DOI from Dublin Core identifier meta tags and other sources
 * 
 * This function searches for an article's DOI looking for <meta name="dc.identifier">
 * tags in the page HTML. It extracts, filters, and validates the DOI format,
 * ensuring only one unique DOI is returned.
 * 
 * @returns {Object} Result object with format: { success: boolean, doi: string|null }
 *   - success: Whether DOI extraction was successful
 *   - doi: Clean DOI string (e.g., "10.1000/xyz123") or null if not found
 */
function extractDOIFromPage() {
    const allDois = [];
    
    // Strategy 1: Dublin Core identifier meta tags (case-insensitive)
    // <meta name="dc.identifier" content="doi:10.1000/xyz123">
    // <meta name="dc.Identifier" content="10.1000/xyz123">
    const dcIdentifierMeta = document.querySelectorAll('meta[name="dc.identifier" i], meta[name="dc.Identifier" i]');
    dcIdentifierMeta.forEach(meta => {
        const content = meta.getAttribute('content');
        if (content && isValidDOI(content)) {
            allDois.push(cleanDOI(content));
        }
    });
    
    // Strategy 2: Dublin Core identifier with scheme attribute (Science, etc.)
    // <meta name="dc.Identifier" scheme="doi" content="10.1126/science.xyz123">
    const dcSchemeMeta = document.querySelectorAll('meta[name="dc.identifier" i][scheme="doi" i], meta[name="dc.Identifier" i][scheme="doi" i]');
    dcSchemeMeta.forEach(meta => {
        const content = meta.getAttribute('content');
        if (content) {
            // For scheme="doi", content usually doesn't have "doi:" prefix
            const doiContent = content.startsWith('10.') ? `doi:${content}` : content;
            if (isValidDOI(doiContent)) {
                allDois.push(cleanDOI(doiContent));
            }
        }
    });
    
    // Strategy 3: Citation DOI meta tags
    // <meta name="citation_doi" content="10.1000/xyz123">
    const citationDoiMeta = document.querySelectorAll('meta[name="citation_doi"]');
    citationDoiMeta.forEach(meta => {
        const content = meta.getAttribute('content');
        if (content) {
            const doiContent = content.startsWith('10.') ? `doi:${content}` : content;
            if (isValidDOI(doiContent)) {
                allDois.push(cleanDOI(doiContent));
            }
        }
    });
    
    // Strategy 4: DOI meta tag
    // <meta name="DOI" content="10.1000/xyz123">
    const doiMeta = document.querySelectorAll('meta[name="DOI" i], meta[name="doi" i]');
    doiMeta.forEach(meta => {
        const content = meta.getAttribute('content');
        if (content) {
            const doiContent = content.startsWith('10.') ? `doi:${content}` : content;
            if (isValidDOI(doiContent)) {
                allDois.push(cleanDOI(doiContent));
            }
        }
    });
    
    // Strategy 5: Property-based meta tags
    // <meta property="article:doi" content="10.1000/xyz123">
    const propertyDoiMeta = document.querySelectorAll('meta[property="article:doi"], meta[property="citation_doi"]');
    propertyDoiMeta.forEach(meta => {
        const content = meta.getAttribute('content');
        if (content) {
            const doiContent = content.startsWith('10.') ? `doi:${content}` : content;
            if (isValidDOI(doiContent)) {
                allDois.push(cleanDOI(doiContent));
            }
        }
    });

    // Remove duplicates
    const uniqueDois = [...new Set(allDois)];

    if (uniqueDois.length == 0) {
        console.error("No valid DOI found");
        return { success: false, doi: null };
    } else if (uniqueDois.length > 1) {
        // Multiple different DOIs found - ambiguous, so we don't process
        console.error("Multiple different DOIs found - cannot determine which to use");
        return { success: false, doi: null };
    }

    // Return the single valid DOI found
    return { success: true, doi: uniqueDois[0] };
}