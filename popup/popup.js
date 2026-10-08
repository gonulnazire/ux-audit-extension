// popup/popup.js
import { analyzeWithLLM, prepareDOMForLLM } from '../models/llmAnalyzer.js';
import { calculateScores } from '../models/scorer.js';

let latestReportData = null;

document.getElementById('audit-btn').addEventListener('click', async () => {
  const loadingEl = document.getElementById('loading');
  const resultsEl = document.getElementById('results-section');
  const exportBtn = document.getElementById('export-btn');

  loadingEl.classList.remove('hidden');
  resultsEl.classList.add('hidden');
  exportBtn.disabled = true;

  try {
    // 1. Aktif sekmeyi bul
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 2. Deterministik Analizi Çalıştır
    chrome.tabs.sendMessage(tab.id, { action: "RUN_DETERMINISTIC_AUDIT" }, async (response) => {
      let deterministicResults = response && response.success ? response.data : {};

      // 3. LLM Yorumsal Analiz için DOM verisini hazırla ve enjekte et
      let domSummaryText = "";
      try {
        const injectionResult = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: prepareDOMForLLM
        });
        domSummaryText = injectionResult[0]?.result || "[]";
      } catch (e) {
        console.warn("DOM özet verisi alınamadı, boş devam ediliyor:", e);
      }

      // 4. LLM Analizini Çalıştır
      let llmFindings = [];
      try {
        const llmResult = await analyzeWithLLM(domSummaryText);
        llmFindings = llmResult.findings || llmResult.mockFindings || [];
      } catch (e) {
        console.warn("LLM analizi çalıştırılamadı, fallback kullanılıyor.");
      }

      // 5. Skorları Hesapla
      const scores = calculateScores(deterministicResults, llmFindings);

      // Rapor nesnesini sakla
      latestReportData = {
        url: tab.url,
        timestamp: new Date().toISOString(),
        scores,
        deterministicResults,
        llmFindings
      };

      // 6. Arayüze Yansit
      document.getElementById('final-score').innerText = `${scores.finalScore} / 100`;
      document.getElementById('det-score').innerText = `${scores.deterministicScore}`;
      document.getElementById('ai-score').innerText = `${scores.llmScore}`;

      const listEl = document.getElementById('findings-list');
      listEl.innerHTML = '';

      // Tüm bulguları listeye ekle
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

      loadingEl.classList.add('hidden');
      resultsEl.classList.remove('hidden');
      exportBtn.disabled = false;
    });

  } catch (err) {
    console.error("Denetim sırasında hata oluştu:", err);
    loadingEl.classList.add('hidden');
    alert("Analiz başlatılırken bir hata oluştu. Sayfayı yenileyip tekrar deneyin.");
  }
});

// JSON Olarak Dışa Aktar
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