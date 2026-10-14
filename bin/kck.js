#!/usr/bin/env node
import * as K from '../src/kck.js';
import { pool } from '../src/pool-node.js';
const argv = process.argv.slice(2);
const alpha = argv.includes('--alpha');
const pi = argv.indexOf('--phrase'), phrase = pi >= 0 ? argv.splice(pi, 2)[1] : undefined;
const mt = argv.indexOf('--max-tail'), maxTail = mt >= 0 ? +argv.splice(mt, 2)[1] : Infinity;
const [cmd, ...args] = argv.filter(a => a !== '--alpha');
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const USAGE = `usage:
  kck encode <hex> [--check N]          encode hex data
  kck encode-bits <0101...> [--check N] encode arbitrary bit string
  kck random [--bits 256] [--check N]   generate a random key and encode it
  kck hash <passphrase> [--salt S] [--iter N]  derive 256-bit key (PBKDF2-SHA256) and encode it
  kck decode "<text>"                   decode; supports ? (unknown color), (..) shifted block, [..] permuted block
  --alpha                               use alpha mode (32 glyphs 2345679ABCDEFGHIJKLMNOPQRSTVWXYZ x 4 colors = 7 bit/symbol)
                                        (decode/pretty auto-detect the A(...) header)
  --phrase 国破山河在城春草木深        phrase mode: fixed kanji, bits in stroke colors, rest as alpha tail
  --max-tail N                          (phrase) fail if more than N alpha tail symbols are needed
  kck capacity <phrase>                 strokes / bits a phrase provides
  kck pretty "<text>"                   show stroke-by-stroke color names`;
const enc = (b, o) => phrase !== undefined ? K.encodePhrase(pool, phrase, b, { ...o, maxTail }) : alpha ? K.encodeAlpha(b, o) : K.encodeBits(pool, b, o);
const show = (r) => { console.log(r.text); console.error(`# ${r.tokens.filter(t => t.type === 'kanji').length} kanji, ${r.tokens.filter(t => t.type === 'hex').length} hex, ${r.tokens.filter(t => t.type === 'alpha').length} alpha, ${r.totalBits} bits`); };
const check = () => { const c = opt('--check'); return { checkBits: c === undefined ? K.DEFAULT_CHECK_BITS : +c }; };
try {
  if (cmd === 'encode') { const o = check(); show(enc(K.hexToBits(args[0] ?? ''), o)); }
  else if (cmd === 'encode-bits') { const o = check(); show(enc(K.parseBitString(args[0] ?? ''), o)); }
  else if (cmd === 'random') { const n = +(opt('--bits') ?? 256), o = check(); const b = K.randomBits(n); console.log(K.bitsToHex(b)); show(enc(b, o)); }
  else if (cmd === 'hash') {
    const salt = opt('--salt') ?? '', iter = +(opt('--iter') ?? K.KDF_ITERATIONS), o = check();
    const key = await K.deriveKey(args[0] ?? '', { salt, iterations: iter });
    console.log(K.bitsToHex(K.bytesToBits(key))); show(enc(K.bytesToBits(key), o));
  } else if (cmd === 'decode') {
    const r = K.decodeAny(pool, args.join(' '));
    console.error(`# ${r.tried} combinations tried, ${r.candidates.length} passed the ${r.checkBits}-bit check`);
    for (const c of r.candidates) console.log(c.hex + '\t' + c.text);
    process.exitCode = r.candidates.length === 1 ? 0 : 2;
  } else if (cmd === 'capacity') {
    const c = K.phraseCapacity(pool, args.join('')); console.log(`${c.chars.join('')}: ${c.strokes} strokes = ${c.bits} bit; for 256+12 bit needs ${Math.ceil(Math.max(0, 268 - c.bits) / 7)} alpha tail symbols`);
  } else if (cmd === 'pretty') {
    const txt = args.join(' ');
    if (K.isPhraseText(txt)) { for (const t of K.parsePhrase(pool, txt).tokens) console.log(t.char + '  ' + [...t.spec].map(c => K.COLORS[+c] ?? c).join(' ')); }
    else if (K.isAlphaText(txt)) { for (const t of K.parseAlpha(txt).tokens) console.log(t.char + '  ' + (K.COLORS[+t.spec] ?? t.spec)); }
    else for (const t of K.parseText(pool, txt).tokens)
      console.log(t.char + '  ' + [...t.spec].map(c => K.COLORS[+c] ?? c).join(' '));
  } else { console.log(USAGE); process.exitCode = cmd ? 1 : 0; }
} catch (e) { console.error('error: ' + e.message); process.exitCode = 1; }
