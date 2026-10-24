const CONFIG = window.ROSEN_CONFIG || {};
const PRE = window.ROSEN_PREBUILT || null;
const NS = "http://www.w3.org/2000/svg";
const $ = s => document.querySelector(s);
const svg = $("#map"), world = $("#world");
const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); p && p.appendChild(e); return e };
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2] };
const fg = h => lum(h) > .32 ? "#14181f" : "#fff";
const lname = L => L + "号線";
const tierOf = n => n.planned ? 4 : n.cls === 1 ? 1 : (n.cls <= 4 ? 2 : 3);
const DIRS = [[1, 0], [-1, 0], [0, -1], [0, 1], [.707, -.707], [-.707, -.707], [.707, .707], [-.707, .707]];
const PAD = 300;
let D, N = {}, LC = {}, stnEls = {}, labs = [], edgeEls = [], selId = null, lineSel = null;
let z = 1, tx = 0, ty = 0, zfit = 1, MS = { 1: 1, 2: 1, 3: 1, 4: 1 };

function rFor(n) { return n.planned ? 3.4 : n.cls === 1 ? 7.5 : (n.cls <= 4 ? 5.5 : 3.6) }
function otherGate(n) { const b = n.id.split("#")[0]; return N[b + (n.side === "ブルー側" ? "#C" : "#B")] }

function render(data) {
  D = data; N = {}; LC = {}; stnEls = {}; labs = []; edgeEls = []; selId = null; lineSel = null;
  D.nodes.forEach(n => N[n.id] = n); D.lines.forEach(l => LC[l.L] = l.color);
  ["grid", "bg", "eg", "sg", "bgd", "lg"].forEach(id => $("#" + id).replaceChildren());
  world.classList.remove("dim");
  $("#cnt").textContent = `${D.check.stations}駅・${D.lines.length}路線`;
  const B = D.bounds, yTop = B[1] - PAD, yBot = B[3] + PAD, bg = $("#bg");
  const leftBlue = !D.blueRight;
  if (D.hasGates) {
    el("rect", { x: -PAD, y: yTop, width: PAD + 240, height: yBot - yTop, fill: leftBlue ? "url(#gB)" : "url(#gCL)" }, bg);
    el("rect", { x: D.W - 240, y: yTop, width: PAD + 240, height: yBot - yTop, fill: leftBlue ? "url(#gC)" : "url(#gBR)" }, bg);
    const vcap = (x, t, color) => { const g = el("g", { class: "pin vcap", style: `--x:${x}px;--y:${(yTop + yBot) / 2}px` }, bg); const tx = el("text", { "text-anchor": "middle", "writing-mode": "vertical-rl" }, g); tx.textContent = t; tx.style.fill = color; };
    vcap(-PAD + 34, (leftBlue ? "ブルー" : "クリムゾン") + "地区側 ― 惑星を一周して右端へつづく", leftBlue ? "var(--blue)" : "var(--crimson)");
    vcap(D.W + PAD - 34, (leftBlue ? "クリムゾン" : "ブルー") + "地区側 ― 惑星を一周して左端へつづく", leftBlue ? "var(--crimson)" : "var(--blue)");
    D.nodes.filter(n => n.gate).forEach(n => { const s = n.x < D.W / 2 ? -1 : 1; const blue = n.side === "ブルー側";
      el("line", { x1: n.x, y1: n.y, x2: n.x + s * (PAD - 70), y2: n.y, stroke: blue ? "var(--blue)" : "var(--crimson)", style: "stroke-dasharray:calc(var(--lw)*1.2) calc(var(--lw)*1.2);stroke-width:calc(var(--lw)*.8)" }, bg); });
  }
  if (D.small.length) {
    const x0 = Math.min(...D.small.map(r => r[0])) - 60, y0 = Math.min(...D.small.map(r => r[1])) - 70, x1 = Math.max(...D.small.map(r => r[2])) + 90, y1 = Math.max(...D.small.map(r => r[3])) + 50;
    el("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 18, class: "frame" }, bg);
    const g = el("g", { class: "pin edgecap", style: `--x:${x0 + 8}px;--y:${y0 - 10}px` }, bg); el("text", {}, g).textContent = "ほかの路線網とまだつながっていない路線";
  }
  /* grid: x+ = west (left), z+ = north (up) */
  { const g = $("#grid"), X = x => (-x / D.U - D.edgeL) * D.SC, Z = zz => -zz / D.U * D.SC, invX = px => -(px / D.SC + D.edgeL) * D.U, invZ = py => -py / D.SC * D.U;
    const xa = invX(D.W + PAD), xb = invX(-PAD), za = invZ(yBot), zb = invZ(yTop);
    for (let x = Math.ceil(xa / 10000) * 10000; x <= xb; x += 10000) { el("line", { x1: X(x), x2: X(x), y1: yTop, y2: yBot, class: "gl" + (x % 50000 === 0 ? " major" : "") }, g);
      if (x % 40000 === 0) { const c = el("g", { class: "pin gcap", style: `--x:${X(x) + 4}px;--y:${B[1] - 40}px` }, g); el("text", {}, c).textContent = "x " + x.toLocaleString() } }
    for (let zz = Math.ceil(za / 10000) * 10000; zz <= zb; zz += 10000) { el("line", { x1: -PAD, x2: D.W + PAD, y1: Z(zz), y2: Z(zz), class: "gl" + (zz % 50000 === 0 ? " major" : "") }, g);
      if (zz % 20000 === 0) { const c = el("g", { class: "pin gcap", style: `--x:${-PAD + 60}px;--y:${Z(zz) - 4}px` }, g); el("text", {}, c).textContent = "z " + zz.toLocaleString() } }
    const c = el("g", { class: "pin gcap", style: `--x:${D.W / 2}px;--y:${B[1] - 130}px` }, g); const t = el("text", { "text-anchor": "middle" }, c); t.textContent = "↑ 北（z＋）　← 西（x＋）"; t.style.fontWeight = 700; }
  /* edges: planned first */
  const eg = $("#eg");
  D.edges.slice().sort((a, b) => (a[3] === "p" ? 0 : 1) - (b[3] === "p" ? 0 : 1)).forEach(([a, b, L, k, o]) => {
    const A = N[a], Bn = N[b]; if (!A || !Bn) return; const dx = Bn.x - A.x, dy = Bn.y - A.y, m = Math.hypot(dx, dy) || 1, ox = -dy / m * o * 5.4, oy = dx / m * o * 5.4;
    const e = el("line", { x1: A.x + ox, y1: A.y + oy, x2: Bn.x + ox, y2: Bn.y + oy, class: "edge" + (k === "x" ? " x" : k === "p" ? " p" : "") }, eg);
    if (k !== "p") e.setAttribute("stroke", LC[L]); e._L = L; edgeEls.push(e) });
  /* stations + labels */
  const sg = $("#sg"), lg = $("#lg"), bgd = $("#bgd");
  D.nodes.slice().sort((a, b) => (b.planned ? 1 : 0) - (a.planned ? 1 : 0)).forEach(n => {
    const t = tierOf(n);
    const g = el("g", { class: "pin stn k" + Math.min(t, 3) + (n.cls === 1 && !n.planned ? " c1" : "") + (n.lines.length > 1 ? " xf" : "") + (n.planned ? " pl" : "") + (!n.xz && !n.planned ? " est" : ""), style: `--x:${n.x}px;--y:${n.y}px` }, sg);
    const r = rFor(n);
    if (n.gate) { const s = r + 2; el("rect", { x: -s, y: -s, width: 2 * s, height: 2 * s, rx: 2, transform: "rotate(45)", style: `stroke:${n.side === "ブルー側" ? "var(--blue)" : "var(--crimson)"};stroke-width:3.5` }, g) }
    else { const c = el("circle", { r: n.lines.length > 1 ? r + 1.5 : r }, g); if (n.lines.length === 1 && n.cls !== 1) c.style.stroke = LC[n.lines[0]]; }
    g._n = n; stnEls[n.id] = g;
    const lgp = el("g", { class: "pin lab t" + t, style: `--x:${n.x}px;--y:${n.y}px` }, lg);
    const tx = el("text", {}, lgp); tx.textContent = n.name;
    if (n.side) { const sp = el("tspan", { class: "side" }, tx); sp.textContent = "（" + n.side + "）" }
    const fs = t === 1 ? 14 : t === 2 ? 11.5 : 10; let w = 0; for (const ch of n.name + (n.side ? "（" + n.side + "）" : "")) w += (ch.charCodeAt(0) < 256 ? .56 : 1) * (ch === "（" || ch === "）" ? .6 : 1);
    const item = { n, g: lgp, tx, w: w * fs, h: fs * 1.15, fs, r: r + 4, pri: (n.gate ? -100 : n.planned ? 3000 : n.cls === 1 ? 0 : 1000) + n.cls * 10 - n.lines.length * 3, tier: t };
    labs.push(item); place(item, n.ld[0]);
  });
  D.term.forEach(t => { const n = N[t.n]; if (!n) return; const g = el("g", { class: "pin badge", style: `--x:${n.x}px;--y:${n.y}px` }, bgd);
    const R = rFor(n) + 13; el("circle", { cx: t.dx * R, cy: t.dy * R, r: 9, fill: LC[t.L] }, g); const tx = el("text", { x: t.dx * R, y: t.dy * R + .5, fill: fg(LC[t.L]) }, g); tx.textContent = t.L; g._L = t.L });
  /* line list */
  const ll = $("#lineList"); ll.replaceChildren();
  D.lines.forEach(l => { const st = lineStats(l.L), li = document.createElement("li"); li.innerHTML = `<button type="button" aria-pressed="false" data-l="${l.L}"><span class="sw" style="background:${l.color}"></span>${lname(l.L)}${l.L === 7 || l.L === 26 ? '<span class="gate">ゲート</span>' : ''}<small>${l.n}駅<br>${kmText(st)}</small></button>`; ll.appendChild(li) });
  const sel = $("#lineSel"); sel.innerHTML = `<option value="">路線を選んでください</option>` + D.lines.map(l => `<option value="${l.L}">${lname(l.L)}（${l.n}駅）</option>`).join("");
  renderStations(null);
  $("#xzCnt").textContent = `入力済み ${D.check.xz}／${D.check.stations}駅`;
  closeCard(); initFit();
}

/* ---------- distances & station list ---------- */
const md = (a, b) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])) / 1000;
const f1 = v => v.toFixed(1);
function lineStats(L) { let km = 0, gaps = 0, any = false;
  (D.routes[L] || []).forEach(sec => { if (sec.express) return; for (let i = 0; i + 1 < sec.items.length; i++) { const a = sec.items[i], b = sec.items[i + 1]; if (!a.open || !b.open) continue; if (a.xz && b.xz) { km += md(a.xz, b.xz); any = true } else gaps++ } });
  return { km, gaps, any } }
function kmText(st) { return !st.any ? "距離未計測" : (st.gaps ? "≥" : "") + f1(st.km) + "km" }
function nodeFor(id, L) { const c = [id, id + "#B", id + "#C"].map(k => N[k]).filter(Boolean); return c.find(n => n.lines.includes(L)) || c[0] || null }
function renderStations(L) {
  const box = $("#stList"); $("#lineSel").value = L == null ? "" : String(L);
  if (L == null || !D.routes[L]) { box.innerHTML = `<p class="sum">路線を選ぶと、駅の並びと駅間距離を表示します。距離はx・z座標の差の合計（3000＋2000ブロック＝5km）で計算します。</p>`; return }
  const st = lineStats(L), col = LC[L], openN = new Set();
  D.routes[L].forEach(sec => sec.items.forEach(it => { if (it.open) openN.add(it.id) }));
  let h = `<div class="sum" style="--lc:${col}"><span class="chip" style="background:${col};color:${fg(col)}">${L}</span> ${lname(L)}<br><b>${st.any ? f1(st.km) : "—"}</b> km　${openN.size}駅`
    + (st.gaps ? `<br>座標のない駅間が${st.gaps}か所あり、その区間は距離に含まれていません。` : "") + `</div>`;
  D.routes[L].forEach(sec => {
    let cum = 0, broken = false, secKm = 0;
    const rows = sec.items.map((it, i) => {
      let gap = "";
      if (i > 0) { const p = sec.items[i - 1], both = p.open && it.open;
        if (p.xz && it.xz) { const d = md(p.xz, it.xz); if (both || sec.express) { cum += d; secKm += d } gap = `<div class="gap${both ? "" : " na"}">${f1(d)} km${both ? "" : "（未開業区間）"}</div>` }
        else { if (both) broken = true; gap = `<div class="gap${both ? "" : " na"}">${both ? "距離不明（座標未入力）" : "未開業区間"}</div>` } }
      const n = nodeFor(it.id, L), cls = it.open ? (it.cls === 1 ? " k1" : it.cls <= 4 ? " k2" : "") : " un";
      const others = n && it.open ? n.lines.filter(x => x !== L).slice(0, 5).map(x => chip(x)).join("") : "";
      const cumTxt = !it.open ? "未開業" : (broken && cum === 0) ? "—" : (broken ? "≥" : "") + f1(cum) + " km";
      return gap + `<button type="button" class="st${cls}" data-id="${n ? n.id : ""}" ${n ? "" : "disabled"}><span class="no"><i></i>${it.num || "—"}</span><span><span class="nm">${it.name}</span>${others ? `<span class="tags">${others}</span>` : ""}</span><span class="km">${i === 0 ? (it.open ? "<b>0.0 km</b>" : "未開業") : cumTxt.replace(/^(≥?[\d.]+ km)$/, "<b>$1</b>")}</span></button>`;
    }).join("");
    h += `<div class="sec"><span>${sec.title}</span><span>${secKm ? f1(secKm) + " km" : ""}</span></div><div style="--lc:${col}">${rows}</div>`;
  });
  box.innerHTML = h;
  box.querySelectorAll(".st[data-id]").forEach(b => { if (b.dataset.id) b.onclick = () => select(b.dataset.id, true) });
  box.scrollTop = 0 }
function showTab(t) { const s = t === "S"; $("#tabL").setAttribute("aria-selected", String(!s)); $("#tabS").setAttribute("aria-selected", String(s)); $("#paneL").hidden = s; $("#paneS").hidden = !s }
$("#tabL").onclick = () => showTab("L"); $("#tabS").onclick = () => { showTab("S"); renderStations(lineSel) };
$("#lineSel").onchange = e => { const v = e.target.value; selectLine(v === "" ? null : +v) };

function place(it, di) { const [ux, uy] = DIRS[di]; it.di = di; const R = it.r + 1;
  const x = ux * R, y = uy * R; it.tx.setAttribute("x", x.toFixed(1)); it.tx.setAttribute("y", (y + (uy > 0.5 ? it.h * .75 : uy < -0.5 ? -it.h * .15 : it.h * .32)).toFixed(1));
  it.tx.setAttribute("text-anchor", ux > 0.3 ? "start" : ux < -0.3 ? "end" : "middle");
  it.ox = ux > 0.3 ? x : ux < -0.3 ? x - it.w : x - it.w / 2; it.oy = (uy > 0.5 ? y : uy < -0.5 ? y - it.h : y - it.h / 2) }

/* view */
let tmr = 0, raf = 0;
function apply() { world.setAttribute("transform", `translate(${tx},${ty}) scale(${z})`);
  const s = 1 / z, lw = Math.min(6, Math.max(2.4, 5.2 * z)) / z;
  svg.style.setProperty("--s", s); svg.style.setProperty("--lw", lw + "px"); svg.style.setProperty("--lw0", (1.5 / z) + "px");
  const f = z / zfit, sf = Math.min(1, Math.max(.55, innerWidth / 1300));
  MS = { 1: Math.min(1.25, Math.max(.75 * sf, f * .4 * sf)) / z, 2: Math.min(1.15, Math.max(.5 * sf, f * .3 * sf)) / z, 3: Math.min(1.05, Math.max(.3 * sf, f * .22 * sf)) / z }; MS[4] = MS[3];
  const sg = $("#sg"); sg.style.setProperty("--s1", MS[1]); sg.style.setProperty("--s2", MS[2]); sg.style.setProperty("--s3", MS[3]);
  $("#bgd").style.setProperty("--s", Math.min(1.2, Math.max(.75 * sf, z / zfit * .6 * sf)) / z);
  clearTimeout(tmr); tmr = setTimeout(declutter, 90) }
function declutter() {
  const W = innerWidth, H = innerHeight, grid = new Map(), CS = 60, tierMin = { 1: 0, 2: zfit * 1.25, 3: zfit * 2.6, 4: zfit * 3.2 };
  const key = (i, j) => i + "," + j;
  const add = r => { for (let i = Math.floor(r[0] / CS); i <= Math.floor(r[2] / CS); i++)for (let j = Math.floor(r[1] / CS); j <= Math.floor(r[3] / CS); j++) { const k = key(i, j); (grid.get(k) || grid.set(k, []).get(k)).push(r) } };
  const hit = r => { for (let i = Math.floor(r[0] / CS); i <= Math.floor(r[2] / CS); i++)for (let j = Math.floor(r[1] / CS); j <= Math.floor(r[3] / CS); j++) { const a = grid.get(key(i, j)); if (a) for (const q of a) if (r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]) return true } return false };
  const sorted = labs.slice().sort((a, b) => a.pri - b.pri);
  for (const it of sorted) { const sx = it.n.x * z + tx, sy = it.n.y * z + ty, r = rFor(it.n) * MS[it.tier] * z; if (it.tier <= 2 && sx > -50 && sx < W + 50 && sy > -50 && sy < H + 50) add([sx - r, sy - r, sx + r, sy + r]) }
  for (const it of sorted) {
    const sx = it.n.x * z + tx, sy = it.n.y * z + ty, off = sx < -200 || sx > W + 200 || sy < -60 || sy > H + 60, sel = it.n.id === selId || it.n.gate;
    if (off || (z < tierMin[it.tier] && !sel) || (lineSel !== null && !it.n.lines.includes(lineSel) && !sel)) { it.g.classList.add("hide"); continue }
    it.r = (rFor(it.n) + (it.n.lines.length > 1 ? 1.5 : 0)) * MS[it.tier] * z + 4;
    let ok = false; for (const di of (sel ? [it.n.ld[0]] : it.n.ld)) { place(it, di); const rc = [sx + it.ox - 2, sy + it.oy - 1, sx + it.ox + it.w + 2, sy + it.oy + it.h + 1]; if (sel || !hit(rc)) { add(rc); ok = true; break } }
    it.g.classList.toggle("hide", !ok) } }
function fit(b, anim) {
  b = b || [D.bounds[0] - PAD, D.bounds[1] - 90, D.bounds[2] + PAD, D.bounds[3] + 60];
  const W = innerWidth, H = innerHeight, narrow = W < 760, padL = narrow ? 12 : 360, padR = narrow ? 12 : 320, padT = narrow ? 150 : 20, padB = narrow ? 70 : 20;
  const nz = Math.min((W - padL - padR) / (b[2] - b[0]), (H - padT - padB) / (b[3] - b[1]));
  go(nz, padL + ((W - padL - padR) - (b[2] - b[0]) * nz) / 2 - b[0] * nz, padT + ((H - padT - padB) - (b[3] - b[1]) * nz) / 2 - b[1] * nz, anim) }
function go(nz, ntx, nty, anim) {
  if (!anim || matchMedia("(prefers-reduced-motion: reduce)").matches) { z = nz; tx = ntx; ty = nty; apply(); return }
  const z0 = z, x0 = tx, y0 = ty, t0 = performance.now(), T = 420; cancelAnimationFrame(raf);
  const step = t => { const k = Math.min(1, (t - t0) / T), e = 1 - Math.pow(1 - k, 3); z = z0 + (nz - z0) * e; tx = x0 + (ntx - x0) * e; ty = y0 + (nty - y0) * e; apply(); if (k < 1) raf = requestAnimationFrame(step) }; raf = requestAnimationFrame(step) }
function zoomAt(f, cx, cy) { const nz = Math.max(zfit * .6, Math.min(zfit * 14, z * f)), k = nz / z; tx = cx - (cx - tx) * k; ty = cy - (cy - ty) * k; z = nz; apply() }
function initFit() { fit(); zfit = z; apply() }
addEventListener("resize", () => { if (D) { fit(); zfit = z; apply() } });

const pts = new Map(); let moved = 0;
svg.addEventListener("pointerdown", e => { svg.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; svg.classList.add("drag"); cancelAnimationFrame(raf) });
svg.addEventListener("pointermove", e => {
  if (!pts.has(e.pointerId)) { hover(e); return }
  const p = pts.get(e.pointerId);
  if (pts.size === 1) { tx += e.clientX - p[0]; ty += e.clientY - p[1]; moved += Math.abs(e.clientX - p[0]) + Math.abs(e.clientY - p[1]); pts.set(e.pointerId, [e.clientX, e.clientY]); apply() }
  else if (pts.size === 2) { const [a, b] = [...pts.values()]; const d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); pts.set(e.pointerId, [e.clientX, e.clientY]); const [c, d] = [...pts.values()]; const d1 = Math.hypot(c[0] - d[0], c[1] - d[1]);
    const mx = (c[0] + d[0]) / 2, my = (c[1] + d[1]) / 2; tx += mx - (a[0] + b[0]) / 2; ty += my - (a[1] + b[1]) / 2; moved += 99; zoomAt(d1 / d0, mx, my) } });
const up = e => { pts.delete(e.pointerId); if (!pts.size) svg.classList.remove("drag") };
svg.addEventListener("pointerup", e => { const was = moved; up(e); if (was < 6 && e.pointerType !== "mouse" || was < 4) clickAt(e) });
svg.addEventListener("pointercancel", up);
svg.addEventListener("wheel", e => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0018)), e.clientX, e.clientY) }, { passive: false });
$("#zin").onclick = () => zoomAt(1.6, innerWidth / 2, innerHeight / 2);
$("#zout").onclick = () => zoomAt(1 / 1.6, innerWidth / 2, innerHeight / 2);
$("#zfit").onclick = () => fit(undefined, true);
function nearest(cx, cy, maxPx) { let best = null, bd = maxPx; for (const n of D.nodes) { const d = Math.hypot(n.x * z + tx - cx, n.y * z + ty - cy); if (d < bd) { bd = d; best = n } } return best }
const tip = $("#tip");
function hover(e) { if (e.pointerType !== "mouse" || !D) return; const n = nearest(e.clientX, e.clientY, 14); if (!n) { tip.style.display = "none"; return }
  tip.textContent = n.name + (n.side ? "（" + n.side + "）" : "") + (n.planned ? "（未開業）" : "") + "　" + (n.nums.length ? n.nums : n.pnums).join(" / "); tip.style.display = "block"; tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + "px"; tip.style.top = (e.clientY + 14) + "px" }
svg.addEventListener("pointerleave", () => tip.style.display = "none");
function clickAt(e) { const n = nearest(e.clientX, e.clientY, e.pointerType === "mouse" ? 14 : 24); if (n) select(n.id, false); else closeCard() }

const card = $("#card");
function chip(L, txt, pl) { return pl ? `<span class="chip pl">${txt ?? L}</span>` : `<span class="chip" style="background:${LC[L] || "#888"};color:${fg(LC[L] || "#888888")}">${txt ?? L}</span>` }
const lineOfNum = num => Math.floor(parseInt(num, 10) / 100);
function select(id, fly) {
  if (selId && stnEls[selId]) stnEls[selId].classList.remove("sel"); selId = id; const n = N[id]; stnEls[id].classList.add("sel");
  const clsTxt = n.planned ? `<span class="cls k3">未開業</span>` : n.cls === 1 ? `<span class="cls k1">1級</span>` : n.cls <= 4 ? `<span class="cls k2">${n.cls}級</span>` : `<span class="cls k3">${n.cls}級</span>`;
  let note = "";
  if (n.gate) { const o = otherGate(n); if (o) note = `<div class="note">ゲート駅です。${n.name}の${o.side}は地図の${o.x < D.W / 2 ? "左端" : "右端"}にあります。<button type="button" id="jump" style="background:none;border:0;color:var(--blue);cursor:pointer;padding:0;text-decoration:underline">${o.side}へ移動</button></div>` }
  if (n.nums.some(x => x === "508-1" || x === "1401-1")) note += `<div class="note">速達車のみが停車する別線路上の駅です（点線）。</div>`;
  const xzTxt = n.xz ? `座標 <b>x ${n.xz[0].toLocaleString()}　z ${n.xz[1].toLocaleString()}</b>` : n.gate ? "ゲート駅（地図の端に配置）" : "座標未入力（路線のつながりから推定した位置）";
  card.innerHTML = `<div class="top"><div><h2>${n.name}${n.side ? `<span style="font-size:.6em;font-weight:400">（${n.side}）</span>` : ""}${clsTxt}</h2><div class="yomi">${n.yomi || ""}</div></div><button class="x" type="button" aria-label="閉じる">×</button></div>
  <div class="meta">所在国 <b>${n.country}</b>　支社 <b>${n.branch}</b><br>${xzTxt}</div>
  <div class="nums">${n.nums.map(x => { const L = lineOfNum(x); return `<button type="button" data-l="${L}">${chip(L)}<span>${x}</span></button>` }).join("")}${n.pnums.map(x => `<button type="button" disabled title="未開業区間">${chip(lineOfNum(x), lineOfNum(x), true)}<span>${x}</span></button>`).join("")}</div>${n.pnums.length && !n.planned ? `<div class="note">点線の枠の番号は、路線がまだこの駅まで開業していない区間です。</div>` : ""}${note}`;
  card.classList.add("open"); card.querySelector(".x").onclick = closeCard;
  card.querySelectorAll(".nums button[data-l]").forEach(b => b.onclick = () => { selectLine(+b.dataset.l); showTab("S"); if (innerWidth < 760) { $("#lines").classList.add("open"); $("#linesBtn").setAttribute("aria-expanded", "true") } });
  const j = card.querySelector("#jump"); if (j) j.onclick = () => select(otherGate(n).id, true);
  if (fly) { const nz = Math.max(z, zfit * 3); go(nz, innerWidth / 2 - n.x * nz, innerHeight * .42 - n.y * nz, true) } else apply() }
function closeCard() { card.classList.remove("open"); if (selId && stnEls[selId]) stnEls[selId].classList.remove("sel"); selId = null; if (D) apply() }

const ll = $("#lineList");
ll.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; const L = +b.dataset.l; selectLine(lineSel === L ? null : L) });
$("#clearLine").onclick = () => selectLine(null);
function selectLine(L) { lineSel = L; renderStations(L);
  ll.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.l === L)));
  world.classList.toggle("dim", L !== null);
  edgeEls.forEach(e => e.classList.toggle("on", e._L === L));
  Object.values(stnEls).forEach(g => g.classList.toggle("on", L !== null && g._n.lines.includes(L)));
  labs.forEach(it => it.g.classList.toggle("on", L !== null && it.n.lines.includes(L)));
  $("#bgd").querySelectorAll(".badge").forEach(g => g.classList.toggle("on", g._L === L));
  if (L !== null) { const ns = D.nodes.filter(n => n.lines.includes(L) && !n.gate); const xs = ns.map(n => n.x), ys = ns.map(n => n.y);
    if (ns.length) fit([Math.min(...xs) - 80, Math.min(...ys) - 80, Math.max(...xs) + 80, Math.max(...ys) + 80], true);
    if (innerWidth < 760 && $("#paneS").hidden) { $("#lines").classList.remove("open"); $("#linesBtn").setAttribute("aria-expanded", "false") } }
  else apply() }
$("#linesBtn").onclick = () => { const o = $("#lines").classList.toggle("open"); $("#linesBtn").setAttribute("aria-expanded", String(o)) };

const q = $("#q"), res = $("#res");
const kana = s => s.replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).toLowerCase();
q.addEventListener("input", () => { const v = kana(q.value.trim()); res.innerHTML = ""; if (!v) return;
  const hits = D.nodes.filter(n => kana(n.name).includes(v) || kana(n.yomi || "").includes(v) || n.nums.concat(n.pnums).some(x => x === v || x.startsWith(v))).sort((a, b) => (a.planned ? 1 : 0) - (b.planned ? 1 : 0) || (kana(a.name).startsWith(v) ? 0 : 1) - (kana(b.name).startsWith(v) ? 0 : 1) || a.cls - b.cls).slice(0, 12);
  if (!hits.length) { res.innerHTML = `<li style="padding:8px 6px;color:var(--muted);font-size:13px">一致する駅はありません。駅名・よみ・駅番号の一部で探せます。</li>`; return }
  hits.forEach(n => { const li = document.createElement("li"); li.innerHTML = `<button type="button">${n.planned ? chip(0, "未", true) : n.lines.slice(0, 4).map(L => chip(L)).join("")}<span>${n.name}${n.side ? `<small>（${n.side}）</small>` : ""}</span><small style="margin-left:auto">${(n.nums.length ? n.nums : n.pnums).join(" / ")}</small></button>`;
    li.firstChild.onclick = () => { select(n.id, true); res.innerHTML = ""; q.blur() }; res.appendChild(li) }) });
q.addEventListener("keydown", e => { if (e.key === "Enter") { const b = res.querySelector("button"); b && b.click() } if (e.key === "Escape") { q.value = ""; res.innerHTML = "" } });

$("#xzBtn").onclick = () => { const on = world.classList.toggle("showxz"); $("#xzBtn").setAttribute("aria-pressed", String(on)); $("#xzLegend").style.display = on ? "" : "none" };
$("#legend").innerHTML = `
<div><svg width="22" height="22"><circle cx="11" cy="11" r="7.5" fill="var(--panel)" stroke="var(--ink)" stroke-width="3"/></svg>1級駅</div>
<div><svg width="22" height="22"><circle cx="11" cy="11" r="5.5" fill="var(--panel)" stroke="#5a7" stroke-width="2"/></svg>2〜4級駅</div>
<div><svg width="22" height="22"><circle cx="11" cy="11" r="3.6" fill="var(--panel)" stroke="#5a7" stroke-width="2"/></svg>5級以下</div>
<div><svg width="22" height="22"><circle cx="11" cy="11" r="6" fill="var(--panel)" stroke="var(--ink)" stroke-width="2"/></svg>乗換駅</div>
<div><svg width="22" height="22"><rect x="5" y="5" width="12" height="12" rx="2" transform="rotate(45 11 11)" fill="var(--panel)" stroke="var(--blue)" stroke-width="3"/></svg>ゲート駅</div>
<div><svg width="26" height="22"><line x1="2" y1="11" x2="24" y2="11" stroke="#5a7" stroke-width="3" stroke-dasharray="5 4"/></svg>速達車の別線路</div>
<div><svg width="26" height="22"><line x1="2" y1="11" x2="24" y2="11" stroke="var(--planned)" stroke-width="2.5" stroke-dasharray="4 3"/></svg>未開業区間</div>
<div id="xzLegend" style="display:none;grid-column:1/-1;gap:12px"><span style="display:flex;align-items:center;gap:6px"><svg width="16" height="16"><circle cx="8" cy="8" r="5" fill="var(--ink)" stroke="var(--ink)" stroke-width="2"/></svg>座標入力済み</span><span style="display:flex;align-items:center;gap:6px"><svg width="16" height="16"><circle cx="8" cy="8" r="5" fill="var(--panel)" stroke="#D9822B" stroke-width="2" stroke-dasharray="2.5 2"/></svg>推定位置</span></div>`;
addEventListener("keydown", e => { if (e.target.closest("input,textarea") || $("#dlg").classList.contains("open")) return; if (e.key === "+" || e.key === "=") $("#zin").click(); if (e.key === "-") $("#zout").click(); if (e.key === "0") $("#zfit").click(); if (e.key === "Escape") { closeCard(); selectLine(null) } });

/* ---------- update from sheet ---------- */
const dlg = $("#dlg"), msg = $("#msg"), prog = $("#prog"), chk = $("#chk");
let busy = false;
$("#updBtn").onclick = () => { dlg.classList.add("open"); msg.textContent = ""; $("#drop").focus() };
$("#dlgClose").onclick = () => dlg.classList.remove("open");
dlg.addEventListener("keydown", e => { if (e.key === "Escape") dlg.classList.remove("open") });
const drop = $("#drop"), file = $("#file");
drop.onclick = () => file.click(); drop.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click() } };
drop.ondragover = e => { e.preventDefault(); drop.classList.add("over") }; drop.ondragleave = () => drop.classList.remove("over");
drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) readFile(f) };
file.onchange = () => { if (file.files[0]) readFile(file.files[0]) };
$("#runBtn").onclick = () => { const t = $("#paste").value; if (!t.trim()) { msg.textContent = "貼り付け欄が空です。シート159を全選択してコピーし、貼り付けてください。"; return } runText(t) };
async function readFile(f) { const buf = await f.arrayBuffer(); let t = new TextDecoder("utf-8").decode(buf);
  if ((t.match(/\uFFFD/g) || []).length > 5) { try { t = new TextDecoder("shift_jis").decode(buf) } catch (e) { } } runText(t) }
function showCheck(c) {
  const li = a => a.map(s => `<li>${s.replace(/[<&]/g, ch => ch === "<" ? "&lt;" : "&amp;")}</li>`).join("");
  chk.innerHTML = `開業駅 <b>${c.stations}</b>　座標入力済み <b>${c.xz}</b>　座標のある未開業駅 <b>${c.planned}</b>
  ${c.dups.length ? `<details><summary>駅番号の重複 ${c.dups.length}件</summary><ul>${li(c.dups)}</ul></details>` : ""}
  ${c.partial.length ? `<details><summary>座標がx・zの片方だけの駅 ${c.partial.length}件（推定位置で表示）</summary><ul>${li(c.partial)}</ul></details>` : ""}
  ${c.invalid.length ? `<details><summary>読み取れない駅番号 ${c.invalid.length}件</summary><ul>${li(c.invalid)}</ul></details>` : ""}` }
function runText(text) {
  if (busy) return; busy = true; $("#runBtn").disabled = true; prog.style.display = "block"; const bar = prog.firstElementChild; bar.style.width = "0";
  let gen; try { gen = RosenEngine.runGen(text) } catch (e) { fail(e); return }
  const step = () => { try { const t0 = performance.now(); let r;
      while (performance.now() - t0 < 40) { r = gen.next(); if (r.done) break; bar.style.width = (r.value.p * 100).toFixed(0) + "%"; msg.textContent = r.value.t + "…";
        if (r.value.result) { done(r.value.result, text); return } }
      setTimeout(step, 0) } catch (e) { fail(e) } };
  setTimeout(step, 30) }
function fail(e) { busy = false; $("#runBtn").disabled = false; prog.style.display = "none"; msg.textContent = "読み込めませんでした：" + (e && e.message || e) }
function done(data, text) { busy = false; $("#runBtn").disabled = false; prog.style.display = "none";
  render(data); showCheck(data.check);
  msg.textContent = "地図を描き直しました。この表示はこの画面だけのものです（再読み込みすると元に戻ります）。";
  setStatus("読み込んだファイルで表示中") }
/* ---------- start: prebuilt data → latest sheet ---------- */
function hash(t) { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) } return (h >>> 0).toString(16) + ":" + t.length }
function setStatus(t, warn) { const e = $("#status"); e.textContent = t; e.classList.toggle("warn", !!warn) }
const CACHE_KEY = "rosenzu-cache-v" + (window.ROSEN_ENGINE_VERSION || 1);
function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null") } catch (e) { return null } }
function writeCache(h, data) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ h, data })) } catch (e) { } }
function computeAsync(text, onProg) { return new Promise((resolve, reject) => { let gen; try { gen = RosenEngine.runGen(text) } catch (e) { reject(e); return }
  const step = () => { try { const t0 = performance.now(); let r; while (performance.now() - t0 < 30) { r = gen.next(); if (r.done) return; onProg && onProg(r.value); if (r.value.result) { resolve(r.value.result); return } } setTimeout(step, 0) } catch (e) { reject(e) } }; setTimeout(step, 0) }) }
(async function start() {
  const cache = readCache();
  if (PRE && PRE.data) { render(PRE.data); setStatus("保存済みデータ（" + (PRE.builtAt || "") + "）で表示中") }
  else if (cache) { render(cache.data); setStatus("前回取得したデータで表示中") }
  if (!CONFIG.sheetUrl) { if (!PRE) setStatus("データがありません。config.js にシートのURLを設定してください。", true); return }
  let text;
  try { const r = await fetch(CONFIG.sheetUrl, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); text = await r.text();
    if (!/駅名/.test(text)) throw new Error("シートの内容ではありません") }
  catch (e) { setStatus("シートを取得できませんでした（" + e.message + "）。保存済みデータで表示中", true); return }
  const h = hash(text), now = new Date().toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  if (PRE && PRE.csvHash === h) { setStatus("最新のシートで表示中（" + now + " 確認）"); return }
  if (cache && cache.h === h) { render(cache.data); setStatus("最新のシートで表示中（" + now + " 確認）"); return }
  setStatus("シートが更新されています。駅の配置を計算中…");
  try { const data = await computeAsync(text, v => setStatus("シートが更新されています。" + v.t + "… " + Math.round(v.p * 100) + "%"));
    const keepSel = selId; render(data); writeCache(h, data); setStatus("最新のシートで表示中（" + now + " 取得）"); if (keepSel && N[keepSel]) select(keepSel, false) }
  catch (e) { setStatus("シートの読み込みに失敗しました（" + e.message + "）。保存済みデータで表示中", true) }
})();
