// ============================================================
//  Тренировка в шапке вкладки «Лудус».
//  Пары бьются по очереди, боец без пары — на манекене, лучники — на стрельбище у правого края,
//  раненые сидят на песке. Если бойцов больше шести, в шапке шесть самых мощных
// ============================================================

const TRAIN_SHOWN = 6;
const isArcher = g => !!(g.equip && g.equip.weapon && ITEM_BASES[g.equip.weapon.base] && ITEM_BASES[g.equip.weapon.base].ranged);

// Кто чем занят: rest — раненые, pairs — пары, dummy — боец без пары, range — лучники
function trainingPlan(glads) {
  const shown = [...glads].sort((a, b) => combatPower(b) - combatPower(a)).slice(0, TRAIN_SHOWN);
  const rest = shown.filter(g => g.wounded > 0), fit = shown.filter(g => !(g.wounded > 0));
  const range = fit.filter(isArcher), melee = fit.filter(g => !isArcher(g));
  const pairs = [];
  for (let i = 0; i + 1 < melee.length; i += 2) pairs.push([melee[i], melee[i + 1]]);
  return { rest, pairs, dummy: melee.length % 2 ? melee[melee.length - 1] : null, range };
}

// ---------- позы ----------
// Раненые сидят на песке: таз и ступни на земле (самая низкая точка скелета — таз).
// Две позы, чтобы несколько раненых не были одинаковыми: ноги вытянуты с опорой на руку сзади
// и колени подняты, руки на коленях
const SIT_POSES = [
  { r: 0, dx: 0, dy: 0, lean: -0.32, chest: 0.12, head: 0.3, nU: 1.57, nK: 0.05, nF: 0, fU: 2.2, fK: 1.45, fF: 0.1, nA: 0.95, nE: 0.35, nW: 0.1, fA: -0.77, fE: 0.13, fW: 0 },
  { r: 0, dx: 0, dy: 0, lean: -0.1, chest: 0.15, head: 0.34, nU: 2.2, nK: 1.45, nF: 0.1, fU: 2.25, fK: 1.55, fF: 0.1, nA: 1.3, nE: 0.5, nW: 0.1, fA: 1.1, fE: 0.7, fW: 0 },
];
const hasShield = u => u.spec.offhand && (u.spec.offhand.b === 'scutum' || u.spec.offhand.b === 'parma');

function trainUnit(g) {
  ensureLook(g);
  const spec = figureSpec(g), sit = g.wounded > 0;
  if (sit) { spec.weapon = null; spec.offhand = null; spec.ranged = false; } // оружие отложено
  return { g, spec, base: stancePose(g.cls), clip: null, frame: 0, loop: Math.random() * 60, x: 0, y: 0, s: 1, facing: 1, sit, sitPose: 0 };
}
const trainPlay = (u, name) => { u.clip = name; u.frame = 0; };
function trainPose(u) {
  if (u.sit) { const p = SIT_POSES[u.sitPose], br = Math.sin(u.loop / 22); return { ...u.base, ...p, chest: p.chest + br * 0.025, head: p.head + br * 0.03 }; }
  if (u.clip) return sampleClip(u.clip, Math.min(CLIPS[u.clip].len, u.frame), u.base);
  return sampleClip(u.spec.ranged ? 'idle' : 'guard', u.loop % 40, u.base);
}

function trainGroups(glads) {
  const P = trainingPlan(glads), G = [];
  P.rest.forEach((g, i) => { const u = trainUnit(g); u.sitPose = i % 2; G.push({ kind: 'rest', a: u }); });
  for (const [a, b] of P.pairs) G.push({ kind: 'pair', a: trainUnit(a), b: trainUnit(b), t: 20 + Math.random() * 40, turn: Math.random() < 0.5 ? 0 : 1 });
  if (P.dummy) G.push({ kind: 'dummy', a: trainUnit(P.dummy), d: { ang: 0, vel: 0, x: 0, cuts: [] }, t: 20 + Math.random() * 30 });
  P.range.forEach((g, i) => G.push({ kind: 'range', a: trainUnit(g), tg: { x: 0, y: 0, s: 1, shake: 0, stuck: [] }, t: 15 + i * 17 + Math.random() * 20 }));
  return G;
}

// Расстановка по полосе шириной W и высотой H: слева знамя, потом раненые, пары, манекен, справа стрельбище
function trainLayout(S, W, H) {
  const k = S.k = Math.min(1, H / 250), gy = H - 12 * k - 6;
  const WD = { rest: 110, pair: 260, dummy: 230 };
  const archers = S.groups.filter(g => g.kind === 'range'), blocks = S.groups.filter(g => g.kind !== 'range');
  const rangeW = archers.length ? 270 + 58 * (archers.length - 1) : 0;
  const need = (blocks.reduce((s, g) => s + WD[g.kind], 0) + rangeW) * k;
  const left = W * 0.23, avail = W * 0.985 - left;
  // раненые сидят кучкой: промежутки только между группами
  const nRest = blocks.filter(g => g.kind === 'rest').length;
  const gaps = blocks.length - Math.max(0, nRest - 1) + (archers.length ? 1 : 0) + 1;
  const f = Math.min(1, avail / need), extra = Math.max(0, avail - need) / gaps;
  let x = left + extra;
  blocks.forEach((g, i) => {
    const w = WD[g.kind] * k * f, cx = x + w / 2;
    for (const u of [g.a, g.b].filter(Boolean)) { u.y = gy; u.s = 0.95 * k; }
    if (g.kind === 'rest') { g.a.x = cx; g.a.facing = 1; }
    if (g.kind === 'pair') { const d = 86 * k * f; g.a.x = cx - d; g.a.facing = 1; g.b.x = cx + d; g.b.facing = -1; }
    if (g.kind === 'dummy') { g.a.x = cx - 68 * k * f; g.a.facing = 1; g.d.x = cx + 60 * k * f; }
    const next = blocks[i + 1];
    x += w + (g.kind === 'rest' && next && next.kind === 'rest' ? 0 : extra);
  });
  // стрельбище: лучники рядами в глубину, у каждого своя мишень у правого края
  if (archers.length) {
    const w = rangeW * k * f;
    archers.forEach((g, i) => {
      const lane = archers.length - 1 - i, s = 0.95 * k * (1 - lane * 0.07);
      Object.assign(g.a, { y: gy - lane * 19 * k, s, facing: 1, x: x + (40 + lane * 58) * k * f });
      Object.assign(g.tg, { x: x + w - (24 + lane * 26) * k, y: g.a.y, s: s / 0.95 });
      g.depth = lane;
    });
  }
}

// ---------- ход тренировки (30 кадров в секунду, как клипы боя) ----------
function trainBurst(x, y, kind) {
  const straw = kind === 'straw', n = straw ? 8 : 6, life = straw ? 28 : 12;
  return Array.from({ length: n }, () => ({ x, y, vx: (Math.random() - 0.5) * (straw ? 3 : 4.5), vy: -Math.random() * 3 - 0.5, life, max: life, kind }));
}
function trainStep(S) {
  const k = S.k;
  for (const G of S.groups) {
    for (const u of [G.a, G.b].filter(Boolean)) {
      u.loop += 1;
      if (u.clip) { u.frame += 1; if (u.frame >= CLIPS[u.clip].len) u.clip = null; }
    }
    if (G.kind === 'rest') continue;
    if (G.kind === 'dummy') { const d = G.d; d.vel += -d.ang * 0.12; d.vel *= 0.86; d.ang += d.vel; }
    if (G.kind === 'range') G.tg.shake *= 0.8;
    const P = G.pending;
    if (P && P.u.clip && P.u.frame >= P.at) {
      G.pending = null;
      if (G.kind === 'pair') {
        const D = P.u === G.a ? G.b : G.a;
        trainPlay(D, hasShield(D) ? 'block' : 'parry');
        S.fx.push(...trainBurst((G.a.x + G.b.x) / 2, G.a.y - 105 * k, 'spark'));
      } else if (G.kind === 'dummy') {
        G.d.vel += 0.085;
        S.fx.push(...trainBurst(G.d.x - 6 * k, G.a.y - 100 * k, 'straw'));
        if (G.d.cuts.length < 4 && Math.random() < 0.5) G.d.cuts.push({ y: -70 - Math.random() * 40, a: (Math.random() - 0.5) * 0.9 });
      } else {
        const u = G.a, s = u.s, tg = G.tg;
        const x0 = u.x + 40 * s, y0 = u.y - 128 * s, hy = (Math.random() - 0.5) * 16;
        const x1 = tg.x - 4 * tg.s, y1 = tg.y - 92 * tg.s + hy * tg.s, dist = Math.hypot(x1 - x0, y1 - y0);
        S.arrows.push({ G, x0, y0, x1, y1, hy, arc: Math.min(30, dist * 0.06), f: 0, n: Math.max(5, Math.round(dist / 1.6 / 33)), s });
      }
    }
    if (--G.t > 0) continue;
    if (G.kind === 'pair') {
      const A = G.turn ? G.b : G.a, name = meleeClipOf(A.spec);
      trainPlay(A, name);
      G.pending = { u: A, at: Math.max(1, (CLIPS[name].impact || 8) - 2) };
      G.turn ^= 1;
      G.t = CLIPS[name].len + 26 + Math.random() * 30;
    } else if (G.kind === 'dummy') {
      const name = meleeClipOf(G.a.spec);
      trainPlay(G.a, name);
      G.pending = { u: G.a, at: CLIPS[name].impact || 8 };
      G.t = CLIPS[name].len + 14 + Math.random() * 24;
    } else {
      trainPlay(G.a, 'shoot');
      G.pending = { u: G.a, at: CLIPS.shoot.impact };
      G.t = CLIPS.shoot.len + 24 + Math.random() * 30;
    }
  }
  for (const a of S.arrows) {
    if (++a.f < a.n) continue;
    a.dead = true;
    const tg = a.G.tg;
    tg.shake = 1;
    tg.stuck.push({ hy: a.hy, life: 90 });
    if (tg.stuck.length > 3) tg.stuck.shift();
  }
  S.arrows = S.arrows.filter(a => !a.dead);
  for (const p of S.fx) { p.x += p.vx; p.y += p.vy; p.vy += p.kind === 'straw' ? 0.12 : 0.25; p.life--; }
  S.fx = S.fx.filter(p => p.life > 0);
  for (const G of S.groups) if (G.tg) { for (const st of G.tg.stuck) st.life--; G.tg.stuck = G.tg.stuck.filter(st => st.life > 0); }
}

// ---------- рисование: манекен, мишень, стрела ----------
function trainRope(ctx, x0, x1, y, k) {
  ctx.fillStyle = '#5a3f22'; ctx.fillRect(x0, y - 2.2 * k, x1 - x0, 4.4 * k);
  ctx.strokeStyle = 'rgba(230,200,150,.35)'; ctx.lineWidth = 1 * k;
  ctx.beginPath();
  for (let x = x0 + 2 * k; x < x1; x += 4 * k) { ctx.moveTo(x, y - 2 * k); ctx.lineTo(x + 2.5 * k, y + 2 * k); }
  ctx.stroke();
}
// мешковина: заливка, плетение, объём светом по краям
function trainBurlap(ctx, path, x0, y0, w, h, k, base) {
  ctx.save();
  ctx.fillStyle = base; ctx.fill(path);
  ctx.clip(path);
  ctx.strokeStyle = 'rgba(70,45,20,.22)'; ctx.lineWidth = 0.8 * k;
  ctx.beginPath();
  for (let y = y0; y < y0 + h; y += 3 * k) { ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y + 1.2 * k); }
  for (let x = x0; x < x0 + w; x += 3.4 * k) { ctx.moveTo(x, y0); ctx.lineTo(x - 0.8 * k, y0 + h); }
  ctx.stroke();
  const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
  g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(0.35, 'rgba(255,235,190,.08)'); g.addColorStop(1, 'rgba(0,0,0,.32)');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
  ctx.restore();
}
function trainStraws(ctx, x0, x1, y, k, dir, n) {
  ctx.strokeStyle = '#d6b465'; ctx.lineWidth = 1.1 * k;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * ((i * 37) % n) / n, l = (4 + ((i * 13) % 5)) * k;
    ctx.moveTo(x, y); ctx.lineTo(x + ((i % 3) - 1) * 2 * k, y + dir * l);
  }
  ctx.stroke();
}

// Манекен: столб на крестовине, торс из мешковины со соломой, перетянут верёвкой,
// руки-колышки, голова-мешок, завязанный на шее. Качается вокруг основания
function drawTrainDummy(ctx, d, gy, k) {
  ctx.save();
  ctx.translate(d.x, gy);
  ctx.fillStyle = 'rgba(40,22,8,.35)';
  ctx.beginPath(); ctx.ellipse(0, 0, 34 * k, 7 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4a2f1a'; ctx.fillRect(-26 * k, -6 * k, 52 * k, 6 * k);
  ctx.fillStyle = '#5c3b21'; ctx.fillRect(-9 * k, -9 * k, 18 * k, 9 * k);
  ctx.rotate(-d.ang);
  const pg = ctx.createLinearGradient(-6 * k, 0, 6 * k, 0);
  pg.addColorStop(0, '#4a2f1a'); pg.addColorStop(0.45, '#7a5434'); pg.addColorStop(1, '#3e2716');
  ctx.fillStyle = pg; ctx.fillRect(-6 * k, -150 * k, 12 * k, 146 * k);
  ctx.strokeStyle = 'rgba(30,18,8,.45)'; ctx.lineWidth = 0.8 * k;
  ctx.beginPath(); ctx.moveTo(-2 * k, -150 * k); ctx.lineTo(-1 * k, -4 * k); ctx.moveTo(3 * k, -140 * k); ctx.lineTo(2.5 * k, -10 * k); ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * 16 * k, -116 * k); ctx.rotate(s * -0.35);
    ctx.fillStyle = '#6b4a2c'; ctx.beginPath(); ctx.roundRect(s < 0 ? -30 * k : 0, -4 * k, 30 * k, 8 * k, 3 * k); ctx.fill();
    ctx.fillStyle = 'rgba(30,18,8,.35)'; ctx.fillRect(s < 0 ? -30 * k : 0, 1.5 * k, 30 * k, 2.5 * k);
    trainRope(ctx, s < 0 ? -12 * k : 6 * k, s < 0 ? -6 * k : 12 * k, 0, k);
    ctx.restore();
  }
  const tor = new Path2D();
  tor.moveTo(-24 * k, -124 * k); tor.quadraticCurveTo(0, -132 * k, 24 * k, -124 * k);
  tor.lineTo(19 * k, -62 * k); tor.quadraticCurveTo(0, -56 * k, -19 * k, -62 * k); tor.closePath();
  trainBurlap(ctx, tor, -25 * k, -132 * k, 50 * k, 72 * k, k, '#b48f58');
  trainStraws(ctx, -18 * k, 18 * k, -60 * k, k, 1, 11);
  trainStraws(ctx, -22 * k, -10 * k, -124 * k, k, -1, 4);
  ctx.strokeStyle = 'rgba(60,35,15,.6)'; ctx.lineWidth = 1 * k; ctx.setLineDash([2.5 * k, 2.5 * k]);
  ctx.beginPath(); ctx.moveTo(0, -128 * k); ctx.lineTo(0, -60 * k); ctx.stroke(); ctx.setLineDash([]);
  trainRope(ctx, -22 * k, 22 * k, -110 * k, k);
  trainRope(ctx, -20 * k, 20 * k, -78 * k, k);
  ctx.strokeStyle = 'rgba(50,25,10,.75)'; ctx.lineWidth = 1.6 * k;
  for (const c of d.cuts) { ctx.save(); ctx.translate(-6 * k, c.y * k); ctx.rotate(c.a); ctx.beginPath(); ctx.moveTo(-7 * k, 0); ctx.lineTo(7 * k, 0); ctx.stroke(); ctx.restore(); }
  ctx.fillStyle = '#6b4a2c'; ctx.fillRect(-4 * k, -138 * k, 8 * k, 10 * k);
  const head = new Path2D(); head.ellipse(0, -152 * k, 14 * k, 16 * k, 0, 0, Math.PI * 2);
  trainBurlap(ctx, head, -15 * k, -169 * k, 30 * k, 34 * k, k, '#a8834e');
  trainStraws(ctx, -6 * k, 6 * k, -167 * k, k, -1, 5);
  trainRope(ctx, -8 * k, 8 * k, -137 * k, k);
  ctx.restore();
}

// Мишень: соломенный круг с кольцами на треноге; застрявшие стрелы торчат в сторону лучника
function drawTrainTarget(ctx, tg) {
  const s = tg.s;
  ctx.save();
  ctx.translate(tg.x + Math.sin(tg.shake * 9) * tg.shake * 2 * s, tg.y);
  ctx.fillStyle = 'rgba(40,22,8,.32)';
  ctx.beginPath(); ctx.ellipse(0, 0, 26 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#5c3b21'; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-14 * s, 0); ctx.lineTo(-2 * s, -70 * s); ctx.moveTo(14 * s, 0); ctx.lineTo(2 * s, -70 * s); ctx.moveTo(10 * s, -2 * s); ctx.lineTo(4 * s, -66 * s); ctx.stroke();
  const disc = new Path2D(); disc.ellipse(0, -92 * s, 22 * s, 30 * s, 0, 0, Math.PI * 2);
  trainBurlap(ctx, disc, -23 * s, -123 * s, 46 * s, 62 * s, s, '#cfae6c');
  ctx.strokeStyle = 'rgba(120,85,40,.6)'; ctx.lineWidth = 1 * s;
  ctx.beginPath(); ctx.ellipse(0, -92 * s, 22 * s, 30 * s, 0, 0, Math.PI * 2); ctx.stroke();
  for (const [rx, ry, c] of [[15, 20.5, '#8e1a12'], [10, 13.5, '#e7dac2'], [4.5, 6, '#8e1a12']]) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, -92 * s, rx * s, ry * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  trainStraws(ctx, -14 * s, 14 * s, -64 * s, s, 1, 8);
  for (const st of tg.stuck) {
    ctx.globalAlpha = Math.min(1, st.life / 20);
    ctx.save(); ctx.translate(-4 * s, -92 * s + st.hy * s); ctx.rotate(Math.PI + 0.06);
    ctx.strokeStyle = '#2a1a0e'; ctx.lineWidth = 2.2 * s; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(24 * s, 0); ctx.stroke();
    ctx.strokeStyle = '#b08a58'; ctx.lineWidth = 1.1 * s; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(24 * s, 0); ctx.stroke();
    ctx.fillStyle = '#e6dcc6'; ctx.beginPath(); ctx.moveTo(24 * s, 0); ctx.lineTo(29 * s, -3 * s); ctx.lineTo(20 * s, 0); ctx.lineTo(29 * s, 3 * s); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function drawTrainArrow(ctx, a) {
  const p = a.f / a.n;
  const x = a.x0 + (a.x1 - a.x0) * p, y = a.y0 + (a.y1 - a.y0) * p - Math.sin(p * Math.PI) * a.arc;
  const dy = (a.y1 - a.y0) - Math.cos(p * Math.PI) * Math.PI * a.arc;
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(dy, a.x1 - a.x0)); ctx.scale(a.s, a.s);
  ctx.strokeStyle = 'rgba(255,245,220,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(-20, 0); ctx.stroke();
  ctx.strokeStyle = '#2a1a0e'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(6, 0); ctx.stroke();
  ctx.strokeStyle = '#b08a58'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(6, 0); ctx.stroke();
  ctx.fillStyle = '#c9ced2'; ctx.beginPath(); ctx.moveTo(5, -2.6); ctx.lineTo(12, 0); ctx.lineTo(5, 2.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e6dcc6'; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-31, -3.5); ctx.lineTo(-21, 0); ctx.lineTo(-31, 3.5); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function trainDraw(ctx, S) {
  ctx.drawImage(S.back, 0, 0);
  const fig = u => {
    ctx.fillStyle = 'rgba(40,22,8,.35)';
    ctx.beginPath(); ctx.ellipse(u.x, u.y, (u.sit ? 46 : 40) * u.s, 8 * u.s, 0, 0, Math.PI * 2); ctx.fill();
    drawFigure(ctx, u.spec, trainPose(u), u.x, u.y, { scale: u.s, facing: u.facing });
  };
  // дальние ряды стрельбища — первыми
  for (const g of S.groups.filter(g => g.kind === 'range').sort((a, b) => b.depth - a.depth)) { drawTrainTarget(ctx, g.tg); fig(g.a); }
  for (const g of S.groups) {
    if (g.kind === 'range') continue;
    if (g.kind === 'dummy') drawTrainDummy(ctx, g.d, g.a.y, S.k);
    fig(g.a); if (g.b) fig(g.b);
  }
  for (const a of S.arrows) drawTrainArrow(ctx, a);
  for (const p of S.fx) {
    ctx.fillStyle = p.kind === 'straw' ? `rgba(214,178,100,${p.life / p.max})` : `rgba(255,214,140,${p.life / p.max})`;
    ctx.fillRect(p.x, p.y, (p.kind === 'straw' ? 3.4 : 2.2) * S.k, (p.kind === 'straw' ? 1.3 : 2.2) * S.k);
  }
}

// ---------- сцена в шапке ----------
// Фон: полоса арены от нижних трибун до песка, рисуется один раз на арену и высоту
function trainBack(tier, W, H) {
  const full = document.createElement('canvas');
  full.width = AW; full.height = AH;
  const fctx = full.getContext('2d');
  for (const p of paintArena(fctx, tier)) {
    fctx.fillStyle = CROWD_CLOTH[p.c]; fctx.fillRect(p.x - 2.1 * p.s, p.y - 6.5 * p.s, 4.2 * p.s, 6.5 * p.s);
    fctx.fillStyle = CROWD_SKIN[p.k]; fctx.fillRect(p.x - 1.5 * p.s, p.y - 9.6 * p.s, 3 * p.s, 3 * p.s);
  }
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  off.getContext('2d').drawImage(full, 0, 250 + (300 - H) * 0.55, AW, H, 0, 0, W, H);
  return off;
}

const TRAIN = { key: '', backKey: '', back: null, groups: [], fx: [], arrows: [], k: 1, raf: 0, last: 0, acc: 0 };
const trainStill = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Запускает тренировку в canvas шапки. Состав пересобирается, только когда меняются бойцы, их снаряжение или раны
function ludusTraining(cv, glads, tier, W, H) {
  const backKey = `${tier}|${W}|${H}`;
  if (TRAIN.backKey !== backKey) { TRAIN.back = trainBack(tier, W, H); TRAIN.backKey = backKey; TRAIN.key = ''; }
  const key = glads.map(g => `${g.id}:${g.cls}:${g.wounded > 0 ? 'w' : ''}:${combatPower(g)}:${SLOT_KEYS.map(k => (g.equip[k] ? g.equip[k].base : '')).join(',')}`).join(';');
  if (TRAIN.key !== key) {
    TRAIN.key = key; TRAIN.groups = trainGroups(glads); TRAIN.fx = []; TRAIN.arrows = [];
    trainLayout(TRAIN, W, H);
  }
  cv.width = W; cv.height = H;
  trainDraw(cv.getContext('2d'), TRAIN);
  if (trainStill() || TRAIN.raf) return;
  TRAIN.last = 0; TRAIN.acc = 0;
  const tick = ts => {
    const c = document.querySelector('main canvas.ludus-bg');
    if (!c) { TRAIN.raf = 0; return; } // шапка ушла с экрана: тренировка останавливается
    TRAIN.acc += Math.min(200, ts - (TRAIN.last || ts)); TRAIN.last = ts;
    while (TRAIN.acc >= 1000 / 30) { TRAIN.acc -= 1000 / 30; trainStep(TRAIN); }
    trainDraw(c.getContext('2d'), TRAIN);
    TRAIN.raf = requestAnimationFrame(tick);
  };
  TRAIN.raf = requestAnimationFrame(tick);
}
