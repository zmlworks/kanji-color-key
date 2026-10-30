import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const app = readFileSync('web/app.html', 'utf8'), docs = readFileSync('docs/index.html', 'utf8');

test('web: errors and decoded candidates are not written with innerHTML', () => {
  assert.doesNotMatch(app, /innerHTML\s*=\s*`?[^;]*e\.message/);
  assert.doesNotMatch(app, /\$\('decOut'\)\.innerHTML/);
});
test('docs/index.html: CSP allows exactly its own inline scripts and no network', () => {
  const m = docs.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, 'CSP meta present'); const csp = m[1];
  assert.match(csp, /default-src 'none'/); assert.doesNotMatch(csp, /unsafe-inline'[^;]*;?\s*$|script-src[^;]*unsafe/);
  const hashes = [...docs.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(s => `'sha256-${createHash('sha256').update(s[1], 'utf8').digest('base64')}'`);
  assert.ok(hashes.length >= 2);
  for (const h of hashes) assert.ok(csp.includes(h), 'hash of every inline script is in the CSP (rebuild docs with npm run build)');
  assert.doesNotMatch(docs.replace(/<script>[\s\S]*?<\/script>/g, ''), /\son[a-z]+\s*=\s*["']/i, 'no inline event handler attributes');
});
