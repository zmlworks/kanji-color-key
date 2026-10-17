// kanji-color-key core module (browser + Node, no dependencies).
// A pool is { kanji: string of 4096 chars, counts: number[] (stroke counts in KanjiVG order) }.
export const COLORS = ['黒', '赤', '青', '緑'];
export const COLOR_CSS = ['#111111', '#d62828', '#1d4ed8', '#15803d'];
// On dark backgrounds (dark mode): 黒 is drawn light (as in the launcher icon), the others a little brighter.
export const COLOR_CSS_DARK = ['#f1eee4', '#e03a3a', '#4a78f0', '#22a55a'];
export const DEFAULT_CHECK_BITS = 0;
// Color names accepted in place of digits when decoding (黒0 赤1 青2 緑3).
const CNAME = { '黒': '0', '赤': '1', '青': '2', '緑': '3' };
const HEX = '0123456789abcdef';

// ---------- SHA-256 (small sync implementation, used for the check code) ----------
const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
export function sha256(msg) {
  const l = msg.length, nb = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(nb);
  m.set(msg); m[l] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(nb - 4, l * 8); dv.setUint32(nb - 8, Math.floor(l / 0x20000000));
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const W = new Uint32Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < nb; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = W[i - 15], b = W[i - 2];
      W[i] = (W[i - 16] + (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) + W[i - 7] + (r(b, 17) ^ r(b, 19) ^ (b >>> 10))) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32); const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i]);
  return out;
}

// ---------- bit helpers ----------
export function hexToBits(hex) {
  hex = hex.replace(/^0x/i, '').replace(/\s+/g, '').toLowerCase();
  if (!/^[0-9a-f]*$/.test(hex)) throw new Error('invalid hex');
  const bits = [];
  for (const ch of hex) { const v = HEX.indexOf(ch); for (let i = 3; i >= 0; i--) bits.push((v >> i) & 1); }
  return bits;
}
export function bitsToHex(bits) {
  let s = '';
  for (let i = 0; i < bits.length; i += 4) { let v = 0; for (let j = 0; j < 4; j++) v = v * 2 + (bits[i + j] || 0); s += HEX[v]; }
  return s;
}
export function bytesToBits(bytes) { const b = []; for (const x of bytes) for (let i = 7; i >= 0; i--) b.push((x >> i) & 1); return b; }
export function bitsToBytes(bits) {
  const out = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((v, i) => { if (v) out[i >> 3] |= 0x80 >> (i & 7); });
  return out;
}
export function parseBitString(s) { s = s.replace(/[\s_]/g, ''); if (!/^[01]*$/.test(s)) throw new Error('invalid bit string'); return [...s].map(Number); }
const readInt = (bits, pos, n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 2 + (bits[pos + i] || 0); return v; };

// Check code: first `checkBits` bits of SHA-256( "kck1" || u32 bit-length || data bytes ).
export function checkCode(dataBits, checkBits = DEFAULT_CHECK_BITS) {
  if (!checkBits) return [];
  const body = bitsToBytes(dataBits), msg = new Uint8Array(8 + body.length);
  msg.set([0x6b, 0x63, 0x6b, 0x31]); new DataView(msg.buffer).setUint32(4, dataBits.length); msg.set(body, 8);
  return bytesToBits(sha256(msg)).slice(0, checkBits);
}

// Surplus (padding) bits. Symbols are written whole, so after data + check there are leftover bit slots up to
// the end of the last symbol (strokes of the last kanji, glyph/color of a trailing alphanumeric, ...).
// Until v1.0 they were 0 (black / glyph "2"); since v1.1 they are filled with bits derived from the data:
//   surplus = SHA-256( "kckp" || u32 bit-length || u32 counter || data bytes ), counter = 0, 1, ... concatenated.
// Deterministic for the same key, domain-separated from the check code ("kck1"), and it reveals nothing beyond
// the data that is written anyway. The decoder accepts either all-zero padding (old outputs) or exactly this
// derived surplus, so the padding still works as a check.
export function surplusBits(dataBits, n) {
  const body = bitsToBytes(dataBits), msg = new Uint8Array(12 + body.length), dv = new DataView(msg.buffer), out = [];
  msg.set([0x6b, 0x63, 0x6b, 0x70]); dv.setUint32(4, dataBits.length); msg.set(body, 12);
  for (let ctr = 0; out.length < n; ctr++) { dv.setUint32(8, ctr); out.push(...bytesToBits(sha256(msg))); }
  return out.slice(0, n);
}
// Longest possible padding: a kanji started with <12 bits left (12 + 2 x 25 strokes) — 512 is ample.
const SURPLUS_MAX = 512;
// Bit stream for the encoders: data, check, then surplus. L = data + check length (the meaningful part).
function streamOf(dataBits, checkBits) {
  const body = dataBits.concat(checkCode(dataBits, checkBits));
  return { bits: body.concat(surplusBits(dataBits, SURPLUS_MAX)), L: body.length };
}
// Classify the padding of a decoded candidate: 'none' (no padding), 'surplus' (v1.1+), 'zero' (v1.0 style), or null (reject).
export function paddingKind(data, pad) {
  if (!pad.length) return 'none';
  if (pad.every(b => b === 0)) return 'zero'; // v1.0 output (or a surplus that happens to be all zero)
  // same as surplusBits(data, pad.length) compared bit by bit, but stops at the first mismatch (hot path in decoding)
  const body = bitsToBytes(data), msg = new Uint8Array(12 + body.length), dv = new DataView(msg.buffer);
  msg.set([0x6b, 0x63, 0x6b, 0x70]); dv.setUint32(4, data.length); msg.set(body, 12);
  for (let j = 0, h; j < pad.length; j++) {
    if (j % 256 === 0) { dv.setUint32(8, j / 256); h = sha256(msg); }
    if (((h[(j % 256) >> 3] >> (7 - (j & 7))) & 1) !== pad[j]) return null;
  }
  return 'surplus';
}

// ---------- pool ----------
export function makePool(kanji, counts) {
  const chars = [...kanji];
  if (chars.length !== 4096 || counts.length !== 4096) throw new Error('pool must have 4096 kanji');
  const index = new Map(chars.map((c, i) => [c, i]));
  return { chars, counts, index };
}

// ---------- encode ----------
// Returns { text, tokens, totalBits, dataBits, checkBits, writtenBits, surplus } (surplus = padding bits written).
// tokens: {type:'kanji', char, index, colors[]} | {type:'hex', char, color}
export function encodeBits(pool, dataBits, { checkBits = DEFAULT_CHECK_BITS } = {}) {
  const { bits, L } = streamOf(dataBits, checkBits), tokens = [];
  let pos = 0;
  while (L - pos >= 12) {
    const idx = readInt(bits, pos, 12); pos += 12;
    const colors = [];
    for (let s = 0; s < pool.counts[idx]; s++) { colors.push(readInt(bits, pos, 2)); pos += 2; }
    tokens.push({ type: 'kanji', char: pool.chars[idx], index: idx, colors });
  }
  while (pos < L) {
    tokens.push({ type: 'hex', char: HEX[readInt(bits, pos, 4)], color: readInt(bits, pos + 4, 2) }); pos += 6;
  }
  return { tokens, text: formatTokens(tokens, dataBits.length, checkBits), totalBits: L, dataBits: dataBits.length, checkBits, writtenBits: pos, surplus: pos - L };
}
export const encodeHex = (pool, hex, o) => encodeBits(pool, hexToBits(hex), o);
export function formatTokens(tokens, dataLen, checkBits) {
  return `(${dataLen}${checkBits ? '+' + checkBits : ''}bit)` + tokens.map(t => t.type === 'kanji' ? t.char + t.colors.join('') : t.char + t.color).join('');
}

// ---------- uncertain color sequences ----------
// Syntax inside a kanji's digit run: 0-3 color, ? unknown, (..) block kept in order but may sit anywhere,
// [..] block whose members may be permuted. Returns the list of distinct candidate color arrays.
export function expandColorSpec(spec) {
  // parse into items: {v:number|'?'}, groups: {kind:'(' | '[', start, len}
  const syms = [], groups = []; let open = null;
  for (const ch of spec) {
    if ('([' .includes(ch)) { if (open) throw new Error('nested brackets'); open = { kind: ch, start: syms.length }; }
    else if (')]'.includes(ch)) {
      if (!open || (open.kind === '(') !== (ch === ')')) throw new Error('mismatched bracket');
      open.len = syms.length - open.start; groups.push(open); open = null;
    } else if (ch === '?') syms.push('?');
    else if (/[0-3]/.test(ch)) syms.push(+ch);
    else throw new Error('bad color char ' + ch);
  }
  if (open) throw new Error('unclosed bracket');
  // structural variants over symbol ids (so () relocation of each group is independent)
  let variants = [syms.map((_, i) => i)];
  for (const g of groups.filter(g => g.kind === '[')) {
    const next = [];
    for (const v of variants) for (const p of permutations(v.slice(g.start, g.start + g.len))) {
      const w = v.slice(); w.splice(g.start, g.len, ...p); next.push(w);
    }
    variants = next;
  }
  for (const g of groups.filter(g => g.kind === '(')) {
    const ids = new Set(syms.map((_, i) => i).slice(g.start, g.start + g.len)), next = [];
    for (const v of variants) {
      const block = v.filter(x => ids.has(x)), rest = v.filter(x => !ids.has(x));
      for (let p = 0; p <= rest.length; p++) next.push([...rest.slice(0, p), ...block, ...rest.slice(p)]);
    }
    variants = next;
  }
  const out = new Map();
  for (const v of variants) {
    let partial = [[]];
    for (const id of v) {
      const s = syms[id];
      partial = s === '?' ? partial.flatMap(a => [0, 1, 2, 3].map(c => [...a, c])) : partial.map(a => [...a, s]);
    }
    for (const a of partial) out.set(a.join(''), a);
  }
  return [...out.values()];
}
function permutations(a) {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
}

// ---------- parse ----------
// Returns { dataBits, checkBits, tokens:[{type, char, index?, spec, options:[colors[]]}] }
export function parseText(pool, text) {
  const t = text.replace(/\s+/g, '').normalize('NFC');
  const m = /^[(（](\d+)(?:\+(\d+))?bit[)）]/i.exec(t);
  if (!m) throw new Error('missing header like (256+12bit)');
  const dataBits = +m[1], checkBits = m[2] === undefined ? DEFAULT_CHECK_BITS : +m[2];
  const chars = [...t.slice(m[0].length)], tokens = [];
  let i = 0, budget = dataBits + checkBits;
  while (i < chars.length) {
    const c = chars[i++];
    let need, tok;
    if (budget >= 12) {
      if (!pool.index.has(c)) throw new Error(`"${c}" is not in the kanji pool`);
      const index = pool.index.get(c); need = pool.counts[index]; tok = { type: 'kanji', char: c, index };
      budget -= 12 + 2 * need;
    } else {
      if (!HEX.includes(c.toLowerCase())) throw new Error(`expected hex char, got "${c}"`);
      need = 1; tok = { type: 'hex', char: c.toLowerCase() }; budget -= 6;
    }
    let spec = '', n = 0;
    while (i < chars.length) {
      if (n < need && CNAME[chars[i]]) chars[i] = CNAME[chars[i]];
      const d = chars[i];
      if (n === need && !')]'.includes(d)) break;
      if (/[0-3?]/.test(d)) n++; else if (!'()[]'.includes(d)) break;
      spec += d; i++;
    }
    if (n !== need) throw new Error(`"${c}" needs ${need} colors, got ${n}`);
    tok.spec = spec; tok.options = expandColorSpec(spec);
    tokens.push(tok);
    if (budget <= 0) break;
  }
  if (budget > 0) throw new Error('text too short for header');
  if (i < chars.length) throw new Error('trailing characters: ' + chars.slice(i).join(''));
  return { dataBits, checkBits, tokens };
}

// ---------- decode ----------
// Returns { candidates:[{bits, hex, text, tokens, padding}], tried, total, checkBits, dataBits }.
// A candidate must match the check code and its padding must be all zero (v1.0) or the derived surplus (v1.1+).
// Candidates are unique by data (the same key reached via zero and surplus padding is listed once).
export function decodeText(pool, text, { maxCandidates = 2_000_000 } = {}) {
  const p = parseText(pool, text);
  const total = p.tokens.reduce((a, t) => a * t.options.length, 1);
  if (total > maxCandidates) throw new Error(`too many combinations (${total}); narrow the uncertainty`);
  const L = p.dataBits + p.checkBits, results = [], seen = new Set();
  const choice = new Array(p.tokens.length).fill(0);
  let tried = 0;
  for (;;) {
    tried++;
    const bits = [];
    p.tokens.forEach((t, k) => {
      const col = t.options[choice[k]];
      if (t.type === 'kanji') { for (let b = 11; b >= 0; b--) bits.push((t.index >> b) & 1); }
      else { const v = HEX.indexOf(t.char); for (let b = 3; b >= 0; b--) bits.push((v >> b) & 1); }
      for (const c of col) bits.push(c >> 1, c & 1);
    });
    const data = bits.slice(0, p.dataBits), chk = bits.slice(p.dataBits, L);
    const padding = checkCode(data, p.checkBits).every((b, j) => b === chk[j]) && paddingKind(data, bits.slice(L));
    if (padding) {
      const dk = data.join('');
      if (!seen.has(dk)) {
        seen.add(dk);
        const tokens = p.tokens.map((t, k) => t.type === 'kanji'
          ? { type: 'kanji', char: t.char, index: t.index, colors: t.options[choice[k]] }
          : { type: 'hex', char: t.char, color: t.options[choice[k]][0] });
        results.push({ bits: data, hex: bitsToHex(data), text: formatTokens(tokens, p.dataBits, p.checkBits), tokens, padding });
      }
    }
    let k = 0;
    while (k < choice.length && ++choice[k] === p.tokens[k].options.length) choice[k++] = 0;
    if (k === choice.length) break;
  }
  return { candidates: results, tried, total, dataBits: p.dataBits, checkBits: p.checkBits };
}

// ---------- hash mode ----------
// Derive a 256-bit key from a passphrase: PBKDF2-HMAC-SHA256, salt "kanji-color-key/v1:"+salt, 600000 iterations.
export const KDF_ITERATIONS = 600000;
export async function deriveKey(passphrase, { salt = '', iterations = KDF_ITERATIONS, bits = 256 } = {}) {
  const subtle = globalThis.crypto.subtle, enc = new TextEncoder();
  const k = await subtle.importKey('raw', enc.encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  const out = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('kanji-color-key/v1:' + salt), iterations }, k, bits);
  return new Uint8Array(out);
}
export function randomBits(n) {
  const b = new Uint8Array(Math.ceil(n / 8)); globalThis.crypto.getRandomValues(b); return bytesToBits(b).slice(0, n);
}

// ---------- alpha mode (glyph32): uppercase letters + digits, 5 bit glyph + 2 bit color = 7 bit/symbol ----------
// 36 chars minus {0, 1, 8, U}, in this fixed order (index = 5-bit value):
export const ALPHA = '2345679ABCDEFGHIJKLMNOPQRSTVWXYZ';
// Text: "A(256+12bit)" header, then pairs <glyph><color digit>, grouped by 4 with spaces (whitespace ignored).
export function encodeAlpha(dataBits, { checkBits = DEFAULT_CHECK_BITS } = {}) {
  const { bits, L } = streamOf(dataBits, checkBits), tokens = [];
  for (let pos = 0; pos < L; pos += 7) tokens.push({ type: 'alpha', char: ALPHA[readInt(bits, pos, 5)], color: readInt(bits, pos + 5, 2) });
  const written = tokens.length * 7;
  return { tokens, text: formatAlpha(tokens, dataBits.length, checkBits), totalBits: L, dataBits: dataBits.length, checkBits, writtenBits: written, surplus: written - L };
}
export function formatAlpha(tokens, dataLen, checkBits) {
  return `A(${dataLen}${checkBits ? '+' + checkBits : ''}bit)` + tokens.map((t, i) => (i && i % 4 === 0 ? ' ' : '') + t.char + t.color).join('');
}
// Uncertainty: '?' as glyph (any of 32) or as color (any of 4).
export function parseAlpha(text) {
  const t = text.replace(/\s+/g, '').replace(/[黒赤青緑]/g, c => CNAME[c]).toUpperCase();
  const m = /^A[(（](\d+)(?:\+(\d+))?BIT[)）]/.exec(t);
  if (!m) throw new Error('missing header like A(256+12bit)');
  const dataBits = +m[1], checkBits = m[2] === undefined ? DEFAULT_CHECK_BITS : +m[2];
  const body = t.slice(m[0].length), n = Math.ceil((dataBits + checkBits) / 7);
  if (body.length !== 2 * n) throw new Error(`expected ${n} symbols (${2 * n} chars), got ${body.length} chars`);
  const tokens = [];
  for (let i = 0; i < n; i++) {
    const g = body[2 * i], c = body[2 * i + 1];
    if (g !== '?' && !ALPHA.includes(g)) throw new Error(`"${g}" is not in the alpha set (0, 1, 8, U are excluded)`);
    if (!/[0-3?]/.test(c)) throw new Error(`bad color "${c}" after "${g}"`);
    const gs = g === '?' ? [...Array(32).keys()] : [ALPHA.indexOf(g)], cs = c === '?' ? [0, 1, 2, 3] : [+c];
    tokens.push({ char: g, spec: c, options: gs.flatMap(a => cs.map(b => a * 4 + b)) }); // 7-bit values
  }
  return { dataBits, checkBits, tokens };
}
export function decodeAlpha(text, { maxCandidates = 2_000_000 } = {}) {
  const p = parseAlpha(text), L = p.dataBits + p.checkBits;
  const total = p.tokens.reduce((a, t) => a * t.options.length, 1);
  if (total > maxCandidates) throw new Error(`too many combinations (${total}); narrow the uncertainty`);
  const choice = new Array(p.tokens.length).fill(0), results = [], seen = new Set(); let tried = 0;
  for (;;) {
    tried++;
    const bits = [];
    p.tokens.forEach((t, k) => { const v = t.options[choice[k]]; for (let b = 6; b >= 0; b--) bits.push((v >> b) & 1); });
    const data = bits.slice(0, p.dataBits), chk = bits.slice(p.dataBits, L);
    const padding = checkCode(data, p.checkBits).every((b, j) => b === chk[j]) && paddingKind(data, bits.slice(L));
    if (padding) {
      const dk = data.join('');
      if (!seen.has(dk)) {
        seen.add(dk);
        const tokens = p.tokens.map((t, k) => ({ type: 'alpha', char: ALPHA[t.options[choice[k]] >> 2], color: t.options[choice[k]] & 3 }));
        results.push({ bits: data, hex: bitsToHex(data), text: formatAlpha(tokens, p.dataBits, p.checkBits), tokens, padding });
      }
    }
    let k = 0;
    while (k < choice.length && ++choice[k] === p.tokens[k].options.length) choice[k++] = 0;
    if (k === choice.length) break;
  }
  return { candidates: results, tried, total, dataBits: p.dataBits, checkBits: p.checkBits };
}
// Dispatch on header: "A(" = alpha, "KF(" = fixed-length kana, "M(" (or the prototype's "K(") = mixed, "(" = kanji.
// Texts with kana need the kana set: pass it as o.kana (the web app and the CLI always do).
export const isAlphaText = (text) => /^\s*[Aa]\s*[(（]/.test(text);
export const isKanaFixedText = (text) => /^\s*[Kk]\s*[Ff]\s*[(（]/.test(text);
export const decodeAny = (pool, text, o = {}) => isAlphaText(text) ? decodeAlpha(text, o)
  : isKanaFixedText(text) ? decodeKanaFixed(needKana(o.kana), text, o)
  : isMixedText(text) ? decodeMixed(pool, text, o) : decodeText(pool, text, o);
const needKana = (k) => { if (!k) throw new Error('kana set required'); return k; };

// ---------- kana (v1.2): 32 kana with >= 3 strokes, 5 bit identity + 2 bit per stroke ----------
// Index = 5-bit value: 18 hiragana, then 14 katakana (data/kana.json, from KanjiVG). ヰ is kept on purpose.
export const KANA = 'あおかきけさせたなにはふほまむもやを' + 'ウオキケサチツテネホミモヨヰ';
// Hiragana/katakana pairs inside the set that may be confused when handwritten (used by the look-alike retry).
export const KANA_LOOKALIKES = [['お', 'オ'], ['き', 'キ'], ['け', 'ケ'], ['さ', 'サ'], ['ほ', 'ホ'], ['も', 'モ']];
const PARTNER = new Map(KANA_LOOKALIKES.flatMap(([a, b]) => [[a, b], [b, a]]));
// A kana set is { chars: 32 kana (index = 5-bit value), counts: stroke counts (KanjiVG), index: Map }.
export function makeKanaSet(kana, counts) {
  const chars = [...kana];
  if (chars.length !== 32 || counts.length !== 32 || new Set(chars).size !== 32) throw new Error('kana set must have 32 distinct kana');
  return { chars, counts, index: new Map(chars.map((c, i) => [c, i])) };
}

// ---------- mixed mode: each symbol is a pool kanji (12 bit + 2 bit/stroke), an alpha-32 glyph (7 bit),
// or (v1.2) a kana (5 bit + 2 bit/stroke, 3 or 4 strokes) ----------
// alphaPos / kanaPos: 1-based symbol positions that are alpha glyphs / kana; other positions are kanji.
// tail 'kanji': keep the chosen types to the end (the last symbol is filled with surplus bits).
// tail 'alpha': as soon as the next kanji or kana would not be fully used by the remaining bits, finish with alpha glyphs.
// tail 'kana' (v1.2): same switch point, but finish with one-color kana ("kanaGlyph": 5 bit kana + 1 color = 7 bit,
//   written as e.g. ウ2, the whole kana in one color), so less than 7 bits are surplus, as with alpha.
// Text: "M(256+12bit)" + symbols separated by spaces: <kanji|kana><color digits> or <glyph|one-color kana><color digit>.
export function encodeMixed(pool, dataBits, { checkBits = DEFAULT_CHECK_BITS, alphaPos = [], kanaPos = [], tail = 'kanji', kana = null } = {}) {
  if (!['kanji', 'alpha', 'kana'].includes(tail)) throw new Error('tail must be kanji, alpha or kana');
  const ap = new Set(alphaPos), kp = new Set(kanaPos);
  if (kp.size || tail === 'kana') needKana(kana);
  const { bits, L } = streamOf(dataBits, checkBits), tokens = [];
  let pos = 0, rest = null;
  for (let i = 1; pos < L; i++) {
    let type = rest ?? (ap.has(i) ? 'alpha' : kp.has(i) ? 'kana' : 'kanji');
    if (!rest && tail !== 'kanji' && type !== 'alpha') {
      const full = type === 'kanji' ? 12 + 2 * pool.counts[readInt(bits, pos, 12)] : 5 + 2 * kana.counts[readInt(bits, pos, 5)];
      if (L - pos < full) type = rest = tail === 'alpha' ? 'alpha' : 'kanaGlyph';
    }
    if (type === 'alpha') { tokens.push({ type, char: ALPHA[readInt(bits, pos, 5)], color: readInt(bits, pos + 5, 2) }); pos += 7; }
    else if (type === 'kanaGlyph') { const idx = readInt(bits, pos, 5); tokens.push({ type, char: kana.chars[idx], index: idx, color: readInt(bits, pos + 5, 2) }); pos += 7; }
    else {
      const kanji = type === 'kanji', n = kanji ? 12 : 5, idx = readInt(bits, pos, n), colors = []; pos += n;
      for (let s = 0; s < (kanji ? pool.counts[idx] : kana.counts[idx]); s++) { colors.push(readInt(bits, pos, 2)); pos += 2; }
      tokens.push({ type, char: kanji ? pool.chars[idx] : kana.chars[idx], index: idx, colors });
    }
  }
  return { tokens, text: formatMixed(tokens, dataBits.length, checkBits), totalBits: L, dataBits: dataBits.length, checkBits, writtenBits: pos, surplus: pos - L };
}
const hasColors = (t) => t.type === 'kanji' || t.type === 'kana';
export function formatMixed(tokens, dataLen, checkBits) {
  return `M(${dataLen}${checkBits ? '+' + checkBits : ''}bit)` + tokens.map(t => t.char + (hasColors(t) ? t.colors.join('') : t.color)).join(' ');
}
export const isMixedText = (text) => /^\s*[MmKk]\s*[(（]/.test(text);
// Whitespace is ignored; halfwidth katakana (ｳ) are read as fullwidth (NFKC on that range only).
const squeeze = (text) => text.replace(/\s+/g, '').replace(/[\uFF61-\uFF9F]+/g, s => s.normalize('NFKC')).normalize('NFC');
// Color run after a kanji/kana: up to `need` colors (0-3 ? or 黒赤青緑) plus brackets. Returns { spec, n, i }.
function colorRun(chars, i, need) {
  let spec = '', n = 0;
  while (i < chars.length) {
    if (n < need && CNAME[chars[i]]) chars[i] = CNAME[chars[i]];
    const d = chars[i];
    if (n === need && !')]'.includes(d)) break;
    if (/[0-3?]/.test(d)) n++; else if (!'()[]'.includes(d)) break;
    spec += d; i++;
  }
  return { spec, n, i };
}
export function parseMixed(pool, text, kana = null) {
  const t = squeeze(text);
  const m = /^[MmKk][(（](\d+)(?:\+(\d+))?bit[)）]/i.exec(t);
  if (!m) throw new Error('missing header like M(256+12bit)');
  const dataBits = +m[1], checkBits = m[2] === undefined ? DEFAULT_CHECK_BITS : +m[2];
  const chars = [...t.slice(m[0].length)], tokens = [];
  let i = 0, budget = dataBits + checkBits, glyphRun = false;
  const onlyGlyphs = (c) => new Error(`"${c}" cannot follow a one-color kana (only one-color kana until the end)`);
  while (i < chars.length && budget > 0) {
    const c = chars[i++];
    if (/[0-9A-Za-z?]/.test(c)) {
      const g = c.toUpperCase(), col = CNAME[chars[i]] ?? chars[i]; i++;
      if (g !== '?' && !ALPHA.includes(g)) throw new Error(`"${g}" is not in the alpha set (0, 1, 8, U are excluded)`);
      if (!col || !/[0-3?]/.test(col)) throw new Error(`bad color "${col ?? ''}" after "${g}"`);
      if (glyphRun) throw onlyGlyphs(g);
      const gs = g === '?' ? [...Array(32).keys()] : [ALPHA.indexOf(g)], cs = col === '?' ? [0, 1, 2, 3] : [+col];
      tokens.push({ type: 'alpha', char: g, spec: col, options: gs.flatMap(a => cs.map(b => a * 4 + b)) }); budget -= 7;
    } else if (kana && kana.index.has(c)) {
      const index = kana.index.get(c), s = kana.counts[index], r = colorRun(chars, i, s), spec = r.spec; i = r.i;
      const plain = /^([0-3])\1*$/.test(spec);
      if (r.n === 1) { glyphRun = true; tokens.push({ type: 'kanaGlyph', char: c, index, spec, options: expandColorSpec(spec) }); budget -= 7; }
      else if (r.n === s && glyphRun) {
        // a one-color kana copied stroke by stroke ("ウ222" for "ウ2")
        if (!plain) throw new Error(`"${c}" after a one-color kana must also be one color, got ${spec}`);
        tokens.push({ type: 'kanaGlyph', char: c, index, spec: spec[0], options: [[+spec[0]]] }); budget -= 7;
      } else if (r.n === s) {
        // the last symbol may also be a one-color kana copied stroke by stroke: try both readings
        tokens.push({ type: 'kana', char: c, index, spec, options: expandColorSpec(spec), glyphAlt: budget <= 7 && plain }); budget -= 5 + 2 * s;
      } else throw new Error(`"${c}" needs ${s} colors (or 1 as a one-color tail kana), got ${r.n}`);
    } else {
      if (!pool.index.has(c)) throw new Error(`"${c}" is not in the kanji pool`);
      if (glyphRun) throw onlyGlyphs(c);
      const index = pool.index.get(c), need = pool.counts[index], r = colorRun(chars, i, need); i = r.i;
      if (r.n !== need) throw new Error(`"${c}" needs ${need} colors, got ${r.n}`);
      tokens.push({ type: 'kanji', char: c, index, spec: r.spec, options: expandColorSpec(r.spec) }); budget -= 12 + 2 * need;
    }
  }
  if (budget > 0) throw new Error('text too short for header');
  if (i < chars.length) throw new Error('trailing characters: ' + chars.slice(i).join(''));
  return { dataBits, checkBits, tokens };
}
const pushInt = (bits, v, n) => { for (let b = n - 1; b >= 0; b--) bits.push((v >> b) & 1); };
// Alternatives of every parsed symbol: { type, index|v, colors }. With swap, a look-alike kana also tries its
// hiragana/katakana partner when the stroke count is the same (so the layout is unchanged) or it is one-color.
function symbolAlts(kana, tk, swap, fixed = false) {
  if (tk.type === 'alpha') return tk.options.map(v => ({ type: 'alpha', v }));
  if (tk.type === 'kanji') return tk.options.map(o => ({ type: 'kanji', index: tk.index, colors: o }));
  const idx = [tk.index], q = swap && PARTNER.get(tk.char);
  if (q && kana.index.has(q) && (tk.type === 'kanaGlyph' || kana.counts[kana.index.get(q)] === kana.counts[tk.index])) idx.push(kana.index.get(q));
  const alts = idx.flatMap(ix => tk.options.map(o => ({ type: tk.type, index: ix, colors: o, fixed })));
  if (tk.glyphAlt) alts.push(...idx.map(ix => ({ type: 'kanaGlyph', index: ix, colors: [tk.options[0][0]] })));
  return alts;
}
function altBits(a) {
  const bits = [];
  if (a.type === 'alpha') pushInt(bits, a.v, 7);
  else { pushInt(bits, a.index, a.type === 'kanji' ? 12 : 5); for (const c of a.colors) pushInt(bits, c, 2); }
  return bits;
}
function altToken(pool, kana, a) {
  if (a.type === 'alpha') return { type: 'alpha', char: ALPHA[a.v >> 2], color: a.v & 3 };
  if (a.type === 'kanji') return { type: 'kanji', char: pool.chars[a.index], index: a.index, colors: a.colors };
  if (a.type === 'kanaGlyph') return { type: 'kanaGlyph', char: kana.chars[a.index], index: a.index, color: a.colors[0] };
  const colors = a.colors.slice(); while (colors.length < kana.counts[a.index]) colors.push(0); // KF: 4th stroke black
  return { type: 'kana', char: kana.chars[a.index], index: a.index, colors };
}
const product = (alts) => alts.reduce((a, x) => a * x.length, 1);
// Enumerate every combination; keep those whose check matches and whose padding is the surplus (or all zero, v1.0).
function search(p, alts, toCandidate, maxCandidates) {
  const total = product(alts);
  if (total > maxCandidates) throw new Error(`too many combinations (${total}); narrow the uncertainty`);
  const L = p.dataBits + p.checkBits, ob = alts.map(a => a.map(altBits)), choice = new Array(alts.length).fill(0), results = [], seen = new Set();
  let tried = 0;
  for (;;) {
    tried++;
    const bits = [];
    for (let k = 0; k < ob.length; k++) for (const b of ob[k][choice[k]]) bits.push(b);
    const data = bits.slice(0, p.dataBits), chk = bits.slice(p.dataBits, L);
    const padding = checkCode(data, p.checkBits).every((b, j) => b === chk[j]) && paddingKind(data, bits.slice(L));
    if (padding) {
      const dk = data.join('');
      if (!seen.has(dk)) { seen.add(dk); results.push({ bits: data, hex: bitsToHex(data), ...toCandidate(alts.map((a, k) => a[choice[k]])), padding }); }
    }
    let k = 0;
    while (k < choice.length && ++choice[k] === alts[k].length) choice[k++] = 0;
    if (k === choice.length) break;
  }
  return { candidates: results, tried, total };
}
// Look-alike retry. lookalike in the result: 'off' (not tried), 'always' (swapLookalikes), 'fallback' (the normal
// search found nothing, so the partners were tried too; tried counts both runs), 'skipped' (fallback too large).
function searchWithLookalikes(p, altsFor, toCandidate, { maxCandidates = 2_000_000, swapLookalikes = false, lookalikeFallback = true } = {}) {
  const r = { ...search(p, altsFor(swapLookalikes), toCandidate, maxCandidates), lookalike: swapLookalikes ? 'always' : 'off' };
  if (r.candidates.length || swapLookalikes || !lookalikeFallback) return r;
  const b = altsFor(true), totalB = product(b);
  if (totalB === r.total) return r;
  if (totalB > maxCandidates) return { ...r, lookalike: 'skipped' };
  const r2 = search(p, b, toCandidate, maxCandidates);
  return { ...r2, tried: r.tried + r2.tried, lookalike: 'fallback' };
}
export function decodeMixed(pool, text, o = {}) {
  const kana = o.kana ?? null, p = parseMixed(pool, text, kana);
  const toCandidate = (alts) => { const tokens = alts.map(a => altToken(pool, kana, a)); return { text: formatMixed(tokens, p.dataBits, p.checkBits), tokens }; };
  const r = searchWithLookalikes(p, swap => p.tokens.map(tk => symbolAlts(kana, tk, swap)), toCandidate, o);
  return { ...r, dataBits: p.dataBits, checkBits: p.checkBits };
}

// ---------- fixed-length kana (v1.2), header "KF(256+12bit)" ----------
// Every kana carries exactly 3 colored strokes (5 + 6 = 11 bit), so the length is always ceil(L / 11) kana
// (256 bit: 24 kana). The 4th stroke of きたなふほネホヰ is written black and ignored by the decoder.
export function encodeKanaFixed(kana, dataBits, { checkBits = DEFAULT_CHECK_BITS } = {}) {
  const { bits, L } = streamOf(dataBits, checkBits), tokens = [];
  let pos = 0;
  for (; pos < L; pos += 11) {
    const idx = readInt(bits, pos, 5), colors = [0, 1, 2].map(j => readInt(bits, pos + 5 + 2 * j, 2));
    while (colors.length < kana.counts[idx]) colors.push(0);
    tokens.push({ type: 'kana', char: kana.chars[idx], index: idx, colors });
  }
  return { tokens, text: formatKanaFixed(tokens, dataBits.length, checkBits), totalBits: L, dataBits: dataBits.length, checkBits, writtenBits: pos, surplus: pos - L, fixed: true };
}
export function formatKanaFixed(tokens, dataLen, checkBits) {
  return `KF(${dataLen}${checkBits ? '+' + checkBits : ''}bit)` + tokens.map(t => t.char + t.colors.join('')).join(' ');
}
export function parseKanaFixed(kana, text) {
  const t = squeeze(text);
  const m = /^[Kk][Ff][(（](\d+)(?:\+(\d+))?bit[)）]/i.exec(t);
  if (!m) throw new Error('missing header like KF(256+12bit)');
  const dataBits = +m[1], checkBits = m[2] === undefined ? DEFAULT_CHECK_BITS : +m[2];
  const chars = [...t.slice(m[0].length)], tokens = [];
  let i = 0, budget = dataBits + checkBits;
  while (i < chars.length && budget > 0) {
    const c = chars[i++];
    if (!kana.index.has(c)) throw new Error(`"${c}" is not in the kana set (${kana.chars.join('')})`);
    const index = kana.index.get(c), s = kana.counts[index], r = colorRun(chars, i, s); i = r.i;
    if (r.n !== s) throw new Error(`"${c}" needs ${s} colors, got ${r.n}`);
    const options = [...new Map(expandColorSpec(r.spec).map(a => a.slice(0, 3)).map(a => [a.join(''), a])).values()];
    tokens.push({ type: 'kana', char: c, index, spec: r.spec, options }); budget -= 11;
  }
  if (budget > 0) throw new Error('text too short for header');
  if (i < chars.length) throw new Error('trailing characters: ' + chars.slice(i).join(''));
  return { dataBits, checkBits, tokens, fixed: true };
}
export function decodeKanaFixed(kana, text, o = {}) {
  const p = parseKanaFixed(kana, text);
  const toCandidate = (alts) => { const tokens = alts.map(a => altToken(null, kana, a)); return { text: formatKanaFixed(tokens, p.dataBits, p.checkBits), tokens }; };
  const r = searchWithLookalikes(p, swap => p.tokens.map(tk => symbolAlts(kana, tk, swap, true)), toCandidate, o);
  return { ...r, dataBits: p.dataBits, checkBits: p.checkBits, fixed: true };
}

// ---------- the web page's model (web/app.html; the Android port mirrors it and is checked by test vectors) ----------
// types: { [1-based position]: 'alpha' | 'kana' }, positions not listed are kanji.
// enabled: { alpha: bool, kana: bool } — which symbol types the user switched on.
export const TYPE_ROTATION = ['kanji', 'alpha', 'kana'];
export function nextType(cur, { alpha = true, kana = true } = {}) {
  const on = TYPE_ROTATION.filter(t => t === 'kanji' || (t === 'alpha' ? alpha : kana));
  return on[(on.indexOf(cur) + 1) % on.length];
}
// Click on symbol k: rotate its type kanji → alpha → kana → kanji (skipping disabled types); later positions go back
// to kanji (the boundaries move), earlier ones stay.
export function clickType(types, k, enabled) {
  const next = {};
  for (const [p, t] of Object.entries(types)) if (+p < k) next[p] = t;
  const n = nextType(types[k] ?? 'kanji', enabled);
  if (n !== 'kanji') next[k] = n;
  return next;
}
// Drop positions whose type was switched off.
export const keepEnabled = (types, { alpha = true, kana = true } = {}) =>
  Object.fromEntries(Object.entries(types).filter(([, t]) => t === 'alpha' ? alpha : kana));
export const ALL_POSITIONS = 80;
export const allOf = (type) => type === 'kanji' ? {} : Object.fromEntries(Array.from({ length: ALL_POSITIONS }, (_, i) => [i + 1, type]));
export const isAllOf = (types, type) => Array.from({ length: ALL_POSITIONS }, (_, i) => types[i + 1] === type).every(Boolean);
// The endings shown: always 'kanji' (keep the types, pad the last symbol), plus 'alpha' / 'kana' when enabled.
// fixed (KF) applies only when every position is kana. Returns { variants: [{ tail, enc }], common, fixed }.
export function webEncode(pool, kana, bits, { checkBits = DEFAULT_CHECK_BITS, types = {}, alpha = true, kana: kanaOn = false, fixed = false } = {}) {
  if (kanaOn && fixed && isAllOf(types, 'kana')) {
    const enc = encodeKanaFixed(kana, bits, { checkBits });
    return { variants: [{ tail: 'fixed', enc }], common: enc.tokens.length, fixed: true };
  }
  const pos = (ty) => Object.keys(types).filter(p => types[p] === ty).map(Number);
  const o = { checkBits, alphaPos: pos('alpha'), kanaPos: pos('kana'), kana };
  const tails = ['kanji', ...(alpha ? ['alpha'] : []), ...(kanaOn ? ['kana'] : [])];
  const variants = tails.map(tail => ({ tail, enc: encodeMixed(pool, bits, { ...o, tail }) }))
    .filter((v, i, all) => all.findIndex(w => w.enc.text === v.enc.text) === i); // identical endings shown once
  const same = (n) => variants.every(v => n < v.enc.tokens.length && v.enc.tokens[n].type === variants[0].enc.tokens[n].type && v.enc.tokens[n].char === variants[0].enc.tokens[n].char);
  let n = 0; while (same(n)) n++;
  return { variants, common: n, fixed: false };
}
const countOf = (r, ...ty) => r.tokens.filter(t => ty.includes(t.type)).length;
export const webInfo = (r) => `漢字${countOf(r, 'kanji')}・英数字${countOf(r, 'alpha')}・かな${countOf(r, 'kana', 'kanaGlyph')}・書く量${r.writtenBits}bit`;
export const webHead = (w) => { const a = w.variants[0].enc; return `${a.totalBits}bit (データ${a.dataBits}+チェック${a.checkBits}) ／ 共通部分 ${w.common}記号`; };
