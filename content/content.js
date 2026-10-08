import { runDeterministicAudits } from '../models/deterministic.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "RUN_DETERMINISTIC_AUDIT") {
    runDeterministicAudits().then(results => {
      sendResponse({ success: true, data: results });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});