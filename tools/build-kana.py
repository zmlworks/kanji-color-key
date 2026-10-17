#!/usr/bin/env python3
"""Build data/kana.json (kana mode, 32 kana with >= 3 strokes) from KanjiVG XML (kanjivg-YYYYMMDD.xml).
Order = index = 5-bit value: 18 hiragana then 14 katakana, each in gojuon order. Same path format as pool.json."""
import sys, re, json
KANA = "あおかきけさせたなにはふほまむもやを" + "ウオキケサチツテネホミモヨヰ"
assert len(KANA) == 32 and len(set(KANA)) == 32
xml = open(sys.argv[1], encoding='utf-8').read()
rnd = lambda d: re.sub(r'-?\d+\.\d+', lambda x: ('%.1f' % float(x.group())).rstrip('0').rstrip('.'), d)
kv = {}
for m in re.finditer(r'<kanji id="kvg:kanji_([0-9a-f]{5})">(.*?)</kanji>', xml, re.S):
    c = chr(int(m.group(1), 16))
    if c in KANA:
        paths = re.findall(r'<path id="kvg:[0-9a-f]{5}-s(\d+)"[^>]* d="([^"]+)"', m.group(2))
        paths.sort(key=lambda p: int(p[0]))
        kv[c] = [rnd(d) for _, d in paths]
missing = [c for c in KANA if c not in kv]
assert not missing, missing
json.dump({"source": "KanjiVG r20260714 (CC BY-SA 3.0)", "kana": KANA, "strokes": [kv[c] for c in KANA]},
          open('data/kana.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
open('data/kana.txt', 'w', encoding='utf-8').write("".join(f"{i}\t{c}\tU+{ord(c):04X}\t{len(kv[c])}\n" for i, c in enumerate(KANA)))
print(len(KANA), sum(len(kv[c]) for c in KANA))
