// Kana (v1.2): 32 kana (>= 3 strokes), 5 bit identity + 2 bit per stroke, inside mixed mode (M(...)), with the
// one-color tail kana ending, plus the fixed-length all-kana variant KF(...). v1.1 surplus padding and check.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../src/kck.js';
import { pool } from '../src/pool-node.js';
import { kana, kanaStrokes } from '../src/kana-node.js';

const KVG_COUNTS = { あ: 3, お: 3, か: 3, き: 4, け: 3, さ: 3, せ: 3, た: 4, な: 4, に: 3, は: 3, ふ: 4, ほ: 4, ま: 3, む: 3, も: 3, や: 3, を: 3,
  ウ: 3, オ: 3, キ: 3, ケ: 3, サ: 3, チ: 3, ツ: 3, テ: 3, ネ: 4, ホ: 4, ミ: 3, モ: 3, ヨ: 3, ヰ: 4 };
// What a person writes, as bits (KF: only the first 3 colors of a kana carry bits).
function written(tokens, fixed = false) {
  const bits = [], push = (v, n) => { for (let b = n - 1; b >= 0; b--) bits.push((v >> b) & 1); };
  for (const t of tokens) {
    if (t.type === 'kanji') { push(t.index, 12); t.colors.forEach(c => push(c, 2)); }
    else if (t.type === 'alpha') push(K.ALPHA.indexOf(t.char) * 4 + t.color, 7);
    else { push(t.index, 5); for (const c of (t.type === 'kana' ? (fixed ? t.colors.slice(0, 3) : t.colors) : [t.color])) push(c, 2); }
  }
  return bits;
}
const ALL = K.allOf('kana'), allKana = Object.keys(ALL).map(Number);
const enc = (b, o) => K.encodeMixed(pool, b, { kana, ...o });
const dec = (t, o) => K.decodeAny(pool, t, { kana, ...o });

test('kana set: 18 hiragana + 14 katakana (incl. ヰ), KanjiVG stroke counts, index order, strokes kept for drawing', () => {
  assert.equal(kana.chars.join(''), K.KANA); assert.ok(K.KANA.includes('ヰ'));
  assert.equal(kana.chars.filter(c => c < '\u30a0').length, 18);
  kana.chars.forEach((c, i) => { assert.equal(kana.counts[i], KVG_COUNTS[c], c); assert.equal(kanaStrokes[i].length, KVG_COUNTS[c]); });
  assert.ok(kana.chars.every(c => !pool.index.has(c)));
});

test('mixed with kana: data, check, surplus in place; exact round trip for every tail', () => {
  for (let r = 0; r < 240; r++) {
    const n = [64, 128, 200, 255, 256, 257, 384, 512][r % 8], c = [0, 12, 3][r % 3], b = K.randomBits(n), tail = ['kanji', 'alpha', 'kana'][r % 3];
    const kp = r % 4 === 0 ? allKana : [2, 3, 5 + (r % 6)], ap = r % 4 === 0 ? [] : [4];
    const e = enc(b, { checkBits: c, kanaPos: kp, alphaPos: ap, tail }), w = written(e.tokens), L = n + c, tag = `${tail} ${n}+${c} ${r}`;
    assert.equal(w.length, e.writtenBits, tag);
    assert.deepEqual(w.slice(0, n), b, tag); assert.deepEqual(w.slice(n, L), K.checkCode(b, c), tag);
    assert.deepEqual(w.slice(L), K.surplusBits(b, e.surplus), tag);
    if (tail !== 'kanji') assert.ok(e.surplus < 7, tag);
    if (tail === 'kana') { const g = e.tokens.findIndex(t => t.type === 'kanaGlyph'); if (g >= 0) assert.ok(e.tokens.slice(g).every(t => t.type === 'kanaGlyph'), tag); }
    e.tokens.forEach((t, i) => { if (ap.includes(i + 1) && (tail === 'kanji' || !e.tokens.slice(0, i + 1).some(x => x.type === 'kanaGlyph'))) assert.equal(t.type, 'alpha', tag); });
    const d = dec(e.text);
    assert.equal(d.candidates.length, 1, tag); assert.equal(d.candidates[0].hex, K.bitsToHex(b), tag); assert.equal(d.candidates[0].text, e.text, tag);
    assert.equal(dec(e.text.replace(/ /g, '')).candidates[0].hex, K.bitsToHex(b));
  }
});

test('all-kana in mixed mode is the prototype bit layout; K(...) prototype texts decode as M(...)', () => {
  const hex = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
  const body = 'あ000 を020 を212 を011 は303 た1320 を030 ネ2223 チ212 ま313 チ133 ミ000 か021 か030 ネ0202 ケ121 オ233 か021 オ111 ふ2330 テ232 ヨ323 ヰ3022 に2';
  const e = enc(K.hexToBits(hex), { checkBits: 12, kanaPos: allKana, tail: 'kana' });
  assert.equal(e.text, 'M(256+12bit)' + body); // the prototype's golden vector, header M
  const d = dec('K(256+12bit)' + body);
  assert.equal(d.candidates.length, 1); assert.equal(d.candidates[0].hex, hex); assert.equal(d.candidates[0].text, e.text);
});

test('kana tail: switches when the next kanji or kana would not be fully used', () => {
  for (let r = 0; r < 80; r++) {
    const b = K.randomBits(256), e = enc(b, { tail: 'kana', kanaPos: r % 2 ? allKana : [] });
    const g = e.tokens.findIndex(t => t.type === 'kanaGlyph');
    const before = written(e.tokens.slice(0, g < 0 ? e.tokens.length : g)).length;
    if (g >= 0) assert.ok(256 - before > 0 && 256 - before < (r % 2 ? 13 : 62));
    assert.ok(e.surplus < 7);
  }
});

test('uncertainty: ?, (..), [..], color names, halfwidth katakana', () => {
  const b = K.randomBits(256), e = enc(b, { checkBits: 12, kanaPos: allKana }), parts = e.text.split(' ');
  parts[1] = parts[1].replace(/\d(?=\d*$)/, '?'); parts[5] = parts[5].slice(0, 1) + '?' + parts[5].slice(2);
  const d = dec(parts.join(' '));
  assert.equal(d.tried, 16); assert.ok(d.candidates.some(c => c.hex === K.bitsToHex(b)));
  const p2 = e.text.split(' '), k = p2.findIndex((x, i) => i > 0 && /^\D\d{3,4}$/.test(x));
  p2[k] = p2[k][0] + '[' + p2[k].slice(1, 3) + ']' + p2[k].slice(3);
  assert.ok(dec(p2.join(' ')).candidates.some(c => c.hex === K.bitsToHex(b)));
  const named = e.text.replace(/(?<=[^\d(+])(\d+)/g, ds => [...ds].map(x => K.COLORS[+x]).join(''));
  assert.equal(dec(named).candidates[0].hex, K.bitsToHex(b));
  const half = e.text.replace(/[ウオキケサチツテネホミモヨ]/g, c => String.fromCharCode('ｳｵｷｹｻﾁﾂﾃﾈﾎﾐﾓﾖ'.charCodeAt('ウオキケサチツテネホミモヨ'.indexOf(c))));
  assert.equal(dec(half).candidates[0].hex, K.bitsToHex(b));
});

test('a kana followed by the kanji 赤/青/黒/緑 is not confused with color names', () => {
  for (const kj of '黒赤青緑') {
    const b = [...'00000' + '010101', ...pool.index.get(kj).toString(2).padStart(12, '0')].map(Number).concat(K.randomBits(200));
    const e = enc(b, { kanaPos: [1], checkBits: 4 });
    assert.ok(e.text.startsWith('M(223+4bit)あ111 ' + kj), e.text);
    assert.equal(dec(e.text.replace(/ /g, '')).candidates[0].hex, K.bitsToHex(b));
    assert.equal(dec(e.text.replace(/ /g, '').replace(/(?<=\)\S*)\d/g, d => K.COLORS[+d])).candidates[0].hex, K.bitsToHex(b));
  }
});

test('KF: fixed length, 4th stroke black and ignored, round trip', () => {
  for (let r = 0; r < 60; r++) {
    const n = [64, 128, 256, 257, 512][r % 5], c = [0, 12][r % 2], b = K.randomBits(n), e = K.encodeKanaFixed(kana, b, { checkBits: c });
    assert.ok(e.text.startsWith(`KF(${n}${c ? '+' + c : ''}bit)`));
    assert.equal(e.tokens.length, Math.ceil((n + c) / 11));
    const w = written(e.tokens, true);
    assert.deepEqual(w.slice(0, n), b); assert.deepEqual(w.slice(n + c), K.surplusBits(b, e.surplus));
    e.tokens.forEach(t => { assert.equal(t.colors.length, kana.counts[t.index]); t.colors.slice(3).forEach(x => assert.equal(x, 0)); });
    const d = dec(e.text); assert.equal(d.candidates.length, 1); assert.equal(d.candidates[0].hex, K.bitsToHex(b)); assert.equal(d.candidates[0].text, e.text);
    const q = dec(e.text.replace(/([きたなふほネホヰ]\d{3})\d/g, '$1?')); assert.equal(q.tried, 1); assert.equal(q.candidates[0].hex, K.bitsToHex(b));
  }
  assert.equal(K.encodeKanaFixed(kana, K.randomBits(256)).tokens.length, 24);
});

test('v1.0-style zero padding of a kana tail is accepted', () => {
  let n = 0;
  for (let r = 0; r < 200 && n < 10; r++) {
    const b = K.randomBits(256), e = enc(b, { kanaPos: allKana, tail: 'kana' });
    const last = e.tokens.at(-1); if (last.type !== 'kanaGlyph' || e.surplus < 2) continue;
    const w = written(e.tokens).map((x, i) => i < 256 ? x : 0), ix = parseInt(w.slice(-7, -2).join(''), 2), col = w.at(-2) * 2 + w.at(-1);
    const t = K.formatMixed([...e.tokens.slice(0, -1), { type: 'kanaGlyph', char: kana.chars[ix], index: ix, color: col }], 256, 0);
    const d = dec(t); assert.ok(d.candidates.some(c => c.hex === K.bitsToHex(b) && c.padding === 'zero')); n++;
  }
  assert.ok(n >= 5);
});

test('look-alike swap: off by default, automatic fallback when nothing matches, always on request', () => {
  let tested = 0;
  for (let r = 0; r < 400 && tested < 15; r++) {
    const b = K.randomBits(256), e = enc(b, { checkBits: 12, kanaPos: allKana, tail: 'kanji' });
    const body = e.text.slice('M(256+12bit)'.length), m = /[おけさほもオケサホモ](?=\d{3})/.exec(body); if (!m) continue;
    const sw = { お: 'オ', け: 'ケ', さ: 'サ', ほ: 'ホ', も: 'モ', オ: 'お', ケ: 'け', サ: 'さ', ホ: 'ほ', モ: 'も' }[m[0]];
    const bad = 'M(256+12bit)' + body.slice(0, m.index) + sw + body.slice(m.index + 1);
    const off = dec(bad, { lookalikeFallback: false });
    assert.equal(off.lookalike, 'off'); assert.ok(!off.candidates.some(c => c.hex === K.bitsToHex(b)));
    const fb = dec(bad);
    if (!off.candidates.length) { assert.equal(fb.lookalike, 'fallback'); assert.ok(fb.tried > off.tried); assert.ok(fb.candidates.some(c => c.hex === K.bitsToHex(b))); }
    const al = dec(bad, { swapLookalikes: true }); assert.equal(al.lookalike, 'always'); assert.ok(al.candidates.some(c => c.hex === K.bitsToHex(b)));
    const ok = dec(e.text); assert.equal(ok.lookalike, 'off'); assert.ok(ok.tried <= 2); // 2 when the padded last kana may also be read as one-color
    tested++;
  }
  assert.ok(tested >= 10);
  // KF too
  for (let r = 0; r < 200; r++) {
    const b = K.randomBits(256), e = K.encodeKanaFixed(kana, b, { checkBits: 12 }), m = /[おけさほもオケサホモ](?=\d{3})/.exec(e.text.slice(13)); if (!m) continue;
    const sw = { お: 'オ', け: 'ケ', さ: 'サ', ほ: 'ホ', も: 'モ', オ: 'お', ケ: 'け', サ: 'さ', ホ: 'ほ', モ: 'も' }[m[0]];
    const bad = e.text.slice(0, 13 + m.index) + sw + e.text.slice(13 + m.index + 1), d = dec(bad);
    assert.equal(d.lookalike, 'fallback'); assert.equal(d.candidates[0].hex, K.bitsToHex(b)); break;
  }
});

test('fallback is skipped (not an error) when it would be too large', () => {
  for (let r = 0; r < 100; r++) {
    const b = K.randomBits(256), e = K.encodeKanaFixed(kana, b, { checkBits: 12 });
    if (!/[おけさほもオケサホモ]/.test(e.text)) continue;
    const bad = e.text.replace(/^(KF\(256\+12bit\)\S)(\d)/, (m, h, d) => h + ((+d + 1) % 4)); // a wrong color, no mark
    const d = dec(bad, { maxCandidates: 1 });
    assert.equal(d.tried, 1); assert.equal(d.candidates.length, 0); assert.equal(d.lookalike, 'skipped');
    return;
  }
  assert.fail('no sample');
});

test('a one-color tail kana copied stroke by stroke ("ウ222") still decodes', () => {
  let n = 0;
  for (let r = 0; r < 400 && n < 20; r++) {
    const b = K.randomBits(256), e = enc(b, { kanaPos: allKana, tail: 'kana' });
    const last = e.tokens.at(-1); if (last.type !== 'kanaGlyph') continue;
    const t = e.text.replace(/(\S)(\d)$/, (m, ch, d) => ch + d.repeat(kana.counts[last.index]));
    const d = dec(t); assert.ok(d.candidates.some(c => c.hex === K.bitsToHex(b))); n++;
  }
  assert.ok(n >= 10);
});

test('errors', () => {
  const e = enc(K.randomBits(256), { kanaPos: allKana, tail: 'kana' });
  assert.throws(() => dec(e.text.replace(/^(M\(256bit\)\S\d)\d/, '$1')), /needs \d colors \(or 1 as a one-color tail kana\), got [23]/);
  assert.throws(() => dec(e.text + ' あ000'), /trailing/);
  assert.throws(() => K.decodeAny(pool, e.text), /not in the kanji pool/);
  assert.throws(() => K.decodeAny(pool, 'KF(11bit)あ000'), /kana set required/);
  assert.throws(() => dec('KF(11bit)ア000'), /not in the kana set/);
  assert.throws(() => dec('KF(11bit)き000'), /needs 4 colors, got 3/);
  assert.throws(() => dec('M(14bit)あ0 B1'), /cannot follow a one-color kana/);
  assert.throws(() => dec('M(21bit)あ0 か012'), /must also be one color/);
  assert.throws(() => K.encodeMixed(pool, [1], { kanaPos: [1] }), /kana set required/);
  assert.throws(() => K.encodeMixed(pool, [1], { tail: 'x' }), /tail must be/);
});
