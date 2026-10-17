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

## What was verified, and what was not

Verified on 2026-10-17 against `GET https://api.deepseek.com/models` using the
session credential (stored in `~/.dsh/.credentials.yaml` under
`refs.DEEPSEEK_API_KEY`; the harness injects it into its own process, not into a
user's interactive shell):

```json
{ "id": "deepseek-flash", "name": "DeepSeek-V4.1-Flash", "owned_by": "deepseek",
  "context_window": 1048576, "max_output_tokens": 393216,
  "input_modalities": ["text", "image"], "output_modalities": ["text"],
  "effort": { "supported_levels": ["low", "high", "max"], "default_level": "high" } }
```

The catalogue exposes exactly two models: `deepseek-flash` and
`deepseek-v4-pro`.

**Not verifiable:** the build tag `1017`. The API returns the model family and
its limits, not a build date, so "V4.1-Flash-1017" remains the vendor's statement
and this ADR says so. The session runs `deepseek-flash` with `reasoningEffort:
max`, which is within the supported levels and above the default.

One practical note: an unauthenticated call to `/models` returns **plain text**
(`Authentication Fails (governor)`, HTTP 401, no content type), not the JSON
error envelope a bad key produces. Any script should check the status before
parsing the body.

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
