#!/usr/bin/env node
import * as K from '../src/kck.js';
import { pool } from '../src/pool-node.js';
const [cmd, ...args] = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const USAGE = `usage:
  kck encode <hex> [--check N]          encode hex data
  kck encode-bits <0101...> [--check N] encode arbitrary bit string
  kck random [--bits 256] [--check N]   generate a random key and encode it
  kck hash <passphrase> [--salt S] [--iter N]  derive 256-bit key (PBKDF2-SHA256) and encode it
  kck decode "<text>"                   decode; supports ? (unknown color), (..) shifted block, [..] permuted block
  kck pretty "<text>"                   show stroke-by-stroke color names`;
const show = (r) => { console.log(r.text); console.error(`# ${r.tokens.filter(t => t.type === 'kanji').length} kanji, ${r.tokens.filter(t => t.type === 'hex').length} hex, ${r.totalBits} bits`); };
const check = () => { const c = opt('--check'); return { checkBits: c === undefined ? K.DEFAULT_CHECK_BITS : +c }; };
try {
  if (cmd === 'encode') { const o = check(); show(K.encodeHex(pool, args[0] ?? '', o)); }
  else if (cmd === 'encode-bits') { const o = check(); show(K.encodeBits(pool, K.parseBitString(args[0] ?? ''), o)); }
  else if (cmd === 'random') { const n = +(opt('--bits') ?? 256), o = check(); const b = K.randomBits(n); console.log(K.bitsToHex(b)); show(K.encodeBits(pool, b, o)); }
  else if (cmd === 'hash') {
    const salt = opt('--salt') ?? '', iter = +(opt('--iter') ?? K.KDF_ITERATIONS), o = check();
    const key = await K.deriveKey(args[0] ?? '', { salt, iterations: iter });
    console.log(K.bitsToHex(K.bytesToBits(key))); show(K.encodeBits(pool, K.bytesToBits(key), o));
  } else if (cmd === 'decode') {
    const r = K.decodeText(pool, args.join(''));
    console.error(`# ${r.tried} combinations tried, ${r.candidates.length} passed the ${r.checkBits}-bit check`);
    for (const c of r.candidates) console.log(c.hex + '\t' + c.text);
    process.exitCode = r.candidates.length === 1 ? 0 : 2;
  } else if (cmd === 'pretty') {
    for (const t of K.parseText(pool, args.join('')).tokens)
      console.log(t.char + '  ' + [...t.spec].map(c => K.COLORS[+c] ?? c).join(' '));
  } else { console.log(USAGE); process.exitCode = cmd ? 1 : 0; }
} catch (e) { console.error('error: ' + e.message); process.exitCode = 1; }
