// The org map: units, roles and who does what.
//
// Units are derived from the directory's department attribute and the
// reporting lines, then the responsibilities are inferred from work traces
// (case assignments and mail threads). Every inference is a knowledge
// candidate: it is in no answer until a person confirms it, and it carries the
// count of what it rests on rather than a made-up score.

import type { Ontology } from '../ontology/compose.ts';
import { Graph, refFor, stableId, type Provenance } from '../graph/graph.ts';
import { ACTIVITY_LABELS } from '../cloud/fixtures.ts';

export type Responsibility = {
  candidateRef: string;
  personRef: string;
  activity: string;
  activityLabel: string;
  service: string | null;
  subject: string;
  support: number;
  share: number;
  signal: 'case-events' | 'mail';
  summary: string;
};

export type OrgMap = {
  units: {
    ref: string;
    name: string;
    nameEn: string;
    headcount: number;
    headRef: string | null;
    memberRefs: string[];
    roles: { title: string; personRefs: string[] }[];
  }[];
  people: {
    ref: string;
    name: string;
    title: string;
    unitRef: string | null;
    unitName: string | null;
    managerRef: string | null;
    responsibilities: Responsibility[];
  }[];
  responsibilities: Responsibility[];
  unassignedUnits: string[];
};

const TOPICS: { topic: string; service: string; pattern: RegExp }[] = [
  { topic: 'licensing applications', service: 'LIC', pattern: /רישיון|בקשה לרישיון|licen[cs]e/i },
  { topic: 'inspection scheduling', service: 'LIC', pattern: /פיקוח|ביקורת|inspection|שיבוץ/i },
  { topic: 'missing documents', service: 'LIC', pattern: /מסמכים חסרים|מסמך חסר|אישור הדברה|missing document/i },
  { topic: 'fee discounts', service: 'FEE', pattern: /הנחה|אגרת תברואה|זכאות|discount/i },
  { topic: 'sanitation complaints', service: 'CMP', pattern: /קריאה|תלונה|מכרסמים|ריח|complaint/i },
  { topic: 'tariffs and billing', service: 'FEE', pattern: /תעריף|חיוב|תשלום|tariff/i },
];

const PROVENANCE = (asOf: string): Provenance => ({
  kind: 'inferred',
  source: 'org inference',
  method: 'case-event frequency + mail thread topic v1',
  as_of: asOf,
  evidence_class: 'attributed',
});

export function buildOrgMap(graph: Graph, capturedAt: string): OrgMap {
  const people = graph.ofType('person');
  const unitKey = (p: (typeof people)[number]) => String(p.properties.department ?? '');
  const unitsByKey = new Map<string, typeof people>();

  for (const person of people) {
    const key = unitKey(person);
    if (!key) continue;
    const list = unitsByKey.get(key) ?? [];
    list.push(person);
    unitsByKey.set(key, list);
  }

  // Units are pages, so the rest of the system can link to them.
  const units: OrgMap['units'] = [];
  for (const [name, members] of unitsByKey) {
    const ref = refFor('org_unit', name);
    const nameEn = String(members[0]?.properties.department_en ?? name);
    graph.addPage({ ref, type: 'org_unit', title: name, properties: {}, createdAt: capturedAt });

    // The head is the senior person whose manager is outside the unit, and
    // failing that the one whose title says so. Nothing is invented if neither.
    const memberRefs = new Set(members.map((m) => m.ref));
    const head = members.find((m) => {
      const managerRef = graph.out('reports_to', m.ref)[0]?.to;
      return !managerRef || !memberRefs.has(managerRef);
    });
    const titled = members.find((m) => /מנהל|מנהלת|head/i.test(String(m.properties.job_title ?? '')));

    for (const member of members) {
      graph.setProperty({
        pageRef: member.ref,
        property: 'department',
        value: name,
        status: 'confirmed',
        provenance: {
          kind: 'computed',
          source: 'Entra ID /users.department',
          method: 'org grouping v1',
          as_of: capturedAt,
          evidence_class: 'attributed',
        },
        evidenceIds: [],
      });
      graph.addEdge({
        kind: 'occupies',
        from: member.ref,
        to: ref,
        payload: { role_title: String(member.properties.job_title ?? ''), share: 1 },
      });
    }

    const headPage = titled ?? head;
    if (headPage) graph.addEdge({ kind: 'head_of', from: headPage.ref, to: ref });

    graph.setProperty({
      pageRef: ref,
      property: 'name',
      value: name,
      status: 'confirmed',
      provenance: PROVENANCE(capturedAt),
      evidenceIds: [],
    });
    graph.setProperty({
      pageRef: ref,
      property: 'name_en',
      value: nameEn,
      status: 'confirmed',
      provenance: PROVENANCE(capturedAt),
      evidenceIds: [],
    });
    graph.setProperty({
      pageRef: ref,
      property: 'headcount',
      value: members.length,
      status: 'confirmed',
      provenance: PROVENANCE(capturedAt),
      evidenceIds: [],
    });

    const roles = new Map<string, string[]>();
    for (const m of members) {
      const title = String(m.properties.job_title ?? '');
      roles.set(title, [...(roles.get(title) ?? []), m.ref]);
    }

    units.push({
      ref,
      name,
      nameEn,
      headcount: members.length,
      headRef: headPage?.ref ?? null,
      memberRefs: members.map((m) => m.ref),
      roles: [...roles.entries()].map(([title, personRefs]) => ({ title, personRefs })),
    });
  }

  // ---------------------------------------------------------- responsibilities
  const caseService = new Map<string, string>();
  for (const c of graph.ofType('case')) caseService.set(c.ref, String(c.properties.service_code ?? ''));

  const activityCounts = new Map<string, Map<string, number>>(); // person -> `${activity}|${service}` -> n
  const bump = (person: string, key: string) => {
    const map = activityCounts.get(person) ?? new Map<string, number>();
    map.set(key, (map.get(key) ?? 0) + 1);
    activityCounts.set(person, map);
  };

  for (const event of graph.ofType('case_event')) {
    const actor = graph.out('event_actor', event.ref)[0]?.to;
    if (!actor) continue;
    const caseRef = graph.out('event_of', event.ref)[0]?.to;
    const service = caseRef ? (caseService.get(caseRef) ?? '') : '';
    bump(actor, `${String(event.properties.activity ?? '')}|${service}`);
  }

  const mailCounts = new Map<string, Map<string, number>>(); // person -> topic|service -> n
  for (const message of graph.ofType('message')) {
    const subject = String(message.properties.subject ?? '');
    const topic = TOPICS.find((t) => t.pattern.test(subject));
    if (!topic) continue;
    const participants = Array.isArray(message.properties.participants) ? message.properties.participants : [];
    for (const person of participants as string[]) {
      const ref = refFor('person', person);
      if (!graph.page(ref)) continue;
      const map = mailCounts.get(ref) ?? new Map<string, number>();
      const key = `${topic.topic}|${topic.service}`;
      map.set(key, (map.get(key) ?? 0) + 1);
      mailCounts.set(ref, map);
    }
  }

  const responsibilities: Responsibility[] = [];

  const addCandidate = (
    personRef: string,
    activity: string,
    activityLabel: string,
    service: string | null,
    subject: string,
    support: number,
    share: number,
    signal: Responsibility['signal'],
    summary: string,
    examples: string[],
  ) => {
    const ref = stableId('KC', personRef, activity, subject);
    const person = graph.page(personRef);
    if (!person) return;
    graph.addPage({
      ref,
      type: 'knowledge_candidate',
      title: `${person.title}: ${activityLabel || activity}`,
      properties: {},
      createdAt: capturedAt,
    });
    const values: Record<string, unknown> = {
      candidate_id: ref,
      candidate_kind: 'responsibility',
      subject_ref: personRef,
      proposal: {
        subject,
        activity: activity || null,
        service: service || null,
        share: Number(share.toFixed(2)),
        examples,
      },
      evidence_summary: summary,
      support_count: support,
      status: 'open',
      proposed_by: 'org inference v1',
    };
    for (const [property, value] of Object.entries(values)) {
      graph.setProperty({
        pageRef: ref,
        property,
        value,
        status: 'candidate',
        provenance: PROVENANCE(capturedAt),
        evidenceIds: [],
      });
    }
    responsibilities.push({
      candidateRef: ref,
      personRef,
      activity,
      activityLabel,
      service,
      subject,
      support,
      share,
      signal,
      summary,
    });
  };

  for (const [personRef, map] of activityCounts) {
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    for (const [key, count] of map) {
      const [activity, service] = key.split('|');
      if (count < 3) continue;
      const share = count / total;
      addCandidate(
        personRef,
        activity,
        ACTIVITY_LABELS[activity] ?? activity,
        service || null,
        `activity:${activity}`,
        count,
        share,
        'case-events',
        `${count} of ${total} recorded actions by this person are "${activity}" on ${service} cases.`,
        [`${count} case events`],
      );
    }
  }

  for (const [personRef, map] of mailCounts) {
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    for (const [key, count] of map) {
      const [topic, service] = key.split('|');
      if (count < 2) continue;
      addCandidate(
        personRef,
        '',
        topic,
        service || null,
        `topic:${topic}`,
        count,
        count / total,
        'mail',
        `Appears on ${count} threads about ${topic}.`,
        [`${count} threads`],
      );
    }
  }

  const peopleView = people.map((p) => {
    const unitRef = graph.out('occupies', p.ref)[0]?.to ?? null;
    const unit = unitRef ? graph.page(unitRef) : undefined;
    const managerRef = graph.out('reports_to', p.ref)[0]?.to ?? null;
    return {
      ref: p.ref,
      name: p.title,
      title: String(p.properties.job_title ?? ''),
      unitRef,
      unitName: unit?.title ?? null,
      managerRef,
      responsibilities: responsibilities.filter((r) => r.personRef === p.ref),
    };
  });

  return {
    units,
    people: peopleView,
    responsibilities,
    unassignedUnits: [],
  };
}

/** "Who handles this?" — the query the org map exists to answer. */
export function whoHandles(org: OrgMap, query: string): { personRef: string; name: string; title: string; support: number; summary: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return org.responsibilities
    .filter(
      (r) =>
        r.subject.toLowerCase().includes(q) ||
        r.activityLabel.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q),
    )
    .sort((a, b) => b.support - a.support)
    .slice(0, 5)
    .map((r) => {
      const person = org.people.find((p) => p.ref === r.personRef);
      return {
        personRef: r.personRef,
        name: person?.name ?? r.personRef,
        title: person?.title ?? '',
        support: r.support,
        summary: r.summary,
      };
    });
}
