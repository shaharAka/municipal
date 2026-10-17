const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
class Raw {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}
const raw = (value) => new Raw(String(value));
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const renderValue = (value) =>
  value instanceof Raw ? value.value
    : Array.isArray(value) ? value.map(renderValue).join('')
      : value === null || value === undefined || value === false ? '' : esc(value);
function h(strings, ...values) {
  let out = strings[0];
  values.forEach((value, index) => { out += renderValue(value) + strings[index + 1]; });
  return new Raw(out);
}
const isHebrew = (value) => /[\u0590-\u05FF]/.test(String(value ?? ''));
const heb = (value) => (isHebrew(value) ? h`<span class="he" dir="rtl" lang="he">${value}</span>` : h`<span dir="auto">${value}</span>`);
const mono = (value) => h`<code class="mono">${value ?? '—'}</code>`;
const badge = (label, tone = '') => h`<span class="badge ${tone}">${label ?? ''}</span>`;
const n = (value) =>
  value === null || value === undefined || value === '' || Number.isNaN(Number(value)) ? '—' : Number(value).toLocaleString('en-US');
const day = (value) =>
  value === null || value === undefined || !Number.isFinite(Number(value))
    ? '—' : Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 });
const pct = (value) =>
  value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : `${Math.round(Number(value) * 100)}%`;
const date = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value ?? '—') : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const width = (ratio) => Math.max(0, Math.min(100, Number(ratio) * 100 || 0)).toFixed(1);
const bar = (ratio) => h`<span class="bar" aria-hidden="true"><span style="width:${width(ratio)}%"></span></span>`;
const sortedEntries = (object) => Object.entries(object ?? {}).sort((a, b) => Number(b[1]) - Number(a[1]));
const list = (items, fallback = 'None.') =>
  items.length ? h`<div class="chips">${items.map((item) => h`<span class="chip">${item}</span>`)}</div>` : h`<p class="tiny muted">${fallback}</p>`;
const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'ask', label: 'Ask' },
  { id: 'learn', label: 'Learn' },
  { id: 'mapping', label: 'Sources & Mapping' },
  { id: 'organization', label: 'Organization' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'automations', label: 'Automations' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'access', label: 'Access' },
];
const state = {
  tab: 'overview', service: null, viewer: null, coverageFilter: 'all',
  search: { q: '', ran: false, loading: false, error: null, results: [], seq: 0 },
  approvals: new Map(), overlays: new Map(), focusService: null, focusViewer: false,
  ask: { answer: null, error: null }, learn: { result: null },
};
const cache = new Map();
async function fetchJson(path, params = {}) {
  const url = new URL(path, location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, value);
  }
  const cacheKey = url.pathname + url.search;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const request = (async () => {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; }
    catch { throw new Error(`The API returned non-JSON content (HTTP ${response.status}).`); }
    if (!response.ok) throw new Error(body?.error ? `HTTP ${response.status}: ${body.error}` : `Request failed with HTTP ${response.status}.`);
    return body;
  })();
  cache.set(cacheKey, request);
  try { return await request; }
  catch (error) { cache.delete(cacheKey); throw error; }
}
async function postJson(path, body = {}) {
  const response = await fetch(path, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; }
  catch { throw new Error(`The API returned non-JSON content (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(payload?.error ?? `Request failed with HTTP ${response.status}.`);
  return payload;
}

/* ------------------------------------------------------------------ shell */
let renderToken = 0;
function buildTabs() {
  $('#tabs').innerHTML = h`${SECTIONS.map((section) =>
    h`<button type="button" class="tab" role="tab" id="tab-${section.id}" data-tab="${section.id}" aria-controls="panel" aria-selected="false" tabindex="-1">${section.label}</button>`)}`;
}
function activateTab(tab) {
  $$('#tabs [role="tab"]').forEach((button) => {
    const selected = button.dataset.tab === tab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
}
function currentTab() {
  const candidate = location.hash.replace(/^#\/?/, '');
  return SECTIONS.some((section) => section.id === candidate) ? candidate : 'overview';
}
const sectionLabel = (tab) => SECTIONS.find((section) => section.id === tab)?.label ?? tab;
async function loadShell() {
  try {
    const data = await fetchJson('/api/overview');
    $('#org-name').textContent = data.organization.name;
    const hebrewName = $('#org-he');
    hebrewName.textContent = data.organization.nameHe ?? '';
    hebrewName.setAttribute('dir', 'rtl');
    hebrewName.setAttribute('lang', 'he');
    $('#org-meta').textContent = `Profile ${data.organization.profileId} · ${data.organization.domain} · captured ${date(data.organization.capturedAt)}`;
    $('#footer-meta').textContent = `${data.organization.name} · organization ${data.organization.organizationId}`;
    document.title = `${data.organization.name} · Municipal data workbench`;
  } catch {
    $('#org-name').textContent = 'Municipal data workbench';
    $('#org-he').textContent = '';
    $('#org-meta').textContent = 'API unavailable — retry from the Overview tab';
  }
}
const errorView = (error) => h`<div class="state error" role="alert">
  <p class="eyebrow">API error</p>
  <h3>This section could not be loaded</h3>
  <p class="small">The workbench asked the API and did not receive a usable answer. Nothing was blanked or defaulted.</p>
  <p class="error-msg">${error instanceof Error ? error.message : String(error)}</p>
  <button type="button" class="btn" data-action="retry">Try again</button>
</div>`;
const loadingView = (tab) => h`<div class="state" role="status"><span class="spinner" aria-hidden="true"></span><p>Loading ${sectionLabel(tab)}…</p></div>`;
async function renderTab() {
  const tab = state.tab;
  const token = ++renderToken;
  const panel = $('#panel');
  panel.setAttribute('aria-labelledby', `tab-${tab}`);
  panel.setAttribute('aria-busy', 'true');
  panel.innerHTML = loadingView(tab);
  try {
    const data = await LOADERS[tab]();
    if (token !== renderToken || state.tab !== tab) return;
    panel.innerHTML = VIEWS[tab](data);
    panel.setAttribute('aria-busy', 'false');
    restoreFocus();
  } catch (error) {
    if (token !== renderToken || state.tab !== tab) return;
    panel.innerHTML = errorView(error);
    panel.setAttribute('aria-busy', 'false');
  }
}
function restoreFocus() {
  if (state.focusViewer) { state.focusViewer = false; $('#viewer-select')?.focus(); }
  if (state.focusService) {
    const code = state.focusService;
    state.focusService = null;
    $(`[data-action="service"][data-service="${code}"]`)?.focus();
  }
}
function goToHash() {
  const next = currentTab();
  if (next === state.tab) return;
  state.tab = next;
  activateTab(next);
  window.scrollTo(0, 0);
  renderTab();
}

/* -------------------------------------------------------------- shared ui */
const pageHead = (eyebrow, title, lede, actions = '') => h`<header class="page-head">
  <div><p class="eyebrow">${eyebrow}</p><h2 class="page-title">${title}</h2>${lede ? h`<p class="lede">${lede}</p>` : ''}</div>
  ${actions ? h`<div class="actions">${actions}</div>` : ''}
</header>`;
const sectionHead = (title, note, extra = '') =>
  h`<div class="section-head"><div><h3>${title}</h3>${note ? h`<p>${note}</p>` : ''}</div>${extra}</div>`;
const statTile = (label, value, sub = '') =>
  h`<div class="stat"><div class="stat-value">${value}</div><div class="stat-label">${label}</div>${sub ? h`<div class="stat-sub">${sub}</div>` : ''}</div>`;
const coverageTile = (label, ratio, sub) =>
  h`<div class="stat"><div class="stat-value">${pct(ratio)}</div><div class="stat-label">${label}</div><div class="stat-sub">${sub}</div>${bar(ratio)}</div>`;
const meterRows = (entries, total) => entries.map(([label, count]) =>
  h`<div class="meter-row"><span class="meter-label">${label.replaceAll('_', ' ')}</span>${bar(total ? Number(count) / Number(total) : 0)}<span class="num">${n(count)}</span></div>`);
function findingsBanner(findings, withLink = true) {
  const items = Array.isArray(findings) ? findings : [];
  if (!items.length) return '';
  return h`<section class="banner" aria-labelledby="security-finding">
    <div class="banner-body">
      <p class="eyebrow">Security finding · ${items[0].severity} severity</p>
      <h3 id="security-finding">An injected instruction was found in a source document</h3>
      ${items.map((finding) => h`<div><p><strong>${String(finding.kind ?? 'finding').replaceAll('-', ' ')}</strong> · document ${heb(finding.document)}</p><blockquote class="excerpt">${finding.excerpt}</blockquote></div>`)}
      <p class="small muted">The text was treated as data: flagged, never executed.${withLink ? h` <a class="text-link" href="#/access">Open the access view →</a>` : ''}</p>
    </div>
  </section>`;
}
const overlayBlock = (draft) => h`<div class="overlay-block"><p class="eyebrow">Returned overlay draft</p><pre class="code-block">${JSON.stringify(draft, null, 2)}</pre></div>`;

/* ---------------------------------------------------------------- overview */
function serviceCard(service) {
  return h`<article class="card service-card">
    <div class="row-between"><span class="badge accent">${service.code}</span><span class="muted tiny">${n(service.cases)} cases</span></div>
    <h3 class="card-title">${service.name}</h3>
    <dl class="metric-row"><div><dt>Cases</dt><dd>${n(service.cases)}</dd></div><div><dt>Median days</dt><dd>${day(service.medianDays)}</dd></div></dl>
    <div class="bottleneck-line"><span class="muted tiny">Bottleneck</span>${mono(service.bottleneck ?? '—')}${service.bottleneckDays !== null && service.bottleneckDays !== undefined ? h`<span class="muted tiny">${day(service.bottleneckDays)} d median wait</span>` : ''}</div>
    <a class="text-link" href="#/workflows" data-service="${service.code}">Inspect workflow →</a>
  </article>`;
}
function connectionCard(connection) {
  return h`<article class="card connection-card">
    <div class="row-between"><h4>${connection.label}</h4><div class="chips">${badge(connection.kind)}${badge(connection.access, 'ok')}</div></div>
    <p class="muted tiny">${connection.auth}</p>
    <div class="endpoint"><span class="endpoint-label">Local</span><code>${connection.localEndpoint}</code></div>
    <div class="endpoint"><span class="endpoint-label">Production</span><code>${connection.productionEndpoint}</code></div>
    <div class="swap-note"><strong>Swap:</strong> ${connection.swap}</div>
    <p class="muted tiny">Scopes: ${connection.scopes.join(' · ')}</p>
  </article>`;
}
function overviewView(data) {
  const graph = data.graph;
  return h`
    ${pageHead('Organization overview', h`${data.organization.name} ${data.organization.nameHe ? heb(data.organization.nameHe) : ''}`,
      h`${data.organization.domain} · profile ${mono(data.organization.profileId)} · organization ${mono(data.organization.organizationId)} · captured ${date(data.organization.capturedAt)}`,
      h`<a class="btn ghost" href="#/mapping">Review source mapping</a><a class="btn ghost" href="#/onboarding">Second municipality</a>`)}
    ${findingsBanner(data.findings)}
    <div class="stats">
      ${statTile('Pages', n(graph.pages), `${Object.keys(graph.byType ?? {}).length} page types`)}
      ${statTile('Edges', n(graph.edges), 'typed relationships')}
      ${statTile('Facts', n(graph.facts), `${n(graph.byStatus?.candidate ?? 0)} candidate · ${n(graph.byStatus?.confirmed ?? 0)} confirmed`)}
      ${statTile('Evidence', n(graph.evidence), `${n(graph.sourceItems)} source items`)}
    </div>
    <div class="grid-2 section">
      <section class="card">
        <div class="row-between"><h3 class="card-title">Graph composition</h3><span class="muted tiny">pages by type</span></div>
        <div class="tokens" style="margin-top:12px">${sortedEntries(graph.byType).map(([type, count]) =>
          h`<span class="token"><span>${type.replaceAll('_', ' ')}</span><b>${n(count)}</b></span>`)}</div>
        <div class="ledger">
          <div class="ledger-group"><h5>Facts by status</h5>${meterRows(sortedEntries(graph.byStatus), graph.facts)}</div>
          <div class="ledger-group"><h5>Facts by evidence class</h5>${meterRows(sortedEntries(graph.byEvidenceClass), graph.facts)}</div>
        </div>
      </section>
      <section class="card">
        <div class="row-between"><h3 class="card-title">Ontology baseline</h3><span class="muted tiny">v${data.ontology.version}</span></div>
        <div class="stats" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:12px">
          ${statTile('Page types', n(data.ontology.pageTypes), data.ontology.packs.join(' · '))}
          ${statTile('Edge kinds', n(data.ontology.edgeKinds), 'declared relationships')}
          ${statTile('Inference rules', n(data.ontology.inferenceRules), 'composed from packs')}
          ${statTile('Learnings', n(data.ontology.learnings), `${n(data.ontology.observations)} observations`)}
        </div>
        <p class="muted small" style="margin-top:12px">Versioned packs compose the baseline. Tenant changes are overlays, never edits to a pack.</p>
      </section>
    </div>
    <section class="section">
      ${sectionHead('Services', 'Each service is a page in the graph; its process model is discovered from the case traces.')}
      <div class="grid-3">${data.services.map(serviceCard)}</div>
    </section>
    <section class="section">
      ${sectionHead('Connections', 'Six production connections, each replaced by a local mock through configuration. The POC is read-only.')}
      <div class="grid-2">${data.connections.map(connectionCard)}</div>
    </section>
    <section class="section">
      <div class="card template-strip">
        <div>
          <p class="eyebrow">Second municipality</p><h3>${data.secondOrganization.name}</h3>
          <p class="muted small">Onboarded from the ${data.organization.name} template; only the differences are proposed.</p>
          <p class="tiny muted">${mono(data.secondOrganization.profileId)} · ${n(data.secondOrganization.pages)} pages in its graph</p>
        </div>
        <a class="btn ghost" href="#/onboarding">Review the template diff</a>
      </div>
    </section>
    ${data.problems.length ? h`<section class="section"><div class="banner"><div class="banner-body">
      <p class="eyebrow">Data integrity notes</p><h3>${data.problems.length} problem${data.problems.length === 1 ? '' : 's'} reported during ingestion</h3>
      <ul class="list-plain">${data.problems.map((problem) => h`<li>${problem}</li>`)}</ul>
    </div></div></section>` : ''}
  `;
}

/* ----------------------------------------------------------------- mapping */
function mappingCard(mapping, sources) {
  const run = mapping.run;
  const sourceLabel = sources.find((source) => source.system === mapping.system)?.label ?? mapping.system;
  return h`<article class="card map-card">
    <header class="map-head">
      <div class="row-between"><span class="badge">${sourceLabel}</span>${run ? h`<span class="muted tiny">${n(run.rows)} rows · ${n(run.facts)} facts</span>` : ''}</div>
      <div class="flow-line">${mono(mapping.source)}<span class="flow-arrow" aria-hidden="true">→</span><span class="type-pill">${mapping.pageType}</span></div>
      <p class="meta">${mono(mapping.id)} · ${mapping.fields.length} mapped fields${mapping.acceptance ? ` · ${mapping.acceptance.ruleId}` : ' · no acceptance rule'}</p>
    </header>
    <table class="map-table">
      <thead><tr><th>Source column</th><th>Ontology property</th><th>Transform</th></tr></thead>
      <tbody>${mapping.fields.map((field) => h`<tr><td>${mono(field.from)}</td><td>${mono(field.property)}</td><td>${field.transform ? mono(field.transform) : h`<span class="muted">direct</span>`}</td></tr>`)}</tbody>
    </table>
    <div class="map-extra">
      ${mapping.acceptance
        ? h`<div class="acceptance">${badge(mapping.acceptance.ruleId, 'ok')}<span>${mapping.acceptance.reason}</span><span>Owner: ${heb(mapping.acceptance.owner)}</span></div>`
        : h`<p class="tiny muted">No acceptance rule: imported values remain candidates.</p>`}
      ${mapping.edges.length ? h`<div class="subblock"><h5>Edges</h5><div class="chips">${mapping.edges.map((edge) =>
        h`<span class="chip">${edge.kind}<span class="count">${edge.side === 'from' ? '→' : '←'} ${edge.targetType} · ${edge.from}</span></span>`)}</div></div>` : ''}
      ${mapping.unmapped.length ? h`<div class="subblock"><h5>Unmapped source columns</h5>${mapping.unmapped.map((column) =>
        h`<div class="unmapped-row">${mono(column.column)}<span class="reason">${column.reason}</span>${badge('schema candidate', 'candidate')}</div>`)}</div>` : ''}
    </div>
    <footer class="map-foot">
      ${run
        ? h`<span><b>${n(run.pages)}</b> pages</span><span><b>${n(run.facts)}</b> facts</span><span><b>${n(run.edges)}</b> edges</span>
          ${run.missingValues.length ? h`<span><b>${n(run.missingValues.reduce((sum, item) => sum + item.count, 0))}</b> missing values</span>` : ''}
          ${run.rejected.length ? h`<span class="badge danger">${run.rejected.length} rejected</span>` : ''}`
        : h`<span>No ingestion run recorded for this mapping.</span>`}
    </footer>
  </article>`;
}
function coverageRow(row) {
  const total = Number(row.present) + Number(row.missing);
  const filter = state.coverageFilter;
  const hidden = filter === 'mapped' ? !row.mappedFrom : filter === 'gaps' ? !(!row.mappedFrom || row.missing > 0) : false;
  return h`<tr data-coverage-row data-mapped="${row.mappedFrom ? '1' : '0'}" data-gap="${!row.mappedFrom || row.missing > 0 ? '1' : '0'}" ${hidden ? raw('hidden') : ''}>
    <td>${row.pageType}</td><td>${mono(row.property)}</td>
    <td>${row.mappedFrom ? mono(row.mappedFrom) : h`<span class="muted">not mapped</span>`}</td>
    <td class="num">${n(row.present)}</td><td class="num">${n(row.missing)}</td>
    <td>${total ? h`<div class="metric-bar">${bar(row.present / total)}<span class="tiny muted">${pct(row.present / total)}</span></div>` : h`<span class="tiny muted">no source rows</span>`}</td>
  </tr>`;
}
function candidateCard(candidate) {
  const accepted = state.overlays.has(candidate.id) || candidate.status === 'accepted';
  return h`<article class="card candidate-card">
    <div class="row-between"><span class="badge candidate">${candidate.candidate_kind}</span><span class="candidate-status">${badge(accepted ? 'accepted' : candidate.status, accepted ? 'ok' : 'candidate')}</span></div>
    <div class="candidate-prop">${mono(candidate.proposal.property)} <span class="muted small">· ${candidate.proposal.page_types?.join(', ') ?? candidate.proposal.page_type}</span></div>
    <p class="support"><strong>${n(candidate.support_count)}</strong> <span class="muted">supporting rows</span></p>
    <p class="muted tiny">Sources: ${candidate.sources.map((source, index) => h`${index ? ' · ' : ''}${mono(source)}`)}</p>
    <div class="examples">${candidate.proposal.examples.map((example) => h`<span class="chip" dir="auto">${example}</span>`)}</div>
    <p class="mixed small">${candidate.evidence_summary}</p>
    <p class="small muted">${candidate.reason}</p>
    <div class="candidate-actions">${accepted ? badge('accepted', 'ok') : h`<button type="button" class="btn" data-action="accept" data-id="${candidate.id}">Accept candidate</button>`}</div>
    <div class="action-error" role="alert"></div>
    <div class="candidate-overlay-slot">${state.overlays.has(candidate.id) ? overlayBlock(state.overlays.get(candidate.id)) : ''}</div>
  </article>`;
}
function mappingView(data) {
  const mapped = data.coverage.filter((row) => row.mappedFrom).length;
  const gaps = data.coverage.filter((row) => !row.mappedFrom || row.missing > 0).length;
  const filters = [
    ['all', 'All', data.coverage.length], ['mapped', 'Mapped', mapped], ['gaps', 'Gaps', gaps],
  ].map(([key, label, count]) =>
    h`<button type="button" class="segment" data-action="coverage-filter" data-filter="${key}" aria-pressed="${state.coverageFilter === key}">${label} <span class="coverage-count">${n(count)}</span></button>`);
  return h`
    ${pageHead('Sources & mapping', 'What the platform reads, and where it lands',
      `${data.mappings.length} declarative mappings across ${data.sources.length} source systems. A mapped column becomes an ontology property; an unmapped column becomes a candidate, never a silent extension.`,
      h`<a class="btn ghost" href="#/organization">Open organization map</a>`)}
    <div class="stats">
      ${statTile('Source systems', n(data.sources.length), data.sources.map((source) => source.system).join(' · '))}
      ${statTile('Mappings', n(data.mappings.length), 'source objects mapped')}
      ${statTile('Coverage', `${mapped}/${data.coverage.length}`, 'ontology properties with a source')}
      ${statTile('Candidates', n(data.candidates.length), 'unmapped columns proposed')}
    </div>
    <section class="section">
      ${sectionHead('Source mappings', 'Each row reads source column → ontology property, with the declared transform in the mapping.')}
      <div class="map-grid">${data.mappings.map((mapping) => mappingCard(mapping, data.sources))}</div>
    </section>
    <section class="section">
      ${sectionHead('Coverage', 'Every ontology property, its source column, and how many rows carry a value. "Not mapped" is a known gap, not a zero.', h`<div class="segments" role="group" aria-label="Filter coverage">${filters}</div>`)}
      <div class="table-wrap scroll"><table class="data">
        <thead><tr><th>Page type</th><th>Property</th><th>Mapped from</th><th class="num">Present</th><th class="num">Missing</th><th>Coverage</th></tr></thead>
        <tbody>${data.coverage.map(coverageRow)}</tbody>
      </table></div>
    </section>
    <section class="section">
      ${sectionHead('Schema candidates', 'A column with no ontology property is proposed, never adopted silently. Accepting returns a tenant-namespaced overlay draft for review.')}
      <div class="candidate-grid">${data.candidates.map(candidateCard)}</div>
    </section>
  `;
}

/* ------------------------------------------------------------ organization */
const searchFormCard = () => h`<section class="card search-card">
  <form class="search-form" data-form="search" role="search">
    <label for="org-search">Who handles …?</label>
    <div class="search-row">
      <input id="org-search" name="q" type="search" value="${state.search.q}" placeholder="Search a task, topic or activity" autocomplete="off" />
      <button class="btn" type="submit">Search</button>
    </div>
  </form>
  <p class="tiny muted">Searches inferred responsibilities across case events and mail threads. Every result is a candidate.</p>
</section>`;
function searchResultsView() {
  const search = state.search;
  if (search.loading) return h`<div class="state inline" role="status"><span class="spinner" aria-hidden="true"></span><p>Searching responsibilities…</p></div>`;
  if (search.error) return h`<p class="action-error" role="alert">${search.error}</p>`;
  if (!search.ran) return '';
  if (!search.results.length) return h`<div class="empty-state">No responsibility candidate matches “${search.q}”. Try a broader term.</div>`;
  return h`<section class="card search-results">
    <div class="row-between"><h3 class="card-title">Who handles “${search.q}”</h3>${badge('candidate', 'candidate')}</div>
    <ul class="result-list">${search.results.map((result) => h`<li class="result">
      <div class="result-main"><div class="person-head"><strong>${heb(result.name)}</strong><span>${heb(result.title)}</span></div><p class="mixed small">${result.summary}</p></div>
      <span class="chip">${n(result.support)} supporting records</span>
    </li>`)}</ul>
  </section>`;
}
function unitCard(unit, people) {
  const head = people.find((person) => person.ref === unit.headRef);
  return h`<article class="card unit-card">
    <div class="row-between"><span class="badge">${n(unit.headcount)} people</span><span class="muted tiny">${unit.roles.length} roles</span></div>
    <h3>${heb(unit.name)}</h3>
    <p class="tiny muted">name_en: ${heb(unit.nameEn)}</p>
    ${head ? h`<p class="small">Head: ${heb(head.name)} <span class="muted">${heb(head.title)}</span></p>` : h`<p class="small muted">No head recorded.</p>`}
    <div class="chips">${unit.roles.map((role) => h`<span class="chip">${heb(role.title)}<span class="count">${role.personRefs.length}</span></span>`)}</div>
  </article>`;
}
function responsibilityChip(responsibility) {
  const label = responsibility.activityLabel || String(responsibility.subject ?? '').replace(/^topic:/, '');
  const unit = responsibility.signal === 'mail' ? 'threads' : 'case events';
  return h`<span class="chip resp" title="Knowledge candidate awaiting confirmation">${heb(label)}<span class="count">${n(responsibility.support)} ${unit}</span></span>`;
}
function peopleCard(title, people, hebrewTitle = true) {
  return h`<section class="card people-card">
    <div class="row-between"><h3 class="${hebrewTitle ? 'he-block' : ''}">${title}</h3><span class="muted tiny">${people.length} listed</span></div>
    <ul class="person-list">${people.map((person) => h`<li class="person">
      <div class="person-head"><strong>${heb(person.name)}</strong><span>${heb(person.title)}</span></div>
      <div class="chips">${person.responsibilities.length
        ? [...person.responsibilities].sort((a, b) => b.support - a.support).map(responsibilityChip)
        : h`<span class="tiny muted">No inferred responsibilities</span>`}</div>
    </li>`)}</ul>
  </section>`;
}
function organizationView(data) {
  const peopleByUnit = new Map();
  for (const person of data.people) {
    const key = person.unitRef ?? '';
    peopleByUnit.set(key, [...(peopleByUnit.get(key) ?? []), person]);
  }
  const unassigned = data.people.filter((person) => !person.unitRef);
  return h`
    ${pageHead('Organization', 'Units, roles and who is inferred to do what',
      'Units come from the directory; a head is the senior person whose manager sits outside the unit. Responsibilities are inferred from work traces.',
      h`${badge('inferred responsibilities are candidates', 'candidate')}`)}
    ${searchFormCard()}
    <div id="search-results" aria-live="polite">${searchResultsView()}</div>
    <section class="section">
      ${sectionHead('Units', `${data.units.length} units · ${data.people.length} people in the directory.`)}
      <div class="grid-3">${data.units.map((unit) => unitCard(unit, peopleByUnit.get(unit.ref) ?? []))}</div>
    </section>
    <div class="callout section"><span class="eyebrow">Status · candidate</span>
      <p>Inferred responsibilities are knowledge candidates, not facts. Each chip carries the count of case events or mail threads behind it and waits for a person to confirm it.</p>
    </div>
    <section class="section">
      ${sectionHead('People by unit', 'Support counts are the evidence behind each candidate, not a score.')}
      <div class="grid-2">
        ${data.units.map((unit) => peopleCard(unit.name, peopleByUnit.get(unit.ref) ?? []))}
        ${unassigned.length ? peopleCard('No recorded unit', unassigned, false) : ''}
      </div>
    </section>
  `;
}

/* --------------------------------------------------------------- workflows */
const serviceSwitch = (services, current) => h`<div class="service-switch" role="group" aria-label="Choose a service">${services.map((service) =>
  h`<button type="button" class="segment" data-action="service" data-service="${service.code}" aria-pressed="${service.code === current}">${service.code}<span>${service.name}</span></button>`)}</div>`;
function workflowsView({ services, code, data }) {
  const model = data.model;
  const steps = [...model.steps].sort((a, b) => b.medianWaitDays - a.medianWaitDays);
  const maxWait = Math.max(0, ...steps.map((step) => Number(step.medianWaitDays) || 0));
  const labels = new Map(model.steps.map((step) => [step.activity, step.labels]));
  const bottleneck = model.bottleneck?.activity;
  return h`
    ${pageHead('Workflow discovery', model.serviceName,
      `Discovered from ${n(model.caseCount)} case traces over ${n(model.windowDays)} days. Waits are measured between consecutive events, not estimated.`,
      serviceSwitch(services, code))}
    <div class="stats">
      ${statTile('Cases', n(model.caseCount), `over ${n(model.windowDays)} days`)}
      ${statTile('Median total days', day(model.medianTotalDays), 'first to last event')}
      ${statTile('P90 total days', day(model.p90TotalDays), 'tail of the distribution')}
      ${statTile('Top-3 variant coverage', pct(model.coverageOfTopVariants), `${model.variants.length} variants discovered`)}
    </div>
    ${model.bottleneck ? h`<div class="callout"><span class="eyebrow">Bottleneck step</span>
      <p><strong>${heb(model.bottleneck.labels)}</strong> ${mono(model.bottleneck.activity)} waits a median of <strong>${day(model.bottleneck.medianWaitDays)} days</strong> (p90 ${day(model.bottleneck.p90WaitDays)}). Role: ${model.bottleneck.role ? heb(model.bottleneck.role) : 'unrecorded'}.</p>
    </div>` : ''}
    <section class="section">
      ${sectionHead('Variants', `Identical activity sequences collapse into one variant. The top three cover ${pct(model.coverageOfTopVariants)} of cases.`)}
      <div class="table-wrap"><table class="data variants-table">
        <thead><tr><th>Path</th><th class="num">Cases</th><th>Coverage</th><th class="num">Median days</th><th>Rework</th></tr></thead>
        <tbody>${model.variants.map((variant) => h`<tr>
          <td><div class="sequence">${variant.sequence.map((activity, index) =>
            h`${index ? h`<span class="arrow" aria-hidden="true">→</span>` : ''}<span class="chip activity" title="${activity}">${heb(labels.get(activity) ?? activity)}</span>`)}</div></td>
          <td class="num">${n(variant.caseCount)}</td>
          <td><div class="metric-bar">${bar(variant.coverageShare)}<span class="tiny muted">${pct(variant.coverageShare)}</span></div></td>
          <td class="num">${day(variant.medianDays)}</td>
          <td>${variant.hasRework ? badge('rework', 'candidate') : h`<span class="muted">—</span>`}</td>
        </tr>`)}</tbody>
      </table></div>
    </section>
    <section class="section">
      ${sectionHead('Steps by median wait', `Sorted by median wait. Bar length is relative to the longest step (${day(maxWait)} days).`)}
      <div class="table-wrap"><table class="data steps-table">
        <thead><tr><th>Step</th><th>Role</th><th>Median wait</th><th class="num">P90</th><th class="num">Events</th><th>Rework</th></tr></thead>
        <tbody>${steps.map((step) => h`<tr class="${step.activity === bottleneck ? 'bottleneck' : ''}">
          <td><div class="step-name">${heb(step.labels)}${mono(step.activity)}${step.activity === bottleneck ? badge('bottleneck', 'accent') : ''}</div></td>
          <td>${step.role ? heb(step.role) : h`<span class="muted">—</span>`}</td>
          <td><div class="metric-bar">${bar(maxWait ? step.medianWaitDays / maxWait : 0)}<b>${day(step.medianWaitDays)} d</b></div></td>
          <td class="num">${day(step.p90WaitDays)}</td><td class="num">${n(step.occurrences)}</td>
          <td>${step.isRework ? badge('rework', 'candidate') : h`<span class="muted">—</span>`}</td>
        </tr>`)}</tbody>
      </table></div>
    </section>
  `;
}

/* -------------------------------------------------------------- automations */
function proposalCard(proposal, processes, automations) {
  const ref = proposal.ref ?? '';
  const model = processes.find((entry) => entry.model.serviceCode === proposal.serviceCode)?.model;
  const step = model?.steps.find((candidate) => candidate.activity === proposal.step);
  const automation = automations.get(ref);
  const decision = state.approvals.get(ref) ?? null;
  const approved = Boolean(decision) || automation?.status === 'approved';
  const riskTone = proposal.risk === 'high' ? 'danger' : proposal.risk === 'medium' ? 'candidate' : 'ok';
  return h`<article class="card proposal-card ${approved ? 'is-approved' : ''}" data-proposal="${ref}">
    <div class="row-between">
      <div class="chips">${badge(String(proposal.kind ?? 'proposal').replaceAll('_', ' '))}${proposal.serviceCode ? badge(proposal.serviceCode, 'accent') : ''}${step ? h`<span class="chip">${heb(step.labels)}</span>` : proposal.step ? h`<span class="chip">${proposal.step}</span>` : ''}</div>
      <span class="proposal-status">${approved ? badge('approved', 'ok') : badge('proposed', 'candidate')}</span>
    </div>
    <h3 class="card-title">${proposal.title}</h3>
    <p class="mixed">${proposal.rationale}</p>
    <dl class="proposal-metrics">
      <div><dt>Expected cases / yr</dt><dd>${n(proposal.expectedCasesPerYear)}</dd></div>
      <div><dt>Time saved / case</dt><dd>${day(proposal.timeSavedDaysPerCase)} d</dd></div>
      <div><dt>Annual waiting days avoided</dt><dd>${n(proposal.annualDaysSaved)}</dd></div>
      <div><dt>Risk</dt><dd>${badge(proposal.risk ?? 'unrated', riskTone)}</dd></div>
    </dl>
    <div class="evidence"><h4>Evidence</h4><ul>${(proposal.evidence ?? []).map((item) => h`<li>${item}</li>`)}</ul></div>
    <div class="proposal-actions">${approved
      ? h`<div class="decision"><span class="eyebrow">Decision recorded</span>${decision ? mono(decision) : badge('approved', 'ok')}${automation?.approved_by ? h`<span class="tiny muted">${heb(automation.approved_by)}</span>` : ''}</div>`
      : h`<button type="button" class="btn" data-action="approve" data-ref="${ref}">Approve proposal</button>`}</div>
    <div class="action-error" role="alert"></div>
  </article>`;
}
function parametersSection(params) {
  const entries = Object.entries(params ?? {});
  if (!entries.length) return '';
  return h`<section class="section">
    ${sectionHead('Declared parameters', 'Every threshold that decides a proposal has a named owner. None is hidden in an if-statement.')}
    <div class="card params-card"><div class="table-wrap" style="border:0;border-radius:0"><table class="data">
      <thead><tr><th>Parameter</th><th>Value</th><th>Owner</th><th>Why this value</th></tr></thead>
      <tbody>${entries.map(([name, param]) => h`<tr>
        <td>${mono(name)}</td>
        <td><strong>${param.value}</strong>${typeof param.value === 'number' && param.value > 0 && param.value < 1 ? h`<span class="muted tiny"> · ${Math.round(param.value * 100)}%</span>` : ''}</td>
        <td>${heb(param.owner)}</td><td class="mixed">${param.reason}</td>
      </tr>`)}</tbody>
    </table></div></div>
  </section>`;
}
function automationsView({ overview, proposals, processes, automations }) {
  const params = processes[0]?.params ?? {};
  const primaryService = proposals[0]?.serviceCode ?? overview.services[0]?.code;
  return h`
    ${pageHead('Automation proposals', 'Where the measured wait can be removed',
      `${proposals.length} proposals from the discovered process. Approval records a decision in the graph; it does not configure or run an automation.`,
      h`<a class="btn ghost" href="#/workflows" data-service="${primaryService ?? ''}">Open workflow</a>`)}
    ${parametersSection(params)}
    <section class="section">
      ${sectionHead('Proposals', 'Each proposal rests on a measured step and on the declared assumptions above.')}
      ${proposals.length
        ? h`<div class="proposal-grid">${proposals.map((proposal) => proposalCard(proposal, processes, automations))}</div>`
        : h`<div class="empty-state">The API returned no automation proposals. The discovered process is available under Workflows.</div>`}
    </section>
  `;
}

/* --------------------------------------------------------------- onboarding */
function stepGroups(process, key) {
  const groups = process.filter((entry) => entry.steps[key]?.length);
  if (!groups.length) return h`<p class="tiny muted">None.</p>`;
  return groups.map((entry) => h`<div class="step-group"><p class="eyebrow">${entry.service_code}</p>
    <div class="chips">${entry.steps[key].map((activity) => h`<span class="chip" title="${activity}">${heb(entry.step_labels?.[activity] ?? activity)}</span>`)}</div></div>`);
}
function unitList(units) {
  if (!units.length) return h`<p class="tiny muted">None.</p>`;
  return h`<div class="unit-list">${units.map((unit) => h`<div class="unit-line">
    <div class="row-between"><strong>${heb(unit.name)}</strong><span class="muted tiny">${n(unit.headcount)} people</span></div>
    <p class="tiny muted">name_en: ${heb(unit.name_en)}</p>
    <div class="chips">${unit.roles.map((role) => h`<span class="chip">${heb(role)}</span>`)}</div>
  </div>`)}</div>`;
}
function onboardingView(data) {
  const diff = data.diff;
  const summary = diff.summary;
  const kinds = [['matched', 'Matched'], ['added', 'Added'], ['missing', 'Missing']];
  return h`
    ${pageHead('Onboarding template diff', h`<span dir="auto">${diff.target_organization}</span> learned from ${diff.source_template.organization}`,
      'Only the differences are proposed for review. The template carries structure, not people or records.',
      h`<a class="btn ghost" href="#/mapping">Source mapping</a>`)}
    <div class="stats coverage-stats">
      ${coverageTile('Unit coverage', summary.unit_coverage, `${diff.units.matched.length} of ${data.template.units.length} template units matched`)}
      ${coverageTile('Role coverage', summary.role_coverage, `${diff.roles.matched.length} matched · ${diff.roles.missing.length} missing`)}
      ${coverageTile('Step coverage', summary.step_coverage, `${summary.identical_steps} identical · ${summary.new_steps} new`)}
    </div>
    <section class="section"><div class="card template-strip">
      <div>
        <p class="eyebrow">Source template</p><h3>${diff.source_template.organization}</h3>
        <p class="small muted">${mono(diff.source_template.id)} · version ${diff.source_template.version}</p>
        <p class="tiny muted">${n(data.template.built_from.pages)} pages · built ${date(data.template.built_from.captured_at)}</p>
      </div>
      <span class="flow-arrow" aria-hidden="true">→</span>
      <div>
        <p class="eyebrow">Target organization</p><h3>${diff.target_organization}</h3>
        <p class="small muted">${n(data.second.stats.pages)} pages · ${n(data.second.stats.edges)} edges</p>
        <p class="tiny muted">${data.second.models.map((model) => `${model.code}: ${n(model.cases)} cases`).join(' · ')}</p>
      </div>
    </div></section>
    <section class="section">
      ${sectionHead('Units', 'A matched unit is either the same name or the same roles under another name. Weak matches stay unmatched rather than guessed.')}
      <div class="table-wrap"><table class="data matched-table">
        <thead><tr><th>Template unit</th><th>Target unit</th><th>Verdict</th><th>Similarity</th><th>Role overlap</th></tr></thead>
        <tbody>${diff.units.matched.map((match) => h`<tr>
          <td>${heb(match.template.name)}<div class="tiny muted">${n(match.template.headcount)} people</div></td>
          <td>${heb(match.target.name)}<div class="tiny muted">${n(match.target.headcount)} people</div></td>
          <td>${badge(match.verdict, match.verdict === 'same' ? 'ok' : 'candidate')}</td>
          <td><div class="metric-bar">${bar(match.similarity)}<span class="tiny muted">${pct(match.similarity)}</span></div></td>
          <td><div class="metric-bar">${bar(match.roleOverlap)}<span class="tiny muted">${pct(match.roleOverlap)}</span></div></td>
        </tr>`)}</tbody>
      </table></div>
      <div class="grid-2" style="margin-top:14px">
        <div class="card"><div class="row-between"><h3 class="card-title">Added units</h3>${badge(`${diff.units.added.length} added`, 'candidate')}</div><p class="tiny muted" style="margin:3px 0 7px">Present in the target, absent from the template.</p>${unitList(diff.units.added)}</div>
        <div class="card"><div class="row-between"><h3 class="card-title">Missing units</h3>${badge(`${diff.units.missing.length} missing`)}</div><p class="tiny muted" style="margin:3px 0 7px">In the template, not found in the target.</p>${unitList(diff.units.missing)}</div>
      </div>
    </section>
    <section class="section">
      ${sectionHead('Roles, services and steps', 'A three-column diff. Steps stay grouped by service so each code keeps its process context.')}
      <div class="diff-grid">${kinds.map(([key, label]) => h`<div class="diff-col ${key}">
        <header><h4>${label}</h4><span class="muted tiny">${diff.roles[key].length} roles</span></header>
        <div class="diff-block"><h5>Roles</h5>${list(diff.roles[key].map((role) => heb(role)))}</div>
        <div class="diff-block"><h5>Services</h5>${list(diff.services[key].map((service) => mono(service)))}</div>
        <div class="diff-block"><h5>Process steps</h5>${stepGroups(diff.process, key)}</div>
      </div>`)}</div>
    </section>
    <section class="section">
      ${sectionHead('Proposed overlay', 'Additive only. This is the change a person reviews; it does not edit the shared packs.')}
      <div class="card"><pre class="code-block">${JSON.stringify(diff.proposed_overlay, null, 2)}</pre></div>
    </section>
  `;
}

/* ------------------------------------------------------------------- access */
function labelTone(label) {
  if (/restricted/i.test(label)) return 'danger';
  if (/confidential/i.test(label)) return 'candidate';
  if (/public/i.test(label)) return 'ok';
  return '';
}
function accessView({ viewers, security }) {
  const current = viewers.find((viewer) => viewer.id === state.viewer) ?? viewers[0] ?? null;
  const visibleDocuments = security.documents.filter((document) => !document.hidden);
  const hiddenCount = security.documents.length - visibleDocuments.length;
  return h`
    ${pageHead('Access', 'The same document, seen by different people',
      'Access mirrors the source. The selected viewer is passed to the API; facts behind a document the viewer cannot see are removed from the response.',
      h`<a class="btn ghost" href="#/overview">Back to findings</a>`)}
    ${findingsBanner(security.findings, false)}
    <section class="card viewer-card section">
      <div class="viewer-control">
        <label for="viewer-select">Viewing as</label>
        <select id="viewer-select" data-action="viewer">${viewers.map((viewer) =>
          h`<option value="${viewer.id}" ${viewer.id === state.viewer ? raw('selected') : ''}>${viewer.label}</option>`)}</select>
      </div>
      <p class="viewer-meta">${current ? heb(current.label) : 'No viewer'} · clearance ${n(current?.clearance)} · ${n(visibleDocuments.length)} of ${n(security.documents.length)} documents visible</p>
      <p class="muted small">${hiddenCount ? `${n(hiddenCount)} document${hiddenCount === 1 ? '' : 's'} hidden for this viewer.` : 'No documents are hidden for this viewer.'} A head-level viewer sees everything; other viewers are filtered by the source permission lists.</p>
    </section>
    <section class="section">
      ${sectionHead('Documents', 'The document list itself is deliberately unfiltered so the difference is visible. Visibility is derived from the source permissions, not from a separate policy.')}
      ${security.documents.length
        ? h`<div class="table-wrap"><table class="data doc-table">
          <thead><tr><th>Document</th><th>Label</th><th class="num">Extracted facts</th><th>Flags</th><th>Access for this viewer</th></tr></thead>
          <tbody>${security.documents.map((document) => h`<tr class="${document.hidden ? 'is-hidden' : ''}">
            <td><span class="doc-name" dir="auto">${document.name}</span>${document.hidden ? h`<div class="tiny muted">${mono(document.ref)}</div>` : ''}</td>
            <td><span class="badge ${labelTone(document.label)}">${document.label}</span></td>
            <td class="num">${n(document.facts)}</td>
            <td>${document.flags ? badge(`${document.flags} finding`, 'danger') : h`<span class="muted">—</span>`}</td>
            <td>${document.hidden ? badge('hidden', 'danger') : badge('visible', 'ok')}</td>
          </tr>`)}</tbody>
        </table></div>`
        : h`<div class="empty-state">The API returned no documents.</div>`}
      <div class="chips" style="margin-top:10px">${sortedEntries(security.labelCounts).map(([label, count]) =>
        h`<span class="chip">${label}<span class="count">${n(count)}</span></span>`)}</div>
    </section>
  `;
}

/* ----------------------------------------------------------------- actions */
async function acceptCandidate(button) {
  const card = button.closest('.candidate-card');
  const id = button.dataset.id;
  button.disabled = true;
  button.textContent = 'Accepting…';
  try {
    const result = await postJson('/api/candidates/accept', { id });
    state.overlays.set(id, result.overlayDraft);
    if (!card) return;
    $('.candidate-status', card).innerHTML = h`${badge('accepted', 'ok')}`;
    $('.candidate-actions', card).innerHTML = h`${badge('accepted', 'ok')}`;
    $('.candidate-overlay-slot', card).innerHTML = overlayBlock(result.overlayDraft);
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Accept candidate';
    const target = card ? $('.action-error', card) : null;
    if (target) target.textContent = error.message;
  }
}
async function approveProposal(button) {
  const card = button.closest('.proposal-card');
  const ref = button.dataset.ref;
  button.disabled = true;
  button.textContent = 'Approving…';
  try {
    const result = await postJson(`/api/automations/${encodeURIComponent(ref)}/approve`, {});
    state.approvals.set(ref, result.decision);
    if (!card) return;
    card.classList.add('is-approved');
    $('.proposal-status', card).innerHTML = h`${badge('approved', 'ok')}`;
    $('.proposal-actions', card).innerHTML = h`<div class="decision"><span class="eyebrow">Decision recorded</span>${mono(result.decision ?? 'approved')}</div>`;
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Approve proposal';
    const target = card ? $('.action-error', card) : null;
    if (target) target.textContent = error.message;
  }
}
function applyCoverageFilter() {
  const panel = $('#panel');
  $$('[data-coverage-row]', panel).forEach((row) => {
    const filter = state.coverageFilter;
    row.hidden = !(filter === 'all' || (filter === 'mapped' && row.dataset.mapped === '1') || (filter === 'gaps' && row.dataset.gap === '1'));
  });
  $$('[data-action="coverage-filter"]', panel).forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === state.coverageFilter));
  });
}
function renderSearchResults() {
  const target = $('#search-results');
  if (target) target.innerHTML = searchResultsView();
}
async function runSearch(form) {
  const input = $('input[name="q"]', form);
  const query = input.value.trim();
  const seq = ++state.search.seq;
  state.search = { q: query, ran: Boolean(query), loading: Boolean(query), error: null, results: [], seq };
  renderSearchResults();
  if (!query) return;
  try {
    const data = await fetchJson('/api/search', { q: query });
    if (seq !== state.search.seq) return;
    state.search.loading = false;
    state.search.results = data.results ?? [];
    renderSearchResults();
  } catch (error) {
    if (seq !== state.search.seq) return;
    state.search.loading = false;
    state.search.error = error.message;
    renderSearchResults();
  }
}
function onPanelClick(event) {
  const actionElement = event.target.closest('[data-action]');
  if (actionElement) {
    const action = actionElement.dataset.action;
    if (action === 'service') {
      state.service = actionElement.dataset.service;
      state.focusService = state.service;
      renderTab();
      return;
    }
    if (action === 'retry') { cache.clear(); renderTab(); return; }
    if (action === 'coverage-filter') { state.coverageFilter = actionElement.dataset.filter; applyCoverageFilter(); return; }
    if (action === 'accept') { acceptCandidate(actionElement); return; }
    if (action === 'approve') { approveProposal(actionElement); return; }
    if (action === 'open-interview') { openInterviewFor(actionElement.dataset.gap); return; }
    if (action === 'ask-suggestion') {
      const form = $('form[data-form="ask"]');
      if (!form) return;
      const input = $('input[name="q"]', form);
      input.value = actionElement.dataset.q ?? '';
      runAsk(form);
      return;
    }
  }
  const serviceLink = event.target.closest('[data-service]');
  if (serviceLink) state.service = serviceLink.dataset.service;
}
function onPanelChange(event) {
  if (!event.target.matches('[data-action="viewer"]')) return;
  state.viewer = event.target.value;
  state.focusViewer = true;
  renderTab();
}
function onPanelSubmit(event) {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  if (form.dataset.form === 'search') runSearch(form);
  if (form.dataset.form === 'ask') runAsk(form);
  if (form.dataset.form === 'answer') submitInterview(form);
}


/* --------------------------------------------------------------------- ask */
async function loadAsk() {
  const [answer, rules] = await Promise.all([
    state.ask.answer ? Promise.resolve(state.ask.answer) : fetchJson('/api/answer'),
    fetchJson('/api/rules'),
  ]);
  return { answer, rules };
}
async function runAsk(form) {
  const input = $('input[name="q"]', form);
  const question = input.value.trim();
  if (!question) return;
  const errorBox = $('.action-error', form);
  if (errorBox) errorBox.textContent = '';
  state.ask = { answer: null, error: null };
  try {
    const answer = await postJson('/api/ask', { question });
    state.ask.answer = answer;
    renderTab();
  } catch (error) {
    state.ask.error = error.message;
    if (errorBox) errorBox.textContent = error.message;
  }
}
function askView({ answer, rules }) {
  const a = state.ask.answer ?? answer;
  const counts = a.counts ?? {};
  const isRule = Boolean(a.rule);
  const current = isRule ? rules.rules.find((rule) => rule.code === a.rule.code && rule.version === a.rule.version) : null;
  const criteria = current?.criteria ?? [];
  const sources = (a.sources ?? []).map((source) => source.label).join(' · ');
  return h`
    ${pageHead('Ask the record', 'A question, the rule behind it, and what could not be decided',
      'Answers are computed from the graph with the rule version in force. Unknown is reported, never folded into a zero: it is the list of gaps the next interview or lookup has to close.')}
    <section class="section">
      <form class="search-form" data-form="ask" role="form">
        <label for="ask-input">Question</label>
        <div class="search-row">
          <input id="ask-input" name="q" type="search" value="${a.question ?? ''}" placeholder="How many households are eligible for the sanitation fee discount?" autocomplete="off" />
          <button class="btn" type="submit">Ask</button>
        </div>
        <div class="chips suggestion-row">${(rules.suggested ?? []).map((question) => h`<button type="button" class="chip activity suggestion" data-action="ask-suggestion" data-q="${question}">${question}</button>`)}</div>
        <p class="action-error" role="alert"></p>
      </form>
    </section>
    ${a.refused ? h`<section class="banner warn"><div class="banner-body"><p class="eyebrow">Not answered</p><h3>${a.refused}</h3><p>The planner refuses rather than guessing, and nothing was executed.</p></div></section>` : ''}
    ${!a.refused && isRule ? h`
      <section class="section">
        <div class="stats">
          ${statTile('Eligible', n(counts.eligible), 'households')}
          ${statTile('Not eligible', n(counts.notEligible), 'households')}
          ${statTile('Unknown', n(counts.unknown), a.unknownReasons.length ? 'missing ' + a.unknownReasons.map((reason) => reason.property).join(', ') : 'nothing missing')}
          ${statTile('Total', n(counts.total), 'rule v' + a.rule.version)}
        </div>
        ${a.suppression?.applied ? h`<p class="tiny muted note-line">Suppressed: the minimum cell size is ${a.suppression.minCellSize}, declared by ${heb(a.suppression.owner)}.</p>` : ''}
      </section>
      <section class="section">
        ${sectionHead('The rule that decided it', 'A count without its rule version is not an answer.')}
        <div class="card">
          <div class="row-between">
            <div><p class="eyebrow">${a.rule.code}</p><h3 class="card-title">${a.rule.citation}</h3></div>
            <div class="chips">${badge('v' + a.rule.version)}${badge(a.rule.status, 'ok')}</div>
          </div>
          <dl class="proposal-metrics">
            <div><dt>Owner</dt><dd>${heb(a.rule.owner)}</dd></div>
            <div><dt>In force from</dt><dd>${date(a.rule.effective_from)}</dd></div>
            <div><dt>Combination</dt><dd>${a.rule.logic === 'any' ? 'any ground qualifies' : 'every ground required'}</dd></div>
          </dl>
          <div class="table-wrap inline-table"><table class="data">
            <thead><tr><th>Ground</th><th>Reads</th><th>Operator</th><th>Value</th></tr></thead>
            <tbody>${criteria.map((criterion) => h`<tr>
              <td>${criterion.label_en} <span class="tiny muted">${heb(criterion.label_he)}</span></td>
              <td>${mono(criterion.property)}</td><td>${mono(criterion.operator)}</td><td>${mono(String(criterion.value))}</td>
            </tr>`)}</tbody>
          </table></div>
        </div>
      </section>` : ''}
    ${!a.refused && !isRule && counts.value != null ? h`
      <section class="section"><div class="stats">${statTile('Count', n(counts.value), a.plan.entity + ' pages')}</div></section>` : ''}
    ${a.unknownReasons.length ? h`
      <section class="section">
        ${sectionHead('What could not be decided', 'Every unknown has a cause, and each cause is already a knowledge candidate in the graph.')}
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Missing attribute</th><th>Ground</th><th class="num">Households</th><th>Next step</th></tr></thead>
          <tbody>${a.unknownReasons.map((reason) => h`<tr>
            <td>${mono(reason.property)}</td>
            <td>${reason.label_en} <span class="tiny muted">${heb(reason.label_he)}</span></td>
            <td class="num">${n(reason.count)}</td>
            <td>${badge('gap → interview or lookup', 'candidate')}</td>
          </tr>`)}</tbody>
        </table></div>
      </section>` : ''}
    <section class="section">
      ${sectionHead('Explain', 'The plan, the steps, and what was not checked.')}
      <div class="card explain-card">
        <p class="eyebrow">Plan</p>
        <pre class="code-block">${JSON.stringify(a.explain.plan, null, 2)}</pre>
        <p class="eyebrow">Steps</p>
        <ol class="steps">${(a.explain.steps ?? []).map((step) => h`<li>${step}</li>`)}</ol>
        <p class="eyebrow">What was not checked</p>
        <ul class="steps">${(a.explain.whatWasNotChecked ?? []).map((step) => h`<li>${step}</li>`)}</ul>
        <p class="tiny muted">Sources: ${sources || 'none'} · data captured ${date(a.freshness)} · answer ${mono(a.answer_id)}</p>
      </div>
    </section>`;
}


/* ------------------------------------------------------------------- learn */
async function openInterviewFor(gapRef) {
  if (!gapRef) return;
  cache.clear();
  try {
    await postJson('/api/interviews/open', { gapRef });
  } catch (error) {
    state.learn.result = { error: error.message };
  }
  renderTab();
}
async function submitInterview(form) {
  const ref = form.dataset.ref;
  const answers = {};
  for (const field of Array.from(form.querySelectorAll('[data-question]'))) {
    if (field.value) answers[field.dataset.question] = field.value;
  }
  const button = $('button[type="submit"]', form);
  if (button) button.disabled = true;
  try {
    const result = await postJson('/api/interviews/answer', { ref, answers });
    state.learn.result = result;
    cache.clear();
    renderTab();
  } catch (error) {
    if (button) button.disabled = false;
    const box = $('.action-error', form);
    if (box) box.textContent = error.message;
  }
}
function interviewCard(interview, last) {
  const isOpen = interview.status === 'open';
  const answer = last && last.interview?.ref === interview.ref ? last : null;
  return h`<article class="card interview-card">
    <div class="row-between">
      <div><p class="eyebrow">${isOpen ? 'Open interview' : 'Answered'}</p><h3 class="card-title">${interview.gapSummary}</h3></div>
      <div class="chips">${badge(interview.status, isOpen ? 'candidate' : 'ok')}${badge(interview.attentionCost + ' questions')}</div>
    </div>
    <p class="small muted">To ${heb(interview.personName)} · ${heb(interview.personTitle)} · delivered ${date(interview.deliveredAt)}</p>
    ${isOpen ? h`<form class="answer-form" data-form="answer" data-ref="${interview.ref}">
      ${interview.questions.map((question) => h`<div class="question">
        <label for="q-${question.id}">${heb(question.prompt_he)}<span class="tiny muted"> ${question.prompt_en}</span></label>
        <select id="q-${question.id}" data-question="${question.id}">
          ${(question.options ?? []).map((option) => h`<option value="${option}" ${option === question.prefill ? 'selected' : ''}>${heb(option)}</option>`)}
        </select>
        <p class="tiny muted">Prefilled: ${heb(question.prefill ?? '')} · ${question.prefill_source ?? ''}</p>
      </div>`)}
      <div class="row-between"><button class="btn" type="submit">Send answers</button><span class="tiny muted">Answering is optional; declining is a valid answer.</span></div>
      <p class="action-error" role="alert"></p>
    </form>` : h`<dl class="proposal-metrics">
      ${Object.entries(interview.answers).map(([key, value]) => h`<div><dt>${key.replaceAll('_', ' ')}</dt><dd>${heb(value)}</dd></div>`)}
      <div><dt>Yield</dt><dd>${pct(interview.yieldRate)}</dd></div>
      <div><dt>Answered</dt><dd>${date(interview.answeredAt)}</dd></div>
    </dl>`}
    ${answer?.contradiction ? h`<div class="banner warn" style="margin-top:12px"><div class="banner-body">
      <p class="eyebrow">Contradiction recorded</p><h3>${answer.contradiction}</h3>
      <p>What-if with the proposed policy: <strong>${n(answer.whatIf.eligible)}</strong> eligible · <strong>${n(answer.whatIf.notEligible)}</strong> not eligible · <strong>${n(answer.whatIf.unknown)}</strong> unknown. The rule owner still has to approve it.</p>
    </div></div>` : ''}
  </article>`;
}
function learnView(data) {
  const interviews = data.interviews ?? [];
  const open = interviews.filter((interview) => interview.status === 'open');
  const answered = interviews.filter((interview) => interview.status !== 'open');
  return h`
    ${pageHead('Learn from people', 'The gap queue, and the shortest form that closes it',
      'The system asks one person at most one open question at a time. Answers become evidence; an answer that contradicts a rule becomes a proposed rule change with its what-if counts, which a person still approves.')}
    <div class="stats">
      ${statTile('Open gaps', n((data.gaps ?? []).length), 'knowledge candidates')}
      ${statTile('Open interviews', n(open.length), 'one per person')}
      ${statTile('Answered', n(answered.length), 'answers kept as evidence')}
      ${statTile('Attention budget', n(data.attention?.maxOpenPerPerson?.value ?? 1), 'open interview per person')}
    </div>
    <section class="section">
      ${sectionHead('Gap queue', 'Every gap names what it blocks and what would close it.')}
      <div class="candidate-grid">${(data.gaps ?? []).map((gap) => h`<article class="card">
        <div class="row-between"><span class="badge candidate">${gap.proposal?.property ?? 'gap'}</span><span class="tiny muted">${n(gap.support)} blocked</span></div>
        <p class="small">${gap.summary}</p>
        <button class="btn ghost" type="button" data-action="open-interview" data-gap="${gap.ref}">Generate an interview</button>
      </article>`)}</div>
    </section>
    <section class="section">
      ${sectionHead('Interviews', 'Generated from the gap, never hand-written.')}
      <div class="interview-list">${interviews.length ? interviews.map((interview) => interviewCard(interview, state.learn.result)) : h`<p class="tiny muted">No interviews yet. Generate one from a gap.</p>`}</div>
    </section>`;
}

/* ----------------------------------------------------------------- loaders */


async function loadWorkflows() {
  const overview = await fetchJson('/api/overview');
  const codes = overview.services.map((service) => service.code);
  const code = codes.includes(state.service) ? state.service : codes[0];
  if (!code) throw new Error('The overview response lists no services.');
  state.service = code;
  const data = await fetchJson('/api/process', { service: code });
  return { services: overview.services, code, data };
}
async function loadAutomations() {
  const overview = await fetchJson('/api/overview');
  const processes = await Promise.all(overview.services.map((service) => fetchJson('/api/process', { service: service.code })));
  const proposals = processes.flatMap((process) => process.proposals ?? []);
  const automations = new Map();
  for (const process of processes) for (const automation of process.automations ?? []) automations.set(automation.ref, automation);
  return { overview, proposals, processes, automations };
}
async function loadAccess() {
  const data = await fetchJson('/api/viewers');
  const viewers = data.viewers ?? [];
  if (!viewers.some((viewer) => viewer.id === state.viewer)) state.viewer = viewers[0]?.id ?? null;
  const security = await fetchJson('/api/security', state.viewer ? { viewer: state.viewer } : {});
  const hidden = new Map((security.exampleHidden ?? []).map((document) => [document.ref, document]));
  return {
    viewers,
    security: { ...security, documents: (security.documents ?? []).map((document) => ({ ...document, hidden: hidden.has(document.ref) })) },
  };
}
const LOADERS = {
  overview: () => fetchJson('/api/overview'),
  ask: loadAsk,
  learn: () => fetchJson('/api/interviews'),
  mapping: () => fetchJson('/api/mapping'),
  organization: () => fetchJson('/api/org'),
  workflows: loadWorkflows,
  automations: loadAutomations,
  onboarding: () => fetchJson('/api/onboard'),
  access: loadAccess,
};
const VIEWS = {
  overview: overviewView, ask: askView, learn: learnView, mapping: mappingView, organization: organizationView,
  workflows: workflowsView, automations: automationsView, onboarding: onboardingView, access: accessView,
};

/* -------------------------------------------------------------------- boot */
function boot() {
  buildTabs();
  const tab = currentTab();
  state.tab = tab;
  if (!location.hash) history.replaceState(null, '', `#/${tab}`);
  activateTab(tab);
  $('#tabs').addEventListener('click', (event) => {
    const button = event.target.closest('[role="tab"]');
    if (!button) return;
    const target = `#/${button.dataset.tab}`;
    if (location.hash === target) return;
    location.hash = target;
  });
  $('#tabs').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = $$('#tabs [role="tab"]');
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : event.key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  });
  window.addEventListener('hashchange', goToHash);
  $('#panel').addEventListener('click', onPanelClick);
  $('#panel').addEventListener('change', onPanelChange);
  $('#panel').addEventListener('submit', onPanelSubmit);
  loadShell();
  renderTab();
}
boot();