#!/usr/bin/env node
// Sync docs/board/tasks/*.mjs into this repo's GitHub issues and project board.
//
// Idempotent: each issue body carries an HTML marker with its task id, so a
// re-run updates title, body, labels and project fields instead of duplicating.
//
//   node scripts/sync-board.mjs            # create/update everything
//   node scripts/sync-board.mjs --dry-run  # print what would change, touch nothing
//   node scripts/sync-board.mjs --issues   # issues only, skip the project
//
// Auth: uses GITHUB_TOKEN if set, otherwise `gh auth token` (needs repo+project).

import { execFileSync } from 'node:child_process';
import { project, tasks } from '../docs/board/tasks/index.mjs';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const ISSUES_ONLY = args.has('--issues');
const VERBOSE = args.has('--verbose');

// GitHub blocks content creation above roughly one write per few seconds;
// stay well under it and let `rest` back off if we still trip the limit.
const CONCURRENCY = Number(process.env.BOARD_CONCURRENCY ?? 2);
const CREATE_DELAY_MS = Number(process.env.BOARD_CREATE_DELAY_MS ?? 750);

const API = 'https://api.github.com';
const GRAPHQL = API + '/graphql';

// ------------------------------------------------------------------ github io

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
}

const TOKEN = token();

function repoFromRemote() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
    encoding: 'utf8',
  }).trim();
  const m = /github\.com[:/]+([^/]+)\/([^/.]+)(?:\.git)?$/.exec(url);
  if (!m) throw new Error('Cannot parse owner/repo from remote: ' + url);
  return m[1] + '/' + m[2];
}

const [OWNER, REPO] = repoFromRemote().split('/');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GitHub asks for patience on secondary limits; back off and retry. */
function retryDelayMs(res, data, attempt) {
  const retryAfter = Number(res.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  if (res.status === 403 && Number.isFinite(reset) && reset > 0) {
    const ms = reset * 1000 - Date.now();
    if (ms > 0 && ms < 120_000) return ms;
  }
  return Math.min(15_000 * attempt, 90_000);
}

function isRetryable(res, data) {
  if ([429, 502, 503, 504].includes(res.status)) return true;
  if (res.status === 403) {
    const msg = (data?.message ?? '').toLowerCase();
    return msg.includes('rate limit') || msg.includes('abuse');
  }
  return false;
}

async function rest(method, path, body, attempt = 1) {
  const res = await fetch(API + path, {
    method,
    headers: {
      authorization: 'Bearer ' + TOKEN,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (isRetryable(res, data) && attempt <= 6) {
      const wait = retryDelayMs(res, data, attempt);
      log(`  ... ${res.status} on ${method} ${path.split('?')[0]}, waiting ${Math.round(wait / 1000)}s (attempt ${attempt})`);
      await sleep(wait);
      return rest(method, path, body, attempt + 1);
    }
    const err = new Error(
      method + ' ' + path + ' -> ' + res.status + ' ' + (data?.message ?? text),
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function gql(query, variables, attempt = 1) {
  const res = await fetch(GRAPHQL, {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + TOKEN,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join('; ');
    if (/rate limit|abuse|timeout/i.test(msg) && attempt <= 6) {
      const wait = Math.min(15_000 * attempt, 90_000);
      log(`  ... GraphQL "${msg.slice(0, 60)}", waiting ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      return gql(query, variables, attempt + 1);
    }
    throw new Error('GraphQL: ' + msg);
  }
  return json.data;
}

/** Run `fn` over `items` with bounded concurrency, preserving order. */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

const log = (...a) => console.log(...a);
const vlog = (...a) => VERBOSE && console.log(...a);

// ------------------------------------------------------------------- labels

const LABEL_STYLE = {
  'kind/epic': ['6f42c1', 'A slice or workstream, tracked as a parent issue'],
  'kind/decision': ['5319e7', 'A decision that must be recorded before code'],
  'area/api': ['0e8a16', 'API, services and connectors'],
  'area/web': ['1d76db', 'Web app, forms and rendering'],
  'area/db': ['006b75', 'Ontology, records and the store'],
  'area/ai': ['b60205', 'Extraction, planning, interviewing, assistant'],
  'area/data': ['fbca04', 'Synthetic dataset and event logs'],
  'area/eval': ['d93f0b', 'Eval harness, metrics and acceptance'],
  'area/security': ['8b1a1a', 'Access control, privacy and auditing'],
  'area/infra': ['c2e0c6', 'Build, runtime and local substitutes'],
  'area/docs': ['0075ca', 'Decisions, briefs and documentation'],
};

async function ensureLabels() {
  const existing = await rest('GET', `/repos/${OWNER}/${REPO}/labels?per_page=100`);
  const have = new Set(existing.map((l) => l.name));
  const wanted = [...new Set(tasks.flatMap((t) => t.labels))];
  for (const name of wanted) {
    if (have.has(name)) continue;
    const [color, description] = LABEL_STYLE[name] ?? ['ededed', undefined];
    if (DRY) {
      log('  + label', name);
      continue;
    }
    await rest('POST', `/repos/${OWNER}/${REPO}/labels`, { name, color, description });
    log('  + label', name);
  }
}

// -------------------------------------------------------------------- issues

const MARKER = (id) => `<!-- board-task:${id} -->`;

function renderBody(t) {
  const done = (t.done ?? [])
    .map((d) => '- [ ] ' + d)
    .join('\n');
  const epicLine = t.epicTitle
    ? `\n_Part of ${t.epicTitle}${t.epic ? ` ({{epic:${t.epic}}})` : ''} · Slice ${t.slice} · ${t.priority} · ${t.size}_`
    : `\n_Slice ${t.slice} · ${t.priority} · ${t.size}_`;
  const deps = (t.dependsOn ?? []).length
    ? `\n**Depends on:** ${(t.dependsOn ?? []).map((d) => `{{dep:${d}}}`).join(', ')}`
    : '';
  return [
    t.body.trim(),
    '',
    '### Done when',
    done,
    epicLine,
    deps,
    '',
    MARKER(t.id),
  ].join('\n');
}

async function listAllIssues() {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await rest(
      'GET',
      `/repos/${OWNER}/${REPO}/issues?state=all&per_page=100&page=${page}`,
    );
    all.push(...batch.filter((i) => !i.pull_request));
    if (batch.length < 100) break;
  }
  return all;
}

function markerOf(body) {
  const m = /<!-- board-task:(\S+) -->/.exec(body ?? '');
  return m ? m[1] : null;
}

async function syncIssues() {
  log('\nIssues');
  const existing = await listAllIssues();
  const byKey = new Map();
  for (const issue of existing) {
    const k = markerOf(issue.body);
    if (k) byKey.set(k, issue);
  }
  log(`  ${existing.length} issues in repo, ${byKey.size} managed by this board`);

  const numbers = new Map();
  const createdBodies = new Map();

  // Pass 1: create what is missing, and fix title/labels on what is not.
  // Bodies that contain link placeholders are finished in pass 2.
  await pool(tasks, CONCURRENCY, async (t) => {
    const body = renderBody(t);
    const prev = byKey.get(t.id);

    if (!prev) {
      if (DRY) {
        log('  + issue', t.id, '-', t.title);
        return;
      }
      const created = await rest('POST', `/repos/${OWNER}/${REPO}/issues`, {
        title: t.title,
        body,
        labels: t.labels,
      });
      numbers.set(t.id, created.number);
      createdBodies.set(t.id, body);
      vlog('  + issue #' + created.number, t.id);
      await sleep(CREATE_DELAY_MS);
      return;
    }

    numbers.set(t.id, prev.number);
    const titleChanged = prev.title !== t.title;
    const labelsChanged =
      JSON.stringify(prev.labels.map((l) => l.name).sort()) !==
      JSON.stringify([...t.labels].sort());

    if (!titleChanged && !labelsChanged) return;
    if (DRY) {
      log('  ~ issue', t.id, '(#' + prev.number + ') would update title/labels');
      return;
    }
    await rest('PATCH', `/repos/${OWNER}/${REPO}/issues/${prev.number}`, {
      ...(titleChanged ? { title: t.title } : {}),
      labels: t.labels,
    });
    vlog('  ~ issue #' + prev.number, t.id);
  });

  // Pass 2: resolve placeholders into issue links and write the body if it moved.
  await pool(tasks, CONCURRENCY, async (t) => {
    const num = numbers.get(t.id);
    if (!num) return;

    const resolved = renderBody(t)
      .replace(/\{\{epic:(\S+?)\}\}/g, (_, id) => '#' + (numbers.get(id) ?? '?'))
      .replace(/\{\{dep:(\S+?)\}\}/g, (_, id) => '#' + (numbers.get(id) ?? '?'));

    const stored = byKey.get(t.id)?.body ?? createdBodies.get(t.id) ?? '';
    if (stored.trim() === resolved.trim()) return;

    if (DRY) {
      log('  ~ issue', t.id, '(#' + num + ') would update body');
      return;
    }
    await rest('PATCH', `/repos/${OWNER}/${REPO}/issues/${num}`, { body: resolved });
    vlog('  ~ body #' + num, t.id);
  });

  return numbers;
}

// ------------------------------------------------------------------- project

async function ensureProject() {
  log('\nProject');
  const viewer = await gql(
    'query { user(login: "' + OWNER + '") { id login projectsV2(first: 50) { nodes { id number title } } } }',
  );
  const user = viewer.user;
  if (!user) throw new Error('No such user: ' + OWNER);

  let projectNode = user.projectsV2.nodes.find((p) => p.title === project.title);

  if (!projectNode) {
    if (DRY) {
      log('  + project', project.title);
      return null;
    }
    const created = await gql(
      'mutation($ownerId: ID!, $title: String!) { createProjectV2(input: { ownerId: $ownerId, title: $title }) { projectV2 { id number title } } }',
      { ownerId: user.id, title: project.title },
    );
    projectNode = created.createProjectV2.projectV2;
    log('  + project', project.title, '#' + projectNode.number);
  } else {
    log('  = project', project.title, '#' + projectNode.number);
  }
  return projectNode;
}

async function projectFields(projectId) {
  const data = await gql(
    `query($id: ID!) { node(id: $id) { ... on ProjectV2 { fields(first: 50) { nodes {
       ... on ProjectV2FieldCommon { id name }
       ... on ProjectV2SingleSelectField { id name options { id name } }
    } } } } }`,
    { id: projectId },
  );
  return data.node.fields.nodes;
}

async function ensureField(projectId, name, options) {
  const fields = await projectFields(projectId);
  let f = fields.find((x) => x.name === name);
  if (f) {
    const missing = options.filter((o) => !f.options?.some((x) => x.name === o));
    if (missing.length) {
      if (DRY) {
        log('  ~ field', name, 'would add options', missing.join(','));
        return f;
      }
      const data = await gql(
        `mutation($fieldId: ID!, $opts: [ProjectV2SingleSelectFieldOptionInput!]!) {
           updateProjectV2Field(input: { fieldId: $fieldId, singleSelectOptions: $opts }) {
             projectV2Field { ... on ProjectV2SingleSelectField { id name options { id name } } }
           } }`,
        {
          fieldId: f.id,
          opts: [
            ...(f.options ?? []).map((o) => ({ name: o.name, color: 'GRAY', description: '' })),
            ...missing.map((o) => ({ name: o, color: 'GRAY', description: '' })),
          ],
        },
      );
      return data.updateProjectV2Field.projectV2Field;
    }
    return f;
  }
  if (DRY) {
    log('  + field', name);
    return null;
  }
  const data = await gql(
    `mutation($projectId: ID!, $name: String!, $opts: [ProjectV2SingleSelectFieldOptionInput!]) {
       createProjectV2Field(input: { projectId: $projectId, name: $name, dataType: SINGLE_SELECT, singleSelectOptions: $opts }) {
         projectV2Field { ... on ProjectV2SingleSelectField { id name options { id name } } }
       } }`,
    {
      projectId,
      name,
      opts: options.map((o) => ({ name: o, color: 'GRAY', description: '' })),
    },
  );
  log('  + field', name);
  return data.createProjectV2Field.projectV2Field;
}

async function projectItems(projectId) {
  const data = await gql(
    `query($id: ID!) { node(id: $id) { ... on ProjectV2 { items(first: 100) { nodes {
       id
       content { ... on Issue { number } }
       fieldValues(first: 20) { nodes {
         ... on ProjectV2ItemFieldSingleSelectValue {
           name
           field { ... on ProjectV2FieldCommon { name } }
         }
       } }
    } } } } }`,
    { id: projectId },
  );
  const map = new Map();
  for (const item of data.node.items.nodes) {
    if (!item.content?.number) continue;
    const fields = {};
    for (const fv of item.fieldValues.nodes) {
      if (fv.field?.name) fields[fv.field.name] = fv.name;
    }
    map.set(item.content.number, { id: item.id, fields });
  }
  return map;
}

async function syncProject(numbers) {
  const projectNode = await ensureProject();
  if (!projectNode) return;

  const sliceField = await ensureField(
    projectNode.id,
    'Slice',
    project.fields.sliceOptions,
  );
  const priorityField = await ensureField(projectNode.id, 'Priority', project.fields.priority);
  const sizeField = await ensureField(projectNode.id, 'Size', project.fields.size);

  log('\nProject items');
  const items = DRY ? new Map() : await projectItems(projectNode.id);

  const fieldValue = (field, value) => {
    const opt = field?.options?.find((o) => o.name === value);
    return opt ? { singleSelectOptionId: opt.id } : null;
  };

  await pool(tasks, CONCURRENCY, async (t) => {
    const num = numbers.get(t.id);
    if (!num) {
      if (DRY) log('  + item', t.id);
      return;
    }
    let item = items.get(num);
    let itemId = item?.id;
    if (!itemId) {
      if (DRY) return log('  + item', t.id, '(#' + num + ')');
      const data = await gql(
        `mutation($projectId: ID!, $contentId: ID!) {
           addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
             item { id } } }`,
        { projectId: projectNode.id, contentId: await issueNodeId(num) },
      );
      itemId = data.addProjectV2ItemById.item.id;
      item = { id: itemId, fields: {} };
      await sleep(CREATE_DELAY_MS);
    }

    const wanted = [
      ['Slice', sliceField, t.slice],
      ['Priority', priorityField, t.priority],
      ['Size', sizeField, t.size],
    ];
    for (const [name, field, value] of wanted) {
      if (item.fields?.[name] === value) continue;
      const v = fieldValue(field, value);
      if (!v || DRY) continue;
      await gql(
        `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
           updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }) {
             projectV2Item { id } } }`,
        { projectId: projectNode.id, itemId, fieldId: field.id, value: v },
      );
    }
  });

  log(`  project: https://github.com/users/${OWNER}/projects/${projectNode.number}`);
}

const nodeIds = new Map();
async function issueNodeId(number) {
  if (nodeIds.has(number)) return nodeIds.get(number);
  const data = await gql(
    'query($owner: String!, $repo: String!, $number: Int!) { repository(owner: $owner, name: $repo) { issue(number: $number) { id } } }',
    { owner: OWNER, repo: REPO, number },
  );
  nodeIds.set(number, data.repository.issue.id);
  return data.repository.issue.id;
}

// ---------------------------------------------------------------------- main

log(`Board sync for ${OWNER}/${REPO}${DRY ? ' (dry run)' : ''}`);
log(`  ${tasks.length} tasks from docs/board/tasks`);

await ensureLabels();
const numbers = await syncIssues();
if (!ISSUES_ONLY) await syncProject(numbers);

log('\nDone.');
