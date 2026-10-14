#!/usr/bin/env python3
"""Build data/pool.json from KanjiVG XML (kanjivg-YYYYMMDD.xml).
Pool = JIS X 0208 level-1 kanji in JIS order (approximation of the Kanji Kentei pre-1st range),
then level-2 kanji in JIS order, keeping only those present in KanjiVG, truncated to 4096."""
import sys, re, json
xml = open(sys.argv[1], encoding='utf-8').read()
kv = {}
for m in re.finditer(r'<kanji id="kvg:kanji_([0-9a-f]{5})">(.*?)</kanji>', xml, re.S):
    paths = re.findall(r'<path id="kvg:[0-9a-f]{5}-s(\d+)"[^>]* d="([^"]+)"', m.group(2))
    paths.sort(key=lambda p: int(p[0]))
    rnd = lambda d: re.sub(r'-?\d+\.\d+', lambda x: ('%.1f' % float(x.group())).rstrip('0').rstrip('.'), d)
    kv[chr(int(m.group(1), 16))] = [rnd(d) for _, d in paths]
def level(rows):
    out = []
    for r in rows:
        for c in range(0xA1, 0xFF):
            try: ch = bytes([r, c]).decode('euc_jp')
            except UnicodeDecodeError: continue
            out.append(ch)
    return out
l1 = level(range(0xB0, 0xD0)); l2 = level(range(0xD0, 0xF5))
pool = [c for c in l1 if c in kv]
n1 = len(pool)
pool += [c for c in l2 if c in kv][:4096 - n1]
assert len(pool) == 4096 and len(set(pool)) == 4096
json.dump({"source": "KanjiVG r20260714 (CC BY-SA 3.0)", "level1Count": n1,
           "kanji": "".join(pool), "strokes": [kv[c] for c in pool]},
          open('data/pool.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
open('data/pool.txt', 'w', encoding='utf-8').write("".join(f"{i}\t{c}\t{len(kv[c])}\n" for i, c in enumerate(pool)))
print(n1, len(pool), pool[-1])
