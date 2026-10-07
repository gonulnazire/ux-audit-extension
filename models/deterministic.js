// deterministic.js

// 1. Dokunma Hedefi Kontrolü (En az 24x24px)
function checkTouchTargets() {
  const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
  const violations = [];

  interactiveElements.forEach((el, index) => {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      if (rect.width < 24 || rect.height < 24) {
        violations.push({
          element: el.tagName.toLowerCase(),
          id: el.id || `element-${index}`,
          className: el.className || '',
          selector: getCssSelector(el),
          issue: "Dokunma hedefi çok küçük (24x24 px altı)",
          size: `${Math.round(rect.width)}x${Math.round(rect.height)}px`,
          severity: "Yüksek",
          rule: "WCAG 2.5.8 Target Size"
        });
      }
    }
  });
  return violations;
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
        rule: "WCAG 1.1.1 Non-text Content"
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
        type: input.type || 'text',
        selector: getCssSelector(input),
        issue: "Form alanı ilişkili bir etikete (label) sahip değil",
        severity: "Kritik",
        rule: "WCAG 3.3.2 Labels or Instructions"
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
      rule: "WCAG 3.1.1 Language of Page"
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

// Tüm deterministik kontrolleri çalıştıran ana fonksiyon
export async function runDeterministicAudits() {
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
        element: 'Axe-Core Kural İhlali'
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
