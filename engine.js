var ROSEN_ENGINE_VERSION = 3;
/* 国際列車 路線図エンジン: CSV → 描画データ（ブラウザとビルドで共用） */
var RosenEngine = (function () {
  var CFG = {
    spurBranch: ['140', '713', '2210', '3602', '2935'],
    spurRanges: [{ from: '3409', nums: ['3410', '3411', '3412'] }, { from: '1406', nums: ['1407'] }],
    express: { '508-1': ['平山南', '一花海岸'], '1401-1': ['中陸中央', '水那'] },
    gates: [
      { name: '黒紺島', crimson: ['クリムゾン橋入口', 'クリムゾン南黒紺海底'] },
      { name: '鰆光ゲート', crimson: ['光海'] }
    ],
    U: 3000, SC: 45
  };

  function z2h(s) { return String(s == null ? '' : s).replace(/[０-９－]/g, function (c) { return c === '－' ? '-' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).trim(); }

  function parseTable(text) {
    text = text.replace(/^\uFEFF/, '');
    var first = text.split(/\r?\n/, 1)[0];
    var delim = (first.split('\t').length > first.split(',').length) ? '\t' : ',';
    var rows = [], row = [], f = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"' && f === '') q = true;
      else if (c === delim) { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }

  function readRows(table) {
    var h = -1;
    for (var i = 0; i < Math.min(table.length, 20); i++) {
      var r = table[i].map(function (s) { return s.trim(); });
      if (r.indexOf('駅名') >= 0 && r.indexOf('駅番号') >= 0) { h = i; break; }
    }
    if (h < 0) throw new Error('見出し行（「駅名」「駅番号」を含む行）が見つかりません。シート159の1行目から含めて読み込んでください。');
    var hd = table[h].map(function (s) { return s.trim(); });
    var ix = function (n) { return hd.indexOf(n); };
    var iCode = hd.findIndex(function (s) { return /^駅(ｺｰﾄﾞ|コード)$/.test(s); });
    var iNums = []; hd.forEach(function (s, j) { if (s === '駅番号') iNums.push(j); });
    var iName = ix('駅名'), iYomi = ix('読み'), iCty = ix('所在国'), iBr = ix('支社'), iCls = ix('級'), iX = ix('x座標'), iZ = ix('z座標');
    var out = [], warn = { invalid: [], partial: [] };
    for (var k = h + 1; k < table.length; k++) {
      var r = table[k], g = function (j) { return j >= 0 && j < r.length ? r[j].trim() : ''; };
      var name = g(iName); if (!name) continue;
      var code = z2h(g(iCode));
      var nums = [];
      iNums.forEach(function (j) {
        var v = z2h(g(j)); if (!v) return;
        if (/^\d+(-\d+)?$/.test(v)) nums.push(v); else warn.invalid.push(name + '：' + v);
      });
      var xs = z2h(g(iX)), zs = z2h(g(iZ)), xz = null;
      var xn = parseFloat(xs), zn = parseFloat(zs);
      if (xs !== '' && zs !== '' && isFinite(xn) && isFinite(zn)) xz = [xn, zn];
      else if (xs !== '' || zs !== '') warn.partial.push(name + (code ? '' : '（未開業）'));
      var cls = parseInt(z2h(g(iCls)), 10);
      out.push({ row: k, code: code, open: code !== '', name: name, yomi: g(iYomi), country: g(iCty), branch: g(iBr), cls: isFinite(cls) ? cls : 6, nums: nums, xz: xz });
    }
    return { rows: out, warn: warn };
  }

  /* ---------- graph ---------- */
  function buildGraph(rows) {
    var st = {}, byName = {}, lines = {};
    rows.forEach(function (r) {
      var id = r.open ? 'c' + r.code : 'u' + r.row;
      if (st[id]) id = id + '_' + r.row;
      r.id = id; st[id] = r; r.served = []; r.planned = [];
      if (r.open && !byName[r.name]) byName[r.name] = id;
      r.nums.forEach(function (num) {
        var m = num.match(/^(\d+)(?:-(\d+))?$/), b = +m[1], s = +(m[2] || 0), L = Math.floor(b / 100);
        (lines[L] = lines[L] || []).push({ b: b, s: s, id: id, open: r.open, num: num, code: r.open ? +r.code || 0 : 1e9 });
      });
    });
    var spurRangeOf = {};
    CFG.spurRanges.forEach(function (sr) { sr.nums.forEach(function (n) { spurRangeOf[n] = sr.from; }); });
    var edges = [], dashed = [], dupNums = {}, routes = {};
    Object.keys(lines).forEach(function (Lk) {
      var L = +Lk, items = lines[Lk];
      items.sort(function (a, c) { return a.b - c.b || a.s - c.s || a.code - c.code; });
      var main = [], spurs = {};
      items.forEach(function (it) {
        dupNums[it.num] = (dupNums[it.num] || []).concat([st[it.id].name + (it.open ? '' : '（未開業）')]);
        if (CFG.express[it.num]) return;
        if (it.s && CFG.spurBranch.indexOf(String(it.b)) >= 0) { (spurs[String(it.b)] = spurs[String(it.b)] || []).push(it); return; }
        if (!it.s && spurRangeOf[it.num]) { (spurs[spurRangeOf[it.num]] = spurs[spurRangeOf[it.num]] || []).push(it); return; }
        main.push(it);
      });
      var seqs = [{ seq: main, spur: false }];
      Object.keys(spurs).forEach(function (from) {
        var root = main.filter(function (it) { return it.num === from; });
        seqs.push({ seq: root.concat(spurs[from]), spur: true, hasRoot: root.length > 0 });
      });
      routes[L] = seqs.filter(function (S) { return S.seq.length; }).map(function (S) {
        return { title: S.spur ? (S.hasRoot ? '支線（' + st[S.seq[0].id].name + 'から）' : '支線') : '本線', items: S.seq.map(function (it) { return { id: it.id, num: it.num }; }) };
      });
      seqs.forEach(function (S) {
        var seq = S.seq, segs = [], cur = [];
        seq.forEach(function (it) { if (!it.open) { if (cur.length) segs.push(cur); cur = []; } else cur.push(it); });
        if (cur.length) segs.push(cur);
        segs.forEach(function (seg) {
          if (S.spur && (!S.hasRoot || seg[0] !== seq[0])) {
            seg.forEach(function (it) { st[it.id].planned.push([L, it.num]); });
            return;
          }
          if (seg.length < 2) { st[seg[0].id].planned.push([L, seg[0].num]); return; }
          for (var i = 0; i + 1 < seg.length; i++) edges.push([seg[i].id, seg[i + 1].id, L, S.spur ? 's' : 'n']);
          seg.forEach(function (it, j) { if (!(S.spur && j === 0)) st[it.id].served.push([L, it.num]); });
        });
        for (var i = 0; i + 1 < seq.length; i++) {
          var a = seq[i], c = seq[i + 1];
          if (a.open && c.open) continue;
          if (!(a.open || st[a.id].xz) || !(c.open || st[c.id].xz)) continue;
          dashed.push([a.id, c.id, L, 'p']);
        }
      });
    });
    Object.keys(CFG.express).forEach(function (num) {
      var L = Math.floor(parseInt(num, 10) / 100);
      var sid = Object.keys(st).find(function (id) { return st[id].open && st[id].nums.indexOf(num) >= 0; });
      var p = byName[CFG.express[num][0]], n = byName[CFG.express[num][1]];
      if (sid && p && n) { edges.push([p, sid, L, 'x']); edges.push([sid, n, L, 'x']); st[sid].served.push([L, num]); (routes[L] = routes[L] || []).push({ title: '速達車線', express: true, items: [{ id: p, num: '' }, { id: sid, num: num }, { id: n, num: '' }] }); }
    });
    var dups = Object.keys(dupNums).filter(function (k) { return dupNums[k].length > 1; }).map(function (k) { return k + '：' + dupNums[k].join('、'); });
    return { st: st, byName: byName, edges: edges, dashed: dashed, dups: dups, routes: routes };
  }

  /* ---------- gates ---------- */
  function splitGates(G) {
    var map = {};
    CFG.gates.forEach(function (g) {
      var id = G.byName[g.name]; if (!id) return;
      var crim = g.crimson.map(function (n) { return G.byName[n]; }).filter(Boolean);
      map[id] = crim;
    });
    function m(x, o) { if (!(x in map)) return x; return x + (map[x].indexOf(o) >= 0 ? '#C' : '#B'); }
    var E = G.edges.map(function (e) { return [m(e[0], e[1]), m(e[1], e[0]), e[2], e[3]]; });
    var P = G.dashed.map(function (e) { return [m(e[0], e[1]), m(e[1], e[0]), e[2], e[3]]; });
    return { E: E, P: P, gateIds: map };
  }

  /* ---------- layout ---------- */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function* layoutGen(G, S) {
    var U = CFG.U, base = function (n) { return n.split('#')[0]; };
    var isGate = function (n) { return n.indexOf('#') > 0; };
    var nodes = [], idx = {}, adj = [];
    function add(n) { if (!(n in idx)) { idx[n] = nodes.length; nodes.push(n); adj.push([]); } return idx[n]; }
    S.E.forEach(function (e) { var a = add(e[0]), b = add(e[1]); if (adj[a].indexOf(b) < 0) { adj[a].push(b); adj[b].push(a); } });
    var n = nodes.length;
    var pin = nodes.map(function (x) { var s = G.st[base(x)]; return (!isGate(x) && s.xz) ? [-s.xz[0] / U, -s.xz[1] / U] : null; });
    // components
    var comp = new Int32Array(n).fill(-1), comps = [];
    for (var i = 0; i < n; i++) if (comp[i] < 0) { var c = [], q = [i]; comp[i] = comps.length; while (q.length) { var v = q.pop(); c.push(v); adj[v].forEach(function (w) { if (comp[w] < 0) { comp[w] = comps.length; q.push(w); } }); } comps.push(c); }
    var compPinned = comps.map(function (c) { return c.some(function (v) { return pin[v]; }); });
    var A = []; comps.forEach(function (c, k) { if (compPinned[k]) A = A.concat(c); });
    // edge weights
    function wgt(a, b) { return (pin[a] && pin[b]) ? Math.max(0.3, Math.hypot(pin[a][0] - pin[b][0], pin[a][1] - pin[b][1])) : 1; }
    // positions for set A via stress
    var m = A.length, aIdx = new Int32Array(n).fill(-1); A.forEach(function (v, j) { aIdx[v] = j; });
    var D = new Float32Array(m * m), W = new Float32Array(m * m);
    for (var s = 0; s < m; s++) {
      var dist = new Float64Array(m).fill(Infinity), done = new Uint8Array(m); dist[s] = 0;
      var heap = [[0, s]];
      while (heap.length) {
        var top = heap[0], last = heap.pop();
        if (heap.length) { heap[0] = last; var k = 0; for (;;) { var l = 2 * k + 1, r = l + 1, sm = k; if (l < heap.length && heap[l][0] < heap[sm][0]) sm = l; if (r < heap.length && heap[r][0] < heap[sm][0]) sm = r; if (sm === k) break; var t = heap[k]; heap[k] = heap[sm]; heap[sm] = t; k = sm; } }
        var u = top[1]; if (done[u]) continue; done[u] = 1;
        var gu = A[u];
        for (var ai = 0; ai < adj[gu].length; ai++) {
          var gv = adj[gu][ai], vv = aIdx[gv]; if (vv < 0) continue;
          var nd = top[0] + wgt(gu, gv);
          if (nd < dist[vv]) { dist[vv] = nd; heap.push([nd, vv]); var c2 = heap.length - 1; while (c2 > 0) { var p = (c2 - 1) >> 1; if (heap[p][0] <= heap[c2][0]) break; var t2 = heap[p]; heap[p] = heap[c2]; heap[c2] = t2; c2 = p; } }
        }
      }
      for (var j = 0; j < m; j++) { var d = dist[j]; if (isFinite(d) && j !== s) { D[s * m + j] = d; W[s * m + j] = 1 / (d * d); } }
      if (s % 80 === 0) yield { p: 0.1 * s / m, t: '距離を計算中' };
    }
    var X = new Float64Array(m), Y = new Float64Array(m), fixed = new Uint8Array(m), gx = new Uint8Array(m), R = rng(7);
    var pinsA = []; for (var j2 = 0; j2 < m; j2++) if (pin[A[j2]]) { fixed[j2] = 1; X[j2] = pin[A[j2]][0]; Y[j2] = pin[A[j2]][1]; pinsA.push(j2); }
    for (var i2 = 0; i2 < m; i2++) {
      if (fixed[i2]) continue;
      var sw = 0, sx = 0, sy = 0;
      pinsA.forEach(function (pj) { var d = D[i2 * m + pj]; if (d > 0) { var w = Math.pow(d, -4); sw += w; sx += w * X[pj]; sy += w * Y[pj]; } });
      X[i2] = (sw ? sx / sw : 0) + (R() - 0.5) * 3; Y[i2] = (sw ? sy / sw : 0) + (R() - 0.5) * 3;
    }
    var lo = -Infinity, hi = Infinity, gateX = {};
    function stress(its) {
      var NX = new Float64Array(m), NY = new Float64Array(m);
      for (var it = 0; it < its; it++) {
        for (var a = 0; a < m; a++) {
          if (fixed[a]) { NX[a] = X[a]; NY[a] = Y[a]; continue; }
          var sw = 0, sx = 0, sy = 0, xa = X[a], ya = Y[a], o = a * m;
          for (var b = 0; b < m; b++) {
            var w = W[o + b]; if (w === 0) continue;
            var dx = xa - X[b], dy = ya - Y[b], dd = Math.sqrt(dx * dx + dy * dy) + 1e-9, B = w * D[o + b] / dd;
            sw += w; sx += w * X[b] + B * dx; sy += w * Y[b] + B * dy;
          }
          NX[a] = sw ? sx / sw : xa; NY[a] = sw ? sy / sw : ya;
          if (gx[a]) NX[a] = gateX[a]; else if (NX[a] < lo) NX[a] = lo; else if (NX[a] > hi) NX[a] = hi;
        }
        X.set(NX); Y.set(NY);
      }
    }
    var deg2 = []; for (var i3 = 0; i3 < m; i3++) { var g3 = A[i3]; if (!fixed[i3] && !gx[i3] && adj[g3].length === 2) deg2.push(i3); }
    function smooth(its, a) {
      for (var it = 0; it < its; it++) {
        var NX = Float64Array.from(X), NY = Float64Array.from(Y);
        deg2.forEach(function (i) { var p = aIdx[adj[A[i]][0]], q = aIdx[adj[A[i]][1]]; NX[i] = (1 - a) * X[i] + a / 2 * (X[p] + X[q]); NY[i] = (1 - a) * Y[i] + a / 2 * (Y[p] + Y[q]); });
        X.set(NX); Y.set(NY);
      }
    }
    function repel(its, md) {
      for (var it = 0; it < its; it++) {
        var PX = new Float64Array(m), PY = new Float64Array(m);
        for (var a = 0; a < m; a++) for (var b = a + 1; b < m; b++) {
          var dx = X[a] - X[b], dy = Y[a] - Y[b]; if (Math.abs(dx) >= md || Math.abs(dy) >= md) continue;
          var d = Math.sqrt(dx * dx + dy * dy); if (d >= md) continue;
          var f = (md - d) / (d + 1e-6) * 0.3; PX[a] += f * dx; PY[a] += f * dy; PX[b] -= f * dx; PY[b] -= f * dy;
        }
        for (var a2 = 0; a2 < m; a2++) { if (fixed[a2]) continue; if (!gx[a2]) { X[a2] += PX[a2]; X[a2] = Math.min(hi, Math.max(lo, X[a2])); } Y[a2] += PY[a2]; }
      }
    }
    for (var k1 = 0; k1 < 10; k1++) { stress(60); yield { p: 0.1 + 0.3 * k1 / 10, t: '駅の位置を計算中' }; }
    // gate edges
    var gB = [], gC = []; for (var i4 = 0; i4 < m; i4++) { var nm = nodes[A[i4]]; if (/#B$/.test(nm)) gB.push(i4); if (/#C$/.test(nm)) gC.push(i4); }
    var minX = Infinity, maxX = -Infinity; for (var i5 = 0; i5 < m; i5++) { minX = Math.min(minX, X[i5]); maxX = Math.max(maxX, X[i5]); }
    var mean = function (arr, V) { return arr.length ? arr.reduce(function (s, i) { return s + V[i]; }, 0) / arr.length : 0; };
    var blueRight = mean(gB, X) >= mean(gC, X);
    var edgeL = minX - 2, edgeR = maxX + 2;
    if (gB.length || gC.length) {
      gB.forEach(function (i) { gx[i] = 1; gateX[i] = blueRight ? edgeR : edgeL; X[i] = gateX[i]; });
      gC.forEach(function (i) { gx[i] = 1; gateX[i] = blueRight ? edgeL : edgeR; X[i] = gateX[i]; });
      lo = edgeL + 1; hi = edgeR - 1;
      deg2 = deg2.filter(function (i) { return !gx[i]; });
    }
    for (var k2 = 0; k2 < 12; k2++) { stress(60); yield { p: 0.4 + 0.3 * k2 / 12, t: '駅の位置を計算中' }; }
    for (var r3 = 0; r3 < 3; r3++) { smooth(40, 0.5); repel(60, 0.8); stress(80); yield { p: 0.7 + 0.08 * r3, t: '線をなめらかに整えています' }; }
    smooth(30, 0.4); repel(150, 1.0);
    var pos = {}; for (var i6 = 0; i6 < m; i6++) pos[nodes[A[i6]]] = [X[i6], Y[i6]];
    // components without pins: small local layout, placed later
    var loose = [];
    comps.forEach(function (c, k) {
      if (compPinned[k]) return;
      var P = {}, order = [], seen = {}, start = c.find(function (v) { return adj[v].length === 1; }); if (start == null) start = c[0];
      var st2 = [start]; while (st2.length) { var v = st2.pop(); if (seen[v]) continue; seen[v] = 1; order.push(v); adj[v].forEach(function (w) { if (!seen[w]) st2.push(w); }); }
      order.forEach(function (v, j) { P[nodes[v]] = [j * 0.9, j * 0.45]; });
      loose.push(P);
    });
    return { pos: pos, loose: loose, edgeL: edgeL, edgeR: edgeR, blueRight: blueRight, hasGates: gB.length + gC.length > 0 };
  }

  /* ---------- colors ---------- */
  function hls(h, l, s) {
    function v(m1, m2, hue) { hue = ((hue % 1) + 1) % 1; if (hue < 1 / 6) return m1 + (m2 - m1) * hue * 6; if (hue < .5) return m2; if (hue < 2 / 3) return m1 + (m2 - m1) * (2 / 3 - hue) * 6; return m1; }
    var m2 = l <= .5 ? l * (1 + s) : l + s - l * s, m1 = 2 * l - m2;
    return '#' + [v(m1, m2, h + 1 / 3), v(m1, m2, h), v(m1, m2, h - 1 / 3)].map(function (x) { return ('0' + Math.floor(x * 255).toString(16)).slice(-2); }).join('');
  }

  /* ---------- assemble ---------- */
  function finish(G, S, Lr, warn) {
    var SC = CFG.SC, U = CFG.U, base = function (n) { return n.split('#')[0]; };
    var nodes = {}, out = [];
    var inc = {}; S.E.forEach(function (e) { (inc[e[0]] = inc[e[0]] || []).push([e[1], e[2], e[3]]); (inc[e[1]] = inc[e[1]] || []).push([e[0], e[2], e[3]]); });
    var ox = Lr.edgeL;
    function mk(id, p, planned) {
      var s = G.st[base(id)]; if (!s) throw new Error("missing "+id); var Ls = {}; (inc[id] || []).forEach(function (q) { Ls[q[1]] = 1; });
      var side = /#B$/.test(id) ? 'ブルー側' : /#C$/.test(id) ? 'クリムゾン側' : '';
      var served = s.served.filter(function (q) { return !side || Ls[q[0]]; }).map(function (q) { return q[1]; });
      var plannedN = s.planned.filter(function (q) { return !side; }).map(function (q) { return q[1]; });
      if (planned) { served = []; plannedN = s.nums.slice(); }
      return { id: id, name: s.name, side: side, yomi: s.yomi, country: s.country, branch: s.branch, cls: s.cls,
        x: Math.round((p[0] - ox) * SC * 10) / 10, y: Math.round(p[1] * SC * 10) / 10, nums: served, pnums: plannedN,
        lines: Object.keys(Ls).map(Number).sort(function (a, b) { return a - b; }), gate: !!side, xz: (!side && s.xz) ? s.xz : null, planned: !!planned };
    }
    Object.keys(Lr.pos).forEach(function (id) { nodes[id] = mk(id, Lr.pos[id]); });
    var bx = Infinity, by = -Infinity; Object.keys(nodes).forEach(function (k) { bx = Math.min(bx, nodes[k].x); by = Math.max(by, nodes[k].y); });
    // planned stations (with coordinates)
    Object.keys(G.st).forEach(function (id) { var s = G.st[id]; if (!s.open && s.xz) { nodes[id] = mk(id, [-s.xz[0] / U, -s.xz[1] / U], true); by = Math.max(by, nodes[id].y); } });
    // loose components
    var small = [], cx = (isFinite(bx) ? bx : 0) + 60, cy = by + 260;
    Lr.loose.forEach(function (P) {
      var ids = Object.keys(P), maxx = 0;
      ids.forEach(function (id) { var nd = mk(id, [0, 0]); nd.x = Math.round(cx + P[id][0] * SC); nd.y = Math.round(cy + P[id][1] * SC); nodes[id] = nd; maxx = Math.max(maxx, nd.x); });
      small.push([cx, cy, maxx, Math.max.apply(null, ids.map(function (i) { return nodes[i].y; })) - cy]);
      cx = maxx + 160;
    });
    small = small.map(function (r) { return [r[0], r[1], r[2], r[1] + r[3]]; });
    var allE = S.E.concat(S.P.filter(function (e) { return nodes[e[0]] && nodes[e[1]]; }));
    var lineSet = {}; S.E.forEach(function (e) { lineSet[e[2]] = 1; });
    var lines = Object.keys(lineSet).map(Number).sort(function (a, b) { return a - b; });
    var cols = {}; lines.forEach(function (L, i) { cols[L] = hls(((i * 137.508 + 200) % 360) / 360, [0.45, 0.56, 0.36][i % 3], [0.70, 0.62, 0.66][Math.floor(i / 3) % 3]); });
    // termini
    var term = [];
    lines.forEach(function (L) {
      var dg = {}, nb = {}; S.E.forEach(function (e) { if (e[2] === L && e[3] === 'n') { dg[e[0]] = (dg[e[0]] || 0) + 1; dg[e[1]] = (dg[e[1]] || 0) + 1; nb[e[0]] = e[1]; nb[e[1]] = e[0]; } });
      Object.keys(dg).forEach(function (v) { if (dg[v] === 1 && nodes[v] && nodes[nb[v]]) { var a = nodes[v], o = nodes[nb[v]], dx = a.x - o.x, dy = a.y - o.y, mm = Math.hypot(dx, dy) || 1; term.push({ n: v, L: L, dx: +(dx / mm).toFixed(3), dy: +(dy / mm).toFixed(3) }); } });
    });
    // label directions
    var DIRS = [[1, 0], [-1, 0], [0, -1], [0, 1], [.707, -.707], [-.707, -.707], [.707, .707], [-.707, .707]];
    var ids = Object.keys(nodes), arr = ids.map(function (k) { return nodes[k]; });
    var incAll = {}; allE.forEach(function (e) { (incAll[e[0]] = incAll[e[0]] || []).push(e[1]); (incAll[e[1]] = incAll[e[1]] || []).push(e[0]); });
    arr.forEach(function (me) {
      var obs = [];
      (incAll[me.id] || []).forEach(function (o) { var q = nodes[o]; if (!q) return; var dx = q.x - me.x, dy = q.y - me.y, mm = Math.hypot(dx, dy) || 1; obs.push([dx / mm, dy / mm, 1]); });
      term.forEach(function (t) { if (t.n === me.id) obs.push([t.dx, t.dy, 1.2]); });
      arr.forEach(function (o) { if (o === me) return; var dx = o.x - me.x, dy = o.y - me.y; if (Math.abs(dx) > 110 || Math.abs(dy) > 110) return; var mm = Math.hypot(dx, dy); if (mm > 0 && mm < 110) obs.push([dx / mm, dy / mm, 0.5 * (110 - mm) / 110]); });
      var sc = DIRS.map(function (d, i) { var pen = 0; obs.forEach(function (o) { var v = Math.max(0, d[0] * o[0] + d[1] * o[1]); pen += o[2] * v * v; }); pen += d[1] === 0 ? 0 : (d[0] === 0 ? 0.15 : 0.08); return [pen, i]; });
      sc.sort(function (a, b) { return a[0] - b[0]; }); me.ld = sc.slice(0, 4).map(function (q) { return q[1]; });
      if (me.gate) me.ld = (me.side === 'ブルー側') === Lr.blueRight ? [7, 3, 1] : [6, 3, 0];
    });
    // edges with parallel offsets
    var pair = {}; allE.forEach(function (e) { var k = [e[0], e[1]].sort().join('|') + (e[3] === 'p' ? 'p' : ''); (pair[k] = pair[k] || []).push(e); });
    var edges = []; Object.keys(pair).forEach(function (k) { var l = pair[k]; l.sort(function (a, b) { return a[2] - b[2]; }); l.forEach(function (e, i) { edges.push([e[0], e[1], e[2], e[3], +(i - (l.length - 1) / 2).toFixed(2)]); }); });
    var lineinfo = lines.map(function (L) { return { L: L, color: cols[L], n: arr.filter(function (v) { return !v.planned && v.lines.indexOf(L) >= 0; }).length }; });
    var core = arr.filter(function (v) { return !small.some(function (r) { return v.y >= r[1] - 1 && v.y <= r[3] + 1 && v.x >= r[0] - 1 && v.x <= r[2] + 1; }); });
    var bounds = [Math.min.apply(null, core.map(function (v) { return v.x; })), Math.min.apply(null, arr.map(function (v) { return v.y; })), Math.max.apply(null, core.map(function (v) { return v.x; })), Math.max.apply(null, arr.map(function (v) { return v.y; }))];
    var routes = {};
    lines.forEach(function (L) {
      routes[L] = (G.routes[L] || []).map(function (sec) {
        return { title: sec.title, express: !!sec.express, items: sec.items.map(function (it) { var s = G.st[it.id]; return { id: it.id, num: it.num, name: s.name, open: s.open, cls: s.cls, xz: s.xz }; }) };
      });
    });
    return { routes: routes, nodes: arr, edges: edges, lines: lineinfo, term: term, W: Math.round((Lr.edgeR - Lr.edgeL) * SC), SC: SC, U: U, edgeL: Lr.edgeL, blueRight: Lr.blueRight, hasGates: Lr.hasGates,
      bounds: bounds, small: small,
      check: { stations: Object.keys(G.st).filter(function (k) { return G.st[k].open; }).length, xz: arr.filter(function (v) { return v.xz && !v.planned; }).length, planned: arr.filter(function (v) { return v.planned; }).length, dups: G.dups, partial: warn.partial, invalid: warn.invalid } };
  }

  function* runGen(text) {
    var R = readRows(parseTable(text));
    yield { p: 0.02, t: 'データを読み込みました' };
    var G = buildGraph(R.rows), S = splitGates(G);
    var gen = layoutGen(G, S), r;
    while (!(r = gen.next()).done) yield r.value;
    var Dd = finish(G, S, r.value, R.warn);
    yield { p: 1, t: '完了', result: Dd };
  }
  function runSync(text) { var g = runGen(text), r, last; while (!(r = g.next()).done) last = r.value; return last.result; }
  return { runGen: runGen, runSync: runSync, CFG: CFG };
})();
if (typeof module !== 'undefined') module.exports = RosenEngine;
