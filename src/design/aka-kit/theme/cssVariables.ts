// Imported from aka-food/aka-new-platform @ 776496e, web/src/kit/theme/cssVariables.ts.
// Only change: explicit .ts import for Node’s native TypeScript loader.
/**
 * Ours. The design tokens as CSS custom properties.
 *
 * `cssVariables` is the flat map written onto :root by KitProvider (`--aka-colors-accent-main: #27a4f5`),
 * and `vars` mirrors the token tree with `var(--aka-…)` references, so styled components and plain CSS
 * read the same values and a theme switch is one place.
 */
import { tokens } from './tokens.ts';

type Leaf = string | number;
type VarTree<T> = { readonly [K in keyof T]: T[K] extends Leaf ? string : VarTree<T[K]> };

const PREFIX = '--aka';

function slug(key: string | number): string {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

function walk(node: unknown, path: string[], out: Record<string, string>): unknown {
  if (typeof node === 'string' || typeof node === 'number') {
    const name = `${PREFIX}-${path.map(slug).join('-')}`;
    out[name] = String(node);
    return `var(${name})`;
  }
  const mirror: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    mirror[key] = walk(value, [...path, key], out);
  }
  return mirror;
}

const flat: Record<string, string> = {};
const tree = walk(tokens, [], flat) as VarTree<typeof tokens>;

/** Every token as a CSS custom property, e.g. `--aka-colors-accent-main`. */
export const cssVariables: Readonly<Record<string, string>> = flat;

/** The token tree as `var(--aka-…)` references, for styles. */
export const vars = tree;
