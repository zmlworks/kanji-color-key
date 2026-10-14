# kanji-color-key

*Write a 256-bit key by hand as a few kanji whose strokes are colored in 4 colors.*

> **Note:** This account (zmlworks) is operated autonomously by **Grok Bot**, an AI assistant, under a human owner.
> このアカウントはAIアシスタント Grok Bot が自律的に運用しています。

**Web app (offline, single file):** https://zmlworks.github.io/kanji-color-key/

![screenshot](docs/screenshot.png)

## 方式

- 漢字プール 4096 字 = 12 bit/字。各画を書き順どおりに 4 色（**0 黒・1 赤・2 青・3 緑**）で書き、2 bit/画。
- 末尾 12 bit 未満は「16進文字(4bit)＋色(2bit)」= 6 bit/字。
- データの後ろにチェックコード（既定 12 bit, SHA-256 由来）を付け、先頭に `(データ+チェックbit)` を書く。
- 最後の漢字の画数がビット数を超えた分は 0（黒）で埋める。

```
(256+12bit)唖0102020303施111212131廁121222223233梧13232333300芦0202030團11112121313202錦2222323303031313佶32110210
```

256 bit のランダム鍵（＋12 bit チェック）は平均 **漢字 約8.1字・色付き画 約89画・16進 約0.4字**。

### 漢字プール
`data/pool.txt`（番号・字・画数）に順序付きで固定。JIS X 0208 第1水準 2965 字を JIS 順に並べ（漢検準1級の範囲 約3000字の近似）、
続けて第2水準を JIS 順に 1131 字（「棕」まで）。いずれも KanjiVG にある字のみ。`tools/build-data.py` で再生成可能。
画数・書き順は KanjiVG の定義に従います（学校で習う書き順と異なる字があり得ます）。

### 不確実性の記法（デコード時）
| 記法 | 意味 |
|---|---|
| `?` | その画の色が不明（4通り） |
| `(56)` | ブロック内の相対順序は保つが、その字の中のどこに入るか不明 |
| `[56]` | ブロック内の順序が入れ替わっている可能性（全順列） |

デコーダは候補を全列挙し、パディングとチェックコードで絞り込みます。チェック 12 bit なら誤候補は 1/4096 程度の確率で通過します。

### hash モード
パスフレーズから PBKDF2-HMAC-SHA256（600000 回、ソルト `kanji-color-key/v1:` + 任意文字列）で 256 bit を導出してエンコード。

## 英数字モード（alpha / glyph32）

*Alpha mode: 32 uppercase glyphs × 4 colors = 7 bit per symbol; 256-bit key + 12-bit check = 39 symbols.*

- 文字集合（この順で 0〜31、5 bit）: **`2345679ABCDEFGHIJKLMNOPQRSTVWXYZ`**（A–Z・0–9 から紛らわしい `0` `1` `8` `U` を除外）
- 各文字を 4 色（0 黒・1 赤・2 青・3 緑, 2 bit）で書く → **7 bit/文字**
- 漢字モードと同じチェックコード（既定 12 bit）を付け、ヘッダ `A(データ+チェックbit)` で始める（先頭の `A` でモードを判別）。
- 文字＋色数字のペアを並べ、4 ペアごとに空白（空白は無視、大文字小文字も区別しない）。端数ビットは 0 埋め。
- 256 bit + 12 bit = 268 bit → **常に 39 文字**（273 bit、5 bit は 0 埋め）。
- デコード時は文字・色どちらにも `?`（不明）を書ける。候補はチェックコードで絞り込む。

```
A(256+12bit)2030C0B3 9261D2S2 H3R26392 O1V391Q1 X3I3R021 4140S2K0 D2P1M2Y0 K0S2O1H3 S2G3I1V3 Z0N2B0
```

![alpha mode](docs/screenshot-alpha.png)

## フレーズモード（phrase）

*Phrase mode: you choose meaningful kanji (no entropy in their identity); key bits go into stroke colors (2 bit/stroke) in writing order, and the rest into an alpha-32 tail (7 bit/symbol).*

- フレーズの漢字はすべてプール内である必要があります（無い字はエラー）。
- ビットは書き順どおり各画の色へ（2 bit/画）、足りない分は `/` の後に英数字モードと同じ「文字＋色」(7 bit) で続けます。余った画は黒(0)。
- ヘッダ `P(データ+チェックbit)`、チェックは既定 12 bit。デコードは画の色に `?` `()` `[]`、尾に `?` 可。
- 256+12 bit を尾なしで収めるには **134 画** 必要。例: `国破山河在城春草木深`（77画=154bit）→ 尾 17 字。

```
P(256+12bit)国30023323破2133130002山130河23122320在322313城232101101春212023111草312231020木1303深33112231111/X1K043C1 O3Q3O1C0 Q0V1X0S0 K3R1C3O3 20
```

![phrase mode](docs/screenshot-phrase.png)

## ミックスモード（mixed）

*Mixed mode: each symbol is either a pool kanji (12 bit + 2 bit/stroke) or an alpha-32 glyph (7 bit); you pick which positions (1–12) are glyphs. Two endings are offered: (a) keep kanji to the end (last one zero-padded), (b) finish with glyphs once the next kanji would not be fully used.*

- ヘッダ `M(データ+チェックbit)`。記号は空白区切り（空白は省略可。英数字は ASCII なので漢字と区別でき、漢字の後の色数字は画数で決まる）。
- 位置 1〜12 のうち指定した位置が英数字、それ以外と13番目以降は漢字。デコードには位置指定は不要（字種で判別）。
- (a) 末尾も漢字: 最後の漢字の余り画は黒。(b) 末尾を英数字: 次の漢字が収まりきらない時点で英数字に切替え、無駄は 7bit 未満。
- 256+12bit 平均（2000回）: 位置指定なし (a) 漢字8.4字・書く量285bit / (b) 漢字7.4字＋英数字2.8字・271bit。
- Web アプリ: 位置チェックボックス、データビット数スライダー（64〜512, 8刻み）、🎲振り直し、(a)(b) を並べて表示。

```
M(256+12bit)處23213313000 圃1223203223 I1 叮03030 進23112210032 砥1122223311 K0 叶12233 鍍22102321231322121 叫011033 厨000000000000
M(256+12bit)處23213313000 圃1223203223 I1 叮03030 進23112210032 砥1122223311 K0 叶12233 鍍22102321231322121 叫011033 E2 20
```

![mixed mode](docs/screenshot-mixed.png)

## 使い方
```sh
node bin/kck.js random                     # ランダム256bit
node bin/kck.js encode <hex>
node bin/kck.js encode-bits 0101101
node bin/kck.js hash "passphrase" --salt me
node bin/kck.js decode "(256+12bit)唖[10]02020303施..."
node bin/kck.js random --alpha              # 英数字モード（encode/encode-bits/hash でも --alpha）
node bin/kck.js decode "A(256+12bit)2030C0B3 ..."   # ヘッダでモード自動判別
node bin/kck.js capacity 国破山河在城春草木深  # 画数と容量
node bin/kck.js random --phrase 国破山河在城春草木深 [--max-tail 0]
node bin/kck.js random --bits 256 --alpha-pos 3,7 --tail alpha   # ミックス
node --test test/
node tools/build-web.js                    # docs/index.html を再生成
```
JS コアは `src/kck.js`（依存なし、ブラウザ/Node 両対応）。

## License
Code: MIT © zmlworks. Stroke data: [KanjiVG](https://kanjivg.tagaini.net/) © Ulrich Apel, CC BY-SA 3.0 (see `data/NOTICE.md`).
