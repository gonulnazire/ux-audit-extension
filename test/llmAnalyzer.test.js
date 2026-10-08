import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWithLLM, NORMAN_PRINCIPLES } from '../models/llmAnalyzer.js';

const evidence = {
  counts: { visibleHeadings: 1 },
  observations: [{ id: 'page-structure', kind: 'page-structure' }],
  findings: [{ id: 'finding-1', kind: 'deterministic-finding', measured: '12x12 CSS px' }],
  controls: [{
    id: 'control-1',
    selector: '#account-email',
    tag: 'button',
    name: 'Merhaba gonul@example.com',
    hasAccessibleName: true,
    disabled: false,
    targetSize: '24x24 CSS px',
    value: 'private form value must never be sent'
  }]
};

function apiPayload(findings = []) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        principleScores: NORMAN_PRINCIPLES.map(principle => ({
          principle,
          score: 80,
          evidenceIds: ['control-1'],
          rationale: 'Kontrol yapısı gözlemlendi.'
        })),
        findings
      })
    }]
  };
}

test('sends only minimized evidence and rejects findings without evidence IDs', async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => apiPayload([
      {
        principle: 'Görünürlük',
        issue: 'Kanıtsız iddia',
        severity: 'Orta',
        recommendation: 'Düzeltin',
        evidenceIds: ['not-on-page']
      },
      {
        principle: 'Tutarlılık',
        issue: 'Kanıtlı yorum',
        severity: 'Düşük',
        recommendation: 'Gözden geçirin',
        evidenceIds: ['control-1']
      }
    ]) };
  };
  try {
    const result = await analyzeWithLLM('secret-key', evidence);
    const body = request.options.body;
    assert.equal(request.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(request.options.headers['x-api-key'], 'secret-key');
    assert.equal(JSON.parse(request.options.body).model, 'claude-sonnet-5-5');
    assert.equal(JSON.parse(request.options.body).temperature, 0);
    assert.equal(result.model, 'claude-sonnet-5-5');
    assert.equal(result.findings.length, 1);
    assert.equal(result.unsupportedFindings, 1);
    assert.ok(!body.includes('secret-key'));
    assert.ok(!body.includes('#account-email'));
    assert.ok(!body.includes('private form value'));
    assert.ok(!body.includes('gonul@example.com'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects incomplete principle score responses', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ content: [{ type: 'text', text: JSON.stringify({ principleScores: [], findings: [] }) }] })
  });
  try {
    await assert.rejects(analyzeWithLLM('secret-key', evidence), /altı Norman ilkesi/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('accepts explicitly unscored principles when evidence is insufficient', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      content: [{
        type: 'text',
        text: JSON.stringify({
          principleScores: NORMAN_PRINCIPLES.map((principle, index) => ({
            principle,
            score: index === 0 ? 80 : null,
            evidenceIds: index === 0 ? ['page-structure'] : [],
            rationale: index === 0 ? 'Gözlemlenebilir yapı var.' : 'Davranış kanıtı yok.'
          })),
          findings: []
        })
      }]
    })
  });
  try {
    const result = await analyzeWithLLM('secret-key', evidence);
    assert.equal(result.principleScores[0].score, 80);
    assert.equal(result.principleScores[1].score, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
