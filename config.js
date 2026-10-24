/* 路線図の設定ファイル
   sheetUrl に Apps Script のウェブアプリURL（…/exec）を入れると、
   ページを開くたびに路線図用シートの最新データを読み込みます。
   空のままにすると、data/prebuilt.js の保存済みデータだけで表示します（取得ボタンも出ません）。
   autoFetch を false にすると、ページを開いたときには取得せず、
   「シートから最新データを取得」ボタンを押したときだけ取得します。 */
window.ROSEN_CONFIG = {
  sheetUrl: "https://script.google.com/macros/s/AKfycbzM4L2-p86w9xDk5RjE-8kO-QXCoevV-q_bOi8EZqg6KXD2oVqRk4j4r0oYIdElwBl1aQ/exec",
  autoFetch: true
};
