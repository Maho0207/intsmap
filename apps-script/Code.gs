/**
 * 国際列車 路線図用：シート159をCSVで返すウェブアプリ
 *
 * 設定手順
 *  1. スプレッドシートの「拡張機能」→「Apps Script」を開き、このコードを貼り付けて保存
 *  2. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *     実行ユーザー：自分 ／ アクセスできるユーザー：全員
 *  3. 発行された …/exec のURLを config.js の sheetUrl に貼り付け
 *  コードを書き換えたときは「デプロイを管理」→ 編集 →「新バージョン」で更新します（URLは変わりません）。
 */
const SPREADSHEET_ID = '17Q0-Q7LynBNk89kttIWdOVTD-ktQaL_ItM91vgBpUhE';
const SHEET_NAME = 'シート159';

function doGet() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  // getDisplayValues: 見た目どおりの文字列で取得（「137-1」などの枝番が数値・日付に化けない）
  const values = sheet.getDataRange().getDisplayValues();
  const csv = values
    .map(row => row.map(v => /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(','))
    .join('\n');
  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
}
