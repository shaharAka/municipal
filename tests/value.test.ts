import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFixture } from '../src/cloud/fixtures.ts';
import { evaluateHouseholds, outreachLetter, rightsView } from '../src/value/rights.ts';
import { createTasks, extractDecisions, meetingsView, recall } from '../src/value/meetings.ts';
import { SUPPRESSION } from '../src/seed/eligibility-rules.ts';

const fixture = buildFixture('givat-rimon');
const names = { canSeeNames: true, whyHe: '' };
const counts = { canSeeNames: false, whyHe: '' };

test('proactive rights: eligible households that are not receiving the discount, with the evidence', () => {
  const view = rightsView(fixture, names, new Map());
  assert.equal(view.totals.households, 44);
  assert.equal(view.totals.eligible, 7);
  assert.equal(view.totals.notReceiving, 5);
  assert.equal(view.worklist.length, 5);
  for (const h of view.worklist) {
    assert.ok(h.qualifiers.length > 0, 'every row has a ground');
    assert.equal(h.receiving, false);
    assert.ok(h.unclaimedAnnual > 0);
    for (const q of h.qualifiers) assert.ok(q.evidence.every((e) => e.table && e.row && e.column), 'every ground points at a row and a column');
  }
  // One discount per household, never summed across grounds.
  assert.equal(view.totals.unclaimedAnnual, view.worklist.reduce((a, h) => a + h.unclaimedAnnual, 0));
});

test('proactive rights: names stay with the role that handles requests, small counts are suppressed', () => {
  const view = rightsView(fixture, counts, new Map());
  assert.equal(view.worklist.length, 0, 'no names or addresses without the role');
  for (const g of view.grounds.filter((x) => x.connected)) {
    if (g.eligible !== null) assert.ok(g.eligible === 0 || g.eligible >= SUPPRESSION.minCellSize);
  }
  assert.equal(view.totals.receiving, null, 'a count of 2 is suppressed');
});

test('proactive rights: the rule engine reads the records and no record goes to a model', () => {
  const view = rightsView(fixture, names, new Map());
  assert.equal(view.boundary.rowsSentToModel, 0);
  assert.equal(view.boundary.rowsProcessed, 44);
  const reservist = view.grounds.find((g) => g.code === 'RESERVIST');
  assert.equal(reservist?.connected, false);
  assert.ok((reservist?.unchecked ?? 0) > 0, 'an unconnected source is reported as unchecked, not as zero');
});

test('proactive rights: the outreach letter is Hebrew, cites the rule and names the clerk', () => {
  const household = evaluateHouseholds(fixture).find((h) => h.qualifiers.length && !h.receiving)!;
  const letter = outreachLetter(household, 'הילה קורן')!;
  assert.match(letter.text, /הנחה בארנונה/);
  assert.match(letter.text, /תקנות הסדרים/);
  assert.match(letter.text, /הילה קורן/);
  assert.doesNotMatch(letter.text, /[A-Za-z]{3,}/, 'no English in a letter to a resident');
});

test('meetings: decisions, owners and dates come from the minutes, and a later meeting closes one', () => {
  const decisions = extractDecisions(fixture);
  assert.equal(decisions.length, 8);
  assert.equal(decisions.filter((d) => d.status === 'done').length, 1);
  assert.equal(decisions.filter((d) => d.status === 'overdue').length, 1);
  assert.equal(decisions.filter((d) => d.flags.includes('no_owner')).length, 2);
  assert.ok(decisions.every((d) => d.line > 0 && d.path), 'every decision keeps its document and line');
  const owned = decisions.filter((d) => d.ownerName);
  assert.ok(owned.every((d) => d.ownerId), 'every named owner is matched to the directory');
});

test('meetings: recall finds what was decided, and tasks are created only for owned, open decisions', () => {
  const decisions = extractDecisions(fixture);
  const found = recall(decisions, 'מה הוחלט על הנחות');
  assert.ok(found.some((d) => d.linksTo === 'rights'));
  const tasks = new Map();
  const created = createTasks(fixture, tasks, new Map(), 'דנה לוי (מנהלת תברואה ובריאות)', '2026-10-17T08:00:00.000Z');
  assert.equal(created.length, 5);
  assert.ok(created.every((t) => t.ownerId && t.createdBy));
  assert.equal(createTasks(fixture, tasks, new Map(), 'x', 'y').length, 0, 'creating twice adds nothing');
  const view = meetingsView(fixture, created[0].ownerId, tasks, new Map(), '');
  assert.ok(view.mine.length > 0, 'the owner sees their task');
});
