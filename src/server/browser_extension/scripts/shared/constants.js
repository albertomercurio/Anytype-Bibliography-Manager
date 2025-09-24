/**
 * Shared constants for the Anytype Bibliography Manager browser extension
 */

// Local server configuration
// The Anytype Bibliography Manager server runs locally on this address
const HOST = "127.0.0.1";
const PORT = 44556;

// DOI format validation regex
// Matches: doi:10.1234/anything or 10.1234/anything
// Format: 10.{4-9 digits}/{publisher-specific string}
const DOI_REGEX = /^doi:10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;

// DOI format without "doi:" prefix
// Matches: 10.1234/anything
// Format: 10.{4-9 digits}/{publisher-specific string}
const BARE_DOI_REGEX = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;

// Message action types for communication between background and content scripts
const MESSAGE_ACTIONS = {
  GET_DOI: "getDOI",
  LOG: "log"
};