importScripts("axios.min.js"); // include axios

const HOST = "127.0.0.1";
const PORT = 44556;


async function sendPostReq(endpoint, data) {
  try {
    const res = await axios.post(`http://${HOST}:${PORT}/${endpoint}`, data, {
      headers: { "Content-Type": "application/json" },
    });
    return res.data;
  } catch (err) {
    throw new Error("Failed to connect to Anytype Bib server. Error: " + err.message);
  }
}


chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;

  // Ask the content script for dc:identifier
  chrome.tabs.sendMessage(tab.id, { action: "getDcIdentifier" }, async (response) => {
    if (chrome.runtime.lastError) {
      console.warn("No content script on this page.");
      return;
    }

    const doi = response.identifier;

    if (!doi) return

    try {
        const res = await sendPostReq("add", { doi: doi });
    } catch (err) {
      console.error("Error adding DOI:", err);
    }
  });
});
