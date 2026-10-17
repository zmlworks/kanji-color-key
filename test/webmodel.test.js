// The web page's model: type rotation on click, the type toggles, all-kana / KF, the endings shown.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../src/kck.js';
import { pool } from '../src/pool-node.js';
import { kana } from '../src/kana-node.js';

const BOTH = { alpha: true, kana: true }, ALPHA = { alpha: true, kana: false }, KANA = { alpha: false, kana: true }, NONE = { alpha: false, kana: false };

test('rotation: kanji → alpha → kana → kanji with both on; 2-state with one; none: stays kanji', () => {
  assert.deepEqual(['kanji', 'alpha', 'kana'].map(t => K.nextType(t, BOTH)), ['alpha', 'kana', 'kanji']);
  assert.deepEqual(['kanji', 'alpha'].map(t => K.nextType(t, ALPHA)), ['alpha', 'kanji']);
  assert.deepEqual(['kanji', 'kana'].map(t => K.nextType(t, KANA)), ['kana', 'kanji']);
  assert.equal(K.nextType('kanji', NONE), 'kanji');
  let t = {};
  t = K.clickType(t, 3, BOTH); assert.deepEqual(t, { 3: 'alpha' });
  t = K.clickType(t, 5, BOTH); assert.deepEqual(t, { 3: 'alpha', 5: 'alpha' });
  t = K.clickType(t, 3, BOTH); assert.deepEqual(t, { 3: 'kana' });          // later positions reset
  t = K.clickType(t, 3, BOTH); assert.deepEqual(t, {});
  assert.deepEqual(K.clickType({ 2: 'kana' }, 2, ALPHA), {});               // a disabled type falls back to kanji
  assert.deepEqual(K.keepEnabled({ 1: 'alpha', 2: 'kana' }, ALPHA), { 1: 'alpha' });
  assert.deepEqual(K.keepEnabled({ 1: 'alpha', 2: 'kana' }, KANA), { 2: 'kana' });
});

test('endings: kanji always, alpha / kana when enabled; common prefix shared by all; text matches encodeMixed', () => {
  for (let r = 0; r < 120; r++) {
    const b = K.randomBits(256), en = [BOTH, ALPHA, KANA, NONE][r % 4];
    const types = K.keepEnabled({ 2: 'alpha', 4: 'kana', 6: 'kana' }, en);
    const w = K.webEncode(pool, kana, b, { types, ...en, checkBits: 0 });
    const want = ['kanji', ...(en.alpha ? ['alpha'] : []), ...(en.kana ? ['kana'] : [])], texts = w.variants.map(v => v.enc.text);
    assert.equal(w.variants[0].tail, 'kanji'); assert.ok(w.variants.every(v => want.includes(v.tail)));
    assert.equal(new Set(texts).size, texts.length);                         // identical endings are shown once
    for (const tail of want) assert.ok(texts.includes(K.encodeMixed(pool, b, { checkBits: 0, alphaPos: Object.keys(types).filter(p => types[p] === 'alpha').map(Number), kanaPos: Object.keys(types).filter(p => types[p] === 'kana').map(Number), tail, kana }).text));
    for (const v of w.variants) {
      const d = K.decodeAny(pool, v.enc.text, { kana }); assert.ok(d.candidates.some(c => c.hex === K.bitsToHex(b)));
      for (let i = 0; i < w.common; i++) assert.equal(v.enc.tokens[i].char, w.variants[0].enc.tokens[i].char);
    }
    assert.match(K.webInfo(w.variants[0].enc), /^漢字\d+・英数字\d+・かな\d+・書く量\d+bit$/);
    assert.match(K.webHead(w), /^256bit \(データ256\+チェック0\) ／ 共通部分 \d+記号$/);
  }
});

test('all-kana: variable by default; KF only when fixed is on and kana enabled', () => {
  const b = K.randomBits(256), all = K.allOf('kana');
  assert.ok(K.isAllOf(all, 'kana')); assert.ok(!K.isAllOf({ 1: 'kana' }, 'kana'));
  const v = K.webEncode(pool, kana, b, { types: all, ...BOTH });
  assert.equal(v.fixed, false); assert.ok(v.variants[0].enc.tokens.every(t => t.type === 'kana'));
  const f = K.webEncode(pool, kana, b, { types: all, ...BOTH, fixed: true });
  assert.equal(f.fixed, true); assert.ok(f.variants[0].enc.text.startsWith('KF(256bit)')); assert.equal(f.variants[0].enc.tokens.length, 24);
  assert.equal(K.webEncode(pool, kana, b, { types: { 1: 'kana' }, ...BOTH, fixed: true }).fixed, false);
});
