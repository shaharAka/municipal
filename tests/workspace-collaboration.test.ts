import test from 'node:test';
import assert from 'node:assert/strict';
import { PEOPLE, createWorkspace, commentsFor, addComment, followRecord, updateRequest, notificationsFor, markNotificationRead, attentionCount, approvalsFor, decideApproval, resolveCharge, charges, financeRows, settlementApproved } from '../src/web/workspace-model.js';
const review = (m: any, id: string, role: string) => approvalsFor(m, role).find(a => a.id === id)!;
const decide = (m: any, id: string, role: string, outcome: string, extra: any = {}) => {
  const a = review(m, id, role);
  return decideApproval(m, id, role, outcome, { version: a.version, basis: a.currentBasis, ...extra });
};
function quiet() {
  const m = createWorkspace();
  Object.assign(m.collaboration, { comments: [], watches: [], notifications: [] });
  return m;
}

test('record conversation addresses explicit people; a comment is never an approval', () => {
  const m = quiet();
  const approvals = JSON.stringify(m.collaboration.approvals);
  addComment(m, 'point-s2', 'manager', 'נא לבדוק את הפינוי', [PEOPLE.dispatcher.id]);
  assert.equal(notificationsFor(m, 'dispatcher').filter(n => n.kind === 'mentioned').length, 1);
  assert.equal(notificationsFor(m, 'finance').length, 0);
  assert.equal(notificationsFor(m, 'manager').length, 0);
  assert.equal(commentsFor(m, 'point-s2', 'finance').length, 1, 'conversation is shared by record readers');
  assert.equal(JSON.stringify(m.collaboration.approvals), approvals);
  addComment(m, 'point-s2', 'manager', 'נוספה אסמכתה');
  assert.equal(notificationsFor(m, 'dispatcher')[0].kind, 'watching', 'mentioned person follows later changes');
});

test('mentions cannot leak financial records or name unknown principals', () => {
  const m = quiet();
  assert.throws(() => addComment(m, 'charge-s2', 'manager', 'פרטי חיוב', [PEOPLE.dispatcher.id]), /לקרוא/);
  assert.throws(() => addComment(m, 'point-s2', 'manager', 'פרטים', ['user:outsider']), /לקרוא/);
  assert.throws(() => commentsFor(m, 'charge-s2', 'dispatcher'), /זמינה/);
  assert.equal(m.collaboration.comments.length, 0);
  assert.equal(m.collaboration.notifications.length, 0);
});

test('read state belongs to the recipient and does not complete an approval', () => {
  const m = createWorkspace();
  const n = notificationsFor(m, 'manager').find(n => n.kind === 'mentioned')!;
  const count = attentionCount(m, 'manager');
  assert.throws(() => markNotificationRead(m, n.id, 'finance'), /אחר/);
  markNotificationRead(m, n.id, 'manager');
  assert.equal(attentionCount(m, 'manager'), count - 1);
  assert.equal(review(m, 'approval-charge-s2', 'manager').state, 'pending');
});

test('followed changes stay quiet, exclude the actor and stop after unfollow; no-op emits nothing', () => {
  const m = quiet();
  followRecord(m, 'request-1042', 'finance');
  followRecord(m, 'request-1042', 'manager');
  const before = attentionCount(m, 'finance');
  updateRequest(m, 'request-1042', 'manager', 'investigating');
  assert.equal(notificationsFor(m, 'manager').length, 0);
  assert.equal(notificationsFor(m, 'finance').length, 1);
  assert.equal(attentionCount(m, 'finance'), before);
  updateRequest(m, 'request-1042', 'manager', 'investigating');
  assert.equal(notificationsFor(m, 'finance').length, 1);
  followRecord(m, 'request-1042', 'finance', false);
  updateRequest(m, 'request-1042', 'manager', 'closed');
  assert.equal(notificationsFor(m, 'finance').length, 1);
});

test('approval requires its exact version, source basis and assigned approver', () => {
  const m = createWorkspace();
  const a = review(m, 'approval-charge-s2', 'manager');
  assert.throws(() => decide(m, a.id, 'finance', 'approved'), /תפקיד אחר/);
  m.entities['charge-s2'].billedQuantity = 13;
  assert.throws(() => decideApproval(m, a.id, 'manager', 'approved', { version: a.version, basis: a.currentBasis }), /השתנתה/);
  assert.equal(m.resolutions['charge-s2'], undefined);
  assert.equal(m.collaboration.approvals[a.id].decisions.length, 0);
  assert.equal(review(m, a.id, 'finance').state, 'stale');
  decide(m, a.id, 'finance', 'resubmit', { note: 'המקור עודכן ונבדק' });
  decide(m, a.id, 'manager', 'approved');
  assert.equal(m.resolutions['charge-s2'].resolved, true);
  assert.equal(m.collaboration.approvals[a.id].decisions.at(-1).person, PEOPLE.manager.id);
});

test('requesting information blocks approval until the requester responds and resubmits', () => {
  const m = createWorkspace();
  assert.throws(() => decide(m, 'approval-charge-s2', 'manager', 'needs_information'), /להסביר/);
  decide(m, 'approval-charge-s2', 'manager', 'needs_information', { note: 'נא לבדוק את מספר השקילה' });
  assert.equal(review(m, 'approval-charge-s2', 'finance').assignedTo, 'finance');
  assert.throws(() => decide(m, 'approval-charge-s2', 'manager', 'approved'), /תפקיד אחר/);
  addComment(m, 'charge-s2', 'finance', 'בדקנו את השקילה', [PEOPLE.manager.id]);
  assert.equal(review(m, 'approval-charge-s2', 'manager').state, 'needs_information', 'reply alone is not resubmission');
  decide(m, 'approval-charge-s2', 'finance', 'resubmit', { note: 'אסמכתת השקילה אומתה' });
  decide(m, 'approval-charge-s2', 'manager', 'approved');
  assert.deepEqual(m.collaboration.approvals['approval-charge-s2'].decisions.map(d => d.outcome), ['needs_information', 'resubmit', 'approved']);
});

test('settlement export needs a separate finance signature and invalidates it when numbers change', () => {
  const m = createWorkspace();
  assert.equal(review(m, 'approval-settlement', 'finance').state, 'blocked');
  for (const c of charges(m).filter(c => !c.resolved)) decide(m, `approval-${c.id}`, 'manager', 'approved', { quantity: 8.6, proof: 'DEMO-PROOF' });
  assert.throws(() => financeRows(m, 'manager'), /אישור נפרד/);
  assert.throws(() => decide(m, 'approval-settlement', 'manager', 'approved'), /תפקיד אחר/);
  decide(m, 'approval-settlement', 'finance', 'approved');
  assert.equal(settlementApproved(m), true);
  assert.equal(financeRows(m, 'finance').length, 8);
  m.entities['charge-s1'].quantity = 19;
  assert.equal(settlementApproved(m), false);
  assert.throws(() => financeRows(m, 'finance'), /אישור נפרד/);
});

test('discussion of a computed finding remains on its source charge after resolution', () => {
  const m = quiet();
  addComment(m, 'finding-charge-s2', 'finance', 'בדיקת ממצא', [PEOPLE.manager.id]);
  assert.equal(notificationsFor(m, 'manager')[0].subject, 'charge-s2');
  decide(m, 'approval-charge-s2', 'manager', 'approved');
  assert.equal(commentsFor(m, 'charge-s2', 'finance')[0].body, 'בדיקת ממצא');
});
