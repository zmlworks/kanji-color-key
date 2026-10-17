// v1.2 must read everything v1.0 and v1.1 wrote, and behave exactly like v1.1 on texts without kana.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../src/kck.js';
import * as V10 from './fixtures/kck-1.0.0.js'; // frozen src/kck.js of v1.0.0 (zero padding)
import * as V11 from './fixtures/kck-1.1.0.js'; // frozen src/kck.js of v1.1.0 (surplus padding)
import { pool } from '../src/pool-node.js';
import { kana } from '../src/kana-node.js';

const p10 = V10.makePool(pool.chars.join(''), pool.counts), p11 = V11.makePool(pool.chars.join(''), pool.counts);
const all = Array.from({ length: 80 }, (_, i) => i + 1);
const rnd = (n) => Math.floor(Math.random() * n);
function encoders(M, P) {
  return [
    (b, c) => M.encodeBits(P, b, { checkBits: c }),
    (b, c) => M.encodeAlpha(b, { checkBits: c }),
    (b, c, ap) => M.encodeMixed(P, b, { checkBits: c, alphaPos: ap, tail: 'kanji' }),
    (b, c, ap) => M.encodeMixed(P, b, { checkBits: c, alphaPos: ap, tail: 'alpha' }),
    (b, c) => M.encodeMixed(P, b, { checkBits: c, alphaPos: all }),
  ];
}
const strip = (d) => ({ tried: d.tried, total: d.total, dataBits: d.dataBits, checkBits: d.checkBits, candidates: d.candidates.map(c => [c.hex, c.text, c.padding]) });

test('v1.2 encoders give the same text as v1.1 when no kana is used', () => {
  const now = encoders(K, pool), old = encoders(V11, p11);
  for (let r = 0; r < 300; r++) {
    const b = K.randomBits(8 * (8 + rnd(57))), c = [0, 12, 5][r % 3], ap = [1 + rnd(8), 2 + rnd(8)], m = r % 5;
    assert.equal(now[m](b, c, ap).text, old[m](b, c, ap).text);
  }
});

test('v1.0 and v1.1 outputs (exact, with ?, wrong color) decode exactly as v1.1 decoded them', () => {
  const e10 = encoders(V10, p10), e11 = encoders(V11, p11);
  for (let r = 0; r < 200; r++) {
    const b = K.randomBits([64, 128, 256, 257, 384][r % 5]), c = [0, 12][r % 2], m = r % 5, e = (r % 4 < 2 ? e10 : e11)[m](b, c, [2, 5]);
    let t = e.text;
    if (r % 3 === 1) t = t.replace(/(\D)([0-3])/u, '$1?');                      // first color unknown
    if (r % 3 === 2) t = t.replace(/([0-3])(?=\D*$)/, d => String((+d + 1) % 4)); // a wrong last color
    let want, got;
    try { want = strip(V11.decodeAny(p11, t)); } catch (x) { want = x.message; }
    try { got = strip(K.decodeAny(pool, t, { kana })); } catch (x) { got = x.message; }
    assert.deepEqual(got, want, t);
    if (r % 3 === 0) assert.ok(got.candidates.some(x => x[0] === K.bitsToHex(b)), t);
  }
});
