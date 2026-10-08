// models/scorer.js

/**
 * Ağırlıklı Skorlama Modeli
 * 
 * Açıklama ve Gerekçe (README için):
 * - Başlangıç skoru 100 puandır.
 * - Deterministik katman (WCAG ve teknik hatalar) toplam skora %50 etki eder.
 * - LLM yorumsal katmanı (Don Norman ilkeleri) toplam skora %50 etki eder.
 * - Hatalar şiddet derecelerine göre ceza puanı alır:
 *   * Kritik: -15 puan
 *   * Yüksek: -10 puan
 *   * Orta: -5 puan
 *   * Düşük: -2 puan
 * - Skor 0'ın altına düşemez (Minimum 0).
 */

export function calculateScores(deterministicResults, llmFindings) {
  // 1. Deterministik Skor Hesaplama
  let deterministicPenalties = 0;
  
  // Axe-core ihlalleri
  if (deterministicResults.axeViolations) {
    deterministicResults.axeViolations.forEach(v => {
      deterministicPenalties += (v.severity === 'Kritik' ? 15 : 10);
    });
  }
  
  // Dokunma hedefi ihlalleri
  if (deterministicResults.touchTargets) {
    deterministicResults.touchTargets.forEach(v => {
      deterministicPenalties += 10; // Yüksek
    });
  }

  // Eksik alt metinler
  if (deterministicResults.missingAlts) {
    deterministicResults.missingAlts.forEach(v => {
      deterministicPenalties += 15; // Kritik
    });
  }

  // Etiketsiz form alanları
  if (deterministicResults.unlabeledInputs) {
    deterministicResults.unlabeledInputs.forEach(v => {
      deterministicPenalties += 15; // Kritik
    });
  }

  // Sayfa dili eksikliği
  if (deterministicResults.pageLanguage && deterministicResults.pageLanguage.length > 0) {
    deterministicPenalties += 10;
  }

  let deterministicScore = Math.max(0, 100 - deterministicPenalties);

  // 2. LLM Yorumsal Skor Hesaplama (Don Norman İlkeleri)
  let llmPenalties = 0;
  if (llmFindings && Array.isArray(llmFindings)) {
    llmFindings.forEach(f => {
      const sev = f.severity ? f.severity.toLowerCase() : 'orta';
      if (sev.includes('kritik')) llmPenalties += 15;
      else if (sev.includes('yüksek')) llmPenalties += 10;
      else if (sev.includes('orta')) llmPenalties += 5;
      else llmPenalties += 2;
    });
  }

  let llmScore = Math.max(0, 100 - llmPenalties);

  // 3. Ağırlıklı Toplam Skor (%50 Deterministik + %50 LLM)
  const finalScore = Math.round((deterministicScore * 0.5) + (llmScore * 0.5));

  return {
    finalScore,
    deterministicScore,
    llmScore,
    breakdown: {
      deterministicPenalties,
      llmPenalties,
      totalIssuesFound: (
        (deterministicResults.axeViolations?.length || 0) +
        (deterministicResults.touchTargets?.length || 0) +
        (deterministicResults.missingAlts?.length || 0) +
        (deterministicResults.unlabeledInputs?.length || 0) +
        (deterministicResults.pageLanguage?.length || 0) +
        (llmFindings?.length || 0)
      )
    }
  };
}