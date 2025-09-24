/**
 * Anytype Bibliography Manager - Browser Extension Background Script
 * 
 * This is the background service worker for the browser extension that enables
 * adding references to Anytype directly from web pages. It communicates with
 * the local Anytype Bibliography Manager server and content scripts.
 * 
 * Architecture:
 * - Background script (this file): Handles high-level extension logic and 
 *  communication with local server
 * - Content script: Interacts with web pages to extract DOI and other metadata
 * - Local server: Processes DOIs and adds references to Anytype
 */

// Import browser API polyfill for cross-browser compatibility
importScripts("../../lib/browser-polyfill.min.js");

// Import axios for HTTP requests to the local server
importScripts("../../lib/axios.min.js");

// Import shared modules (order matters - constants first, then api-client)
importScripts("../shared/constants.js");
importScripts("../shared/api-client.js");



/**
 * When the user clicks the extension icon, this listener:
 * 1. Communicates with the content script to extract DOI from the current page
 * 2. Validates the response and extracted DOI
 * 3. Sends the DOI to the local server for processing
 */
browser.action.onClicked.addListener(async (tab) => {
  // Ensure we have a valid tab ID
  if (!tab.id) return;

  try {
    // Request DOI extraction from the content script running on the current page
    const response = await browser.tabs.sendMessage(tab.id, { action: MESSAGE_ACTIONS.GET_DOI });
    
    // Check for communication errors with content script
    if (browser.runtime.lastError) {
      console.warn("No content script on this page:", browser.runtime.lastError.message);
      return;
    }

    // Validate that we received a response from the content script
    if (!response) {
      console.warn("No response from content script");
      return;
    }
    
    // Extract the DOI from the response object
    const doi = response.doi;

    // Validate that a DOI was found on the page
    if (!doi) {
      console.warn("No DOI found in response");
      return;
    }

    try {
        // Send the DOI to the local server for processing
        const res = await sendPostRequest("add", { doi: doi });
        console.log("DOI added:", res);
    } catch (err) {
        console.error("Error adding DOI:", err);
    }
  } catch (err) {
    console.error("Error communicating with content script:", err);
  }
});
