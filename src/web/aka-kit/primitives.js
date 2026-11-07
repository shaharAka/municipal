// Adapted from aka-food/aka-new-platform @ 776496e:
// web/src/kit/layout/Bits.tsx (StatusDot, Facts) and layout/Page.tsx.
// This POC uses native DOM modules. Tokens are copied verbatim; these renderers
// preserve the kit's semantics without bringing its React/Radix runtime here.
import { esc } from '../ui.js';

export function statusDot(tone, label) {
  return `<span class="aka-status-dot aka-status-${tone}"><i aria-hidden="true"></i>${esc(label)}</span>`;
}

export function pageHeading(title, description = '', accessory = '') {
  return `<div class="page-heading"><div><h1 tabindex="-1">${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ''}</div>${accessory}</div>`;
}

export function facts(rows) {
  return `<dl class="record-facts">${rows.map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
}
