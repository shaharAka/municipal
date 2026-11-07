import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, sites, charges, requests, record, totals, amount, resolveCharge, updateRequest, financeRows, routePlan, findings, CAPACITY_TONNES, RATES, approvalsFor, decideApproval } from '../src/web/workspace-model.js';

test('work, map and CRM navigate through the same site and collection point', () => {
  const m = createWorkspace();
  for (const site of sites(m)) {
    assert.equal(record(m, site.chargeId).siteId, site.id);
    assert.equal(record(m, site.pointId).siteId, site.id);
    for (const id of site.requestIds) {
      const request = record(m, id);
      assert.equal(request.siteId, site.id);
      assert.equal(request.pointId, site.pointId);
    }
  }
});

test('unknown weight cannot silently become zero or enter an approved finance export', () => {
  const m = createWorkspace();
  const unknown = charges(m).find(c => c.quantity === null);
  assert.equal(amount(unknown), null);
  assert.throws(() => financeRows(m, 'manager'), /חריגים/);
  assert.throws(() => resolveCharge(m, unknown.id, 'manager', { quantity: 0, proof: 'EX-1' }), /חיובית/);
  assert.throws(() => resolveCharge(m, unknown.id, 'manager', { quantity: 8.6 }), /אסמכת/);
  assert.equal(record(m, unknown.id).resolved, false);
});

test('reviewing all exceptions enables exact, traceable finance outputs', () => {
  const m = createWorkspace();
  for (const c of charges(m).filter(c => !c.resolved)) {
    resolveCharge(m, c.id, 'manager', { quantity: 8.6, proof: 'EXAMPLE-WEIGHT-9' });
  }
  assert.throws(() => financeRows(m, 'finance'), /אישור נפרד/);
  const review = approvalsFor(m, 'finance').find(a => a.id === 'approval-settlement');
  decideApproval(m, review.id, 'finance', 'approved', { version: review.version, basis: review.currentBasis });
  const rows = financeRows(m, 'finance');
  assert.equal(totals(m).issues, 0);
  assert.equal(rows.length, sites(m).length);
  assert.ok(rows.every(r => r.amount === Math.round(r.quantity * r.tariff * 100) / 100 && r.source));
  assert.equal(rows.reduce((sum, r) => sum + r.amount, 0), totals(m).knownAmount);
  assert.equal(m.audit.length, 4);
  assert.ok(m.audit.every(a => ['מוטי', 'צוות הכספים'].includes(a.actor) && a.subject && a.note));
});

test('correcting one tariff does not alter the shared approved rule or other charges', () => {
  const m = createWorkspace();
  const oldRate = RATES.mixed;
  const before = amount(record(m, 'charge-s1'));
  resolveCharge(m, 'charge-s5', 'manager');
  assert.equal(record(m, 'charge-s5').rate, oldRate);
  assert.equal(amount(record(m, 'charge-s1')), before);
  assert.equal(RATES.mixed, oldRate);
  assert.equal(record(m, 'rule-tariff').version, 2);
});

test('role guards apply to model actions, not only hidden controls', () => {
  const m = createWorkspace();
  assert.throws(() => resolveCharge(m, 'charge-s2', 'finance'), /מנהל/);
  assert.throws(() => resolveCharge(m, 'charge-s2', 'dispatcher'), /מנהל/);
  assert.throws(() => financeRows(m, 'dispatcher'), /כספים/);
  assert.throws(() => updateRequest(m, 'request-1042', 'finance', 'closed'), /רכז/);
  assert.equal(m.audit.length, 0);
});

test('request updates are reflected wherever the linked request is read', () => {
  const m = createWorkspace();
  const site = record(m, 's2');
  updateRequest(m, site.requestIds[0], 'dispatcher', 'investigating');
  assert.equal(record(m, 'request-1042').state, 'investigating');
  assert.equal(requests(m).find(r => r.pointId === site.pointId).state, 'investigating');
});

test('route comparison visits every filtered point once and respects capacity', () => {
  const m = createWorkspace();
  const points = sites(m).map(s => record(m, s.pointId));
  for (const improve of [false, true]) {
    const plan = routePlan(points, improve);
    const visited = plan.tours.flatMap(t => t.stops.map(s => s.id));
    assert.deepEqual([...visited].sort(), points.map(p => p.id).sort());
    assert.equal(new Set(visited).size, points.length);
    assert.ok(plan.tours.every(t => t.load <= CAPACITY_TONNES && t.path.length === t.stops.length + 2));
    assert.ok(!('distance' in plan), 'Distances must come from Google road routes.');
  }
  assert.deepEqual(routePlan([], true), { tours: [] });
  assert.throws(() => routePlan([{ ...points[0], load: 11 }], true), /קיבולת/);
});

test('derived knowledge can be recomputed without editing recorded observations', () => {
  const m = createWorkspace();
  const sourceSnapshot = JSON.stringify(m.entities);
  const before = findings(m);
  assert.ok(before.every(f => f.knowledgeLevel === 2 && f.derivedFrom.length >= 2 && f.method && f.version));
  assert.equal(JSON.stringify(m.entities), sourceSnapshot);
  resolveCharge(m, 'charge-s2', 'manager');
  assert.ok(!findings(m).some(f => f.derivedFrom.includes('charge-s2')));
  assert.equal(JSON.stringify(m.entities), sourceSnapshot);
  assert.equal(m.audit[0].subject, 'charge-s2');
});
