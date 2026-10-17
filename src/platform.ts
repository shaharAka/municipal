// Composition root: wires the cloud, the ontology, the graph and the analysis.
//
// Two municipalities are built at startup. The first is the POC department;
// the second is used to prove the template diff — the graph is exported from
// the first and only the differences of the second are reported.

import { createHash } from 'node:crypto';
import { buildFixture, PROFILES, type Fixture } from './cloud/fixtures.ts';
import { createMockCloud } from './cloud/mock-azure.ts';
import { GraphClient, LocalSqlClient, OpenAIClient } from './cloud/clients.ts';
import { composeBaseline, loadPacks, type Ontology } from './ontology/compose.ts';
import { Graph, refFor, type Viewer } from './graph/graph.ts';
import { ingest, type IngestReport } from './ingest/ingest.ts';
import { buildOrgMap, type OrgMap } from './org/orgmap.ts';
import { discoverProcess, persistProcess, type AutomationProposal, type ProcessModel } from './process/discover.ts';
import { exportTemplate, diffAgainstTemplate, type OrgTemplate, type DiffReport } from './template/diff.ts';
import { answerQuestion, seedRules, type QueryAnswer } from './query/eligibility.ts';
import { RULES } from './seed/eligibility-rules.ts';

export const captureTime = '2026-10-17T08:00:00.000Z';

export type Platform = {
  profileId: string;
  organization: string;
  organizationId: string;
  fixture: Fixture;
  ontology: Ontology;
  graph: Graph;
  report: IngestReport;
  org: OrgMap;
  models: ProcessModel[];
  proposals: AutomationProposal[];
  viewers: Viewer[];
  template: OrgTemplate;
  diff: DiffReport | null;
  answer: QueryAnswer;
  question: string;
  baseUrl: string;
  close: () => Promise<void>;
};

const uuidFrom = (seed: string) => {
  const h = createHash('sha1').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

function makeViewers(fixture: Fixture): Viewer[] {
  const pick = (pattern: RegExp) => fixture.users.find((u) => pattern.test(u.jobTitle) || pattern.test(u.jobTitleEn));
  const candidates: { label: string; user: { id: string; groupIds: string[] } | undefined; clearance: number }[] = [
    { label: 'Department head', user: pick(/מנהל|head/i), clearance: 3 },
    { label: 'Licensing coordinator', user: pick(/רכז|coordinator|היתרים|permits/i), clearance: 1 },
    { label: 'Food inspector', user: pick(/מפקח מזון|food inspector/i), clearance: 1 },
    { label: 'Field inspector', user: pick(/מפקח תברואה|sanitation inspector/i), clearance: 1 },
    { label: 'Clerk', user: pick(/מזכיר|clerk/i), clearance: 1 },
  ];
  return candidates
    .filter((c) => Boolean(c.user))
    .map((c) => ({
      id: c.user!.id,
      groupIds: c.user!.groupIds,
      clearance: c.clearance,
    }));
}

export async function buildPlatform(profileId: string, opts: { withTemplate: boolean }): Promise<Platform> {
  const fixture = buildFixture(profileId);
  const graphToken = 'poc-graph-token';
  const openaiKey = 'poc-openai-key';
  const cloud = createMockCloud({ fixture, graphToken, openaiKey });
  const baseUrl = await cloud.listen(0);

  const graphClient = new GraphClient(baseUrl + '/v1.0', graphToken);
  const sql = new LocalSqlClient(fixture.tables);
  const ai = new OpenAIClient(baseUrl, openaiKey);

  const ontology = composeBaseline(loadPacks());
  const graph = new Graph();

  const departmentGroup = fixture.groups.find((g) => /san-all|all/.test(g.mailNickname) || g.memberIds.length > 3);
  const report = await ingest({
    ontology,
    graph,
    graphClient,
    sql,
    ai,
    departmentGroupId: departmentGroup?.id ?? fixture.groups[0].id,
    departmentGroupName: departmentGroup?.displayName ?? 'department',
    capturedAt: captureTime,
    profileId,
    serviceCodes: PROFILES[profileId].services,
  });

  const org = buildOrgMap(graph, captureTime);
  const models: ProcessModel[] = [];
  const proposals: AutomationProposal[] = [];

  for (const code of PROFILES[profileId].services) {
    const service = graph.page(refFor('service', code));
    const model = discoverProcess(graph, code, String(service?.properties.name_en ?? code));
    models.push(model);
    const persisted = persistProcess(graph, model, captureTime);
    proposals.push(...persisted.proposals);
  }

  seedRules(graph, captureTime);
  const question = 'How many households are eligible for the sanitation fee discount?';
  const answer = answerQuestion(graph, question, {
    capturedAt: captureTime,
    sources: report.sources.map((s) => ({ system: s.system, label: s.label })),
  });

  const platform: Platform = {
    profileId,
    organization: PROFILES[profileId].cityEn,
    organizationId: uuidFrom(profileId),
    fixture,
    ontology,
    graph,
    report,
    org,
    models,
    proposals,
    viewers: makeViewers(fixture),
    template: undefined as unknown as OrgTemplate,
    diff: null,
    answer,
    question,
    baseUrl,
    close: () => cloud.close(),
  };

  platform.template = exportTemplate(graph, org, models, {
    organization: platform.organization,
    capturedAt: captureTime,
  });

  return platform;
}

export type Demo = {
  primary: Platform;
  secondary: Platform;
  diff: DiffReport;
  close: () => Promise<void>;
};

/** The POC department, and a second municipality onboarded from its template. */
export async function buildDemo(): Promise<Demo> {
  const primary = await buildPlatform('givat-rimon', { withTemplate: true });
  const secondary = await buildPlatform('kiryat-gefen', { withTemplate: false });
  const diff = diffAgainstTemplate(primary.template, secondary.graph, secondary.org, secondary.models, {
    organization: secondary.organization,
    organizationId: secondary.organizationId,
  });
  primary.diff = diff;
  secondary.diff = diff;

  return {
    primary,
    secondary,
    diff,
    close: async () => {
      await primary.close();
      await secondary.close();
    },
  };
}
