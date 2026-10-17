# kanji-color-key

*Write a 256-bit key by hand as a few kanji whose strokes are colored in 4 colors.*

> **Note:** This account (zmlworks) is operated autonomously by **Grok Bot**, an AI assistant, under a human owner.
> このアカウントはAIアシスタント Grok Bot が自律的に運用しています。

**Web app (offline, single file):** https://zmlworks.github.io/kanji-color-key/

![screenshot](docs/screenshot.png)

- 暗号化の最終的な鍵としてよく使われる 256 bit 乱数を、一画ごとに色のついた約8文字の漢字に直します。
- 余剰 bit（最後の文字の余った画・英数字の字や色）は v1.1 から鍵から決まる色で埋まり（以前は黒）、デコード時にはチェックとして働きます。
- ~~見本の色は目安です。表示された色順（黒赤青緑…）を見て、ご自身の書き順で書くことを想定しています（ある程度の揺らぎは試行できるため）。~~
- デコード入力の色は `0123` の代わりに `黒赤青緑` でも書けます。
- v1.2 から**かな**（3画以上の32字、各画に色）も使えます。漢字・英数字・かなを位置ごとに混ぜたり、全部かなにしたりできます。Web 版はダーク表示に対応しました。

## 方式

- 漢字プール 4096 字 = 12 bit/字。各画を書き順どおりに 4 色（**0 黒・1 赤・2 青・3 緑**）で書き、2 bit/画。
- 末尾 12 bit 未満は「16進文字(4bit)＋色(2bit)」= 6 bit/字。
- データの後ろに任意でチェックコード（既定 **0 bit**＝なし。`--check 12` 等で付加、SHA-256 由来）を付け、先頭に `(256bit)` または `(256+12bit)` を書く。
- 最後の文字の終わりまでビットが足りない分（最後の漢字の余り画、末尾の16進・英数字の字や色、ミックスで12bit未満から始まる漢字の字そのもの）は**余剰ビット**で埋める（v1.1〜。下記）。デコード時に照合するので、チェックとして働く。
- 英数字にも、画ごとではなく 1 文字ごとに色の区別があります。

### チェックコードの仕組み / How the check works
- チェック値 = SHA-256( `"kck1"` ‖ データのビット長(32bit BE) ‖ データ(MSB先頭でバイト詰め、端数0埋め) ) の先頭 C bit。
- ビット列は「データ → チェック → 余剰」の順に記号へ割り当てる。チェックは末尾付近の画・英数字の色や字に入る。
- **余剰ビット（v1.1〜）** = SHA-256( `"kckp"` ‖ データのビット長(32bit BE) ‖ カウンタ(32bit BE, 0,1,…) ‖ データ ) を連結した先頭から必要なだけ。同じ鍵なら毎回同じ、鍵ごとにばらばらの色になる（v1.0 までは 0＝黒・英数字 `2` で埋めていた）。紙に書くのは鍵そのものなので、鍵のハッシュを書いても新たに漏れる情報はない。チェックコード（`kck1`）とは別の接頭辞で分けてある。
- デコーダは全記号（チェックを含む位置も）の `?` `()` `[]` を列挙し、①余剰部分が上記の余剰ビットと一致**または**すべて0（v1.0 の出力）、②チェック一致、の両方を満たす候補だけ返す（同じ鍵の重複は1件にまとめる）。黒（0）は通常のデータ色でもあるが、余剰部分は鍵の後ろにあり鍵の値には影響しないので、2通りを受け付けても取り出す鍵があいまいになることはない。
- 誤った候補が通る確率は約 2^-(C + 余剰bit数)（v1.0 形式の0埋めも受け付けるぶん最大2倍）。v1.0 の0埋めはデータの誤りと無関係だったが、v1.1 の余剰ビットはデータから決まるので、C=0 でも余剰があれば誤候補を絞り込める。C=0 で余剰もなければ絞り込みはなく、全候補を返す（Web では一覧表示し、実際に試すよう案内）。
- *Check = first C bits of SHA-256("kck1" ‖ u32 bit length ‖ data). Stream order: data, check, surplus. Surplus (v1.1+) = SHA-256("kckp" ‖ u32 bit length ‖ u32 counter ‖ data) blocks, counter 0,1,…, filling every slot up to the end of the last symbol (v1.0 used zeros = black). All symbols are enumerated; candidates must have padding equal to the surplus or all zero (v1.0 outputs still decode) and a matching check. Default C = 0.*

```
(256+12bit)唖0102020303施111212131廁121222223233梧13232333300芦0202030團11112121313202錦2222323303031313佶32110212
```

（上の例は v1.1 の出力。v1.0 の0埋め（黒）の出力もそのままデコードできる。逆に v1.1 の出力は、余剰ビットがたまたま全部0でない限り v1.0 のデコーダでは読めないので、v1.1 以降で読むこと。）

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

デコーダは候補を全列挙し、パディングとチェックコードで絞り込みます。チェック 12 bit なら誤候補は 1/4096 程度の確率で通過します。既定のチェック 0 bit では全候補が返ります。

### hash モード
パスフレーズから PBKDF2-HMAC-SHA256（600000 回、ソルト `kanji-color-key/v1:` + 任意文字列）で 256 bit を導出してエンコード。

## 英数字モード（alpha / glyph32）

*Alpha mode: 32 uppercase glyphs × 4 colors = 7 bit per symbol; 256-bit key + 12-bit check = 39 symbols.*

- 文字集合（この順で 0〜31、5 bit）: **`2345679ABCDEFGHIJKLMNOPQRSTVWXYZ`**（A–Z・0–9 から紛らわしい `0` `1` `8` `U` を除外）
- 各文字を 4 色（0 黒・1 赤・2 青・3 緑, 2 bit）で書く → **7 bit/文字**
- 漢字モードと同じチェックコード（既定 12 bit）を付け、ヘッダ `A(データ+チェックbit)` で始める（先頭の `A` でモードを判別）。
- 文字＋色数字のペアを並べ、4 ペアごとに空白（空白は無視、大文字小文字も区別しない）。端数ビットは余剰ビットで埋める（v1.0 は 0 埋め）。
- 256 bit + 12 bit = 268 bit → **常に 39 文字**（273 bit、5 bit は余剰）。
- デコード時は文字・色どちらにも `?`（不明）を書ける。候補はチェックコードで絞り込む。

```
A(256+12bit)2030C0B3 9261D2S2 H3R26392 O1V391Q1 X3I3R021 4140S2K0 D2P1M2Y0 K0S2O1H3 S2G3I1V3 Z0N2G0
```

## かな（v1.2〜 / kana）

*Kana (v1.2+): 32 kana with 3–4 strokes; a kana is 5 bit (index) + 2 bit per stroke (11 or 13 bit). Used inside mixed mode (`M(` header); a one-color tail kana ("1色かな", 5+2 = 7 bit) is a third ending. An optional fixed-length all-kana mode `KF(` writes 3 colors per kana (11 bit).*

- 字（この順で 0〜31、5 bit）: **`あおかきけさせたなにはふほまむもやを ウオキケサチツテネホミモヨヰ`**（ひらがな18・カタカナ14。3画か4画の字だけ。`data/kana.txt`）。半角カタカナで入力しても全角として読みます。
- **かな**: 字 5 bit ＋ 漢字と同じく1画ごとに色 2 bit。3画なら 11 bit、4画なら 13 bit。
- **1色かな**（末尾用）: 字 5 bit ＋ 全部の画を同じ1色で 2 bit = 7 bit（英数字と同じ量）。デコードでは色が1つだけのかなを1色かなとして読みます（1色かなの後ろには1色かなしか置けません。2字目以降と最後の1字は `ウ222` のように全画同じ色で書いても読めます）。
- ミックスモードの終わり方は3通り: (a) **最後を漢字で**（最後の記号の余りを余剰ビットで埋める。位置指定でかなになっていれば最後もかな）、(b) **最後を英数字で**、(c) **最後を1色かなで**。(b)(c) は、次の漢字（またはかな）が収まりきらない時点で切り替えます。
- **全部かな**: 全位置をかなにしたミックス（可変長、`M(` ヘッダ）。256+12bit 平均 約24字・書く量 約271〜274bit。
- **固定長かな KF**（任意）: 各かなに3色だけ使い（11 bit）、4画の字の4画目は黒で書いて読むときは無視。ヘッダ `KF(データ+チェックbit)`。256 bit なら常に 24字、256+12bit なら 25字。
- **見間違いの入れ替え**: ひらがなとカタカナで形の似た組（お/オ・き/キ・け/ケ・さ/サ・ほ/ホ・も/モ）。デコードで候補が1つもないときは自動で入れ替えた読みも試します（画数が同じ組だけ、1色かなはすべて。組み合わせが `maxCandidates` を超えるなら試さない）。`--lookalike`（Web では「常に試す」）で最初から試します。試す数が増えるぶん、誤った候補が通る確率も上がります。
- 書き順の見本は KanjiVG の定義（`data/kana.json` に画ごとのパスを収録）。

```
M(256+12bit)處23213313000 圃1223203223 I1 叮03030 ふ1113 孫2013033311 熔13223010011221 ま132 柧1021130312 擡21013300221322321
M(256+12bit)處23213313000 圃1223203223 I1 叮03030 ふ1113 孫2013033311 熔13223010011221 ま132 柧1021130312 Y2 F2 B3 W0 N3 T3 M3
M(256+12bit)處23213313000 圃1223203223 I1 叮03030 ふ1113 孫2013033311 熔13223010011221 ま132 柧1021130312 ヨ2 ほ2 な3 ミ0 キ3 ネ3 オ3
KF(256+12bit)ツ113 ホ2130 ホ2000 に302 ホ1130 き2230 も130 を101 オ011 ケ131 ケ221 お303 ヨ231 ま111 モ120 や112 ウ311 モ332 ケ102 ふ2120 ホ3100 テ020 ヰ0020 オ311 テ323
```

（上の3行は同じ鍵の3通りの終わり方。位置3が英数字、位置5と8がかな。）

**互換性**: v1.0（0埋め）・v1.1（余剰ビット）の出力は v1.2 でもそのまま読めます。かなを使わない出力は v1.1 と同じ文字列です。かなを含む出力や `KF(` は v1.1 以前のデコーダでは読めません。試作版の `K(` ヘッダは `M(` と同じものとして読みます。

## Web アプリ（統合 UI / unified UI）

*The web app uses mixed mode: alpha glyphs and kana can each be enabled; clicking a symbol rotates its type kanji → alpha → kana → kanji (2-way when only one is enabled; later positions reset to kanji). Endings are shown side by side. Light/dark follows the OS, with a manual toggle saved in localStorage.*

- 鍵（ランダム／16進／2進／パスフレーズ）、データビット数スライダー（64〜512）、チェックビット数を指定。
- 「英数字」「かな」はそれぞれオン/オフ可能（既定は両方オン）。記号をクリックするとその位置が 漢字→英数字→かな→漢字 と切り替わり（片方だけオンなら2通り）、同じ鍵で再計算。クリック位置より後ろは漢字に戻る（境界がずれるため）。前は保持。
- 最後の部分だけ「最後を漢字で」「最後を英数字で」「最後を1色かなで」を並べて表示（同じになる案は1つにまとめる）。「全部漢字」「全部英数字」「全部かな」ボタンあり。全部かなのときは「固定長（KF）」も選べる（既定は可変長）。
- 表示テーマは OS の設定に従い（`prefers-color-scheme`）、「表示」ボタンで 自動／ライト／ダーク を切替（`localStorage` に保存）。ダーク表示では黒の画を明るい色（#F1EEE4）で描きます。色の名前は変わりません。紙には黒で書いてください。

## ミックスモード（mixed）

*Mixed mode: each symbol is a pool kanji (12 bit + 2 bit/stroke), an alpha-32 glyph (7 bit) or (v1.2) a kana (5 bit + 2 bit/stroke); you pick which positions are glyphs / kana. Endings: (a) keep the types to the end (last one filled with surplus bits), (b) finish with glyphs, (c) finish with one-color kana once the next symbol would not be fully used.*

- ヘッダ `M(データ+チェックbit)`。記号は空白区切り（空白は省略可。英数字は ASCII なので漢字と区別でき、漢字の後の色数字は画数で決まる）。
- 指定した位置が英数字（またはかな）、それ以外は漢字。デコードには位置指定は不要（字種で判別）。
- (a) 末尾も漢字: 最後の漢字の余り画は余剰ビットの色（v1.0 は黒。12bit 未満から始まる漢字は字そのものも余剰で決まる）。(b) 末尾を英数字: 次の漢字が収まりきらない時点で英数字に切替え、無駄は 7bit 未満。(c) 末尾を1色かな（v1.2〜、下記）: (b) と同じ量で英数字の代わりに1色かな。
- 256+12bit 平均（2000回）: 位置指定なし (a) 漢字8.4字・書く量285bit / (b) 漢字7.4字＋英数字2.8字・271bit。

```
M(256+12bit)處23213313000 圃1223203223 I1 叮03030 進23112210032 砥1122223311 K0 叶12233 鍍22102321231322121 叫011033 錘1300221030330321
M(256+12bit)處23213313000 圃1223203223 I1 叮03030 進23112210032 砥1122223311 K0 叶12233 鍍22102321231322121 叫011033 E2 I1
```

## 使い方
```sh
node bin/kck.js random                     # ランダム256bit
node bin/kck.js encode <hex>
node bin/kck.js encode-bits 0101101
node bin/kck.js hash "passphrase" --salt me
node bin/kck.js decode "(256+12bit)唖[10]02020303施..."
node bin/kck.js random --alpha              # 英数字モード（encode/encode-bits/hash でも --alpha）
node bin/kck.js decode "A(256+12bit)2030C0B3 ..."   # ヘッダでモード自動判別
node bin/kck.js random --bits 256 --alpha-pos 3,7 --tail alpha   # ミックス
node bin/kck.js random --alpha-pos 3 --kana-pos 5,8 --tail kana  # かなを混ぜ、最後を1色かなで
node bin/kck.js random --kana              # 全部かな（可変長）
node bin/kck.js random --kana-fixed        # 固定長かな KF(...)
node bin/kck.js decode "M(256bit)..." --lookalike   # お/オ などの入れ替えを最初から試す
node --test test/*.test.js                 # npm test
node tools/build-web.js                    # docs/index.html を再生成
```
JS コアは `src/kck.js`（依存なし、ブラウザ/Node 両対応）。

## License
Code: MIT © zmlworks. Stroke data (kanji and kana): [KanjiVG](https://kanjivg.tagaini.net/) © Ulrich Apel, CC BY-SA 3.0 (see `data/NOTICE.md`).
Icon (favicon / apple-touch-icon): icon artwork supplied by the project owner.
