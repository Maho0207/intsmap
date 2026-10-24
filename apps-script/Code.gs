/**
 * 国際列車 路線図用：スプレッドシート「路線図用」の駅データをCSVで返すウェブアプリ
 *
 * 設定手順
 *  1. スプレッドシート「路線図用」の「拡張機能」→「Apps Script」を開き、このコードを貼り付けて保存
 *     （ほかのスクリプトと混ざらないよう、このコードだけのプロジェクトにしてください）
 *  2. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *     実行ユーザー：自分 ／ アクセスできるユーザー：全員
 *  3. 発行された …/exec のURLを config.js の sheetUrl に貼り付け
 *  コードを書き換えたときは「デプロイを管理」→ 編集 →「新バージョン」で更新します（URLは変わりません）。
 *
 * このスクリプトはシートを読むだけで、書き込み・シートの追加・削除は一切しません。
 */
const SPREADSHEET_ID = '1zXvomSTWuoScvuP1zjzf0Y495Lfu0NrcoI5dU78o4yk';
const SHEET_NAME = 'シート1';   // シート名を変えたらここも変更（見つからないときは先頭のシートを使います）

function doGet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  // getDisplayValues: 見た目どおりの文字列で取得（「137-1」などの枝番が数値・日付に化けない）
  const values = sheet.getDataRange().getDisplayValues();
  const csv = values
    .map(row => row.map(v => /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(','))
    .join('\n');
  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
}
