# 国際列車 路線図

シート159（国際列車総合データ）の駅データと座標から、路線図を自動で描くWebページです。
GitHub Pages でそのまま公開できます。

## しくみ

1. ページを開くと、まず `data/prebuilt.js`（計算済みの保存データ）で即座に表示します。
2. `config.js` に Apps Script のURLがあれば、シート159の最新データを読み込みます（自動、または「シートから最新データを取得」ボタンで手動）。
3. シートが保存データから変わっていれば、ブラウザで駅の配置を計算し直して描き直します（数秒）。
   計算結果はブラウザに保存されるので、シートが変わらない限り次回からは計算しません。

## 公開までの手順

### 1. Apps Script を用意する
1. スプレッドシートの「拡張機能」→「Apps Script」を開き、`apps-script/Code.gs` の中身を貼り付けて保存
2. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
   - 実行ユーザー：自分
   - アクセスできるユーザー：全員
3. 発行された `https://script.google.com/macros/s/…/exec` をコピー

### 2. config.js にURLを書く
```js
window.ROSEN_CONFIG = {
  sheetUrl: "https://script.google.com/macros/s/…/exec"
};
```

ページを開いたときは自動で取得せず、ボタンを押したときだけ取得したい場合は `autoFetch: false` にします。
どちらの設定でも、左上の「シートから最新データを取得」ボタンでいつでも取得し直せます。

### 3. GitHub Pages を有効にする
リポジトリの Settings → Pages → Branch を `main` / `(root)` にして保存。

### 4.（任意）保存データの自動更新
`.github/workflows/update-data.yml` が3時間ごとにシートを取得し、`data/prebuilt.js` を作り直してコミットします。
保存データが新しいほど、ページを開いたときの再計算が起きにくくなります。

- Settings → Secrets and variables → Actions → **Variables** に `SHEET_URL`（Apps Script のURL）を追加
- Settings → Actions → General → Workflow permissions を「Read and write」に
- Actions タブの「シート159から路線図データを更新」→「Run workflow」で手動実行もできます

## 手元で保存データを作り直す
Node.js 18 以上で:
```
node tools/build.js 保存したシート159.csv
```
`data/sheet.csv` と `data/prebuilt.js` が更新されます。

## ファイル構成
| ファイル | 内容 |
|---|---|
| `index.html` | ページ本体（見た目） |
| `app.js` | 描画・操作・シートの読み込み |
| `engine.js` | CSV → 路線・駅配置の計算（ブラウザと tools/build.js で共用） |
| `config.js` | Apps Script のURL |
| `data/prebuilt.js` | 計算済みの保存データ（自動生成） |
| `data/sheet.csv` | 保存データの元になったCSV |
| `apps-script/Code.gs` | シート159をCSVで返す Apps Script |
| `tools/build.js` | 保存データを作るスクリプト |

## 路線の扱い（engine.js の `CFG`）
- 駅番号の上2桁（100で割った商）が路線番号。駅番号 → 枝番 → 次の駅番号 の順につなぐ
- 支線：140・713・2210・3602・2935 の枝番、34号線の 3410〜3412（3409から）、14号線の 1407（1406から）
- 速達車のみの別線路：青海中央（平山南〜一花海岸）、水那晴森（中陸中央〜水那）
- ゲート駅：黒紺島（7号線）、鰆光ゲート（26号線）。ブルー側とクリムゾン側に分けて地図の両端に配置
- 駅コードのない駅は未開業。座標があれば灰色の点線で表示
- 方角：x＋が西、z＋が北。距離は x・z の差の合計（1ブロック＝1m）

ルールを追加・変更したときは `engine.js` 先頭の `ROSEN_ENGINE_VERSION` を1つ上げてください（ブラウザの保存データが作り直されます）。
