/**
 * API client for communicating with the local Anytype Bibliography Manager server
 * Note: This file expects constants.js to be loaded first
 */

/**
 * Send GET request to the local Anytype Bibliography Manager server
 * @param {string} endpoint - API endpoint (without leading slash)
 * @param {Object} data - Query parameters to send
 * @returns {Promise<Object>} Response data from server
 * @throws {Error} If server connection fails
 */
async function sendGetRequest(endpoint, data) {
  try {
    const res = await axios.get(`http://${HOST}:${PORT}/${endpoint}`, {
      headers: { "Content-Type": "application/json" },
      params: data,
    });
    return res.data;
  } catch (err) {
    throw new Error("Failed to connect to Anytype Bib server. Error: " + err.message);
  }
}

/**
 * Send POST request to the local Anytype Bibliography Manager server
 * @param {string} endpoint - API endpoint (without leading slash)
 * @param {Object} data - JSON data to send in request body
 * @returns {Promise<Object>} Response data from server
 * @throws {Error} If server connection fails
 */
async function sendPostRequest(endpoint, data) {
  try {
    const res = await axios.post(`http://${HOST}:${PORT}/${endpoint}`, data, {
      headers: { "Content-Type": "application/json" },
    });
    return res.data;
  } catch (err) {
    throw new Error("Failed to connect to Anytype Bib server. Error: " + err.message);
  }
}