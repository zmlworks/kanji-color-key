// Surplus (padding) bits: since v1.1 the slots after data+check up to the end of the last symbol are filled with
// SHA-256("kckp" || u32 len || u32 counter || data) instead of zeros (black). Old zero-padded outputs must still decode.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../src/kck.js';
import * as OLD from './fixtures/kck-1.0.0.js'; // frozen copy of src/kck.js at v1.0.0 (zero padding)
import { pool } from '../src/pool-node.js';

const oldPool = OLD.makePool(pool.chars.join(''), pool.counts);
// Re-create the written bit stream from tokens (what a person writes on paper).
function written(tokens) {
  const bits = [], push = (v, n) => { for (let b = n - 1; b >= 0; b--) bits.push((v >> b) & 1); };
  for (const t of tokens) {
    if (t.type === 'kanji') { push(t.index, 12); for (const c of t.colors) push(c, 2); }
    else if (t.type === 'hex') { push(parseInt(t.char, 16), 4); push(t.color, 2); }
    else push(K.ALPHA.indexOf(t.char) * 4 + t.color, 7);
  }
  return bits;
}
const MODES = {
  kanji: (b, c) => K.encodeBits(pool, b, { checkBits: c }),
  alpha: (b, c) => K.encodeAlpha(b, { checkBits: c }),
  mixedKanjiTail: (b, c) => K.encodeMixed(pool, b, { checkBits: c, alphaPos: [2, 5], tail: 'kanji' }),
  mixedAlphaTail: (b, c) => K.encodeMixed(pool, b, { checkBits: c, alphaPos: [3], tail: 'alpha' }),
  allAlphaMixed: (b, c) => K.encodeMixed(pool, b, { checkBits: c, alphaPos: [...Array(80).keys()].map(i => i + 1) }),
};
const OLD_MODES = {
  kanji: (b, c) => OLD.encodeBits(oldPool, b, { checkBits: c }),
  alpha: (b, c) => OLD.encodeAlpha(b, { checkBits: c }),
  mixedKanjiTail: (b, c) => OLD.encodeMixed(oldPool, b, { checkBits: c, alphaPos: [2, 5], tail: 'kanji' }),
  mixedAlphaTail: (b, c) => OLD.encodeMixed(oldPool, b, { checkBits: c, alphaPos: [3], tail: 'alpha' }),
  allAlphaMixed: (b, c) => OLD.encodeMixed(oldPool, b, { checkBits: c, alphaPos: [...Array(80).keys()].map(i => i + 1) }),
};

test('surplusBits: deterministic, data-dependent, documented derivation', () => {
  const b = K.hexToBits('00'.repeat(32));
  assert.deepEqual(K.surplusBits(b, 600), K.surplusBits(b, 600));
  assert.notDeepEqual(K.surplusBits(b, 64), K.surplusBits(K.hexToBits('00'.repeat(31) + '01'), 64));
  const msg = Buffer.concat([Buffer.from('kckp'), Buffer.from([0, 0, 1, 0]), Buffer.from([0, 0, 0, 1]), Buffer.alloc(32)]);
  assert.deepEqual(K.surplusBits(b, 512).slice(256), K.bytesToBits(K.sha256(msg)));
});

test('random keys, every mode: data/check unchanged, padding = derived surplus, exact round trip', () => {
  for (const [name, enc] of Object.entries(MODES)) for (let r = 0; r < 60; r++) {
    const n = [64, 128, 200, 256, 257, 384, 512][r % 7], c = [0, 12][r % 2], b = K.randomBits(n);
    const e = enc(b, c), w = written(e.tokens), L = n + c;
    assert.equal(w.length, e.writtenBits, name); assert.equal(e.surplus, w.length - L);
    assert.deepEqual(w.slice(0, n), b, name);
    assert.deepEqual(w.slice(n, L), K.checkCode(b, c), name);
    assert.deepEqual(w.slice(L), K.surplusBits(b, e.surplus), `${name}: padding must be the derived surplus`);
    // non-padding part identical to v1.0 output (only the padding changed)
    const o = OLD_MODES[name](b, c), wo = written(o.tokens);
    assert.deepEqual(wo.slice(0, L), w.slice(0, L), name);
    const d = K.decodeAny(pool, e.text);
    assert.ok(d.candidates.length >= 1); assert.equal(d.candidates[0].hex, K.bitsToHex(b), name);
    if (e.surplus) assert.ok(['surplus', 'zero'].includes(d.candidates[0].padding));
  }
});

test('no surplus slot is forced to black: surplus colors are ~uniform over 4 colors', () => {
  const hist = [0, 0, 0, 0]; let surplusStrokes = 0, allBlackTails = 0, tails = 0;
  for (let r = 0; r < 400; r++) {
    const b = K.randomBits(256), e = K.encodeMixed(pool, b, { tail: 'kanji' });
    // strokes of the last kanji that lie entirely in the padding
    const last = e.tokens.at(-1); if (last.type !== 'kanji') continue;
    const start = e.writtenBits - 2 * last.colors.length;
    const sur = last.colors.filter((_, s) => start + 2 * s >= e.totalBits);
    sur.forEach(c => hist[c]++); surplusStrokes += sur.length;
    if (sur.length >= 3) { tails++; if (sur.every(c => c === 0)) allBlackTails++; }
  }
  assert.ok(surplusStrokes > 500);
  for (const h of hist) assert.ok(h / surplusStrokes > 0.18 && h / surplusStrokes < 0.32, `color histogram ${hist}`);
  assert.ok(allBlackTails <= Math.max(2, tails * 0.1), `${allBlackTails}/${tails} tails all black`);
  // alpha / trailing glyphs: with 246 bits the last glyph carries 1 data bit + 6 padding bits.
  // v1.0 could only produce 2 distinct last symbols ("2" or "J", always black); now ~all 64 appear and colors vary.
  const lastGlyphs = new Set(), colors = new Set();
  for (let r = 0; r < 300; r++) { const e = K.encodeAlpha(K.randomBits(246)); assert.equal(e.surplus, 6); const t = e.tokens.at(-1); lastGlyphs.add(t.char + t.color); colors.add(t.color); }
  assert.ok(lastGlyphs.size > 40, `${lastGlyphs.size} distinct last glyphs`); assert.equal(colors.size, 4);
  // mixed "last = alphanumeric": when the last glyph's color lies in the padding it is no longer always black
  const tailColors = [0, 0, 0, 0];
  for (let r = 0; r < 400; r++) { const e = K.encodeMixed(pool, K.randomBits(256), { tail: 'alpha' }); if (e.surplus >= 2 && e.tokens.at(-1).type === 'alpha') tailColors[e.tokens.at(-1).color]++; }
  assert.ok(tailColors.every(n => n > 10), `trailing glyph colors ${tailColors}`);
});

test('backward compatibility: v1.0 (zero / black padded) outputs still decode to the same key', () => {
  for (const [name, enc] of Object.entries(OLD_MODES)) for (let r = 0; r < 30; r++) {
    const n = [64, 256, 300, 512][r % 4], c = [0, 12][r % 2], b = K.randomBits(n), o = enc(b, c);
    const d = K.decodeAny(pool, o.text);
    assert.equal(d.candidates[0].hex, K.bitsToHex(b), name);
    if (c) assert.equal(d.candidates.length, 1);
    if (o.tokens && d.candidates[0].padding !== 'none') assert.equal(d.candidates[0].padding, 'zero');
  }
  // fixed vectors from the v1.0 README
  const v = [
    '(256+12bit)唖0102020303施111212131廁121222223233梧13232333300芦0202030團11112121313202錦2222323303031313佶32110210',
    'A(256+12bit)2030C0B3 9261D2S2 H3R26392 O1V391Q1 X3I3R021 4140S2K0 D2P1M2Y0 K0S2O1H3 S2G3I1V3 Z0N2B0',
    'M(256+12bit)處23213313000 圃1223203223 I1 叮03030 進23112210032 砥1122223311 K0 叶12233 鍍22102321231322121 叫011033 厨000000000000',
    'M(256+12bit)處23213313000 圃1223203223 I1 叮03030 進23112210032 砥1122223311 K0 叶12233 鍍22102321231322121 叫011033 E2 20',
  ];
  for (const t of v) { const d = K.decodeAny(pool, t), od = OLD.decodeAny(oldPool, t); assert.equal(d.candidates.length, 1, t); assert.equal(d.candidates[0].hex, od.candidates[0].hex); }
});

test('padding still acts as a check; wrong padding is rejected; ? on padding strokes is fine', () => {
  for (let r = 0; r < 40; r++) {
    const b = K.randomBits(256), e = K.encodeBits(pool, b);
    const p = K.parseText(pool, e.text), last = p.tokens.length - 1, lt = p.tokens[last];
    if (lt.type !== 'kanji') continue;
    const start = e.writtenBits - 2 * lt.spec.length, firstPad = lt.spec.split('').findIndex((_, s) => start + 2 * s >= e.totalBits);
    if (firstPad < 0) continue;
    const head = e.text.match(/^\([^)]*\)/)[0], body = p.tokens.slice(0, last).map(t => t.char + t.spec).join('');
    // a padding stroke changed to a color that is neither the surplus nor 0 -> rejected
    const sp = [...lt.spec], orig = +sp[firstPad]; sp[firstPad] = String([1, 2, 3].find(x => x !== orig));
    const bad = K.decodeText(pool, head + body + lt.char + sp.join(''));
    assert.equal(bad.candidates.length, 0);
    // unknown padding strokes: the correct key is listed exactly once (zero and surplus variants are merged)
    sp[firstPad] = '?';
    const d = K.decodeText(pool, head + body + lt.char + sp.join(''));
    assert.equal(d.candidates.filter(x => x.hex === K.bitsToHex(b)).length, 1);
  }
});
