// Ingestion: sources -> ontology pages, edges and the fact ledger.
//
// The pipeline is declarative. It reads each source through its port, applies
// the mapping in ontology/mappings.ts, and writes:
//   - a page per row, validated against the ontology
//   - a fact per mapped field, with provenance and a locator
//   - an edge per mapped relation, once both endpoints exist
//   - a knowledge_candidate for every source column the ontology does not model
//
// Values read from a system of record are accepted by declared rule R-001 and
// recorded as confirmed. Anything a model reads from a document stays a
// candidate. Nothing here decides what the schema should become.

import { pageProblems, type Ontology } from '../ontology/compose.ts';
import {
  MAPPINGS,
  SOURCE_LABELS,
  type EntityMapping,
  type SourceSystem,
  type Transform,
} from '../ontology/mappings.ts';
import { Graph, refFor, stableId, type EvidenceRecord, type Provenance } from '../graph/graph.ts';
import { GraphClient, OpenAIClient, type SqlPort } from '../cloud/clients.ts';
import { extractFromText, type ExtractionResult } from '../cloud/local-model.ts';
import { SERVICES } from '../seed/services.ts';

export type IngestDeps = {
  ontology: Ontology;
  graph: Graph;
  graphClient: GraphClient;
  sql: SqlPort;
  ai: OpenAIClient;
  departmentGroupId: string;
  departmentGroupName: string;
  capturedAt: string;
  profileId: string;
  /** Services this municipality runs; a municipality without pest control has no CMP. */
  serviceCodes: string[];
};

export type MappingRun = {
  id: string;
  pageType: string;
  system: SourceSystem;
  source: string;
  rows: number;
  pages: number;
  facts: number;
  edges: number;
  missingValues: { property: string; count: number }[];
  rejected: { row: string; problems: string[] }[];
};

export type SchemaCandidate = {
  id: string;
  candidate_kind: 'property' | 'enum_value';
  proposal: { page_type: string; page_types?: string[]; property: string; examples: string[] };
  evidence_summary: string;
  support_count: number;
  sources: string[];
  status: 'open' | 'accepted' | 'rejected';
  reason: string;
};

export type CoverageRow = {
  pageType: string;
  property: string;
  mappedFrom: string | null;
  present: number;
  missing: number;
  sources: string[];
};

export type IngestReport = {
  startedAt: string;
  finishedAt: string;
  mappings: MappingRun[];
  sources: { system: SourceSystem; label: string; endpoints: string[]; rows: number; pages: number }[];
  schemaCandidates: SchemaCandidate[];
  coverage: CoverageRow[];
  documents: { ref: string; name: string; label: string; facts: number; flags: number }[];
  findings: { kind: string; severity: 'high' | 'medium'; document: string; excerpt: string }[];
  problems: string[];
};

// ------------------------------------------------------------------ reading

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function transform(value: unknown, t: Transform | undefined): unknown {
  if (value === null || value === undefined) return undefined;
  switch (t) {
    case 'date': {
      // A date-typed property takes a calendar date; a timestamp would be a
      // different fact, so the time is dropped here and only here.
      const s = String(value);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return undefined;
      return d.toISOString().slice(0, 10);
    }
    case 'dateTime': {
      const s = String(value);
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return undefined;
      return d.toISOString();
    }
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    }
    case 'boolean':
      return value === true || value === 1 || value === '1' || value === 'true';
    case 'digits':
      return String(value).replace(/\D/g, '');
    case 'normalizeAddress':
      return String(value).replace(/\s+/g, ' ').trim();
    case 'lower':
      return String(value).toLowerCase().trim();
    case 'trim':
      return String(value).trim();
    default:
      return value;
  }
}

type SourceRow = {
  raw: Record<string, unknown>;
  key: string;
  accessList: string[];
  label: string;
  sourceRef: string;
  locator: Record<string, unknown>;
};

async function readSource(deps: IngestDeps, mapping: EntityMapping): Promise<SourceRow[]> {
  const { graphClient, sql, departmentGroupId } = deps;
  const deptAccess = [departmentGroupId];

  if (mapping.system === 'sql') {
    const result = await sql.query<Record<string, unknown>>(`SELECT * FROM ${mapping.source}`);
    return result.recordset.map((raw) => {
      const key = String(getPath(raw, mapping.keyFrom));
      return {
        raw,
        key,
        accessList: deptAccess,
        label: 'Internal',
        sourceRef: `${mapping.source}#${key}`,
        locator: { table: mapping.source, rowKey: key },
      };
    });
  }

  if (mapping.id === 'people-from-entra') {
    const users = await graphClient.users();
    return users.map((raw) => ({
      raw,
      key: raw.id,
      accessList: deptAccess,
      label: 'Internal',
      sourceRef: `/users/${raw.id}`,
      locator: { endpoint: '/users', objectId: raw.id },
    }));
  }

  if (mapping.id === 'groups-from-entra') {
    const groups = await graphClient.groups();
    return groups.map((raw) => ({
      raw,
      key: raw.id,
      accessList: deptAccess,
      label: 'Internal',
      sourceRef: `/groups/${raw.id}`,
      locator: { endpoint: '/groups', objectId: raw.id },
    }));
  }

  if (mapping.id === 'documents-from-sharepoint') {
    const drives = await graphClient.drives();
    const rows: SourceRow[] = [];
    for (const drive of drives) {
      const items = await graphClient.driveItems(drive.id);
      for (const item of items) {
        const permissions = await graphClient.itemPermissions(drive.id, item.id);
        // Access is mirrored from the item's own permissions, not from the
        // department. A restricted document shared with two named people must
        // not become department-wide here.
        const access = new Set<string>();
        for (const perm of permissions) {
          const user = perm.grantedToV2?.user?.id;
          const group = perm.grantedToV2?.group?.id;
          if (user) access.add(user);
          if (group) access.add(group);
        }
        if (!access.size) for (const id of deptAccess) access.add(id);
        const content = await graphClient.itemContent(drive.id, item.id);
        rows.push({
          raw: {
            ...item,
            _pageCount: Math.max(1, Math.ceil(content.length / 1400)),
            _sourceSystem: 'SharePoint',
            _content: content,
            _driveId: drive.id,
          },
          key: item.id,
          accessList: [...access],
          label: item.sensitivityLabel?.name ?? 'Internal',
          sourceRef: `${drive.id}/${item.id}`,
          locator: { driveId: drive.id, itemId: item.id, name: item.name },
        });
      }
    }
    return rows;
  }

  if (mapping.id === 'messages-from-exchange') {
    const users = await graphClient.users();
    const seen = new Map<string, SourceRow>();
    for (const user of users) {
      const messages = await graphClient.messages(user.id);
      for (const message of messages) {
        if (seen.has(message.id)) continue;
        const participants: string[] = [];
        const addresses = [message.from, ...(message.toRecipients ?? []), ...(message.ccRecipients ?? [])];
        for (const entry of addresses) {
          const address = entry?.emailAddress?.address;
          if (!address) continue;
          const matched = users.find((u) => u.mail?.toLowerCase() === String(address).toLowerCase());
          if (matched) participants.push(matched.id);
        }
        seen.set(message.id, {
          raw: { ...message, _participantIds: participants },
          key: message.id,
          accessList: [...new Set([...participants, ...deptAccess])],
          label: message.sensitivityLabel?.name ?? 'Internal',
          sourceRef: `/users/${user.id}/messages/${message.id}`,
          locator: { endpoint: '/messages', messageId: message.id },
        });
      }
    }
    return [...seen.values()];
  }

  throw new Error('No reader for mapping ' + mapping.id);
}

function pageTitle(mapping: EntityMapping, raw: Record<string, unknown>, key: string): string {
  if (mapping.pageType === 'resident') {
    const first = getPath(raw, 'first_name');
    const last = getPath(raw, 'last_name');
    if (first && last) return `${first} ${last}`;
  }
  const value = getPath(raw, mapping.titleFrom);
  return value === undefined || value === null || value === '' ? key : String(value);
}

// ---------------------------------------------------------------- ingestion

export async function ingest(deps: IngestDeps): Promise<IngestReport> {
  const { ontology, graph, capturedAt } = deps;
  const startedAt = new Date().toISOString();
  const problems: string[] = [];
  const mappings: MappingRun[] = [];
  const coverageCounts = new Map<string, { present: number; missing: number; sources: Set<string> }>();
  const pendingEdges: { kind: string; from: string; to: string; row: SourceRow; mapping: EntityMapping }[] = [];
  const schemaCandidates: SchemaCandidate[] = [];
  const documents: IngestReport['documents'] = [];
  const findings: IngestReport['findings'] = [];
  const pagesByType = new Map<string, number>();

  const servicePages = SERVICES.filter((s) => deps.serviceCodes.includes(s.code));

  // Declared services: a decision with an owner, not a discovered fact.
  for (const service of servicePages) {
    const ref = refFor('service', service.code);
    graph.addPage({
      ref,
      type: 'service',
      title: service.name_en,
      properties: {},
      createdAt: capturedAt,
    });
    const values: Record<string, unknown> = {
      code: service.code,
      name_he: service.name_he,
      name_en: service.name_en,
      sla_days: service.sla_days,
      requires_inspection: service.requires_inspection,
      rule_owner: service.rule_owner,
    };
    for (const [property, value] of Object.entries(values)) {
      graph.setProperty({
        pageRef: ref,
        property,
        value,
        status: 'confirmed',
        provenance: {
          kind: 'recorded',
          source: service.source_citation,
          method: 'seed/services.ts',
          as_of: capturedAt,
          evidence_class: 'asserted',
          confirmed_by_role: service.rule_owner,
        },
        evidenceIds: [],
      });
    }
  }

  for (const mapping of MAPPINGS) {
    const run: MappingRun = {
      id: mapping.id,
      pageType: mapping.pageType,
      system: mapping.system,
      source: mapping.source,
      rows: 0,
      pages: 0,
      facts: 0,
      edges: 0,
      missingValues: [],
      rejected: [],
    };
    const missing = new Map<string, number>();

    let rows: SourceRow[] = [];
    try {
      rows = await readSource(deps, mapping);
    } catch (err) {
      problems.push(`${mapping.id}: ${(err as Error).message}`);
      mappings.push(run);
      continue;
    }

    for (const row of rows) {
      run.rows++;
      const ref = refFor(mapping.pageType, row.key);
      const title = pageTitle(mapping, row.raw, row.key);
      const page = graph.addPage({
        ref,
        type: mapping.pageType,
        title,
        properties: {},
        createdAt: capturedAt,
      });
      run.pages++;
      pagesByType.set(mapping.pageType, (pagesByType.get(mapping.pageType) ?? 0) + 1);

      const sourceItemId = stableId('SRC', mapping.system, row.sourceRef);
      graph.addSourceItem({
        id: sourceItemId,
        system: mapping.system,
        ref: row.sourceRef,
        name: title,
        contentHash: stableId('H', JSON.stringify(row.raw)).slice(2, 18),
        label: row.label,
        accessList: row.accessList,
        capturedAt,
      });

      for (const field of mapping.fields) {
        const raw = getPath(row.raw, field.from);
        const value = transform(raw, field.transform);
        const covKey = `${mapping.pageType}.${field.property}`;
        const cov = coverageCounts.get(covKey) ?? { present: 0, missing: 0, sources: new Set<string>() };
        cov.sources.add(mapping.source);
        if (value === undefined || value === '') {
          cov.missing++;
          coverageCounts.set(covKey, cov);
          missing.set(field.property, (missing.get(field.property) ?? 0) + 1);
          continue;
        }
        cov.present++;
        coverageCounts.set(covKey, cov);

        const evidence: EvidenceRecord = graph.addEvidence({
          id: stableId('EV', mapping.system, row.sourceRef, field.from),
          kind: mapping.system === 'sql' ? 'row' : mapping.system === 'entra' ? 'endpoint' : mapping.system === 'sharepoint' ? 'file' : 'message',
          sourceSystem: mapping.system,
          sourceRef: row.sourceRef,
          locator: { ...row.locator, column: field.from },
          excerpt:
            mapping.system === 'sql'
              ? `${field.from} = ${JSON.stringify(raw)}`
              : `${field.from} = ${JSON.stringify(raw)}`,
          label: row.label,
          accessList: row.accessList,
          capturedAt,
        });

        const provenance: Provenance = {
          kind: 'imported',
          source: `${SOURCE_LABELS[mapping.system]} ${mapping.source}`,
          method: `mapping ${mapping.id} v1`,
          as_of: capturedAt,
          evidence_class: mapping.evidenceClass,
          locator: `${mapping.source}:${row.key}#${field.from}`,
        };

        const status = mapping.acceptance ? 'confirmed' : 'candidate';
        const written = graph.setProperty({
          pageRef: ref,
          property: field.property,
          value,
          status,
          provenance: mapping.acceptance
            ? { ...provenance, confirmed_by_role: mapping.acceptance.owner, method: `${provenance.method} · accepted by ${mapping.acceptance.ruleId}` }
            : provenance,
          evidenceIds: [evidence.id],
        });
        run.facts++;

        for (const edge of mapping.edges ?? []) {
          const targetKey = getPath(row.raw, edge.from);
          if (targetKey === undefined || targetKey === null) continue;
          const targetRef = refFor(edge.targetType, String(targetKey));
          pendingEdges.push({
            kind: edge.kind,
            from: edge.side === 'from' ? ref : targetRef,
            to: edge.side === 'from' ? targetRef : ref,
            row,
            mapping,
          });
        }
      }

      run.missingValues = [...missing.entries()].map(([property, count]) => ({ property, count }));

      if (page.type === 'document') {
        // Extraction is a separate, candidate-only pass.
        const content = String(row.raw._content ?? '');
        const result: ExtractionResult = extractFromText(content);
        documents.push({
          ref,
          name: title,
          label: row.label,
          facts: result.facts.length,
          flags: result.flags.length,
        });
        for (const flag of result.flags) {
          findings.push({ kind: flag.kind, severity: flag.severity, document: title, excerpt: flag.excerpt });
        }
      }
    }

    if (mapping.unmapped?.length) {
      for (const column of mapping.unmapped) {
        schemaCandidates.push({
          id: stableId('KC', mapping.id, column.column),
          candidate_kind: 'property',
          proposal: {
            page_type: mapping.pageType,
            property: column.column,
            examples: column.examples,
          },
          evidence_summary: `${column.column} appears in ${mapping.source} on ${rows.length} rows and has no ontology property.`,
          support_count: rows.length,
          sources: [mapping.source],
          status: 'open',
          reason: column.reason,
        });
      }
    }

    mappings.push(run);
  }

  // Edges land once every page exists; a missing endpoint is a real integrity
  // problem worth reporting, not something to silently drop.
  const edgesByKind = new Map<string, number>();
  for (const pending of pendingEdges) {
    const created = graph.addEdge({ kind: pending.kind, from: pending.from, to: pending.to });
    if (created) {
      edgesByKind.set(pending.kind, (edgesByKind.get(pending.kind) ?? 0) + 1);
    } else if (!graph.page(pending.from) || !graph.page(pending.to)) {
      problems.push(
        `edge ${pending.kind}: ${pending.from} -> ${pending.to} has a missing endpoint (${pending.mapping.source})`,
      );
    }
  }

  // A case points at its subject, whose type only the subject reference knows.
  for (const page of graph.ofType('case')) {
    const subject = String(page.properties.subject_ref ?? '');
    if (!subject) continue;
    for (const type of ['business', 'resident', 'property']) {
      const target = refFor(type, subject);
      if (graph.page(target)) {
        graph.addEdge({ kind: 'case_about', from: page.ref, to: target, payload: { subject_ref: subject } });
        break;
      }
    }
  }

  // Every page must satisfy its type. A failure here is a mapping bug, and it
  // is reported rather than swallowed.
  for (const page of graph.pages.values()) {
    const issues = pageProblems(ontology, page);
    if (issues.length) problems.push(...issues.slice(0, 3));
  }

  // Merge duplicate schema candidates (the same column in two tables).
  const merged = new Map<string, SchemaCandidate>();
  const typesByProperty = new Map<string, Set<string>>();
  for (const candidate of schemaCandidates) {
    const key = candidate.proposal.property;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, candidate);
      typesByProperty.set(key, new Set([candidate.proposal.page_type]));
      continue;
    }
    existing.support_count += candidate.support_count;
    existing.sources = [...new Set([...existing.sources, ...candidate.sources])];
    existing.proposal.examples = [...new Set([...existing.proposal.examples, ...candidate.proposal.examples])].slice(0, 4);
    typesByProperty.get(key)!.add(candidate.proposal.page_type);
    existing.evidence_summary = `${key} appears in ${existing.sources.join(', ')} across ${existing.support_count} rows and has no ontology property.`;
  }
  for (const [key, candidate] of merged) {
    candidate.proposal.page_types = [...(typesByProperty.get(key) ?? [])];
  }

  const coverage: CoverageRow[] = [];
  for (const [name, spec] of Object.entries(ontology.pageTypes)) {
    for (const property of Object.keys(spec.properties)) {
      if (property === 'provenance') continue;
      const mapping = MAPPINGS.find((m) => m.pageType === name && m.fields.some((f) => f.property === property));
      const cov = coverageCounts.get(`${name}.${property}`);
      coverage.push({
        pageType: name,
        property,
        mappedFrom: mapping ? `${mapping.source}.${mapping.fields.find((f) => f.property === property)!.from}` : null,
        present: cov?.present ?? 0,
        missing: cov?.missing ?? 0,
        sources: cov ? [...cov.sources] : [],
      });
    }
  }

  const sources = (['entra', 'exchange', 'sharepoint', 'sql'] as SourceSystem[])
    .map((system) => {
      const runs = mappings.filter((m) => m.system === system);
      return {
        system,
        label: SOURCE_LABELS[system],
        endpoints: [...new Set(runs.map((m) => m.source))],
        rows: runs.reduce((a, m) => a + m.rows, 0),
        pages: runs.reduce((a, m) => a + m.pages, 0),
      };
    })
    .filter((s) => s.endpoints.length > 0);

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    mappings,
    sources,
    schemaCandidates: [...merged.values()],
    coverage,
    documents,
    findings,
    problems: [...new Set(problems)],
  };
}
