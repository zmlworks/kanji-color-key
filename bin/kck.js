#!/usr/bin/env node
import * as K from '../src/kck.js';
import { pool } from '../src/pool-node.js';
import { kana } from '../src/kana-node.js';
const argv = process.argv.slice(2);
const FLAGS = ['--alpha', '--kana', '--kana-fixed', '--lookalike', '--no-lookalike-fallback'];
const has = (f) => argv.includes(f);
const grab = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
const alphaPosArg = grab('--alpha-pos'), kanaPosArg = grab('--kana-pos'), tailArg = grab('--tail'), bitsArg = grab('--bits');
const allKana = has('--kana'), kanaFixed = has('--kana-fixed'), alpha = has('--alpha');
const mixed = allKana || alphaPosArg !== undefined || kanaPosArg !== undefined || tailArg !== undefined;
const list = (s) => (s ?? '').split(',').filter(Boolean).map(Number);
const alphaPos = list(alphaPosArg), kanaPos = allKana ? Object.keys(K.allOf('kana')).map(Number) : list(kanaPosArg);
if (bitsArg !== undefined) argv.push('--bits', bitsArg);
const lookOpts = { kana, swapLookalikes: has('--lookalike'), lookalikeFallback: !has('--no-lookalike-fallback') };
const [cmd, ...args] = argv.filter(a => !FLAGS.includes(a));
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const USAGE = `usage:
  kck encode <hex> [--check N]          encode hex data
  kck encode-bits <0101...> [--check N] encode arbitrary bit string
  kck random [--bits 256] [--check N]   generate a random key and encode it
  kck hash [--salt S] [--iter N]        derive 256-bit key (PBKDF2-SHA256) and encode it; the passphrase is
                                        read from a hidden prompt, or from stdin when piped (printf %s 'pass' | kck hash)
  kck hash <passphrase> ...             (also accepted, with a warning: it stays in shell history / ps)
  kck decode "<text>"                   decode; supports ? (unknown color), (..) shifted block, [..] permuted block
  --alpha                               use alpha mode (32 glyphs 2345679ABCDEFGHIJKLMNOPQRSTVWXYZ x 4 colors = 7 bit/symbol)
                                        (decode/pretty auto-detect the A(...) header)
  --alpha-pos 3,7 --kana-pos 2,5        mixed mode: positions (1-based) that are alpha glyphs / kana, others kanji
  --tail kanji|alpha|kana               mixed ending: kanji = keep the types to the end (last symbol padded),
                                        alpha / kana = finish with glyphs / one-color kana once the next symbol
                                        would not be fully used (padding = surplus bits derived from the key)
  --kana                                all positions kana (mixed mode, M(...) header; with --tail kana by default)
  --kana-fixed                          fixed-length all-kana mode: 3 colored strokes per kana (11 bit), header KF(...)
  --lookalike                           (decode) always try the hiragana/katakana partner of お/オ き/キ け/ケ さ/サ ほ/ホ も/モ
  --no-lookalike-fallback               (decode) do not try them automatically when nothing matches
  kck pretty "<text>"                   show stroke-by-stroke color names`;
const enc = (b, o) => kanaFixed ? K.encodeKanaFixed(kana, b, o)
  : mixed ? K.encodeMixed(pool, b, { ...o, alphaPos, kanaPos, kana, tail: tailArg ?? (allKana ? 'kana' : 'kanji') })
  : alpha ? K.encodeAlpha(b, o) : K.encodeBits(pool, b, o);
const n = (r, ...ty) => r.tokens.filter(t => ty.includes(t.type)).length;
const show = (r) => { console.log(r.text); console.error(`# ${n(r, 'kanji')} kanji, ${n(r, 'hex')} hex, ${n(r, 'alpha')} alpha, ${n(r, 'kana')} kana, ${n(r, 'kanaGlyph')} one-color kana, ${r.totalBits} bits`); };
const intOpt = (name, def, min, max) => {
  const v = opt(name);
  if (v === undefined) return def;
  if (!/^\d+$/.test(v) || +v < min || +v > max) throw new Error(`${name} must be an integer ${min}..${max} (got ${JSON.stringify(v)})`);
  return +v;
};
const check = () => ({ checkBits: intOpt('--check', K.DEFAULT_CHECK_BITS, 0, 64) });
/* Passphrase: from stdin (piped) or a hidden prompt (TTY). The old argument form still works but
   leaves the passphrase in shell history and the process list, so it prints a warning. */
async function readPassphrase() {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    let s = ''; stdin.setEncoding('utf8');
    for await (const c of stdin) s += c;
    return s.replace(/\r?\n$/, '');
  }
  process.stderr.write('passphrase: ');
  return await new Promise((resolve, reject) => {
    let s = '';
    stdin.setRawMode(true); stdin.setEncoding('utf8'); stdin.resume();
    const done = (err) => { stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData); process.stderr.write('\n'); err ? reject(err) : resolve(s); };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') return done();
        if (ch === '\u0003') return done(new Error('cancelled'));
        if (ch === '\u007f' || ch === '\b') s = [...s].slice(0, -1).join(''); else s += ch;
      }
    };
    stdin.on('data', onData);
  });
}
const colorNames = (spec) => [...spec].map(c => K.COLORS[+c] ?? c).join(' ');
try {
  if (cmd === 'encode') { const o = check(); show(enc(K.hexToBits(args[0] ?? ''), o)); }
  else if (cmd === 'encode-bits') { const o = check(); show(enc(K.parseBitString(args[0] ?? ''), o)); }
  else if (cmd === 'random') { const nb = intOpt('--bits', 256, 1, 4096), o = check(); const b = K.randomBits(nb); console.log(K.bitsToHex(b)); show(enc(b, o)); }
  else if (cmd === 'hash') {
    const salt = opt('--salt') ?? '', iter = intOpt('--iter', K.KDF_ITERATIONS, 1, 100000000), o = check();
    let pass;
    if (args[0] !== undefined && args[0] !== '-') {
      pass = args[0];
      console.error('warning: a passphrase given on the command line stays in shell history and is visible to other processes; run "kck hash" without it to type it at a hidden prompt, or pipe it on stdin');
    } else pass = await readPassphrase();
    const key = await K.deriveKey(pass, { salt, iterations: iter });
    console.log(K.bitsToHex(K.bytesToBits(key))); show(enc(K.bytesToBits(key), o));
  } else if (cmd === 'decode') {
    const r = K.decodeAny(pool, args.join(' '), lookOpts);
    console.error(`# ${r.tried} combinations tried, ${r.candidates.length} passed the ${r.checkBits}-bit check` + (r.lookalike === 'fallback' ? ' (after trying look-alike kana)' : r.lookalike === 'skipped' ? ' (look-alike retry skipped: too many combinations)' : ''));
    for (const c of r.candidates) console.log(c.hex + '\t' + c.text);
    process.exitCode = r.candidates.length === 1 ? 0 : 2;
  } else if (cmd === 'pretty') {
    const txt = args.join(' ');
    const p = K.isKanaFixedText(txt) ? K.parseKanaFixed(kana, txt) : K.isMixedText(txt) ? K.parseMixed(pool, txt, kana) : K.isAlphaText(txt) ? K.parseAlpha(txt) : K.parseText(pool, txt);
    for (const t of p.tokens) console.log(t.char + '  ' + colorNames(t.spec) + (t.type === 'kanaGlyph' ? '  (whole kana in one color)' : ''));
  } else { console.log(USAGE); process.exitCode = cmd ? 1 : 0; }
} catch (e) { console.error('error: ' + e.message); process.exitCode = 1; }
