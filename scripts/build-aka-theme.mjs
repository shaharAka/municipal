import { writeFile } from 'node:fs/promises';
import { tokens } from '../src/design/aka-kit/theme/tokens.ts';
import { cssVariables } from '../src/design/aka-kit/theme/cssVariables.ts';

// The copied AKA token source is authoritative; browser outputs are generated.
const notice = 'Generated from aka-food/aka-new-platform @ 776496e, web/src/kit/theme. Run npm run theme:build.';
await writeFile(new URL('../src/web/aka-kit/theme.css', import.meta.url), `/* ${notice} */\n:root {\n${Object.entries(cssVariables).map(([key, value]) => `  ${key}: ${value};`).join('\n')}\n}\n`);
await writeFile(new URL('../src/web/aka-kit/tokens.js', import.meta.url), `// ${notice}\nexport const tokens = ${JSON.stringify(tokens, null, 2)};\n`);
