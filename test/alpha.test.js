import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../src/kck.js';
import { pool } from '../src/pool-node.js';

test('alpha set: 32 unique, excludes 0 1 8 U', () => {
  assert.equal(K.ALPHA.length, 32); assert.equal(new Set(K.ALPHA).size, 32);
  for (const c of '018U') assert.ok(!K.ALPHA.includes(c));
  assert.equal([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'].filter(c => !K.ALPHA.includes(c)).sort().join(''), '018U');
});
test('alpha round trip for many lengths', () => {
  for (let n = 0; n <= 300; n += 5) for (const c of [0, 8, 12]) {
    const b = K.randomBits(n), e = K.encodeAlpha(b, { checkBits: c });
    assert.equal(e.tokens.length, Math.ceil((n + c) / 7));
    const d = K.decodeAny(pool, e.text.toLowerCase());
    assert.ok(d.candidates.some(x => x.bits.join('') === b.join('')), `n=${n} c=${c}`);
    if (c >= 12) assert.equal(d.candidates.length, 1);
  }
});
test('alpha 256 bit: 39 symbols, header', () => {
  const e = K.encodeAlpha(K.hexToBits('ab'.repeat(32)), { checkBits: 12 });
  assert.match(e.text, /^A\(256\+12bit\)/); assert.equal(e.tokens.length, 39);
  assert.ok(!K.isAlphaText(K.encodeHex(pool, 'ab'.repeat(32)).text));
});
test('alpha decode with unknown glyph and color filtered by check', () => {
  const b = K.randomBits(256), e = K.encodeAlpha(b, { checkBits: 12 });
  const body = e.text.replace(/^A\([^)]*\)/, '').replace(/ /g, '');
  const t = 'A(256+12bit)' + '??' + body.slice(2, 9) + '?' + body.slice(10);
  const d = K.decodeAlpha(t);
  assert.equal(d.tried, 128 * 4);
  assert.ok(d.candidates.some(x => x.hex === K.bitsToHex(b)));
  assert.ok(d.candidates.length <= 3);
});
test('alpha errors', () => {
  assert.throws(() => K.decodeAlpha('A(7+0bit)U0'), /excluded/);
  assert.throws(() => K.decodeAlpha('A(7+0bit)A4'), /bad color/);
  assert.throws(() => K.decodeAlpha('A(14+0bit)A0'), /expected 2 symbols/);
});
