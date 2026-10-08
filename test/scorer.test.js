import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScores } from '../models/scorer.js';

const cleanAudit = checks => ({
  findings: [],
  checks: { axeCore: 'completed', ...checks }
});

test('calculates category scores and weighted deterministic score', () => {
  const result = calculateScores({
    ...cleanAudit(),
    findings: [{
      category: 'targetSize',
      rule: 'WCAG 2.5.8',
      selector: '#target',
      severity: 'Yüksek'
    }]
  });
  assert.equal(result.categories.targetSize.score, 90);
  assert.equal(result.deterministicScore, 99);
  assert.equal(result.llmScore, null);
  assert.equal(result.finalScore, result.deterministicScore);
});

test('normalizes weights when axe-core is unavailable', () => {
  const result = calculateScores(cleanAudit({ axeCore: 'unavailable' }));
  assert.equal(result.categories.axe.score, null);
  assert.equal(result.deterministicScore, 100);
});

test('excludes incomplete contrast and target scans from the aggregate score', () => {
  const result = calculateScores(cleanAudit({
    contrastElementsUnmeasurable: 1,
    touchTargetCheckTruncated: true
  }));
  assert.equal(result.categories.contrast.score, null);
  assert.equal(result.categories.targetSize.score, null);
  assert.equal(result.deterministicScore, 100);
});

test('deduplicates repeated evidence and combines the two scored layers', () => {
  const finding = { category: 'contrast', rule: 'WCAG 1.4.3', selector: '#copy', severity: 'Orta' };
  const result = calculateScores({
    ...cleanAudit(),
    findings: [finding, finding]
  }, {
    principleScores: [
      { principle: 'Görünürlük', score: 80 },
      { principle: 'Geri Bildirim', score: 80 },
      { principle: 'Kısıtlar', score: 80 },
      { principle: 'Eşleme', score: 80 },
      { principle: 'Tutarlılık', score: 80 },
      { principle: 'Sağlarlık (Affordance)', score: 80 }
    ],
    findings: []
  });
  assert.equal(result.categories.contrast.findings, 1);
  assert.equal(result.categories.contrast.score, 95);
  assert.equal(result.llmScore, 80);
  assert.equal(result.finalScore, 93);
});
