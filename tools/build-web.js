// Build docs/index.html: inline src/kck.js, data/pool.json, data/kana.json and the favicon into web/app.html
// (single offline file). docs/apple-touch-icon.png sits next to it (used only when the page is online).
// The Content-Security-Policy allows only the page's own inline scripts (by SHA-256 hash), no network access.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const core = readFileSync('src/kck.js', 'utf8').replace(/^export /gm, '');
const pool = readFileSync('data/pool.json', 'utf8');
const kana = readFileSync('data/kana.json', 'utf8');
const favicon = 'data:image/png;base64,' + readFileSync('docs/favicon-64.png').toString('base64');
let html = readFileSync('web/app.html', 'utf8').replace('/*__CORE__*/', () => core).replace('/*__POOL__*/', () => pool)
  .replace('/*__KANA__*/', () => kana).replaceAll('/*__FAVICON__*/', () => favicon);
if (/\son[a-z]+\s*=\s*["']/i.test(html.replace(/<script>[\s\S]*?<\/script>/g, ''))) throw new Error('inline event handler attribute found (blocked by the CSP)');
const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(m => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
const csp = [`default-src 'none'`, `script-src ${hashes.join(' ')}`, `style-src 'unsafe-inline'`, `img-src 'self' data:`,
  `base-uri 'none'`, `form-action 'none'`].join('; ');
if (!html.includes('/*__CSP__*/')) throw new Error('CSP placeholder missing');
html = html.replace('/*__CSP__*/', () => csp);
writeFileSync('docs/index.html', html);
console.log('docs/index.html', html.length, csp.replace(/'sha256-[^']+'/g, 'sha256-…'));
