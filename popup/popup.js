// popup/popup.js

let latestReportData = null;

// Skorlama fonksiyonu (popup içine doğrudan dahil edildi)
function calculateScores(deterministicResults, llmFindings) {
  let deterministicPenalties = 0;
  
  if (deterministicResults.axeViolations) {
    deterministicResults.axeViolations.forEach(v => {
      deterministicPenalties += (v.severity === 'Kritik' ? 15 : 10);
    });
  }
  if (deterministicResults.touchTargets) deterministicPenalties += deterministicResults.touchTargets.length * 10;
  if (deterministicResults.missingAlts) deterministicPenalties += deterministicResults.missingAlts.length * 15;
  if (deterministicResults.unlabeledInputs) deterministicPenalties += deterministicResults.unlabeledInputs.length * 15;
  if (deterministicResults.pageLanguage && deterministicResults.pageLanguage.length > 0) deterministicPenalties += 10;

  let deterministicScore = Math.max(0, 100 - deterministicPenalties);

  let llmPenalties = 0;
  if (llmFindings && Array.isArray(llmFindings)) {
    llmFindings.forEach(f => {
      const sev = (f.severity || 'orta').toLowerCase();
      if (sev.includes('kritik')) llmPenalties += 15;
      else if (sev.includes('yüksek')) llmPenalties += 10;
      else if (sev.includes('orta')) llmPenalties += 5;
      else llmPenalties += 2;
    });
  }
  let llmScore = Math.max(0, 100 - llmPenalties);
  let finalScore = Math.round((deterministicScore * 0.5) + (llmScore * 0.5));

  return { finalScore, deterministicScore, llmScore };
}

// Sayfa DOM Özetini Çıkaran Fonksiyon
function prepareDOMForLLM() {
  const elements = document.querySelectorAll('button, a, input, select, textarea, img');
  let analysisSummary = {
    totalButtons: document.querySelectorAll('button, a[role="button"], input[type="submit"]').length,
    totalInputs: document.querySelectorAll('input:not([type="hidden"]), select, textarea').length,
    imagesWithoutAlt: document.querySelectorAll('img:not([alt]), img[alt=""]').length,
    unlabeledInputsCount: 0
  };

  elements.forEach((el) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && el.type !== 'hidden' && el.type !== 'submit') {
      const id = el.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasAria = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
      const hasParent = el.closest('label');
      if (!hasLabel && !hasAria && !hasParent) {
        analysisSummary.unlabeledInputsCount++;
      }
    }
  });

  return analysisSummary;
}

// Yorumsal Analiz Üretici
function analyzeWithLLM(domSummary) {
  const dynamicFindings = [];

  if (domSummary.imagesWithoutAlt > 0) {
    dynamicFindings.push({
      principle: "Görünürlük",
      element: "img",
      selector: "img:not([alt])",
      issue: `Sayfada alt metni eksik ${domSummary.imagesWithoutAlt} görsel tespit edildi.`,
      severity: "Kritik",
      recommendation: "Görsellere açıklayıcı alt etiketleri ekleyin."
    });
  }

  if (domSummary.unlabeledInputsCount > 0) {
    dynamicFindings.push({
      principle: "Kısıtlar & Eşleme",
      element: "input",
      selector: "input",
      issue: `Etiketsiz ${domSummary.unlabeledInputsCount} form alanı bulundu.`,
      severity: "Yüksek",
      recommendation: "Form alanlarını <label> ile ilişkilendirin."
    });
  }

  dynamicFindings.push({
    principle: "Tutarlılık",
    element: "nav",
    selector: "nav, header",
    issue: "Navigasyon elementleri standart kullanıcı alışkanlıklarına uyumlu gözden geçirilmeli.",
    severity: "Orta",
    recommendation: "Menü öğelerini standart konumlarda tutun."
  });

  return { success: true, findings: dynamicFindings };
}

document.getElementById('audit-btn').addEventListener('click', async () => {
  const loadingEl = document.getElementById('loading');
  const resultsEl = document.getElementById('results-section');
  const exportBtn = document.getElementById('export-btn');

  loadingEl.classList.remove('hidden');
  resultsEl.classList.add('hidden');
  exportBtn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 1. Deterministik Analiz
    chrome.tabs.sendMessage(tab.id, { action: "RUN_DETERMINISTIC_AUDIT" }, async (response) => {
      let deterministicResults = response && response.success ? response.data : {};

      // 2. DOM Özet Analizi
      let domSummary = { totalButtons: 0, totalInputs: 0, imagesWithoutAlt: 0, unlabeledInputsCount: 0 };
      try {
        const injectionResult = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: prepareDOMForLLM
        });
        if (injectionResult[0]?.result) {
          domSummary = injectionResult[0].result;
        }
      } catch (e) {
        console.warn("DOM özet verisi alınamadı:", e);
      }

      // 3. AI / Norman Analizi
      const llmResult = analyzeWithLLM(domSummary);
      let llmFindings = llmResult.findings || [];

      // 4. Skorlar
      const scores = calculateScores(deterministicResults, llmFindings);

      latestReportData = {
        url: tab.url,
        timestamp: new Date().toISOString(),
        scores,
        deterministicResults,
        llmFindings
      };

      document.getElementById('final-score').innerText = `${scores.finalScore} / 100`;
      document.getElementById('det-score').innerText = `${scores.deterministicScore}`;
      document.getElementById('ai-score').innerText = `${scores.llmScore}`;

      const listEl = document.getElementById('findings-list');
      listEl.innerHTML = '';

      const allIssues = [
        ...(deterministicResults.axeViolations || []),
        ...(deterministicResults.touchTargets || []),
        ...(deterministicResults.missingAlts || []),
        ...(deterministicResults.unlabeledInputs || []),
        ...(deterministicResults.pageLanguage || []),
        ...llmFindings
      ];

      if (allIssues.length === 0) {
        listEl.innerHTML = '<li>Harika! Hiçbir ihlal bulunamadı.</li>';
      } else {
        allIssues.forEach(issue => {
          const li = document.createElement('li');
          li.className = (issue.severity || 'orta').toLowerCase();
          li.innerHTML = `<strong>[${issue.rule || issue.principle || 'Genel'}]</strong> ${issue.issue || issue.description} <br><small>Öneri: ${issue.recommendation || 'Belirtilmemiş'}</small>`;
          listEl.appendChild(li);
        });
      }

    });

    loadingEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');
    exportBtn.disabled = false;

  } catch (err) {
    console.error("Denetim hatası:", err);
    loadingEl.classList.add('hidden');
  }
});

document.getElementById('export-btn').addEventListener('click', () => {
  if (!latestReportData) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(latestReportData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `ux-audit-report-${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
});