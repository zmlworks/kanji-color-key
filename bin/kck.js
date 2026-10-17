#!/usr/bin/env node
import * as K from '../src/kck.js';
import { pool } from '../src/pool-node.js';
const argv = process.argv.slice(2);
const alpha = argv.includes('--alpha');
const grab = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
const alphaPosArg = grab('--alpha-pos'), tailArg = grab('--tail'), bitsArg = grab('--bits');
const mixed = alphaPosArg !== undefined || tailArg !== undefined;
const alphaPos = (alphaPosArg ?? '').split(',').filter(Boolean).map(Number);
if (bitsArg !== undefined) argv.push('--bits', bitsArg);
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
  --alpha-pos 3,7 --tail kanji|alpha    mixed mode: positions (1-based) that are alpha glyphs, others kanji;
                                        --tail alpha finishes with glyphs instead of a padded kanji
                                        (padding = surplus bits derived from the key; v1.0 zero padding still decodes)
  kck pretty "<text>"                   show stroke-by-stroke color names`;
const enc = (b, o) => mixed ? K.encodeMixed(pool, b, { ...o, alphaPos, tail: tailArg ?? 'kanji' }) : alpha ? K.encodeAlpha(b, o) : K.encodeBits(pool, b, o);
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
  } else if (cmd === 'pretty') {
    const txt = args.join(' ');
    if (K.isMixedText(txt)) { for (const t of K.parseMixed(pool, txt).tokens) console.log(t.char + '  ' + [...t.spec].map(c => K.COLORS[+c] ?? c).join(' ')); }
    else if (K.isAlphaText(txt)) { for (const t of K.parseAlpha(txt).tokens) console.log(t.char + '  ' + (K.COLORS[+t.spec] ?? t.spec)); }
    else for (const t of K.parseText(pool, txt).tokens)
      console.log(t.char + '  ' + [...t.spec].map(c => K.COLORS[+c] ?? c).join(' '));
  } else { console.log(USAGE); process.exitCode = cmd ? 1 : 0; }
} catch (e) { console.error('error: ' + e.message); process.exitCode = 1; }
