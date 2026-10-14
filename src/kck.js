// kanji-color-key core module (browser + Node, no dependencies).
// A pool is { kanji: string of 4096 chars, counts: number[] (stroke counts in KanjiVG order) }.
export const COLORS = ['黒', '赤', '青', '緑'];
export const COLOR_CSS = ['#111111', '#d62828', '#1d4ed8', '#15803d'];
export const DEFAULT_CHECK_BITS = 12;
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
  const body = bitsToBytes(dataBits), msg = new Uint8Array(8 + body.length);
  msg.set([0x6b, 0x63, 0x6b, 0x31]); new DataView(msg.buffer).setUint32(4, dataBits.length); msg.set(body, 8);
  return bytesToBits(sha256(msg)).slice(0, checkBits);
}

// ---------- pool ----------
export function makePool(kanji, counts) {
  const chars = [...kanji];
  if (chars.length !== 4096 || counts.length !== 4096) throw new Error('pool must have 4096 kanji');
  const index = new Map(chars.map((c, i) => [c, i]));
  return { chars, counts, index };
}

// ---------- encode ----------
// Returns { text, tokens, totalBits, dataBits, checkBits }.
// tokens: {type:'kanji', char, index, colors[]} | {type:'hex', char, color}
export function encodeBits(pool, dataBits, { checkBits = DEFAULT_CHECK_BITS } = {}) {
  const bits = dataBits.concat(checkCode(dataBits, checkBits)), L = bits.length, tokens = [];
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
  return { tokens, text: formatTokens(tokens, dataBits.length, checkBits), totalBits: L, dataBits: dataBits.length, checkBits };
}
export const encodeHex = (pool, hex, o) => encodeBits(pool, hexToBits(hex), o);
export function formatTokens(tokens, dataLen, checkBits) {
  return `(${dataLen}+${checkBits}bit)` + tokens.map(t => t.type === 'kanji' ? t.char + t.colors.join('') : t.char + t.color).join('');
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
// Returns { candidates:[{bits, hex, text}], tried, total, checkBits, dataBits }.
export function decodeText(pool, text, { maxCandidates = 2_000_000 } = {}) {
  const p = parseText(pool, text);
  const total = p.tokens.reduce((a, t) => a * t.options.length, 1);
  if (total > maxCandidates) throw new Error(`too many combinations (${total}); narrow the uncertainty`);
  const L = p.dataBits + p.checkBits, results = [];
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
    if (bits.slice(L).every(b => b === 0)) {
      const data = bits.slice(0, p.dataBits), chk = bits.slice(p.dataBits, L);
      if (checkCode(data, p.checkBits).every((b, j) => b === chk[j])) {
        const tokens = p.tokens.map((t, k) => t.type === 'kanji'
          ? { type: 'kanji', char: t.char, index: t.index, colors: t.options[choice[k]] }
          : { type: 'hex', char: t.char, color: t.options[choice[k]][0] });
        results.push({ bits: data, hex: bitsToHex(data), text: formatTokens(tokens, p.dataBits, p.checkBits), tokens });
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
  const bits = dataBits.concat(checkCode(dataBits, checkBits)), L = bits.length, tokens = [];
  for (let pos = 0; pos < L; pos += 7) tokens.push({ type: 'alpha', char: ALPHA[readInt(bits, pos, 5)], color: readInt(bits, pos + 5, 2) });
  return { tokens, text: formatAlpha(tokens, dataBits.length, checkBits), totalBits: L, dataBits: dataBits.length, checkBits };
}
export function formatAlpha(tokens, dataLen, checkBits) {
  return `A(${dataLen}+${checkBits}bit)` + tokens.map((t, i) => (i && i % 4 === 0 ? ' ' : '') + t.char + t.color).join('');
}
// Uncertainty: '?' as glyph (any of 32) or as color (any of 4).
export function parseAlpha(text) {
  const t = text.replace(/\s+/g, '').toUpperCase();
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
  const choice = new Array(p.tokens.length).fill(0), results = []; let tried = 0;
  for (;;) {
    tried++;
    const bits = [];
    p.tokens.forEach((t, k) => { const v = t.options[choice[k]]; for (let b = 6; b >= 0; b--) bits.push((v >> b) & 1); });
    if (bits.slice(L).every(b => b === 0)) {
      const data = bits.slice(0, p.dataBits), chk = bits.slice(p.dataBits, L);
      if (checkCode(data, p.checkBits).every((b, j) => b === chk[j])) {
        const tokens = p.tokens.map((t, k) => ({ type: 'alpha', char: ALPHA[t.options[choice[k]] >> 2], color: t.options[choice[k]] & 3 }));
        results.push({ bits: data, hex: bitsToHex(data), text: formatAlpha(tokens, p.dataBits, p.checkBits), tokens });
      }
    }
    let k = 0;
    while (k < choice.length && ++choice[k] === p.tokens[k].options.length) choice[k++] = 0;
    if (k === choice.length) break;
  }
  return { candidates: results, tried, total, dataBits: p.dataBits, checkBits: p.checkBits };
}
// Dispatch on header: "A(" = alpha mode, "(" = kanji mode.
export const isAlphaText = (text) => /^\s*[Aa]\s*[(（]/.test(text);
export const decodeAny = (pool, text, o) => isAlphaText(text) ? decodeAlpha(text, o) : isMixedText(text) ? decodeMixed(pool, text, o) : decodeText(pool, text, o);

// ---------- mixed mode: each symbol is a pool kanji (12 bit + 2 bit/stroke) or an alpha-32 glyph (7 bit) ----------
// alphaPos: Set of 1-based symbol positions that are alpha glyphs; other positions are kanji.
// tail 'kanji': keep the scheme to the end (last symbol zero-padded).
// tail 'alpha': as soon as the next kanji would not be fully used by the remaining bits, finish with alpha glyphs.
// Text: "M(256+12bit)" + symbols separated by spaces: <kanji><color digits> or <glyph><color digit>.
export function encodeMixed(pool, dataBits, { checkBits = DEFAULT_CHECK_BITS, alphaPos = [], tail = 'kanji' } = {}) {
  const ap = new Set(alphaPos), bits = dataBits.concat(checkCode(dataBits, checkBits)), L = bits.length, tokens = [];
  let pos = 0, alphaRest = false;
  for (let i = 1; pos < L; i++) {
    let isAlpha = alphaRest || ap.has(i);
    if (!isAlpha && tail === 'alpha') {
      const idx = readInt(bits, pos, 12);
      if (L - pos < 12 + 2 * pool.counts[idx]) { alphaRest = isAlpha = true; }
    }
    if (isAlpha) { tokens.push({ type: 'alpha', char: ALPHA[readInt(bits, pos, 5)], color: readInt(bits, pos + 5, 2) }); pos += 7; }
    else {
      const idx = readInt(bits, pos, 12), colors = []; pos += 12;
      for (let s = 0; s < pool.counts[idx]; s++) { colors.push(readInt(bits, pos, 2)); pos += 2; }
      tokens.push({ type: 'kanji', char: pool.chars[idx], index: idx, colors });
    }
  }
  return { tokens, text: formatMixed(tokens, dataBits.length, checkBits), totalBits: L, dataBits: dataBits.length, checkBits, writtenBits: pos };
}
export function formatMixed(tokens, dataLen, checkBits) {
  return `M(${dataLen}+${checkBits}bit)` + tokens.map(t => t.type === 'kanji' ? t.char + t.colors.join('') : t.char + t.color).join(' ');
}
export const isMixedText = (text) => /^\s*[Mm]\s*[(（]/.test(text);
export function parseMixed(pool, text) {
  const t = text.replace(/\s+/g, '').normalize('NFC');
  const m = /^[Mm][(（](\d+)(?:\+(\d+))?bit[)）]/i.exec(t);
  if (!m) throw new Error('missing header like M(256+12bit)');
  const dataBits = +m[1], checkBits = m[2] === undefined ? DEFAULT_CHECK_BITS : +m[2];
  const chars = [...t.slice(m[0].length)], tokens = [];
  let i = 0, budget = dataBits + checkBits;
  while (i < chars.length && budget > 0) {
    const c = chars[i++];
    if (/[0-9A-Za-z?]/.test(c)) {
      const g = c.toUpperCase(), col = chars[i++];
      if (g !== '?' && !ALPHA.includes(g)) throw new Error(`"${g}" is not in the alpha set (0, 1, 8, U are excluded)`);
      if (!col || !/[0-3?]/.test(col)) throw new Error(`bad color "${col ?? ''}" after "${g}"`);
      const gs = g === '?' ? [...Array(32).keys()] : [ALPHA.indexOf(g)], cs = col === '?' ? [0, 1, 2, 3] : [+col];
      tokens.push({ type: 'alpha', char: g, spec: col, options: gs.flatMap(a => cs.map(b => a * 4 + b)) }); budget -= 7;
    } else {
      if (!pool.index.has(c)) throw new Error(`"${c}" is not in the kanji pool`);
      const index = pool.index.get(c), need = pool.counts[index];
      let spec = '', n = 0;
      while (i < chars.length) {
        const d = chars[i];
        if (n === need && !')]'.includes(d)) break;
        if (/[0-3?]/.test(d)) n++; else if (!'()[]'.includes(d)) break;
        spec += d; i++;
      }
      if (n !== need) throw new Error(`"${c}" needs ${need} colors, got ${n}`);
      tokens.push({ type: 'kanji', char: c, index, spec, options: expandColorSpec(spec) }); budget -= 12 + 2 * need;
    }
  }
  if (budget > 0) throw new Error('text too short for header');
  if (i < chars.length) throw new Error('trailing characters: ' + chars.slice(i).join(''));
  return { dataBits, checkBits, tokens };
}
export function decodeMixed(pool, text, { maxCandidates = 2_000_000 } = {}) {
  const p = parseMixed(pool, text), L = p.dataBits + p.checkBits;
  const total = p.tokens.reduce((a, t) => a * t.options.length, 1);
  if (total > maxCandidates) throw new Error(`too many combinations (${total}); narrow the uncertainty`);
  const choice = new Array(p.tokens.length).fill(0), results = []; let tried = 0;
  for (;;) {
    tried++;
    const bits = [];
    p.tokens.forEach((t, k) => {
      const o = t.options[choice[k]];
      if (t.type === 'kanji') { for (let b = 11; b >= 0; b--) bits.push((t.index >> b) & 1); for (const c of o) bits.push(c >> 1, c & 1); }
      else for (let b = 6; b >= 0; b--) bits.push((o >> b) & 1);
    });
    if (bits.slice(L).every(b => b === 0)) {
      const data = bits.slice(0, p.dataBits), chk = bits.slice(p.dataBits, L);
      if (checkCode(data, p.checkBits).every((b, j) => b === chk[j])) {
        const tokens = p.tokens.map((t, k) => t.type === 'kanji'
          ? { type: 'kanji', char: t.char, index: t.index, colors: t.options[choice[k]] }
          : { type: 'alpha', char: ALPHA[t.options[choice[k]] >> 2], color: t.options[choice[k]] & 3 });
        results.push({ bits: data, hex: bitsToHex(data), text: formatMixed(tokens, p.dataBits, p.checkBits), tokens });
      }
    }
    let k = 0;
    while (k < choice.length && ++choice[k] === p.tokens[k].options.length) choice[k++] = 0;
    if (k === choice.length) break;
  }
  return { candidates: results, tried, total, dataBits: p.dataBits, checkBits: p.checkBits };
}
