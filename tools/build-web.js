// Build docs/index.html: inline src/kck.js, data/pool.json, data/kana.json and the favicon into web/app.html
// (single offline file). docs/apple-touch-icon.png sits next to it (used only when the page is online).
import { readFileSync, writeFileSync } from 'node:fs';
const core = readFileSync('src/kck.js', 'utf8').replace(/^export /gm, '');
const pool = readFileSync('data/pool.json', 'utf8');
const kana = readFileSync('data/kana.json', 'utf8');
const favicon = 'data:image/png;base64,' + readFileSync('docs/favicon-64.png').toString('base64');
const html = readFileSync('web/app.html', 'utf8').replace('/*__CORE__*/', () => core).replace('/*__POOL__*/', () => pool)
  .replace('/*__KANA__*/', () => kana).replaceAll('/*__FAVICON__*/', () => favicon);
writeFileSync('docs/index.html', html);
console.log('docs/index.html', html.length);
