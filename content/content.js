(() => {
  if (globalThis.__uxAuditInstalled) return;
  globalThis.__uxAuditInstalled = true;

  const INTERACTIVE = 'a[href],button:not(:disabled),input:not([type="hidden"]):not(:disabled),select:not(:disabled),textarea:not(:disabled),[role="button"],[role="link"]';
  const CONTRAST_TEXT = 'p,span,a[href],button,label,li,h1,h2,h3,h4,h5,h6,td,th,small,strong,em,figcaption';
  const PENALTIES = { 'Kritik': 15, 'Yüksek': 10, 'Orta': 5, 'Düşük': 2 };
  let findingSequence = 0;
  let highlightTimer;
  let auditEvidenceTargets = new Map();

  function cssEscape(value) {
    return window.CSS?.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function getCssSelector(element) {
    if (element.id) {
      const idSelector = `#${cssEscape(element.id)}`;
      if (document.querySelectorAll(idSelector).length === 1) return idSelector;
    }
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
      let part = current.tagName.toLowerCase();
      let index = 1;
      for (let sibling = current.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
        if (sibling.tagName === current.tagName) index++;
      }
      part += `:nth-of-type(${index})`;
      parts.unshift(part);
      current = current.parentElement;
    }
    return `html > ${parts.join(' > ')}`;
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 &&
      style.display !== 'none' && style.visibility !== 'hidden' &&
      Number(style.opacity) !== 0;
  }

  function addFinding(findings, finding) {
    const axeRuleByCategory = {
      targetSize: 'target-size',
      altText: 'image-alt',
      formLabels: 'label',
      contrast: 'color-contrast',
      pageLanguage: 'html-has-lang'
    };
    const duplicateIndex = findings.findIndex(existing => {
      if (existing.category !== finding.category || existing.rule !== axeRuleByCategory[finding.category]) return false;
      if (existing.selector === finding.selector) return true;
      try {
        const existingElement = document.querySelector(existing.selector);
        return Boolean(existingElement && existingElement === document.querySelector(finding.selector));
      } catch {
        return false;
      }
    });
    if (duplicateIndex !== -1) findings.splice(duplicateIndex, 1);
    findings.push({
      id: `finding-${++findingSequence}`,
      selector: finding.selector,
      selectors: finding.selectors || [finding.selector],
      category: finding.category,
      rule: finding.rule,
      issue: finding.issue,
      severity: finding.severity,
      recommendation: finding.recommendation,
      evidence: finding.evidence
    });
  }

  function hasTargetSpacingException(element, rect, targets) {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return targets.every(other => {
      if (other.element === element) return true;
      const otherRect = other.rect;
      const nearestX = Math.max(otherRect.left, Math.min(centerX, otherRect.right));
      const nearestY = Math.max(otherRect.top, Math.min(centerY, otherRect.bottom));
      return Math.hypot(centerX - nearestX, centerY - nearestY) >= 12;
    });
  }

  function checkTouchTargets(findings) {
    const allTargets = [...document.querySelectorAll(INTERACTIVE)].filter(isVisible);
    const targets = allTargets.slice(0, 1000).map(element => ({ element, rect: element.getBoundingClientRect() }));
    targets.forEach(({ element, rect }) => {
      if (rect.width >= 24 && rect.height >= 24) return;
      if (hasTargetSpacingException(element, rect, targets)) return;
      addFinding(findings, {
        selector: getCssSelector(element),
        category: 'targetSize',
        rule: 'WCAG 2.5.8 Target Size (Minimum)',
        issue: 'Dokunma hedefi en az 24 × 24 CSS piksel değil ve aralık istisnasını karşılamıyor.',
        severity: 'Yüksek',
        recommendation: 'Tıklanabilir alanı en az 24 × 24 CSS piksele çıkarın veya hedefler arasında WCAG aralık istisnasını sağlayın.',
        evidence: {
          measured: `${rect.width.toFixed(1)} × ${rect.height.toFixed(1)} CSS px`,
          required: '24 × 24 CSS px veya hedefler arası en az 24 CSS px çaplı boş alan'
        }
      });
    });
    return { inspected: targets.length, truncated: allTargets.length > targets.length };
  }

  function checkMissingAltTexts(findings) {
    document.querySelectorAll('img:not([alt])').forEach(image => {
      if (!isVisible(image) || image.getAttribute('role') === 'presentation' ||
          image.getAttribute('role') === 'none' || image.closest('[aria-hidden="true"]')) return;
      addFinding(findings, {
        selector: getCssSelector(image),
        category: 'altText',
        rule: 'WCAG 1.1.1 Non-text Content',
        issue: 'Görselde alt özniteliği yok; dekoratif görsellerde alt="" kullanılması uygundur.',
        severity: 'Yüksek',
        recommendation: 'Bilgi taşıyan görsele bağlamına uygun alt metni ekleyin; yalnızca dekoratifse alt="" tanımlayın.',
        evidence: { measured: 'img öğesinde alt özniteliği bulunamadı', required: 'Anlamlı alt metin veya dekoratif görsel için boş alt' }
      });
    });
  }

  function checkUnlabeledInputs(findings) {
    document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not(:disabled),select:not(:disabled),textarea:not(:disabled)')
      .forEach(input => {
        const hasLabel = [...(input.labels || [])].some(label =>
          Boolean(label.innerText.trim() || label.getAttribute('aria-label')?.trim())
        );
        const hasAriaLabel = Boolean(input.getAttribute('aria-label')?.trim());
        const labelledBy = input.getAttribute('aria-labelledby');
        const hasLabelledBy = Boolean(labelledBy && labelledBy.split(/\s+/).every(id =>
          document.getElementById(id)?.textContent.trim()
        ));
        const hasImageButtonName = input.type === 'image' && Boolean(input.getAttribute('alt')?.trim());
        if (hasLabel || hasAriaLabel || hasLabelledBy || hasImageButtonName) return;
        addFinding(findings, {
          selector: getCssSelector(input),
          category: 'formLabels',
          rule: 'WCAG 1.3.1 Info and Relationships / 4.1.2 Name, Role, Value',
          issue: 'Form denetiminin ilişkili bir etiketi veya erişilebilir adı yok.',
          severity: 'Kritik',
          recommendation: 'Denetime <label for> ekleyin veya görünür metinle eşleşen aria-label / aria-labelledby tanımlayın.',
          evidence: { measured: 'label, aria-label ve geçerli aria-labelledby bulunamadı', required: 'Denetime programatik olarak ilişkili erişilebilir ad' }
        });
      });
  }

  function checkPageLanguage(findings) {
    const lang = document.documentElement.getAttribute('lang')?.trim();
    if (lang) {
      try {
        if (Intl.getCanonicalLocales(lang).length === 1) return;
      } catch {
        // Invalid BCP 47 tags are reported with missing language metadata.
      }
    }
    addFinding(findings, {
      selector: 'html',
      category: 'pageLanguage',
      rule: 'WCAG 3.1.1 Language of Page',
      issue: 'Belge kökünde sayfanın varsayılan dili eksik veya geçerli bir BCP 47 etiketi değil.',
      severity: 'Yüksek',
      recommendation: '<html> öğesine içerik dilini belirten geçerli bir lang özniteliği ekleyin.',
      evidence: { measured: `html[lang]=${lang || 'eksik/geçersiz'}`, required: 'Belgenin birincil içerik dilini belirten geçerli BCP 47 lang' }
    });
  }

  function axeRecommendation(rule, helpUrl) {
    const concrete = {
      'button-name': 'Düğmeye görünür metin veya eylemini anlatan bir erişilebilir ad ekleyin.',
      'link-name': 'Bağlantıya hedefini açıklayan görünür metin veya erişilebilir ad ekleyin.',
      'image-alt': 'Bilgi taşıyan görsele anlamlı alt metin ekleyin; dekoratifse alt="" kullanın.',
      label: 'Form denetimini ilişkili bir görünür label veya eşdeğer erişilebilir adla ilişkilendirin.',
      'color-contrast': 'Metin rengini veya arka planını değiştirerek ilgili WCAG kontrast oranına ulaşın.',
      'html-has-lang': 'html öğesine sayfanın varsayılan dilini belirten geçerli lang ekleyin.',
      'document-title': 'Sayfanın amacını açıklayan benzersiz ve anlamlı bir title ekleyin.',
      'aria-hidden-focus': 'Odaklanabilir öğeleri aria-hidden kapsayıcısından çıkarın veya odağı da devre dışı bırakın.'
    }[rule] || `“${rule}” Axe-Core kuralını bu öğede giderin ve WCAG ölçütünü sağlayın.`;
    return helpUrl ? `${concrete} Kural rehberi: ${helpUrl}` : concrete;
  }

  function parseRgb(color) {
    const channels = color.match(/[\d.]+/g)?.map(Number);
    if (!channels || channels.length < 3) return null;
    return {
      r: channels[0],
      g: channels[1],
      b: channels[2],
      a: color.startsWith('rgba') && channels.length > 3 ? channels[3] : 1
    };
  }

  function composite(foreground, background) {
    const alpha = foreground.a + background.a * (1 - foreground.a);
    if (!alpha) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
      g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
      b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
      a: alpha
    };
  }

  function backgroundColor(element) {
    let current = element;
    let color = { r: 255, g: 255, b: 255, a: 0 };
    while (current && color.a < 1) {
      const style = getComputedStyle(current);
      if (style.backgroundImage !== 'none') return null;
      const layer = parseRgb(style.backgroundColor);
      if (layer) color = composite(layer, color);
      current = current.parentElement;
    }
    return color.a < 1 ? composite(color, { r: 255, g: 255, b: 255, a: 1 }) : color;
  }

  function luminance(color) {
    const channel = value => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  }

  function checkTextContrast(findings) {
    const candidates = [...document.querySelectorAll(CONTRAST_TEXT)].filter(element =>
      isVisible(element) && [...element.childNodes].some(node =>
        node.nodeType === Node.TEXT_NODE && node.textContent.trim()
      )
    );
    const elements = candidates.slice(0, 3000);
    let measured = 0;
    let unmeasurable = 0;
    elements.forEach(element => {
      const style = getComputedStyle(element);
      const foreground = parseRgb(style.color);
      const background = backgroundColor(element);
      if (!foreground || !background || foreground.a < 1 || background.a < 1) {
        unmeasurable++;
        return;
      }
      measured++;
      const fontSize = parseFloat(style.fontSize);
      const isBold = parseInt(style.fontWeight, 10) >= 700;
      const threshold = fontSize >= 24 || (isBold && fontSize >= 18.67) ? 3 : 4.5;
      const light = Math.max(luminance(foreground), luminance(background));
      const dark = Math.min(luminance(foreground), luminance(background));
      const ratio = (light + 0.05) / (dark + 0.05);
      if (ratio >= threshold) return;
      addFinding(findings, {
        selector: getCssSelector(element),
        category: 'contrast',
        rule: 'WCAG 1.4.3 Contrast (Minimum)',
        issue: 'Metin ile arka plan arasındaki kontrast yetersiz.',
        severity: ratio < threshold * 0.6 ? 'Yüksek' : 'Orta',
        recommendation: `Ön plan/arka plan kontrastını en az ${threshold}:1 olacak şekilde artırın.`,
        evidence: { measured: `${ratio.toFixed(2)}:1`, required: `${threshold}:1`, fontSize: `${fontSize}px` }
      });
    });
    return {
      inspected: elements.length,
      measured,
      unmeasurable,
      truncated: candidates.length > elements.length
    };
  }

  function sensitivePageWarnings() {
    const warnings = [];
    if (document.querySelector('input[type="password"],input[autocomplete*="current-password"],input[autocomplete*="cc-"],input[autocomplete*="username"]')) {
      warnings.push('Giriş/kimlik bilgisi alanı algılandı; AI paylaşımı bu sayfada devre dışı bırakıldı.');
    }
    const url = `${location.pathname} ${location.search}`.toLowerCase();
    if (/(login|log-in|sign-in|signin|account|profile|patient|portal|medical-record|lab-result|appointment|dashboard|settings|records|results)/i.test(url)) {
      warnings.push('Hesap veya sağlık verisi içerebilecek sayfa yolu algılandı; AI paylaşımı devre dışı bırakıldı.');
    }
    if (document.querySelector(
      '[autocomplete^="bday"],[autocomplete^="cc-"],' +
      '[name*="patient" i],[id*="patient" i],[name*="medical" i],[id*="medical" i],' +
      '[name*="diagnosis" i],[id*="diagnosis" i],[name*="prescription" i],[id*="prescription" i]'
    )) {
      warnings.push('Hassas kişisel/sağlık verisi göstergesi algılandı; AI paylaşımı devre dışı bırakıldı.');
    }
    return [...new Set(warnings)];
  }

  function redactText(text) {
    return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted email]')
      .replace(/(?:\+?\d[\s().-]*){8,}/g, '[redacted number]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[redacted identifier]')
      .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[redacted number]')
      .replace(/\s+/g, ' ').trim().slice(0, 100);
  }

  function getControlName(element) {
    const explicitName = element.getAttribute('aria-label') || element.getAttribute('title');
    if (explicitName) return redactText(explicitName);
    const clone = element.cloneNode(true);
    clone.querySelectorAll('input,textarea,select,option,form').forEach(control => control.remove());
    return redactText(clone.innerText || clone.textContent || '');
  }

  function collectNormanEvidence(findings) {
    const evidence = findings.map(finding => ({
      id: finding.id,
      kind: 'deterministic-finding',
      rule: finding.rule,
      issue: finding.issue,
      severity: finding.severity,
      measured: finding.evidence?.measured
    }));
    const counts = {
      visibleHeadings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(isVisible).length,
      visibleNavigationRegions: [...document.querySelectorAll('nav,[role="navigation"]')].filter(isVisible).length,
      visibleInteractiveControls: [...document.querySelectorAll(INTERACTIVE)].filter(isVisible).length,
      visibleImages: [...document.images].filter(isVisible).length,
      pageLanguageDefined: Boolean(document.documentElement.getAttribute('lang')?.trim()),
      focusableControls: document.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,[tabindex]:not([tabindex="-1"])').length
    };
    const controls = [...document.querySelectorAll('button,a[href],[role="button"],[role="link"]')]
      .filter(isVisible).slice(0, 30).map((element, index) => ({
        id: `control-${index + 1}`,
        selector: getCssSelector(element),
        tag: element.tagName.toLowerCase(),
        role: ['button', 'link'].includes(element.getAttribute('role'))
          ? element.getAttribute('role')
          : element.hasAttribute('role') ? 'custom' : 'native',
        name: getControlName(element),
        disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true'),
        hasAccessibleName: Boolean(getControlName(element)),
        targetSize: (() => {
          const rect = element.getBoundingClientRect();
          return `${Math.round(rect.width)}x${Math.round(rect.height)} CSS px`;
        })()
      }));
    return {
      counts,
      observations: [{ id: 'page-structure', kind: 'page-structure', counts }],
      findings: evidence,
      controls
    };
  }

  async function runAudit() {
    findingSequence = 0;
    const findings = [];
    const warnings = sensitivePageWarnings();
    const sensitive = warnings.length > 0;
    let axeStatus = 'unavailable';
    let axeVersion = null;
    if (window.axe) {
      axeVersion = window.axe.version;
      try {
        const results = await window.axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']
          }
        });
        axeStatus = 'completed';
        results.violations.forEach(violation => {
          violation.nodes.forEach(node => {
            const selector = node.target[0];
            if (!selector) return;
            const category = {
              'target-size': 'targetSize',
              'image-alt': 'altText',
              label: 'formLabels',
              'color-contrast': 'contrast',
              'html-has-lang': 'pageLanguage'
            }[violation.id];
            const severity = ({ critical: 'Kritik', serious: 'Yüksek', moderate: 'Orta', minor: 'Düşük' })[violation.impact] || 'Orta';
            addFinding(findings, {
              selector,
              category: category || 'axe',
              rule: violation.id,
              issue: violation.help,
              severity,
              recommendation: axeRecommendation(violation.id, violation.helpUrl),
              evidence: { measured: `Axe-Core ${violation.id} kuralında başarısız öğe` }
            });
          });
        });
      } catch (error) {
        warnings.push(`Axe-Core çalıştırılamadı: ${error.message}`);
      }
    } else {
      warnings.push('Axe-Core yüklenemedi; ilgili WCAG kuralları çalıştırılmadı.');
    }
    const contrast = checkTextContrast(findings);
    const touchTargets = checkTouchTargets(findings);
    if (contrast.truncated) warnings.push('Kontrast kontrolü 3.000 görünür metin öğesi sınırı nedeniyle tamamı kapsamadı.');
    if (contrast.unmeasurable) warnings.push(`${contrast.unmeasurable} metin öğesinde kontrast arka planı güvenilir ölçülemedi.`);
    if (touchTargets.truncated) warnings.push('Dokunma hedefi kontrolü 1.000 görünür hedef sınırı nedeniyle tamamı kapsamadı.');
    checkMissingAltTexts(findings);
    checkUnlabeledInputs(findings);
    checkPageLanguage(findings);
    const normanEvidence = collectNormanEvidence(findings);
    const auditEvidenceIds = new Set([
      'page-structure',
      ...findings.map(finding => finding.id),
      ...normanEvidence.controls.map(control => control.id)
    ]);
    auditEvidenceTargets = new Map([
      ...findings.map(finding => [finding.id, finding.selector]),
      ...normanEvidence.controls.map(control => [control.id, control.selector])
    ]);
    return {
      findings,
      warnings,
      page: { origin: location.origin, analyzedAt: new Date().toISOString() },
      checks: {
        axeCore: axeStatus,
        axeVersion,
        contrastElementsInspected: contrast.inspected,
        contrastElementsMeasured: contrast.measured,
        contrastElementsUnmeasurable: contrast.unmeasurable,
        contrastCheckTruncated: contrast.truncated,
        touchTargetsInspected: touchTargets.inspected,
        touchTargetCheckTruncated: touchTargets.truncated
      },
      sensitive,
      normanEvidence
    };
  }

  function highlight(selector) {
    if (highlightTimer) clearTimeout(highlightTimer);
    document.querySelectorAll('[data-ux-audit-highlight="true"]').forEach(element => element.remove());
    const element = document.querySelector(selector);
    if (!element) return { success: false, error: 'Bulgu öğesi artık sayfada bulunamıyor.' };
    element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
    const rect = element.getBoundingClientRect();
    const marker = document.createElement('div');
    marker.dataset.uxAuditHighlight = 'true';
    const shadow = marker.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial !important; position: fixed !important; inset: 0 !important;
        z-index: 2147483647 !important; pointer-events: none !important; }
      div { position: absolute; left: ${rect.left}px; top: ${rect.top}px;
        width: ${rect.width}px; height: ${rect.height}px; box-sizing: border-box;
        outline: 3px solid #e53935; outline-offset: 2px;
        background: rgba(229, 57, 53, .12); }
    `;
    shadow.appendChild(style);
    shadow.appendChild(document.createElement('div'));
    document.documentElement.appendChild(marker);
    highlightTimer = setTimeout(() => marker.remove(), 5000);
    return { success: true };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'RUN_DETERMINISTIC_AUDIT') {
      runAudit().then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
    if (request.action === 'HIGHLIGHT_AUDIT_FINDING') {
      sendResponse(highlight(request.selector));
      return;
    }
    if (request.action === 'VALIDATE_AUDIT_EVIDENCE') {
      const selectors = {};
      const validEvidenceIds = [];
      (request.evidenceIds || []).forEach(id => {
        if (auditEvidenceIds.has(id)) validEvidenceIds.push(id);
        const selector = auditEvidenceTargets.get(id);
        if (!selector) return;
        try {
          if (document.querySelector(selector)) selectors[id] = selector;
        } catch {
          return;
        }
      });
      sendResponse({ selectors, validEvidenceIds });
    }
  });
})();
