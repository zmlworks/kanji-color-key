import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../src/kck.js';
import { pool, strokes } from '../src/pool-node.js';

test('pool: 4096 unique kanji with strokes', () => {
  assert.equal(pool.chars.length, 4096); assert.equal(new Set(pool.chars).size, 4096);
  assert.ok(pool.counts.every(n => n > 0)); assert.equal(strokes.length, 4096);
  assert.equal(pool.counts[pool.index.get('従')], 10);
});
test('sha256 known vector', () => {
  assert.equal(Buffer.from(K.sha256(new TextEncoder().encode('abc'))).toString('hex'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('round trip random lengths', () => {
  for (let n = 0; n <= 300; n += 7) for (const c of [0, 4, 12, 16]) {
    const b = K.randomBits(n), e = K.encodeBits(pool, b, { checkBits: c });
    const d = K.decodeText(pool, e.text);
    assert.ok(d.candidates.some(x => x.bits.join('') === b.join('')), `n=${n} c=${c}`);
    if (c >= 12) assert.equal(d.candidates.length, 1);
  }
});
test('256-bit hex round trip, whitespace tolerant', () => {
  const hex = 'f'.repeat(64), e = K.encodeHex(pool, hex);
  assert.match(e.text, /^\(256\+12bit\)/);
  assert.equal(K.decodeText(pool, e.text.replace(/(.{5})/g, '$1 \n')).candidates[0].hex, hex);
});
test('expandColorSpec', () => {
  assert.deepEqual(K.expandColorSpec('0?').map(a => a.join('')), ['00', '01', '02', '03']);
  assert.deepEqual(K.expandColorSpec('12[30]').map(a => a.join('')).sort(), ['1203', '1230']);
  assert.deepEqual(K.expandColorSpec('1(23)').map(a => a.join('')).sort(), ['123', '231']);
  assert.deepEqual(K.expandColorSpec('12(30)').map(a => a.join('')).sort(), ['1230', '1302', '3012']);
});
function mutate(text, tokIndex, fn) {
  const p = K.parseText(pool, text);
  const parts = p.tokens.map(t => t.char + t.spec); parts[tokIndex] = fn(parts[tokIndex]);
  return text.match(/^\([^)]*\)/)[0] + parts.join('');
}
test('decode with unknown colors recovers the key', () => {
  const b = K.randomBits(256), e = K.encodeBits(pool, b);
  const t = mutate(e.text, 1, s => s[0] + '?' + s.slice(2, 3) + '?' + s.slice(4));
  const d = K.decodeText(pool, t);
  assert.ok(d.tried >= 16); assert.ok(d.candidates.some(x => x.bits.join('') === b.join('')));
});
test('decode with swapped strokes using [..] and shifted block (..)', () => {
  const b = K.randomBits(256), e = K.encodeBits(pool, b);
  // user wrote strokes 2,3 in reverse order and marked them as permutable
  const t1 = mutate(e.text, 0, s => s[0] + s[1] + '[' + s[3] + s[2] + ']' + s.slice(4));
  assert.ok(K.decodeText(pool, t1).candidates.some(x => x.hex === K.bitsToHex(b)));
  // user wrote strokes 1-2 at the end of the kanji, marked as a shiftable block
  const t2 = mutate(e.text, 2, s => s[0] + s.slice(3) + '(' + s[1] + s[2] + ')');
  assert.ok(K.decodeText(pool, t2).candidates.some(x => x.hex === K.bitsToHex(b)));
});
test('errors', () => {
  assert.throws(() => K.decodeText(pool, '従0231'), /header/);
  assert.throws(() => K.decodeText(pool, '(12+0bit)A1'), /not in the kanji pool/);
  assert.throws(() => K.decodeText(pool, '(4+0bit)a1b2'), /trailing/);
});
test('hash mode is deterministic', async () => {
  const a = await K.deriveKey('correct horse', { iterations: 1000 });
  const b = await K.deriveKey('correct horse', { iterations: 1000 });
  const c = await K.deriveKey('correct horse', { iterations: 1000, salt: 'x' });
  assert.deepEqual(a, b); assert.notDeepEqual(a, c); assert.equal(a.length, 32);
});
test('color names 黒赤青緑 accepted in place of digits', () => {
  const b = K.randomBits(256);
  const e1 = K.encodeBits(pool, b);
  const t1 = e1.text.replace(/^(\([^)]*\))(.*)$/, (_, h, body) => h + K.parseText(pool, e1.text).tokens.map(t => t.char + [...t.spec].map(x => '黒赤青緑'[x]).join('')).join(''));
  assert.equal(K.decodeAny(pool, t1).candidates[0].hex, K.bitsToHex(b));
  const e2 = K.encodeMixed(pool, b, { alphaPos: [2, 5], tail: 'alpha' });
  const t2 = 'M(256+12bit)' + K.parseMixed(pool, e2.text).tokens.map(t => t.char + [...t.spec].map(x => '黒赤青緑'[x]).join('')).join(' ');
  assert.equal(K.decodeAny(pool, t2).candidates[0].hex, K.bitsToHex(b));
  const e3 = K.encodeAlpha(b);
  assert.equal(K.decodeAny(pool, e3.text.replace(/([A-Z2-79])([0-3])/g, (_, g, c) => g + '黒赤青緑'[c])).candidates[0].hex, K.bitsToHex(b));
});
