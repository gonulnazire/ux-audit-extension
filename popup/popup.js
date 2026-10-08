import { analyzeWithLLM } from '../models/llmAnalyzer.js';
import { groupFindings } from '../models/report.js';
import { calculateScores } from '../models/scorer.js';

let latestReportData = null;

const $ = id => document.getElementById(id);

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function injectAudit(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/axe.min.js', 'content/content.js']
  });
}

function allFindings(audit, aiFindings = []) {
  return [...audit.findings, ...aiFindings];
}

function appendEvidenceLinks(item, references) {
  const selectors = [...new Set(references.map(reference => reference.selector).filter(Boolean))];
  selectors.forEach((selector, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'evidence-link';
    button.textContent = `Kanıtı göster${selectors.length > 1 ? ` ${index + 1}` : ''}`;
    button.addEventListener('click', async () => {
      try {
        const response = await sendTabMessage(latestReportData.tabId, {
          action: 'HIGHLIGHT_AUDIT_FINDING',
          selector
        });
        if (!response?.success) throw new Error(response?.error || 'Kanıt vurgulanamadı.');
      } catch (error) {
        alert(`Kanıt gösterilemedi: ${error.message}`);
      }
    });
    item.appendChild(button);
  });
}

function renderFindings(audit, aiFindings, warnings) {
  const list = $('findings-list');
  list.replaceChildren();
  warnings.forEach(warning => {
    const item = document.createElement('li');
    item.className = 'warning';
    item.textContent = warning;
    list.appendChild(item);
  });
  const findings = allFindings(audit, aiFindings);
  if (!findings.length && !warnings.length) {
    const item = document.createElement('li');
    item.textContent = 'Taranan kontrollerde kanıtlanmış ihlal bulunamadı.';
    list.appendChild(item);
    return;
  }
  groupFindings(findings).forEach(finding => {
    const item = document.createElement('li');
    item.className = finding.severity.toLowerCase();
    const heading = document.createElement('strong');
    heading.textContent = `[${finding.rule}] ${finding.issue}${finding.count > 1 ? ` (${finding.count} öğe)` : ''}`;
    item.appendChild(heading);

    const details = document.createElement('small');
    const measured = finding.evidence?.measured || finding.references.map(reference => reference.id).join(', ');
    const selectors = [...new Set(finding.references.map(reference => reference.selector).filter(Boolean))];
    details.textContent = `Kanıt: ${measured || 'Sayfada doğrulandı'}${selectors.length ? ` — CSS: ${selectors.join(', ')}` : ''}${finding.recommendation ? ` — Öneri: ${finding.recommendation}` : ''}`;
    item.appendChild(document.createElement('br'));
    item.appendChild(details);
    appendEvidenceLinks(item, finding.references);
    list.appendChild(item);
  });
}

function renderScores(scores, principleScores) {
  $('final-score').textContent = scores.finalScore === null ? 'Hesaplanamadı' : `${scores.finalScore} / 100`;
  $('det-score').textContent = scores.deterministicScore === null ? 'Kullanılamıyor' : `${scores.deterministicScore} / 100`;
  $('ai-score').textContent = scores.llmScore === null ? 'Kullanılamıyor' : `${scores.llmScore} / 100`;
  const list = $('category-scores');
  list.replaceChildren();
  Object.entries(scores.categories).forEach(([category, result]) => {
    const item = document.createElement('li');
    const labels = {
      axe: 'WCAG (Axe-Core)',
      contrast: 'Kontrast',
      targetSize: 'Dokunma hedefi',
      altText: 'Alt metin',
      formLabels: 'Form etiketleri',
      pageLanguage: 'Sayfa dili'
    };
    item.textContent = `${labels[category]}: ${result.score === null ? 'eksik ölçüm — skora katılmadı' : `${result.score}/100`} (${result.findings} bulgu)`;
    list.appendChild(item);
  });
  Object.entries(scores.principles).forEach(([principle, score]) => {
    const item = document.createElement('li');
    const details = principleScores.find(result => result.principle === principle);
    item.textContent = `Norman — ${principle}: ${score === null ? 'Yeterli kanıt yok' : `${score}/100`}${details?.rationale ? ` — ${details.rationale}` : ''}`;
    list.appendChild(item);
    appendEvidenceLinks(item, details?.evidenceReferences || []);
  });
}

async function validateAIReferences(tabId, analysis) {
  const references = [
    ...analysis.findings.flatMap(finding => finding.evidenceIds),
    ...analysis.principleScores.flatMap(score => score.evidenceIds)
  ];
  const response = await sendTabMessage(tabId, {
    action: 'VALIDATE_AUDIT_EVIDENCE',
    evidenceIds: [...new Set(references)]
  });
  if (!response?.selectors) throw new Error('AI kanıtları sayfada doğrulanamadı.');
  const validEvidenceIds = new Set(response.validEvidenceIds || []);
  let unsupportedFindings = analysis.unsupportedFindings;
  const findings = analysis.findings.flatMap(finding => {
    const evidenceReferences = finding.evidenceIds
      .filter(id => response.selectors[id])
      .map(id => ({ id, selector: response.selectors[id] }));
    if (!evidenceReferences.length) {
      unsupportedFindings++;
      return [];
    }
    return [{
      ...finding,
      selector: evidenceReferences[0].selector,
      selectors: evidenceReferences.map(reference => reference.selector),
      id: `ai-${finding.evidenceIds.join('-')}`,
      rule: `Norman: ${finding.principle}`,
      category: 'interpretive',
      evidenceReferences
    }];
  });
  const principleScores = analysis.principleScores.map(score => ({
    ...score,
    evidenceIds: score.evidenceIds.filter(id => validEvidenceIds.has(id))
  })).map(score => {
    const evidenceReferences = score.evidenceIds.map(id => ({
      id,
      selector: response.selectors[id] || null
    }));
    return score.score !== null && !score.evidenceIds.length
      ? {
        ...score,
        score: null,
        evidenceReferences,
        rationale: 'Kanıt öğesi analiz sırasında değişti veya artık bulunamıyor.'
      }
      : { ...score, evidenceReferences };
  });
  return {
    ...analysis,
    findings,
    unsupportedFindings,
    principleScores
  };
}

async function loadSettings() {
  const { anthropicApiKey } = await chrome.storage.local.get('anthropicApiKey');
  $('api-key-status').textContent = anthropicApiKey ? 'API anahtarı bu tarayıcıda kayıtlı.' : 'API anahtarı kayıtlı değil; AI isteğe bağlıdır.';
}

$('save-key-btn').addEventListener('click', async () => {
  const key = $('api-key').value.trim();
  if (!key) {
    $('api-key-status').textContent = 'Önce API anahtarını girin.';
    return;
  }
  try {
    await chrome.storage.local.set({ anthropicApiKey: key });
    $('api-key').value = '';
    $('api-key-status').textContent = 'API anahtarı bu tarayıcının yerel depolamasına kaydedildi.';
  } catch (error) {
    $('api-key-status').textContent = `Anahtar kaydedilemedi: ${error.message}`;
  }
});

$('remove-key-btn').addEventListener('click', async () => {
  try {
    await chrome.storage.local.remove('anthropicApiKey');
    $('api-key').value = '';
    $('api-key-status').textContent = 'API anahtarı silindi.';
  } catch (error) {
    $('api-key-status').textContent = `Anahtar silinemedi: ${error.message}`;
  }
});

$('audit-btn').addEventListener('click', async () => {
  const loading = $('loading');
  const results = $('results-section');
  $('audit-btn').disabled = true;
  $('export-btn').disabled = true;
  loading.classList.remove('hidden');
  results.classList.add('hidden');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('Etkin sekme bulunamadı.');
    await injectAudit(tab.id);
    const response = await sendTabMessage(tab.id, { action: 'RUN_DETERMINISTIC_AUDIT' });
    if (!response?.success) throw new Error(response?.error || 'Denetim sonucu alınamadı.');
    const audit = response.data;
    const warnings = [...audit.warnings];
    let llmAnalysis = null;
    let aiRequestAttempted = false;
    let aiConsentGranted = false;

    if (audit.sensitive) {
      warnings.push('Gizlilik koruması nedeniyle sayfa verisi AI sağlayıcısına gönderilmedi. Yerel deterministik analiz tamamlandı.');
    } else if (!audit.normanEvidence.findings.length && !audit.normanEvidence.controls.length) {
      warnings.push('AI için sayfada hedeflenebilir kanıt bulunamadı; yalnızca deterministik sonuçlar kullanıldı.');
    } else if ($('ai-consent').checked) {
      const confirmed = window.confirm(
        'AI değerlendirmesi için sınırlı, kimliksizleştirilmiş sayfa yapısı Anthropic Claude API\'ye gönderilecek. ' +
        'Form alanları/değerleri, sayfa/kontrol metni, URL ve CSS seçicileri gönderilmez. Devam edilsin mi?'
      );
      if (confirmed) {
        aiConsentGranted = true;
        try {
          const { anthropicApiKey } = await chrome.storage.local.get('anthropicApiKey');
          if (!anthropicApiKey) throw new Error('AI analizi için Anthropic API anahtarı girin.');
          const analysis = await analyzeWithLLM(anthropicApiKey, audit.normanEvidence, () => {
            aiRequestAttempted = true;
          });
          llmAnalysis = await validateAIReferences(tab.id, analysis);
        } catch (error) {
          warnings.push(`AI analizi tamamlanamadı: ${error.message}`);
        }
      } else {
        warnings.push('AI paylaşımı kullanıcı tarafından iptal edildi; yalnızca deterministik skor kullanıldı.');
      }
    } else {
      warnings.push('AI analizi çalıştırılmadı. Başlatmak için AI paylaşım onayını etkinleştirin.');
    }

    const scores = calculateScores(audit, llmAnalysis);
    const checkedAiFindings = (llmAnalysis?.findings.length || 0) + (llmAnalysis?.unsupportedFindings || 0);
    latestReportData = {
      schemaVersion: 1,
      page: audit.page,
      scores,
      checks: audit.checks,
      privacy: {
        sensitivePage: audit.sensitive,
        aiConsentGranted,
        aiRequestAttempted,
        aiAnalysisCompleted: Boolean(llmAnalysis),
        formValuesCollected: false,
        fullPageTextSent: false,
        submittedEvidenceCount: llmAnalysis?.submittedEvidenceCount || 0
      },
      verification: {
        aiFindings: llmAnalysis?.findings.length || 0,
        unsupportedAiFindings: llmAnalysis?.unsupportedFindings || 0,
        unsupportedReferenceRate: checkedAiFindings
          ? (llmAnalysis?.unsupportedFindings || 0) / checkedAiFindings
          : null
      },
      ai: {
        provider: llmAnalysis ? 'Anthropic' : null,
        model: llmAnalysis?.model || null,
        temperature: llmAnalysis?.temperature ?? null
      },
      warnings,
      findings: [...audit.findings, ...(llmAnalysis?.findings || [])],
      aiPrincipleScores: llmAnalysis?.principleScores || []
    };
    latestReportData.tabId = tab.id;
    renderScores(scores, llmAnalysis?.principleScores || []);
    renderFindings(audit, llmAnalysis?.findings || [], warnings);
    $('ai-status').textContent = audit.sensitive
      ? 'Hassas sayfa algılandı — AI kapalı.'
      : llmAnalysis ? 'AI analizi kanıt kimlikleriyle doğrulandı.' : 'AI analizi yapılmadı.';
    loading.classList.add('hidden');
    results.classList.remove('hidden');
    $('export-btn').disabled = false;
  } catch (error) {
    console.error('Denetim sırasında hata oluştu:', error);
    loading.classList.add('hidden');
    alert(`Analiz başlatılamadı: ${error.message}`);
  } finally {
    $('audit-btn').disabled = false;
  }
});

$('export-btn').addEventListener('click', () => {
  if (!latestReportData) return;
  const { tabId, ...report } = latestReportData;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const download = document.createElement('a');
  download.href = url;
  download.download = `ux-audit-report-${Date.now()}.json`;
  download.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

loadSettings().catch(error => {
  $('api-key-status').textContent = `Ayarlar yüklenemedi: ${error.message}`;
});
