import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../src/kck.js';
import { pool } from '../src/pool-node.js';

test('mixed round trip, position sets x tails x lengths', () => {
  for (const ap of [[], [1], [3, 7], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], [2, 4, 6, 8, 10, 12]])
    for (const tail of ['kanji', 'alpha']) for (const n of [64, 128, 256, 384, 512]) {
      const b = K.randomBits(n), e = K.encodeMixed(pool, b, { alphaPos: ap, tail });
      assert.ok(e.text.startsWith(`M(${n}+12bit)`));
      e.tokens.forEach((t, i) => { if (ap.includes(i + 1)) assert.equal(t.type, 'alpha'); });
      const d = K.decodeAny(pool, e.text);
      assert.equal(d.candidates.length, 1, `${ap} ${tail} ${n}`); assert.equal(d.candidates[0].hex, K.bitsToHex(b));
      assert.equal(K.decodeAny(pool, e.text.replace(/ /g, '')).candidates[0].hex, K.bitsToHex(b));
    }
});
test('alpha tail never ends with a partially used kanji', () => {
  for (let r = 0; r < 50; r++) {
    const e = K.encodeMixed(pool, K.randomBits(256), { tail: 'alpha' });
    assert.ok(e.writtenBits - e.totalBits < 12 || e.tokens.at(-1).type === 'alpha');
    const last = e.tokens.findLastIndex(t => t.type === 'kanji');
    assert.ok(e.tokens.slice(last + 1).every(t => t.type === 'alpha'));
    assert.ok(e.writtenBits - e.totalBits < 7);
  }
});
test('mixed ? recovery and errors', () => {
  const b = K.randomBits(256), e = K.encodeMixed(pool, b, { alphaPos: [2] });
  const parts = e.text.split(' ');
  parts[1] = parts[1][0] + '?'; parts[0] = parts[0].replace(/(\)\S)\d/, '$1?');
  const d = K.decodeMixed(pool, parts.join(' '));
  assert.equal(d.tried, 16); assert.ok(d.candidates.some(x => x.hex === K.bitsToHex(b)));
  assert.throws(() => K.decodeMixed(pool, 'M(7+0bit)U0'), /excluded/);
  assert.throws(() => K.decodeMixed(pool, 'M(256+12bit)A0'), /too short/);
});
