// 使い方: node tools/build.js [CSVのパス]
// 路線図用シートのCSVから駅の配置を計算し、data/prebuilt.js を作り直します。
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const E = require(path.join(root, 'engine.js'));
const csvPath = process.argv[2] || path.join(root, 'data', 'sheet.csv');
const text = fs.readFileSync(csvPath, 'utf8');
if (!/駅名/.test(text)) { console.error('CSVに路線図用シートの見出しが見つかりません: ' + csvPath); process.exit(1); }
function hash(t) { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16) + ':' + t.length; }
const t0 = Date.now();
const data = E.runSync(text);
const builtAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const js = JSON.stringify({ builtAt, csvHash: hash(text), data }).replace(/</g, '\\u003c');
fs.writeFileSync(path.join(root, 'data', 'prebuilt.js'), '/* 自動生成ファイル（tools/build.js）。直接編集しないでください。 */\nwindow.ROSEN_PREBUILT = ' + js + ';\n');
if (path.resolve(csvPath) !== path.join(root, 'data', 'sheet.csv')) fs.copyFileSync(csvPath, path.join(root, 'data', 'sheet.csv'));
console.log(`開業駅 ${data.check.stations}・路線 ${data.lines.length}・座標入力済み ${data.check.xz}（${Date.now() - t0}ms）`);
if (data.check.dups.length) console.log('駅番号の重複: ' + data.check.dups.join(' / '));
