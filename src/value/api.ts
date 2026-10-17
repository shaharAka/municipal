// HTTP for the two value pages: /api/rights/* and /api/meetings/*.
// server.ts hands these paths here; the state below is the POC's own store,
// never the source systems (read-only, as everywhere else).

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Viewer } from '../graph/graph.ts';
import { refFor, stableId } from '../graph/graph.ts';
import type { Platform } from '../platform.ts';
import { evaluateHouseholds, outreachLetter, rightsView, type Outreach } from './rights.ts';
import { createTasks, meetingsView, minutesDocument, type Task } from './meetings.ts';

const outreach = new Map<string, Outreach>();
const tasks = new Map<string, Task>();
const assigned = new Map<string, { ownerId: string; ownerName: string }>();

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const body = (req: IncomingMessage): Promise<Record<string, unknown>> =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });

const userOf = (platform: Platform, viewer: Viewer) => platform.fixture.users.find((u) => u.id === viewer.id);

// Who handles discount requests sees names; the rule owner too. Everyone else
// sees counts. A clearance level is not a reason to see a resident's name.
function rightsAccess(platform: Platform, viewer: Viewer) {
  const title = userOf(platform, viewer)?.jobTitle ?? '';
  const canSeeNames = /מזכיר|רכז גזברות/.test(title);
  return {
    canSeeNames,
    whyHe: canSeeNames
      ? 'השמות גלויים לך כי התפקיד שלך כולל טיפול בבקשות הנחה.'
      : 'שמות וכתובות גלויים רק לתפקידים שמטפלים בבקשות הנחה: מזכירות המחלקה ורכז הגזברות.'
  };
}

const isHead = (platform: Platform, viewer: Viewer) => /מנהל/.test(userOf(platform, viewer)?.jobTitle ?? '') && !/סגן/.test(userOf(platform, viewer)?.jobTitle ?? '');

function recordDecision(platform: Platform, kind: string, title: string, actor: string, at: string, subjectRef: string, rationale: string): string {
  const graph = platform.graph;
  const ref = refFor('decision', stableId('DEC', kind, subjectRef, at).replace('DEC-', ''));
  graph.addPage({ ref, type: 'decision', title, properties: {}, createdAt: at });
  const values: Record<string, unknown> = {
    decision_id: ref,
    kind,
    status: 'approved',
    decided_at: at,
    decided_by: actor,
    rationale,
    subject_ref: subjectRef,
  };
  for (const [property, value] of Object.entries(values)) {
    graph.setProperty({
      pageRef: ref,
      property,
      value,
      status: 'confirmed',
      provenance: {
        kind: 'recorded',
        source: kind === 'outreach_approved' ? 'proactive rights' : 'meetings to tasks',
        method: 'person approval',
        as_of: at,
        evidence_class: 'asserted',
        confirmed_by_role: actor,
      },
      evidenceIds: [],
    });
  }
  if (graph.page(subjectRef)) graph.addEdge({ kind: 'approves', from: ref, to: subjectRef });
  return ref;
}

export async function handleValueApi(
  req: IncomingMessage,
  res: ServerResponse,
  platform: Platform,
  viewer: Viewer,
  url: URL,
  parts: string[],
  actor: string,
): Promise<boolean> {
  const now = new Date().toISOString();

  if (parts[1] === 'rights') {
    const access = rightsAccess(platform, viewer);
    if (!parts[2]) return send(res, 200, rightsView(platform.fixture, access, outreach)), true;
    if (!access.canSeeNames) return send(res, 403, { error: 'שמות התושבים גלויים רק לתפקידים שמטפלים בבקשות הנחה.' }), true;
    const id = parts[2] === 'letter' ? url.searchParams.get('household') : String((await body(req)).household ?? '');
    const household = evaluateHouseholds(platform.fixture).find((h) => h.householdId === id && h.qualifiers.length && !h.receiving);
    if (!household) return send(res, 404, { error: 'משק הבית לא נמצא ברשימת הזכאים שעדיין לא מקבלים הנחה.' }), true;
    const letter = outreachLetter(household, actor.split(' (')[0]);
    if (!letter) return send(res, 404, { error: 'לא נמצאה עילת זכאות לפנייה.' }), true;
    if (parts[2] === 'letter') return send(res, 200, { household, letter }), true;
    if (parts[2] === 'outreach' && req.method === 'POST') {
      if (outreach.has(household.householdId)) return send(res, 200, { outreach: outreach.get(household.householdId) }), true;
      const record: Outreach = { by: actor, at: now, letter: letter.text, residentId: letter.residentId };
      outreach.set(household.householdId, record);
      const decision = recordDecision(
        platform,
        'outreach_approved',
        'פנייה יזומה לתושב: הנחה בארנונה',
        actor,
        now,
        refFor('household', household.householdId),
        `${household.householdId} עומד בכלל ARNONA-RELIEF ואינו מקבל הנחה. ${household.unclaimedAnnual} ₪ בשנה.`,
      );
      return send(res, 200, { outreach: record, decision }), true;
    }
  }

  if (parts[1] === 'meetings') {
    if (!parts[2]) {
      return send(res, 200, meetingsView(platform.fixture, viewer.id, tasks, assigned, (url.searchParams.get('q') ?? '').slice(0, 200))), true;
    }
    if (parts[2] === 'minutes') {
      const minutes = minutesDocument(url.searchParams.get('id') ?? '');
      return minutes ? send(res, 200, { minutes }) : send(res, 404, { error: 'הסיכום לא נמצא.' }), true;
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' }), true;
    if (!isHead(platform, viewer)) return send(res, 403, { error: 'רק מנהלת המחלקה קובעת אחראים ויוצרת משימות.' }), true;
    if (parts[2] === 'assign') {
      const input = await body(req);
      const person = platform.fixture.users.find((u) => u.id === String(input.owner ?? ''));
      if (!person) return send(res, 400, { error: 'האחראי לא נמצא בספרייה.' }), true;
      assigned.set(String(input.decision ?? ''), { ownerId: person.id, ownerName: person.displayName });
      return send(res, 200, { ok: true }), true;
    }
    if (parts[2] === 'tasks') {
      const created = createTasks(platform.fixture, tasks, assigned, actor, now);
      const decision = created.length
        ? recordDecision(
            platform,
            'meeting_tasks_created',
            `${created.length} משימות מסיכומי ישיבות ההנהלה`,
            actor,
            now,
            refFor('org_unit', 'department'),
            created.map((t) => `${t.ownerName}: ${t.decisionId}`).join('; '),
          )
        : null;
      return send(res, 200, { created, decision }), true;
    }
  }
  return false;
}
