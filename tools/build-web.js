// Build docs/index.html: inline src/kck.js and data/pool.json into web/app.html (single offline file).
import { readFileSync, writeFileSync } from 'node:fs';
const core = readFileSync('src/kck.js', 'utf8').replace(/^export /gm, '');
const pool = readFileSync('data/pool.json', 'utf8');
const html = readFileSync('web/app.html', 'utf8').replace('/*__CORE__*/', () => core).replace('/*__POOL__*/', () => pool);
writeFileSync('docs/index.html', html);
console.log('docs/index.html', html.length);
