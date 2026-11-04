import { test } from 'node:test';
import assert from 'node:assert/strict';
import { policyLinks } from './model.ts';

const docs = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
const rule = (docId, topic, historical = false) => ({ docId, topic, historical });
const finding = (id, docIds, status = 'detected') => ({ id, status, evidence: docIds.map(docId => ({ docId, version: '1' })) });

test('shared current topics create one pair without implying a finding', () => {
  const links = policyLinks(docs, [rule('A', 'leave'), rule('A', 'leave'), rule('B', 'leave')], []);
  assert.equal(links.length, 1);
  assert.deepEqual(links[0].topics, ['leave']);
  assert.deepEqual(links[0].findings, []);
});
test('historical and unknown-document rules do not create topic links', () => {
  assert.deepEqual(policyLinks(docs, [rule('A', 'leave'), rule('B', 'leave', true), rule('missing', 'leave')], []), []);
});
test('open citations connect exact documents even without current shared topics', () => {
  const issue = finding('F1', ['B', 'A', 'A']);
  const links = policyLinks(docs, [], [issue]);
  assert.equal(links.length, 1);
  assert.equal(links[0].a, 'A');
  assert.equal(links[0].b, 'B');
  assert.deepEqual(links[0].findings, [issue]);
  assert.deepEqual(links[0].topics, []);
});
test('closed, dismissed, single-document and dangling evidence never invent edges', () => {
  assert.deepEqual(policyLinks(docs, [], [finding('closed', ['A', 'B'], 'closed'), finding('dismissed', ['A', 'B'], 'dismissed'), finding('single', ['A', 'A']), finding('missing', ['A', 'missing'])]), []);
});
test('multi-document citations produce unique pairs; topic and finding edges merge', () => {
  const issue = finding('multi', ['A', 'B', 'C', 'A']);
  const links = policyLinks(docs, [rule('A', 'leave'), rule('B', 'leave')], [issue]);
  assert.equal(links.length, 3);
  assert.deepEqual(links.find(l => l.a === 'A' && l.b === 'B').topics, ['leave']);
  assert.ok(links.every(l => l.findings.length === 1));
});
test('empty workspaces produce an empty map', () => assert.deepEqual(policyLinks([], [], []), []));
