import test from 'node:test';
import assert from 'node:assert/strict';
import { groupFindings } from '../models/report.js';

test('groups repeated findings without losing measured evidence or selectors', () => {
  const grouped = groupFindings([
    {
      id: 'f-1',
      rule: 'WCAG 2.5.8',
      issue: 'Target is undersized',
      selector: '#first',
      evidence: { measured: '12x12 CSS px' }
    },
    {
      id: 'f-2',
      rule: 'WCAG 2.5.8',
      issue: 'Target is undersized',
      selector: '#second',
      evidence: { measured: '16x16 CSS px' }
    }
  ]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].count, 2);
  assert.deepEqual(grouped[0].evidence, { measured: '12x12 CSS px' });
  assert.deepEqual(grouped[0].references.map(reference => reference.selector), ['#first', '#second']);
});

test('retains multiple validated references for one AI finding', () => {
  const grouped = groupFindings([{
    rule: 'Norman: Tutarlılık',
    issue: 'Controls are inconsistent.',
    evidenceReferences: [{ id: 'control-1', selector: '#a' }, { id: 'control-2', selector: '#b' }]
  }]);
  assert.equal(grouped[0].count, 1);
  assert.deepEqual(grouped[0].references.map(reference => reference.selector), ['#a', '#b']);
});
