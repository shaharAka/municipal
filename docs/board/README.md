# The board

The build plan lives in this directory as code. GitHub issues and the project
board are generated from it, not hand-edited, so the plan can be reviewed in a
pull request, diffed, and rebuilt from scratch.

```
docs/board/tasks/
  index.mjs         loads, validates and derives slice/priority stats
  slices-0-3.mjs    slices 0–3 of the brief
  slices-4-7.mjs    slices 4–7
  slices-8-10.mjs   slices 8–10
  cross.mjs         domain decisions, synthetic data, governance, evals
scripts/sync-board.mjs   pushes the spec into issues + the project board
```

## Sync

```bash
node scripts/sync-board.mjs --dry-run   # show what would change
node scripts/sync-board.mjs             # apply
node scripts/sync-board.mjs --issues    # issues only, no project access needed
```

Auth is `GITHUB_TOKEN` if set, otherwise `gh auth token`. The token needs `repo`
and `project` scopes.

The script is idempotent. Each issue body ends with a marker comment:

```html
<!-- board-task:s1-records -->
```

That marker is the identity of the task. Renaming a title, rewriting the body or
re-labelling updates the existing issue. Changing an **id** creates a new issue —
only do it deliberately. Deleting an entry from the spec does not close its
issue, on purpose: history is not erased by editing a plan.

## Fields

The project board carries three single-select fields on top of the default
Status: **Slice** (0–10 or Cross-cutting), **Priority** (P0/P1/P2) and **Size**
(S/M/L). Slice is derived from the parent epic, so a task never needs to repeat
it.

Priority meaning in this POC:

- **P0** — the demo does not work without it. This is the critical path.
- **P1** — needed for a credible POC, can land after the first demo.
- **P2** — post-POC or optional; recorded so it is not rediscovered later.

## Relationships

- `epic` — the parent issue. Every non-epic task has one; epics are the slice
  workstreams plus the four cross-cutting ones.
- `dependsOn` — blocking tasks. Rendered into the issue as `#123` links after
  creation, so the graph is visible without a separate tool.

The spec validator rejects: duplicate ids, unknown epics, unknown dependencies,
dependency cycles, missing labels, invalid priority or size, and bodies too thin
to describe the work. A broken plan fails before it reaches GitHub.

## Convention

Every task body cites the section of `docs/DESIGN.md` it implements, and ends
with a "Done when" checklist. "Done" means the checklist is true and the eval
that covers it passes — not that a demo was shown.
