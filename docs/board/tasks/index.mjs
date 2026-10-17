// The board's source of truth.
//
// Every task carries a stable `id`. The sync script embeds that id in the issue
// body as an HTML comment marker, so re-running the sync updates the existing
// issue instead of creating a duplicate. Renaming a title is therefore safe;
// changing an id creates a new issue.
//
// Task schema:
//   id         stable key, used as the marker and for dependency links
//   epic       id of the parent epic (epics themselves have no parent)
//   title      issue title
//   body       markdown; rendered as-is, dependencies appended by the script
//   done       acceptance checklist
//   labels     labels applied to the issue
//   priority   P0 | P1 | P2  (project field)
//   size       S | M | L     (project field)
//   dependsOn  ids of blocking tasks (rendered as #links)

import sliceLow from './slices-0-3.mjs';
import sliceHigh from './slices-4-7.mjs';
import sliceTop from './slices-8-10.mjs';
import cross from './cross.mjs';

export const project = {
  title: 'Municipal POC — Sanitation & Health',
  shortDescription:
    'Build plan for the municipal data-platform POC: map, learn, generate forms, answer questions. Source of truth: docs/board/tasks.',
  fields: {
    priority: ['P0', 'P1', 'P2'],
    size: ['S', 'M', 'L'],
    // Slice field options are derived from the epics plus a cross-cutting bucket.
    sliceOptions: [
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
      'Cross-cutting',
    ],
  },
};

const raw = [...sliceLow, ...sliceHigh, ...sliceTop, ...cross];

/** Slice number for a task, taken from its epic id ("s4-epic" -> "4"). */
function sliceOf(task, byId) {
  if (task.kind === 'epic') {
    const m = /^s(\d+)-epic$/.exec(task.id);
    if (m) return m[1];
    return 'Cross-cutting';
  }
  const epic = byId.get(task.epic);
  if (!epic) return 'Cross-cutting';
  const m = /^s(\d+)-epic$/.exec(epic.id);
  return m ? m[1] : 'Cross-cutting';
}

function validate(items) {
  const errors = [];
  const byId = new Map();

  for (const t of items) {
    if (!t.id) errors.push('task without id: ' + JSON.stringify(t.title));
    else if (byId.has(t.id)) errors.push('duplicate id: ' + t.id);
    else byId.set(t.id, t);
  }

  const allowedLabels = new Set(
    raw.flatMap((t) => t.labels ?? []).concat('kind/epic', 'kind/decision'),
  );

  for (const t of items) {
    if (!t.title) errors.push(t.id + ': missing title');
    if (!t.body || t.body.trim().length < 20) errors.push(t.id + ': body too thin');
    if (t.kind !== 'epic' && !t.epic) errors.push(t.id + ': task without epic');
    if (t.epic && !byId.has(t.epic)) errors.push(t.id + ': unknown epic ' + t.epic);
    if (t.epic && byId.get(t.epic)?.kind !== 'epic')
      errors.push(t.id + ': parent ' + t.epic + ' is not an epic');
    if (!['P0', 'P1', 'P2'].includes(t.priority))
      errors.push(t.id + ': bad priority ' + t.priority);
    if (!['S', 'M', 'L'].includes(t.size)) errors.push(t.id + ': bad size ' + t.size);
    for (const d of t.dependsOn ?? []) {
      if (!byId.has(d)) errors.push(t.id + ': unknown dependency ' + d);
      if (d === t.id) errors.push(t.id + ': depends on itself');
    }
    for (const l of t.labels ?? []) {
      if (!allowedLabels.has(l)) errors.push(t.id + ': unknown label ' + l);
    }
    if (!(t.labels ?? []).length) errors.push(t.id + ': no labels');
  }

  if (errors.length) {
    throw new Error('Task spec is invalid:\n  ' + errors.join('\n  '));
  }

  // Cycle check over dependencies.
  const state = new Map();
  const visit = (id, trail) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting')
      throw new Error('dependency cycle: ' + trail.concat(id).join(' -> '));
    state.set(id, 'visiting');
    for (const d of byId.get(id).dependsOn ?? []) visit(d, trail.concat(id));
    state.set(id, 'done');
  };
  for (const t of items) visit(t.id, []);

  return byId;
}

const byId = validate(raw);

export const tasks = raw.map((t) => ({
  ...t,
  slice: sliceOf(t, byId),
  epicTitle: t.epic ? byId.get(t.epic).title : null,
}));

export const epics = tasks.filter((t) => t.kind === 'epic');
export const leaves = tasks.filter((t) => t.kind !== 'epic');

export function stats() {
  const count = (list, f) =>
    list.reduce((acc, t) => {
      const k = f(t);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
  return {
    total: tasks.length,
    epics: epics.length,
    leaves: leaves.length,
    bySlice: count(tasks, (t) => t.slice),
    byPriority: count(leaves, (t) => t.priority),
    bySize: count(leaves, (t) => t.size),
  };
}
