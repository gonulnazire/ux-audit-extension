export const DETERMINISTIC_WEIGHTS = {
  axe: 40,
  contrast: 20,
  targetSize: 15,
  altText: 10,
  formLabels: 10,
  pageLanguage: 5
};

export const NORMAN_WEIGHTS = {
  'Görünürlük': 1 / 6,
  'Geri Bildirim': 1 / 6,
  'Kısıtlar': 1 / 6,
  'Eşleme': 1 / 6,
  'Tutarlılık': 1 / 6,
  'Sağlarlık (Affordance)': 1 / 6
};

const PENALTIES = { 'Kritik': 15, 'Yüksek': 10, 'Orta': 5, 'Düşük': 2 };

function uniqueFindings(findings) {
  const seen = new Set();
  return findings.filter(finding => {
    const key = `${finding.category}|${finding.rule}|${finding.selector}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function weightedMean(scores, weights) {
  let weightedTotal = 0;
  let weightTotal = 0;
  Object.entries(weights).forEach(([key, weight]) => {
    if (Number.isFinite(scores[key])) {
      weightedTotal += scores[key] * weight;
      weightTotal += weight;
    }
  });
  return weightTotal ? Math.round(weightedTotal / weightTotal) : null;
}

export function calculateScores(audit, llmAnalysis = null) {
  const findings = uniqueFindings(audit.findings || []);
  const categoryScores = {};
  Object.entries(DETERMINISTIC_WEIGHTS).forEach(([category, weight]) => {
    const applicable = category === 'axe'
      ? audit.checks?.axeCore === 'completed'
      : category === 'contrast'
        ? !audit.checks?.contrastCheckTruncated && !audit.checks?.contrastElementsUnmeasurable
        : category === 'targetSize'
          ? !audit.checks?.touchTargetCheckTruncated
          : true;
    const penalties = findings.filter(finding => finding.category === category)
      .reduce((sum, finding) => sum + (PENALTIES[finding.severity] || PENALTIES.Orta), 0);
    categoryScores[category] = {
      score: applicable ? Math.max(0, 100 - penalties) : null,
      weight,
      findings: findings.filter(finding => finding.category === category).length
    };
  });

  const deterministicScore = weightedMean(
    Object.fromEntries(Object.entries(categoryScores).map(([key, value]) => [key, value.score])),
    DETERMINISTIC_WEIGHTS
  );
  const principleScores = Object.fromEntries(
    Object.keys(NORMAN_WEIGHTS).map(principle => {
      const item = llmAnalysis?.principleScores?.find(score => score.principle === principle);
      return [principle, Number.isFinite(item?.score) ? item.score : null];
    })
  );
  const llmScore = weightedMean(principleScores, NORMAN_WEIGHTS);
  const finalScore = llmScore === null
    ? deterministicScore
    : Math.round(deterministicScore * 0.7 + llmScore * 0.3);

  return {
    finalScore,
    deterministicScore,
    llmScore,
    categories: categoryScores,
    principles: principleScores,
    weights: { deterministic: llmScore === null ? 1 : 0.7, interpretive: llmScore === null ? 0 : 0.3 },
    breakdown: {
      deterministicPenalties: 100 - deterministicScore,
      llmPenalties: llmScore === null ? null : 100 - llmScore,
      totalIssuesFound: findings.length + (llmAnalysis?.findings?.length || 0)
    }
  };
}
