/**
 * Anytype Bibliography Manager - Browser Extension Content Script
 * 
 * This content script runs on web pages and extracts DOI (Digital Object Identifier)
 * metadata from academic paper pages. It communicates with the background script
 * to facilitate adding papers to Anytype.
 * 
 * Functionality:
 * - Listens for messages from the background script
 * - Extracts DOI from Dublin Core (dc.identifier) meta tags and other sources
 * - Validates and filters DOI format
 * - Returns clean DOI to background script for server communication
 * 
 * Note: This script expects constants.js and utils.js to be loaded first via the manifest
 */

/**
 * Message listener for communication with background script
 * 
 * Handles two types of messages:
 * 1. "getDOI" - Extract and return DOI from current page
 * 2. "log" - Log a message to console (for debugging)
 * 
 * Uses sendResponse callback for proper async communication with background script.
 */
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === MESSAGE_ACTIONS.GET_DOI) {
        // Extract DOI from the current page's meta tags using shared utility
        sendResponse(extractDOIFromPage());
        return true; // Indicates we will respond asynchronously
    } else if (msg.action === MESSAGE_ACTIONS.LOG) {
        // Debug logging functionality
        console.log(msg.message);
        sendResponse({ success: true });
        return true;
    }
})

