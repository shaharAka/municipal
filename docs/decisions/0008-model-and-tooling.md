# ADR-0008: the model and tools this POC was built with

- **Status:** recorded
- **Date:** 2026-10-17
- **Related:** ADR-0001 (runtime), brief §2 principle 8 (roles, not models), §9 (model choice per role)

## Decision

The POC was built with **DeepSeek V4.1 Flash**, build **V4.1-Flash-1017**, as
reported by the vendor's release note on 2026-10-17. The harness requests it by
the stable alias `deepseek-flash` from the `deepseek-official` provider, with
`reasoningEffort: max`.

The alias is deliberate for the POC: it tracks the vendor's current build
instead of pinning one, which is right for a demo and **wrong for an eval**
(§9). Reproducing a benchmark requires pinning the concrete build.

## What this file can and cannot prove

`~/.dsh/settings.yaml` and the session transcript record the alias
`deepseek-flash`; neither records the resolved build, because resolution happens
on the provider side. The build string above comes from the vendor's own release
note, not from a locally observable field. The corroborating signal is tooling:
this session exposes `web_search` and `web_fetch`, which the same release note
announces for the API, and which earlier builds of the alias did not carry.

To pin it independently:

```bash
curl -s https://api.deepseek.com/models -H "Authorization: Bearer $DEEPSEEK_API_KEY"
# or read .model from any completion response
```

## Why it matters to this product, not just to the build log

The brief requires eligibility rules to be drafted **from the regulation text**
(§5.7 "No rule yet?") and every rule to carry its legal citation. With web fetch
available, that draft can cite the municipality's published by-law rather than
the three paragraphs of it we happened to ingest — which is the difference
between a demo rule and a defensible one. It also makes the adversarial suite
more honest: content fetched from the web is untrusted input exactly like a
document in SharePoint, and must be treated as data, never as instructions.

## Consequences

- Any future benchmark (slice 10, model per role) must record the pinned build,
  because an alias can move under it between runs.
- Fetched web content enters the graph through the same path as any other source
  item: label, access list, evidence locator, and the injection check.
- The model choice for each role remains open: this ADR records what built the
  POC, not what a production deployment should run.
