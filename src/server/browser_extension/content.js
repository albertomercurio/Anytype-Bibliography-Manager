chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "getDcIdentifier") {
        getDcIdentifier(sendResponse);
    }
    return true;
});


// Extract DOI from <meta> tags
function getDcIdentifier(sendResponse) {
    // Look for <meta name="dc.identifier" content="...">
    const meta = document.querySelectorAll('meta[name="dc.identifier"]');

    if (meta.length == 0) {
        console.error("No DC identifier found");
        sendResponse({ identifier: null });
        return;
    }

    // Filter out contents that are not in DOI format
    const doiRegex = /^doi:10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;
    const dois = Array.from(meta)
        .map((m) => m.content)
        .filter((content) => doiRegex.test(content))
        .map((doi) => doi.replace(/^doi:/i, ""));
    const uniqueDois = [...new Set(dois)];

    if (uniqueDois.length == 0) {
        console.error("No valid DOI found");
        sendResponse({ identifier: null });
    } else if (uniqueDois.length > 1) {
        console.error("No DC identifier found");
        sendResponse({ identifier: null });
    }

    sendResponse({ identifier: uniqueDois[0] });
}