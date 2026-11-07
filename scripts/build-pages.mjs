// Builds a static copy of the transport demo for GitHub Pages: the screens as they are, plus a
// browser bundle of the engine that answers the screens' requests. Output: dist/pages.
import { build } from 'esbuild';
import { mkdir, rm, copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist/pages');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

await build({
  entryPoints: [join(root, 'src/static/static-api.ts')],
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true,
  outfile: join(out, 'static-api.js'),
  define: { 'process.env.ANTHROPIC_API_KEY': '""' },
  external: ['@anthropic-ai/sdk'],
  plugins: [{
    name: 'browser-shims',
    setup(b) {
      b.onResolve({ filter: /ontology\/compose\.ts$/ }, () => ({ path: join(root, 'src/static/shims/compose.ts') }));
      b.onResolve({ filter: /graph\/graph\.ts$/ }, () => ({ path: join(root, 'src/static/shims/graph.ts') }));
    },
  }],
  logLevel: 'warning',
});

// The screens' own scripts, bundled so that everything they import comes along.
await build({ entryPoints: [join(root, 'src/web/transport.js'), join(root, 'src/web/driver.js')], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, outdir: out, logLevel: 'warning' });
for (const f of ['transport.css', 'driver.css']) await copyFile(join(root, 'src/web', f), join(out, f));
// The browser key for Google Maps, if the build has one (a repository secret); without it the map falls back.
await writeFile(join(out, 'config.js'), `globalThis.__MAPS_KEY = ${JSON.stringify(process.env.GOOGLE_MAPS_BROWSER_KEY || '')};\n`);
// Every deploy gets its own version on the files, so a browser never mixes a new page with old cached scripts.
const v = process.env.GITHUB_SHA?.slice(0, 8) || Date.now().toString(36);
const shim = `<script src="./config.js?v=${v}"></script><script type="module" src="./static-api.js?v=${v}"></script>`;
for (const page of ['transport.html', 'driver.html']) {
  let html = await readFile(join(root, 'src/web', page), 'utf8');
  html = html.replace(/(href|src)="\.\/([\w-]+\.(?:css|js))"/g, `$1="./$2?v=${v}"`);
  const first = html.indexOf('<script');
  await writeFile(join(out, page), html.slice(0, first) + shim + '\n    ' + html.slice(first));
}
await writeFile(join(out, 'index.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=./transport.html#/rides"><title>הסעות · מועצה אזורית גולן</title><a href="./transport.html#/rides">לדמו</a>\n');
await writeFile(join(out, '.nojekyll'), '');
console.log('built', out);
