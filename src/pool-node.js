import { readFileSync } from 'node:fs';
import { makePool } from './kck.js';
const data = JSON.parse(readFileSync(new URL('../data/pool.json', import.meta.url), 'utf8'));
export const strokes = data.strokes;
export const pool = makePool(data.kanji, data.strokes.map(s => s.length));
