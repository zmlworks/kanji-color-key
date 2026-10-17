import { readFileSync } from 'node:fs';
import { makeKanaSet } from './kck.js';
const data = JSON.parse(readFileSync(new URL('../data/kana.json', import.meta.url), 'utf8'));
export const kanaStrokes = data.strokes;
export const kana = makeKanaSet(data.kana, data.strokes.map(s => s.length));
