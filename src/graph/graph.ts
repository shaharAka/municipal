// The learned graph: pages, edges, and the fact ledger behind them.
//
// Pages and edges are the shape the AKA ontology engine composes and validates:
// a page has a type and properties, an edge has a kind and two endpoints. What
// this module adds is the ledger the brief demands: every property value is a
// fact with provenance and evidence, versioned and never silently overwritten.
//
// Access is mirrored from the source. A fact is visible only to someone who can
// see every piece of evidence behind it, which is the read-side half of the
// RLS story.

import { createHash } from 'node:crypto';

export type FactStatus = 'candidate' | 'confirmed' | 'rejected';

export type EvidenceClass =
  | 'measured'
  | 'sourced'
  | 'extracted'
  | 'attributed'
  | 'asserted'
  | 'model_estimate';

export type Provenance = {
  kind: 'recorded' | 'computed' | 'inferred' | 'imported' | 'modelled' | 'extracted' | 'drafted' | 'copied' | 'migrated';
  source: string;
  method?: string;
  as_of: string;
  evidence_class: EvidenceClass;
  locator?: string;
  confirmed_by_role?: string;
};

export type EvidenceRecord = {
  id: string;
  kind: 'row' | 'message' | 'file' | 'endpoint';
  sourceSystem: string;
  sourceRef: string;
  locator: Record<string, unknown>;
  excerpt: string;
  label: string;
  accessList: string[];
  capturedAt: string;
};

export type FactRecord = {
  id: string;
  pageRef: string;
  property: string;
  value: unknown;
  status: FactStatus;
  provenance: Provenance;
  evidenceIds: string[];
  assertedAt: string;
  version: number;
  previousValue?: unknown;
};

export type PageRecord = {
  ref: string;
  type: string;
  title: string;
  properties: Record<string, unknown>;
  createdAt: string;
};

export type EdgeRecord = {
  id: string;
  kind: string;
  from: string;
  to: string;
  payload?: Record<string, unknown>;
  createdAt: string;
};

export type SourceItemRecord = {
  id: string;
  system: string;
  ref: string;
  name: string;
  contentHash: string;
  label: string;
  accessList: string[];
  capturedAt: string;
};

export type Viewer = { id: string; groupIds: string[]; clearance: number };

const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 12);
export const stableId = (prefix: string, ...parts: string[]) => `${prefix}-${hash(parts.join('|'))}`;

export const refFor = (type: string, key: string) => `mun:${type}:${key}`;

export class Graph {
  pages = new Map<string, PageRecord>();
  edges: EdgeRecord[] = [];
  facts: FactRecord[] = [];
  evidence = new Map<string, EvidenceRecord>();
  sourceItems = new Map<string, SourceItemRecord>();
  factsByPage = new Map<string, FactRecord[]>();
  edgeIndex = new Map<string, EdgeRecord[]>(); // `${kind}|${from}` -> edges

  addPage(page: PageRecord): PageRecord {
    const existing = this.pages.get(page.ref);
    if (existing) return existing;
    this.pages.set(page.ref, page);
    return page;
  }

  addEvidence(e: EvidenceRecord): EvidenceRecord {
    if (!this.evidence.has(e.id)) this.evidence.set(e.id, e);
    return this.evidence.get(e.id)!;
  }

  addSourceItem(item: SourceItemRecord): SourceItemRecord {
    if (!this.sourceItems.has(item.id)) this.sourceItems.set(item.id, item);
    return this.sourceItems.get(item.id)!;
  }

  /**
   * Writes one property value. A new value for the same page+property bumps the
   * version and keeps the previous one, so "what did we think last week" is
   * answerable and nothing is lost to an overwrite.
   */
  setProperty(input: {
    pageRef: string;
    property: string;
    value: unknown;
    status: FactStatus;
    provenance: Provenance;
    evidenceIds: string[];
    assertedAt?: string;
  }): FactRecord {
    const history = (this.factsByPage.get(input.pageRef) ?? []).filter(
      (f) => f.property === input.property && f.status !== 'rejected',
    );
    const latest = history[history.length - 1];
    const version = latest ? latest.version + 1 : 1;
    const fact: FactRecord = {
      id: stableId('FACT', input.pageRef, input.property, String(version)),
      pageRef: input.pageRef,
      property: input.property,
      value: input.value,
      status: input.status,
      provenance: input.provenance,
      evidenceIds: input.evidenceIds,
      assertedAt: input.assertedAt ?? input.provenance.as_of,
      version,
      ...(latest ? { previousValue: latest.value } : {}),
    };
    this.facts.push(fact);
    const list = this.factsByPage.get(input.pageRef) ?? [];
    list.push(fact);
    this.factsByPage.set(input.pageRef, list);

    const page = this.pages.get(input.pageRef);
    if (page) page.properties[input.property] = input.value;
    return fact;
  }

  addEdge(edge: Omit<EdgeRecord, 'id' | 'createdAt'> & { createdAt?: string }): EdgeRecord | undefined {
    if (!this.pages.has(edge.from) || !this.pages.has(edge.to)) return undefined;
    const id = stableId('EDGE', edge.kind, edge.from, edge.to);
    if (this.edges.some((e) => e.id === id)) return undefined;
    const record: EdgeRecord = { ...edge, id, createdAt: edge.createdAt ?? new Date().toISOString() };
    this.edges.push(record);
    const key = edge.kind + '|' + edge.from;
    const list = this.edgeIndex.get(key) ?? [];
    list.push(record);
    this.edgeIndex.set(key, list);
    return record;
  }

  page(ref: string): PageRecord | undefined {
    return this.pages.get(ref);
  }

  ofType(type: string): PageRecord[] {
    return [...this.pages.values()].filter((p) => p.type === type);
  }

  /** Outgoing edges of a kind from a page. */
  out(kind: string, ref: string): EdgeRecord[] {
    return (this.edgeIndex.get(kind + '|' + ref) ?? []).map((e) => e);
  }

  target(kind: string, ref: string): PageRecord | undefined {
    const edge = this.out(kind, ref)[0];
    return edge ? this.pages.get(edge.to) : undefined;
  }

  /** Latest non-rejected facts for a page, one per property. */
  currentFacts(pageRef: string): FactRecord[] {
    const byProp = new Map<string, FactRecord>();
    for (const f of this.factsByPage.get(pageRef) ?? []) {
      if (f.status === 'rejected') continue;
      byProp.set(f.property, f);
    }
    return [...byProp.values()];
  }

  value(pageRef: string, property: string): unknown {
    return this.currentFacts(pageRef).find((f) => f.property === property)?.value;
  }

  canSee(viewer: Viewer, fact: FactRecord): boolean {
    if (viewer.clearance >= 3) return true;
    const evidence = fact.evidenceIds
      .map((id) => this.evidence.get(id))
      .filter((e): e is EvidenceRecord => Boolean(e));
    if (!evidence.length) return true;
    return evidence.every(
      (e) => e.accessList.includes(viewer.id) || e.accessList.some((a) => viewer.groupIds.includes(a)),
    );
  }

  /** A page as one viewer may see it. */
  view(viewer: Viewer, ref: string) {
    const page = this.pages.get(ref);
    if (!page) return null;
    const facts = this.currentFacts(ref);
    const visible = facts.filter((f) => this.canSee(viewer, f));
    return {
      ref: page.ref,
      type: page.type,
      title: page.title,
      properties: Object.fromEntries(visible.map((f) => [f.property, f.value])),
      facts: visible.map((f) => ({
        property: f.property,
        value: f.value,
        status: f.status,
        version: f.version,
        provenance: f.provenance,
        evidence: f.evidenceIds
          .map((id) => this.evidence.get(id))
          .filter((e): e is EvidenceRecord => Boolean(e))
          .map((e) => ({
            id: e.id,
            kind: e.kind,
            source: e.sourceSystem,
            locator: e.locator,
            excerpt: e.excerpt,
          })),
      })),
      hiddenFactCount: facts.length - visible.length,
      edges: this.edges
        .filter((e) => e.from === ref || e.to === ref)
        .map((e) => ({ kind: e.kind, from: e.from, to: e.to, payload: e.payload ?? {} })),
    };
  }

  /** Serialisable snapshot, used by the API and by the template export. */
  snapshot() {
    return {
      pages: [...this.pages.values()],
      edges: this.edges,
    };
  }

  stats() {
    const byType: Record<string, number> = {};
    for (const p of this.pages.values()) byType[p.type] = (byType[p.type] ?? 0) + 1;
    const byStatus: Record<FactStatus, number> = { candidate: 0, confirmed: 0, rejected: 0 };
    for (const f of this.facts) byStatus[f.status]++;
    const byEvidenceClass: Record<string, number> = {};
    for (const f of this.facts) {
      byEvidenceClass[f.provenance.evidence_class] = (byEvidenceClass[f.provenance.evidence_class] ?? 0) + 1;
    }
    return {
      pages: this.pages.size,
      edges: this.edges.length,
      facts: this.facts.length,
      evidence: this.evidence.size,
      sourceItems: this.sourceItems.size,
      byType,
      byStatus,
      byEvidenceClass,
    };
  }
}
