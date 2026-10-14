import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../src/kck.js';
import { pool } from '../src/pool-node.js';
const P = '国破山河在城春草木深';

test('phrase capacity', () => {
  const c = K.phraseCapacity(pool, P); assert.equal(c.strokes, 77); assert.equal(c.bits, 154);
});
test('phrase round trip (with and without tail)', () => {
  for (const ph of [P, '春夏秋冬', '臨機応変', '東京駅前喫茶店東京駅前喫茶店']) for (const n of [0, 64, 128, 256]) {
    const b = K.randomBits(n), e = K.encodePhrase(pool, ph, b);
    assert.ok(e.text.startsWith(`P(${n}+12bit)`));
    assert.ok(!K.isAlphaText(e.text));
    const d = K.decodeAny(pool, e.text);
    assert.equal(d.candidates.length, 1, `${ph} ${n}`); assert.equal(d.candidates[0].hex, K.bitsToHex(b));
  }
  const e = K.encodePhrase(pool, P, K.randomBits(256)); assert.equal(e.tail, 17);
  assert.equal(K.encodePhrase(pool, '東京駅前喫茶店東京駅前喫茶店', K.randomBits(256)).tail, 0);
});
test('insufficient capacity and bad kanji', () => {
  assert.throws(() => K.encodePhrase(pool, '春夏秋冬', K.randomBits(256), { maxTail: 0 }), /insufficient/);
  assert.throws(() => K.encodePhrase(pool, '春夏あ秋', []), /not in the kanji pool: あ/);
  assert.throws(() => K.phraseCapacity(pool, ''), /empty/);
  assert.throws(() => K.decodePhrase(pool, 'P(256+12bit)春000000000'), /expected 36 alpha/);
});
test('phrase ? recovery filtered by check', () => {
  const b = K.randomBits(256), e = K.encodePhrase(pool, P, b);
  const t = e.text.replace(/^(P\([^)]*\)国)(\d)(\d)/, '$1??').replace(/\/(\S)\d/, '/$1?');
  const d = K.decodePhrase(pool, t);
  assert.equal(d.tried, 64); assert.ok(d.candidates.some(x => x.hex === K.bitsToHex(b))); assert.ok(d.candidates.length <= 2);
});
