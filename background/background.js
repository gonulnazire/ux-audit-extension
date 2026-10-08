// background/background.js
// Şimdilik temel olay dinleyicileri ve istek köprüsü olarak görev yapar.
chrome.runtime.onInstalled.addListener(() => {
  console.log("UX & Accessibility Audit Extension yüklendi.");
});