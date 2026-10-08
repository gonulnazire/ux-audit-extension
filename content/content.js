// content/content.js

// 1. Dokunma Hedefi Kontrolü
// 1. Dokunma Hedefi Kontrolü (Gürültüyü azaltan filtrelenmiş versiyon)
function checkTouchTargets() {
  const interactiveElements = document.querySelectorAll('button, input, select, textarea, a[href]');
  const violations = [];

  interactiveElements.forEach((el, index) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    
    // Görünmeyen, ekranda yer kaplamayan veya gizli elementleri atla
    if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return;
    }

    if (rect.width < 24 || rect.height < 24) {
      violations.push({
        element: el.tagName.toLowerCase(),
        id: el.id || `element-${index}`,
        selector: getCssSelector(el),
        issue: "Dokunma hedefi çok küçük (24x24 px altı)",
        size: `${Math.round(rect.width)}x${Math.round(rect.height)}px`,
        severity: "Yüksek",
        rule: "WCAG 2.5.8 Target Size",
        recommendation: "Elementin CSS padding veya genişlik/yükseklik değerlerini artırarak en az 24x24 piksel (önerilen 48x48 px) yapın."
      });
    }
  });

  // Arayüzün binlerce satırla dolmasını önlemek için en kritik ilk 15 ihlali raporla
  return violations.slice(0, 15);
}

// 2. Eksik Alt Metin Kontrolü
function checkMissingAltTexts() {
  const images = document.querySelectorAll('img');
  const violations = [];

  images.forEach((img) => {
    if (!img.hasAttribute('alt') || img.getAttribute('alt').trim() === '') {
      violations.push({
        element: 'img',
        selector: getCssSelector(img),
        issue: "Resim için 'alt' özniteliği eksik veya boş",
        severity: "Kritik",
        rule: "WCAG 1.1.1 Non-text Content",
        recommendation: "Görsele açıklayıcı ve net bir alt özniteliği (alt='açıklama') ekleyin."
      });
    }
  });
  return violations;
}

// 3. Etiketsiz Form Alanları Kontrolü
function checkUnlabeledFormInputs() {
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), select, textarea');
  const violations = [];

  inputs.forEach((input) => {
    const id = input.id;
    const hasLabel = id && document.querySelector(`label[for="${id}"]`);
    const hasAriaLabel = input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby');
    const hasParentLabel = input.closest('label');

    if (!hasLabel && !hasAriaLabel && !hasParentLabel) {
      violations.push({
        element: input.tagName.toLowerCase(),
        selector: getCssSelector(input),
        issue: "Form alanı ilişkili bir etikete sahip değil",
        severity: "Kritik",
        rule: "WCAG 3.3.2 Labels or Instructions",
        recommendation: "Form alanına bir <label for='...'> bağı kurun veya aria-label özniteliği tanımlayın."
      });
    }
  });
  return violations;
}

// 4. Sayfa Dili Kontrolü
function checkPageLanguage() {
  const htmlTag = document.documentElement;
  const lang = htmlTag.getAttribute('lang');
  if (!lang || lang.trim() === '') {
    return [{
      element: 'html',
      selector: 'html',
      issue: "Sayfa dili (lang özniteliği) tanımlanmamış",
      severity: "Yüksek",
      rule: "WCAG 3.1.1 Language of Page",
      recommendation: "<html> etiketine uygun dil kodunu (örn: lang='tr') ekleyin."
    }];
  }
  return [];
}

// CSS Seçici Üretici
function getCssSelector(el) {
  if (el.id) return `#${el.id}`;
  let path = [];
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      let classes = el.className.trim().split(/\s+/).join('.');
      if (classes) selector += `.${classes}`;
    }
    path.unshift(selector);
    el = el.parentNode;
  }
  return path.join(' > ');
}
// content/content.js - Detaylı Deterministik Analiz Motoru

// 1. Dokunma Hedefi Kontrolü (WCAG 2.5.8)
function checkTouchTargets() {
  const interactiveElements = document.querySelectorAll('button, input, select, textarea, a[href]');
  const violations = [];

  interactiveElements.forEach((el, index) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    
    if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return;
    }

    if (rect.width < 24 || rect.height < 24) {
      violations.push({
        element: el.tagName.toLowerCase(),
        id: el.id || `element-${index}`,
        selector: getCssSelector(el),
        issue: "Dokunma hedefi çok küçük (24x24 px altı)",
        size: `${Math.round(rect.width)}x${Math.round(rect.height)}px`,
        severity: "Yüksek",
        rule: "WCAG 2.5.8 Target Size",
        recommendation: "Elementin CSS padding veya genişlik/yükseklik değerlerini artırarak en az 24x24 piksel yapın."
      });
    }
  });
  return violations.slice(0, 15); // Rapor şişmesin diye sınırlandırıldı
}

// 2. Eksik veya Boş Alt Metin Kontrolü (WCAG 1.1.1)
function checkMissingAltTexts() {
  const images = document.querySelectorAll('img');
  const violations = [];

  images.forEach((img) => {
    if (!img.hasAttribute('alt') || img.getAttribute('alt').trim() === '') {
      violations.push({
        element: 'img',
        selector: getCssSelector(img),
        issue: "Resim için 'alt' (alternatif metin) özniteliği eksik veya boş",
        severity: "Kritik",
        rule: "WCAG 1.1.1 Non-text Content",
        recommendation: "Görsele ekran okuyucular için açıklayıcı bir alt etiket ekleyin."
      });
    }
  });
  return violations;
}

// 3. Etiketsiz Form Alanları Kontrolü (WCAG 3.3.2)
function checkUnlabeledFormInputs() {
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), select, textarea');
  const violations = [];

  inputs.forEach((input) => {
    const id = input.id;
    const hasLabel = id && document.querySelector(`label[for="${id}"]`);
    const hasAriaLabel = input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby');
    const hasParentLabel = input.closest('label');

    if (!hasLabel && !hasAriaLabel && !hasParentLabel) {
      violations.push({
        element: input.tagName.toLowerCase(),
        selector: getCssSelector(input),
        issue: "Form alanı ilişkili bir <label> veya aria-label değerine sahip değil",
        severity: "Kritik",
        rule: "WCAG 3.3.2 Labels or Instructions",
        recommendation: "Form alanını uygun bir <label> etiketiyle bağlayın."
      });
    }
  });
  return violations;
}

// 4. Başlık Hiyerarşisi Kontrolü (WCAG 1.3.1)
function checkHeadingHierarchy() {
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const violations = [];
  let lastLevel = 0;

  headings.forEach((h, index) => {
    const level = parseInt(h.tagName.substring(1));
    if (lastLevel > 0 && level > lastLevel + 1) {
      violations.push({
        element: h.tagName.toLowerCase(),
        selector: getCssSelector(h),
        issue: `Başlık hiyerarşisi atlandı (H${lastLevel} doğrudan H${level} seviyesine geçildi)`,
        severity: "Orta",
        rule: "WCAG 1.3.1 Info and Relationships (Heading Order)",
        recommendation: "Başlık seviyelerini sırayla (h1, h2, h3 şeklinde) takip ettirin."
      });
    }
    lastLevel = level;
  });
  return violations;
}

// 5. Sayfa Dili Kontrolü (WCAG 3.1.1)
function checkPageLanguage() {
  const htmlTag = document.documentElement;
  const lang = htmlTag.getAttribute('lang');
  if (!lang || lang.trim() === '') {
    return [{
      element: 'html',
      selector: 'html',
      issue: "Sayfa dili (lang özniteliği) <html> etiketinde tanımlanmamış",
      severity: "Yüksek",
      rule: "WCAG 3.1.1 Language of Page",
      recommendation: "<html> etiketine lang='tr' (veya ilgili dil kodu) ekleyin."
    }];
  }
  return [];
}

// CSS Seçici Üretici
function getCssSelector(el) {
  if (el.id) return `#${el.id}`;
  let path = [];
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      let classes = el.className.trim().split(/\s+/).join('.');
      if (classes) selector += `.${classes}`;
    }
    path.unshift(selector);
    el = el.parentNode;
  }
  return path.join(' > ');
}

// Tüm Deterministik Analizleri Birleştiren Motor
async function runDeterministicAudits() {
  let axeResults = [];
  try {
    if (window.axe) {
      const results = await window.axe.run();
      axeResults = results.violations.map(v => ({
        rule: v.id,
        impact: v.impact,
        description: v.help,
        selector: v.nodes[0]?.target[0] || 'Bilinmiyor',
        severity: v.impact === 'critical' ? 'Kritik' : 'Yüksek',
        element: 'Axe-Core Kural İhlali',
        recommendation: v.help || "Erişilebilirlik standartlarına göre düzeltin."
      }));
    }
  } catch (err) {
    console.error("Axe-core çalıştırılamadı:", err);
  }

  return {
    axeViolations: axeResults,
    touchTargets: checkTouchTargets(),
    missingAlts: checkMissingAltTexts(),
    unlabeledInputs: checkUnlabeledFormInputs(),
    headingHierarchy: checkHeadingHierarchy(),
    pageLanguage: checkPageLanguage()
  };
}

// Mesaj Dinleyicisi
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
// content/content.js - Detaylı Deterministik Analiz Motoru

// 1. Dokunma Hedefi Kontrolü (WCAG 2.5.8)
function checkTouchTargets() {
  const interactiveElements = document.querySelectorAll('button, input, select, textarea, a[href]');
  const violations = [];

  interactiveElements.forEach((el, index) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    
    if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return;
    }

    if (rect.width < 24 || rect.height < 24) {
      violations.push({
        element: el.tagName.toLowerCase(),
        id: el.id || `element-${index}`,
        selector: getCssSelector(el),
        issue: "Dokunma hedefi çok küçük (24x24 px altı)",
        size: `${Math.round(rect.width)}x${Math.round(rect.height)}px`,
        severity: "Yüksek",
        rule: "WCAG 2.5.8 Target Size",
        recommendation: "Elementin CSS padding veya genişlik/yükseklik değerlerini artırarak en az 24x24 piksel yapın."
      });
    }
  });
  return violations.slice(0, 15); // Rapor şişmesin diye sınırlandırıldı
}

// 2. Eksik veya Boş Alt Metin Kontrolü (WCAG 1.1.1)
function checkMissingAltTexts() {
  const images = document.querySelectorAll('img');
  const violations = [];

  images.forEach((img) => {
    if (!img.hasAttribute('alt') || img.getAttribute('alt').trim() === '') {
      violations.push({
        element: 'img',
        selector: getCssSelector(img),
        issue: "Resim için 'alt' (alternatif metin) özniteliği eksik veya boş",
        severity: "Kritik",
        rule: "WCAG 1.1.1 Non-text Content",
        recommendation: "Görsele ekran okuyucular için açıklayıcı bir alt etiket ekleyin."
      });
    }
  });
  return violations;
}

// 3. Etiketsiz Form Alanları Kontrolü (WCAG 3.3.2)
function checkUnlabeledFormInputs() {
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), select, textarea');
  const violations = [];

  inputs.forEach((input) => {
    const id = input.id;
    const hasLabel = id && document.querySelector(`label[for="${id}"]`);
    const hasAriaLabel = input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby');
    const hasParentLabel = input.closest('label');

    if (!hasLabel && !hasAriaLabel && !hasParentLabel) {
      violations.push({
        element: input.tagName.toLowerCase(),
        selector: getCssSelector(input),
        issue: "Form alanı ilişkili bir <label> veya aria-label değerine sahip değil",
        severity: "Kritik",
        rule: "WCAG 3.3.2 Labels or Instructions",
        recommendation: "Form alanını uygun bir <label> etiketiyle bağlayın."
      });
    }
  });
  return violations;
}

// 4. Başlık Hiyerarşisi Kontrolü (WCAG 1.3.1)
function checkHeadingHierarchy() {
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const violations = [];
  let lastLevel = 0;

  headings.forEach((h, index) => {
    const level = parseInt(h.tagName.substring(1));
    if (lastLevel > 0 && level > lastLevel + 1) {
      violations.push({
        element: h.tagName.toLowerCase(),
        selector: getCssSelector(h),
        issue: `Başlık hiyerarşisi atlandı (H${lastLevel} doğrudan H${level} seviyesine geçildi)`,
        severity: "Orta",
        rule: "WCAG 1.3.1 Info and Relationships (Heading Order)",
        recommendation: "Başlık seviyelerini sırayla (h1, h2, h3 şeklinde) takip ettirin."
      });
    }
    lastLevel = level;
  });
  return violations;
}

// 5. Sayfa Dili Kontrolü (WCAG 3.1.1)
function checkPageLanguage() {
  const htmlTag = document.documentElement;
  const lang = htmlTag.getAttribute('lang');
  if (!lang || lang.trim() === '') {
    return [{
      element: 'html',
      selector: 'html',
      issue: "Sayfa dili (lang özniteliği) <html> etiketinde tanımlanmamış",
      severity: "Yüksek",
      rule: "WCAG 3.1.1 Language of Page",
      recommendation: "<html> etiketine lang='tr' (veya ilgili dil kodu) ekleyin."
    }];
  }
  return [];
}

// CSS Seçici Üretici
function getCssSelector(el) {
  if (el.id) return `#${el.id}`;
  let path = [];
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      let classes = el.className.trim().split(/\s+/).join('.');
      if (classes) selector += `.${classes}`;
    }
    path.unshift(selector);
    el = el.parentNode;
  }
  return path.join(' > ');
}

// Tüm Deterministik Analizleri Birleştiren Motor
async function runDeterministicAudits() {
  let axeResults = [];
  try {
    if (window.axe) {
      const results = await window.axe.run();
      axeResults = results.violations.map(v => ({
        rule: v.id,
        impact: v.impact,
        description: v.help,
        selector: v.nodes[0]?.target[0] || 'Bilinmiyor',
        severity: v.impact === 'critical' ? 'Kritik' : 'Yüksek',
        element: 'Axe-Core Kural İhlali',
        recommendation: v.help || "Erişilebilirlik standartlarına göre düzeltin."
      }));
    }
  } catch (err) {
    console.error("Axe-core çalıştırılamadı:", err);
  }

  return {
    axeViolations: axeResults,
    touchTargets: checkTouchTargets(),
    missingAlts: checkMissingAltTexts(),
    unlabeledInputs: checkUnlabeledFormInputs(),
    headingHierarchy: checkHeadingHierarchy(),
    pageLanguage: checkPageLanguage()
  };
}

// Mesaj Dinleyicisi
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

// Tüm Analizleri Çalıştıran Ana Fonksiyon
async function runDeterministicAudits() {
  let axeResults = [];
  try {
    if (window.axe) {
      const results = await window.axe.run();
      axeResults = results.violations.map(v => ({
        rule: v.id,
        impact: v.impact,
        description: v.help,
        selector: v.nodes[0]?.target[0] || 'Bilinmiyor',
        severity: v.impact === 'critical' ? 'Kritik' : 'Yüksek',
        element: 'Axe-Core Kural İhlali',
        recommendation: v.help || "Erişilebilirlik kuralına uygun düzeltme yapın."
      }));
    }
  } catch (err) {
    console.error("Axe-core çalıştırılamadı:", err);
  }

  return {
    axeViolations: axeResults,
    touchTargets: checkTouchTargets(),
    missingAlts: checkMissingAltTexts(),
    unlabeledInputs: checkUnlabeledFormInputs(),
    pageLanguage: checkPageLanguage()
  };
}

// Dinleyici
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