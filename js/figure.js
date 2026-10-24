// ============================================================
//  Фигура гладиатора: скелет, анатомия, слои снаряжения
//  Вид сбоку, лицом вправо (зеркалится через facing). Начало координат — таз.
//  Слои (снизу вверх): дальняя нога → дальняя рука с оружием → торс и голова →
//  ближняя нога → набедренник и пояс → доспех → шлем → ближняя рука и щит
// ============================================================

const SKIN = ['#e2b38d', '#cf9b72', '#b37a52', '#91603e', '#6f462b', '#d8a47c'];
const HAIR = ['#15100c', '#2d1e13', '#4a3019', '#6c4b29', '#8b6a3d', '#3b3631'];
const CLOTH = ['#d8cbb0', '#c4ae86', '#8a2b22', '#e3dccb', '#5d4a36'];
const PAINT = ['#7a1d18', '#5c1813', '#283a5c', '#3c4a25', '#6b4a1a', '#2a2622', '#7a5a1a'];
const CREST = ['#8c1f18', '#cdb47c', '#262626', '#5a1d55', '#ddd2bc', '#2f4a6a'];
const BRONZE_Q = ['#6b5232', '#94703f', '#b08850', '#cba15c', '#e6c06e'];
const STEEL_Q = ['#706d68', '#9fa4a9', '#b9bec2', '#d2d7db', '#e9e0c2'];
const OUTLINE = 'rgba(20,11,5,.92)';

function randomLook() {
  return {
    skin: rnd(0, SKIN.length - 1), hair: rnd(0, HAIR.length - 1),
    beard: chance(55), bald: chance(12),
    cloth: rnd(0, CLOTH.length - 1), paint: rnd(0, PAINT.length - 1), crest: rnd(0, CREST.length - 1),
  };
}
function ensureLook(g) { if (g && !g.look) g.look = randomLook(); return g; }

function shade(hex, f) {
  let r, g, b;
  if (hex[0] === '#') { const n = parseInt(hex.slice(1), 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; }
  else { [r, g, b] = hex.match(/\d+/g).map(Number); }
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const BODY = { thigh: 42, shin: 41, torso: 56, neck: 7, upper: 30, fore: 27, foot: 16 };

// ------------------------------------------------------------
//  Позы. Углы — от вертикали вниз, «+» — вперёд.
// ------------------------------------------------------------
const BASE_POSE = {
  r: 0, dx: 0, dy: 0, sx: 1,
  lean: 0.06, chest: 0.06, head: 0.02,
  nU: 0.42, nK: 0.32, nF: 0, fU: -0.32, fK: 0.38, fF: 0,
  nA: 0.55, nE: 1.15, nW: 0, fA: 0.3, fE: 1.3, fW: 0.15,
  grip: 0.2, nGrip: 0.3, draw: 0, slack: 0,
};
const STANCES = {
  murmillo:    { nA: 0.5, nE: 1.2, fA: 0.28, fE: 1.25, grip: 0.15, lean: 0.1, chest: 0.06 },
  secutor:     { nA: 0.55, nE: 1.1, fA: 0.26, fE: 1.3, grip: 0.2, lean: 0.1, chest: 0.06 },
  thraex:      { nA: 0.65, nE: 1.05, fA: 0.5, fE: 1.0, grip: 0.45, lean: 0.08, chest: 0.08 },
  retiarius:   { nA: 0.12, nE: 0.35, fA: 0.5, fE: 0.9, grip: 0.55, lean: 0.05, chest: 0.04, nU: 0.36, fU: -0.36 },
  dimachaerus: { nA: 0.7, nE: 0.95, fA: 0.38, fE: 1.15, grip: 0.35, nGrip: 0.5, lean: 0.08, chest: 0.08 },
  hoplomachus: { nA: 0.62, nE: 1.1, fA: 0.42, fE: 0.95, grip: 0.62, lean: 0.08, chest: 0.06, nU: 0.4, fU: -0.36 },
  sagittarius: { nA: 0.4, nE: 0.35, nW: 0, fA: 0.18, fE: 0.55, grip: 0.2, lean: 0.03, chest: 0.03, head: 0.04 },
  gallus:      { nA: 0.5, nE: 1.2, fA: 0.5, fE: 1.3, fW: 0.15, grip: 0.62, lean: 0.1, chest: 0.08, nU: 0.46, fU: -0.36 },
};
function stancePose(cls) { return { ...BASE_POSE, ...(STANCES[cls] || {}) }; }

// ------------------------------------------------------------
//  Скелет
// ------------------------------------------------------------
const at = (o, th, len) => ({ x: o.x + Math.sin(th) * len, y: o.y + Math.cos(th) * len });

function skeleton(p) {
  const B = BODY, r = p.r || 0;
  const S = {};
  S.hip = { x: p.dx || 0, y: -(p.dy || 0) };
  S.thL = Math.PI - p.lean - r;
  S.waist = at(S.hip, S.thL, B.torso * 0.45);
  S.thU = S.thL - p.chest;
  S.sh = at(S.waist, S.thU, B.torso * 0.55);
  S.thH = S.thU - p.head;
  S.neck = at(S.sh, S.thU - p.head * 0.4, B.neck);
  S.headTop = at(S.neck, S.thH, 24);
  S.headC = at(S.neck, S.thH, 11);
  S.armJ = at(S.sh, S.thU + Math.PI, 7);
  const tb = p.lean + p.chest + r;
  const arm = (A, E, W, k) => {
    const thU = A - tb;
    S['el' + k] = at(S.armJ, thU, B.upper);
    S['thF' + k] = thU + E;
    S['wr' + k] = at(S['el' + k], S['thF' + k], B.fore);
    S['thH' + k] = S['thF' + k] + W;
    S['hand' + k] = at(S['wr' + k], S['thH' + k], 4.5);
  };
  arm(p.nA, p.nE, p.nW || 0, 'N');
  arm(p.fA, p.fE, p.fW || 0, 'F');
  const leg = (U, K, Fa, k) => {
    const thT = U - r;
    S['kn' + k] = at(S.hip, thT, B.thigh);
    S['thS' + k] = thT - K;
    S['an' + k] = at(S['kn' + k], S['thS' + k], B.shin);
    const thFt = Math.PI / 2 + (Fa || 0) - (Math.abs(r) > 0.3 ? r : 0);
    S['thFt' + k] = thFt;
    const down = thFt - Math.PI / 2;
    S['heel' + k] = at(at(S['an' + k], thFt + Math.PI, 4), down, 4.5);
    S['toe' + k] = at(at(S['an' + k], thFt, B.foot), down, 2.5);
  };
  leg(p.nU, p.nK, p.nF, 'N');
  leg(p.fU, p.fK, p.fF, 'F');
  const back = at(S.waist, S.thL - Math.PI / 2, 10);
  S.ground = Math.max(
    S.heelN.y + 1, S.heelF.y + 1, S.toeN.y + 1, S.toeF.y + 1,
    S.knN.y + 7, S.knF.y + 7, S.hip.y + 12, back.y + 2, S.sh.y + 11,
    S.headC.y + 12, S.handN.y + 5, S.handF.y + 5,
  );
  S.top = Math.min(S.headTop.y, S.sh.y - 10);
  S.slack = clamp(p.slack || 0, 0, 1); // 1 — тело обмякло на песке
  return S;
}

// Двухзвенная ИК руки: плечо → кисть. prefer: 'down' — локоть вниз, 'back' — назад
function solveArm(sh, target, L1, L2, prefer = 'down') {
  const dx = target.x - sh.x, dy = target.y - sh.y;
  const d = Math.hypot(dx, dy) || 0.001;
  const dc = clamp(d, Math.abs(L1 - L2) + 0.5, L1 + L2 - 0.5);
  const base = Math.atan2(dy, dx);
  const a = Math.acos(clamp((L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc), -1, 1));
  const e1 = { x: sh.x + Math.cos(base + a) * L1, y: sh.y + Math.sin(base + a) * L1 };
  const e2 = { x: sh.x + Math.cos(base - a) * L1, y: sh.y + Math.sin(base - a) * L1 };
  const el = prefer === 'back' ? (e1.x < e2.x ? e1 : e2) : (e1.y > e2.y ? e1 : e2);
  return { el, wr: { x: sh.x + dx / d * dc, y: sh.y + dy / d * dc } };
}
const angOf = (a, b) => Math.atan2(b.x - a.x, b.y - a.y); // угол в соглашении at()
// Ставит кисть k в точку grip с направлением кисти thH
function reachArm(S, k, grip, thH, prefer) {
  const { el, wr } = solveArm(S.armJ, at(grip, thH + Math.PI, 4.5), BODY.upper, BODY.fore, prefer);
  S['el' + k] = el; S['wr' + k] = wr;
  S['thF' + k] = angOf(el, wr); S['thH' + k] = thH;
  S['hand' + k] = at(wr, thH, 4.5);
}

// ------------------------------------------------------------
//  Геометрия: анатомические профили конечностей и торса
// ------------------------------------------------------------
// [t, ширина со стороны +нормали, ширина со стороны −нормали]
const PROF = {
  thigh: [[0, 10.2, 10.6], [0.22, 11, 11.8], [0.55, 9, 9.8], [0.85, 6.8, 7.1], [1, 6.1, 6.1]],
  shin: [[0, 6.1, 6.1], [0.12, 6.7, 5.7], [0.32, 8, 5.2], [0.6, 6.1, 4.5], [0.88, 4, 3.7], [1, 3.7, 3.5]],
  upper: [[0, 7.8, 8.4], [0.22, 7.1, 7.9], [0.5, 6.9, 6.7], [0.85, 5.3, 5.5], [1, 4.9, 4.9]],
  fore: [[0, 5.1, 5.1], [0.2, 6, 5.8], [0.5, 4.9, 4.7], [0.88, 3.5, 3.4], [1, 3.3, 3.3]],
  greave: [[0, 7.4, 7.2], [0.15, 8, 6.6], [0.35, 8.8, 6.3], [0.65, 7, 5.6], [0.93, 5, 4.8], [1, 4.8, 4.6]],
};
const TF = [[0, 10], [0.12, 10.8], [0.3, 10.2], [0.45, 9.6], [0.62, 11], [0.76, 13.6], [0.88, 12], [0.96, 8.5], [1, 5]];
const TB = [[0, 12.8], [0.12, 12.2], [0.3, 9], [0.45, 8.6], [0.62, 9.6], [0.78, 11.6], [0.9, 11], [1, 7]];

function interp(tab, t) {
  if (t <= tab[0][0]) return tab[0][1];
  for (let i = 0; i < tab.length - 1; i++) {
    const [t0, v0] = tab[i], [t1, v1] = tab[i + 1];
    if (t <= t1) { const k = (t - t0) / (t1 - t0); const e = (1 - Math.cos(k * Math.PI)) / 2; return v0 + (v1 - v0) * e; }
  }
  return tab[tab.length - 1][1];
}
// Профили разбиты на две таблицы заранее, чтобы не создавать массивы на каждом кадре
const PROF2 = {};
for (const [k, p] of Object.entries(PROF)) PROF2[k] = [p.map(r => [r[0], r[1]]), p.map(r => [r[0], r[2]])];

function smoothThrough(ctx, P, move) {
  if (move) ctx.moveTo(P[0].x, P[0].y); else ctx.lineTo(P[0].x, P[0].y);
  for (let i = 1; i < P.length - 1; i++) {
    ctx.quadraticCurveTo(P[i].x, P[i].y, (P[i].x + P[i + 1].x) / 2, (P[i].y + P[i + 1].y) / 2);
  }
  const l = P[P.length - 1];
  ctx.lineTo(l.x, l.y);
}

// Путь конечности с анатомическим профилем (ширины масштабируются мускулатурой m)
function limbPath(ctx, a, b, prof, m, grow = 0, t0 = 0, t1 = 1) {
  const [pp, pm] = PROF2[prof];
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const samples = [];
  for (let i = 0; i <= 8; i++) {
    const t = t0 + (t1 - t0) * i / 8;
    samples.push({ x: a.x + dx * t, y: a.y + dy * t, wp: interp(pp, t) * m + grow, wm: interp(pm, t) * m + grow });
  }
  const A = samples.map(s => ({ x: s.x + nx * s.wp, y: s.y + ny * s.wp }));
  const B = samples.map(s => ({ x: s.x - nx * s.wm, y: s.y - ny * s.wm })).reverse();
  const e = samples[samples.length - 1], s0 = samples[0];
  ctx.beginPath();
  smoothThrough(ctx, A, true);
  const re = (e.wp + e.wm) / 2, rs = (s0.wp + s0.wm) / 2;
  ctx.quadraticCurveTo(e.x + ux * re * 1.35 + nx * (e.wp - e.wm) / 2, e.y + uy * re * 1.35 + ny * (e.wp - e.wm) / 2, B[0].x, B[0].y);
  smoothThrough(ctx, B, false);
  ctx.quadraticCurveTo(s0.x - ux * rs * 1.35 + nx * (s0.wp - s0.wm) / 2, s0.y - uy * rs * 1.35 + ny * (s0.wp - s0.wm) / 2, A[0].x, A[0].y);
  ctx.closePath();
}

// Точка на изогнутом позвоночнике
function spineAt(S, t) {
  const H = S.hip, W = S.waist, Sh = S.sh;
  const u = 1 - t;
  const x = u * u * H.x + 2 * t * u * W.x + t * t * Sh.x;
  const y = u * u * H.y + 2 * t * u * W.y + t * t * Sh.y;
  let tx = 2 * u * (W.x - H.x) + 2 * t * (Sh.x - W.x), ty = 2 * u * (W.y - H.y) + 2 * t * (Sh.y - W.y);
  const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
  return { x, y, tx, ty, nx: -ty, ny: tx };
}
// side +1 — грудь/живот, −1 — спина
function torsoPt(S, g, t, side, grow = 0) {
  const s = spineAt(S, t);
  const w = (side > 0 ? interp(TF, t) : interp(TB, t)) * g + grow;
  return { x: s.x + s.nx * w * side, y: s.y + s.ny * w * side };
}
function torsoPath(ctx, S, g, t0 = 0, t1 = 1, grow = 0) {
  const F = [], Bk = [];
  for (let i = 0; i <= 12; i++) { const t = t0 + (t1 - t0) * i / 12; F.push(torsoPt(S, g, t, 1, grow)); Bk.push(torsoPt(S, g, t, -1, grow)); }
  Bk.reverse();
  ctx.beginPath();
  smoothThrough(ctx, F, true);
  if (t1 >= 0.99) {
    const s = spineAt(S, 1);
    ctx.quadraticCurveTo(s.x + s.tx * 7, s.y + s.ty * 7, Bk[0].x, Bk[0].y);
  } else ctx.lineTo(Bk[0].x, Bk[0].y);
  smoothThrough(ctx, Bk, false);
  if (t0 <= 0.01) {
    const s = spineAt(S, 0);
    ctx.quadraticCurveTo(s.x - s.tx * 9, s.y - s.ty * 9, F[0].x, F[0].y);
  }
  ctx.closePath();
}

// Целлюлоидная светотень вдоль нормали отрезка a→b
function celShade(ctx, a, b, w, L, k = 1) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (nx * L.x + ny * L.y < 0) { nx = -nx; ny = -ny; }
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const g = ctx.createLinearGradient(mx + nx * w, my + ny * w, mx - nx * w, my - ny * w);
  g.addColorStop(0, `rgba(255,238,215,${0.26 * k})`);
  g.addColorStop(0.24, 'rgba(255,238,215,0)');
  g.addColorStop(0.56, 'rgba(0,0,0,0)');
  g.addColorStop(0.62, `rgba(45,18,6,${0.26 * k})`);
  g.addColorStop(1, `rgba(30,10,2,${0.46 * k})`);
  ctx.fillStyle = g;
  ctx.fillRect(Math.min(a.x, b.x) - 40, Math.min(a.y, b.y) - 40, Math.abs(dx) + 80, Math.abs(dy) + 80);
}

// Группа частей с общим контуром: сначала обводка всех, затем заливка — суставы сливаются
function drawGroup(ctx, parts, lw = 2.4) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = lw;
  for (const p of parts) { p.path(ctx); ctx.stroke(); }
  for (const p of parts) { p.path(ctx); ctx.fillStyle = p.fill; ctx.fill(); }
  for (const p of parts) {
    if (!p.shade) continue;
    ctx.save(); p.path(ctx); ctx.clip(); p.shade(ctx); ctx.restore();
  }
}

function metalGrad(ctx, x0, y0, x1, y1, base) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, shade(base, -0.45));
  g.addColorStop(0.3, shade(base, 0.38));
  g.addColorStop(0.42, shade(base, 0.55));
  g.addColorStop(0.6, base);
  g.addColorStop(1, shade(base, -0.55));
  return g;
}
const strokeLine = (ctx, pts, color, w) => {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
};
const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// ------------------------------------------------------------
//  Спецификация внешности из данных гладиатора
// ------------------------------------------------------------
function figureSpec(g) {
  ensureLook(g);
  const a = g.attrs;
  const eq = k => (g.equip && g.equip[k]) ? { b: (ITEM_BASES[g.equip[k].base] && ITEM_BASES[g.equip[k].base].look) || g.equip[k].base, q: g.equip[k].q } : null;
  const wb = g.equip && g.equip.weapon && ITEM_BASES[g.equip.weapon.base];
  return {
    cls: g.cls, look: g.look,
    m: clamp(0.88 + (a.str - 4) * 0.032, 0.86, 1.32),
    gth: clamp(0.94 + (a.end - 4) * 0.026, 0.92, 1.26),
    weapon: eq('weapon'), offhand: eq('offhand'), helmet: eq('helmet'), armor: eq('armor'),
    arms: eq('arms'), legs: eq('legs'), belt: eq('belt'),
    twoHanded: !!(wb && wb.twoHanded), ranged: !!(wb && wb.ranged),
  };
}

// ============================================================
//  Отрисовка фигуры
//  o: facing, scale, spinX, disarmed, netted, filter, sway {plume, cloth}, noNet
// ============================================================
function drawFigure(ctx, spec, pose, x, groundY, o = {}) {
  const S = skeleton(pose);
  const sc = o.scale || 1, facing = o.facing || 1;
  const sxv = (pose.sx ?? 1) * (o.spinX ?? 1);
  const sx = facing * (Math.abs(sxv) < 0.08 ? 0.08 * Math.sign(sxv || 1) : sxv);
  const hipY = groundY - S.ground * sc;
  const out = { hipY, topY: hipY + S.top * sc, blade: null, bladeN: null };
  ctx.save();
  ctx.translate(x, hipY);
  ctx.scale(sx * sc, sc);
  if (o.filter) ctx.filter = o.filter;
  const L = { x: -Math.sign(sx) * 0.55, y: -0.83 };
  // манекен для изображений предметов — из дерева, без лица и одежды
  const look = spec.look, skin = o.dummy ? '#8a6847' : SKIN[look.skin], far = shade(skin, -0.2);
  const m = spec.m, g = spec.gth;
  const sway = o.sway || { plume: 0, cloth: 0 };
  const oh = o.disarmed ? null : spec.offhand;
  const shield = oh && (oh.b === 'scutum' || oh.b === 'parma');
  const wpn = o.disarmed ? null : spec.weapon;
  const bow = wpn && spec.ranged;
  // двуручный хват: ближняя кисть сама находит рукоять
  if (wpn && spec.twoHanded && !bow && S.slack < 0.5) {
    const th = S.thHF + pose.grip;
    reachArm(S, 'N', at(S.handF, th + Math.PI, wpn.b === 'axe' ? 17 : 12), S.thHF, 'down');
  }
  // лук: стрела вдоль ближнего предплечья, дальняя кисть тянет тетиву
  let bg = null;
  if (bow) {
    bg = bowGeom(S, pose, wpn);
    if (bg.draw > 0.02) reachArm(S, 'F', bg.nock, bg.dir, 'back');
  }

  // 1. дальняя нога
  drawLeg(ctx, S, 'F', far, spec, L, m);
  // 2. дальняя рука с оружием, колчан за спиной
  if (wpn && !bow) {
    let th = S.thHF + pose.grip, hand = S.handF;
    // древковое у павшего выпадает из руки и ложится вдоль тела, а не торчит за головой
    if (S.slack > 0 && (wpn.b === 'spear' || wpn.b === 'trident')) {
      th += (Math.PI / 2 + 0.04 - th) * S.slack;
      hand = lerpP(S.handF, { x: S.waist.x, y: S.handF.y }, S.slack);
    }
    out.blade = drawWeapon(ctx, wpn, hand, th);
  }
  if (spec.offhand && spec.offhand.b === 'pharetra') drawQuiver(ctx, S, spec.offhand, g);
  drawArm(ctx, S, 'F', far, spec, L, m);
  // 3. торс, шея, голова
  drawTorso(ctx, S, spec, skin, L, g, m);
  // 4. ближняя нога
  drawLeg(ctx, S, 'N', skin, spec, L, m);
  // 5. набедренник, пояс, доспех
  drawLoin(ctx, S, spec, g, sway);
  drawBodyArmor(ctx, S, spec, g, sway);
  // 6. лицо, волосы, шлем
  drawHead(ctx, S, spec, skin, sway);
  // 7. ближняя рука и вторая рука
  if (oh && oh.b === 'pugio') out.bladeN = drawWeapon(ctx, { b: 'pugio', q: oh.q }, S.handN, S.thHN + pose.nGrip);
  if (bow) out.bow = drawBow(ctx, wpn, bg);
  drawArm(ctx, S, 'N', skin, spec, L, m);
  if (spec.arms && spec.arms.b === 'galerus') drawGalerus(ctx, S, spec);
  if (shield) drawShield(ctx, oh, S, spec);
  if (oh && oh.b === 'rete' && !o.noNet) {
    // у павшего сеть лежит кучей на песке
    ctx.save();
    ctx.translate(S.handN.x, S.handN.y); ctx.scale(1, 1 - 0.7 * S.slack); ctx.translate(-S.handN.x, -S.handN.y);
    drawNetBundle(ctx, S.handN, sway.cloth * (1 - S.slack));
    ctx.restore();
  }
  if (o.netted) drawNetOverlay(ctx, S);
  ctx.restore();
  return out;
}

// ------------------------------------------------------------
//  Тело
// ------------------------------------------------------------
function drawLeg(ctx, S, k, color, spec, L, m) {
  const hip = { x: S.hip.x + (k === 'N' ? 2.5 : -2.5), y: S.hip.y + 2 };
  const kn = S['kn' + k], an = S['an' + k], heel = S['heel' + k], toe = S['toe' + k], thFt = S['thFt' + k];
  const footPath = c => {
    const down = thFt - Math.PI / 2;
    const ankleTop = at(an, thFt + Math.PI, 2.5);
    const ball = at(at(an, thFt, BODY.foot * 0.7), down, 1.2);
    const mid = lerpP(an, ball, 0.5);
    c.beginPath();
    c.moveTo(ankleTop.x, ankleTop.y);
    c.quadraticCurveTo(heel.x - Math.sin(thFt) * 3, heel.y - Math.cos(thFt) * 3, heel.x, heel.y);
    c.lineTo(toe.x, toe.y + 0.5);
    c.quadraticCurveTo(toe.x + Math.sin(thFt) * 2.5, toe.y - 3, ball.x, ball.y - 3.5);
    c.quadraticCurveTo(mid.x, mid.y - 4.5, an.x + Math.sin(thFt) * 2, an.y - 2);
    c.closePath();
  };
  drawGroup(ctx, [
    { path: c => limbPath(c, hip, kn, 'thigh', m), fill: color, shade: c => celShade(c, hip, kn, 11 * m, L) },
    { path: c => limbPath(c, kn, an, 'shin', m), fill: color, shade: c => celShade(c, kn, an, 8 * m, L) },
    { path: footPath, fill: shade(color, -0.04), shade: c => celShade(c, heel, toe, 5, L, 0.7) },
  ]);
  // рельеф колена
  ctx.strokeStyle = 'rgba(40,16,6,.28)'; ctx.lineWidth = 0.9;
  const kTop = lerpP(hip, kn, 0.82), kBot = lerpP(kn, an, 0.12);
  ctx.beginPath(); ctx.moveTo(kTop.x, kTop.y); ctx.quadraticCurveTo(kn.x + 4, kn.y, kBot.x, kBot.y); ctx.stroke();
  // поножи, обмотки и обувь — по надетому предмету
  const lg = spec.legs && spec.legs.b, q = spec.legs ? spec.legs.q : 1;
  const high = lg === 'ocreaeHigh';
  const greave = high || (lg === 'ocrea' && k === 'N');
  const wraps = lg === 'fasciae' || high || (lg === 'ocrea' && k === 'F');
  const down = thFt - Math.PI / 2;
  if (lg === 'caligae') drawBoot(ctx, kn, an, heel, toe, thFt, m, spec.legs, k);
  else {
    // сандалия: подошва и ремни
    strokeLine(ctx, [at(heel, down, 0.8), at(toe, down, 0.6)], '#3a2414', 2.4);
    ctx.strokeStyle = 'rgba(70,44,22,.95)'; ctx.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) {
      const p = lerpP(heel, toe, 0.25 + i * 0.22);
      ctx.beginPath(); ctx.moveTo(p.x - 1, p.y + 0.5); ctx.lineTo(p.x + 2, p.y - 5); ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const p = lerpP(an, kn, 0.05 + i * 0.07), q2 = lerpP(an, kn, 0.09 + i * 0.07);
      ctx.beginPath(); ctx.moveTo(p.x - 4, p.y); ctx.lineTo(q2.x + 4, q2.y); ctx.stroke();
    }
  }
  if (wraps) {
    ctx.save();
    limbPath(ctx, kn, an, 'shin', m, 0.8, 0, 0.82);
    ctx.clip();
    ctx.fillStyle = k === 'F' ? 'rgba(170,152,120,.85)' : 'rgba(218,204,174,.92)';
    ctx.fillRect(Math.min(kn.x, an.x) - 30, Math.min(kn.y, an.y) - 30, 80, 100);
    ctx.strokeStyle = 'rgba(90,70,45,.55)'; ctx.lineWidth = 0.9;
    for (let i = 0; i < 9; i++) {
      const p = lerpP(kn, an, 0.05 + i * 0.09);
      ctx.beginPath(); ctx.moveTo(p.x - 10, p.y - 3); ctx.lineTo(p.x + 10, p.y + 3); ctx.stroke();
    }
    ctx.restore();
    if (high) {
      // стёганая набедренная обмотка под высокими поножами
      ctx.save();
      limbPath(ctx, hip, kn, 'thigh', m, 0.6, 0.4, 1);
      ctx.fillStyle = k === 'F' ? '#a8977a' : '#d6c8a8'; ctx.fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.clip();
      ctx.strokeStyle = 'rgba(90,70,45,.5)'; ctx.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) { const p = lerpP(hip, kn, 0.45 + i * 0.1); ctx.beginPath(); ctx.moveTo(p.x - 14, p.y - 2); ctx.lineTo(p.x + 14, p.y + 2); ctx.stroke(); }
      ctx.restore();
    }
  }
  if (greave) {
    const col = k === 'F' ? shade(BRONZE_Q[q], -0.25) : BRONZE_Q[q];
    const gTop = lerpP(kn, an, high ? -0.08 : 0.04), gBot = lerpP(kn, an, 0.9);
    ctx.lineJoin = 'round';
    limbPath(ctx, gTop, gBot, 'greave', m, 0.8);
    ctx.fillStyle = metalGrad(ctx, gTop.x - 8, 0, gTop.x + 8, 0, col); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(kn.x + 1.5, kn.y, 6.4 * m, 5.6 * m, 0, 0, Math.PI * 2);
    ctx.fillStyle = metalGrad(ctx, kn.x - 6, kn.y - 6, kn.x + 6, kn.y + 6, col); ctx.fill(); ctx.stroke();
    if (q >= 2) {
      ctx.strokeStyle = shade(col, 0.5); ctx.lineWidth = 0.8;
      const c1 = lerpP(gTop, gBot, 0.3), c2 = lerpP(gTop, gBot, 0.7);
      ctx.beginPath(); ctx.moveTo(c1.x - 4, c1.y); ctx.quadraticCurveTo(c1.x + 3, c1.y + 4, c2.x, c2.y); ctx.stroke();
    }
  }
}

// Галльские сапоги: кожа до середины голени, шнуровка
function drawBoot(ctx, kn, an, heel, toe, thFt, m, it, k) {
  const leather = k === 'F' ? '#3e2716' : it.q >= 2 ? '#6a4224' : '#58371d';
  const down = thFt - Math.PI / 2;
  ctx.lineJoin = 'round';
  limbPath(ctx, kn, an, 'shin', m, 1.2, 0.5, 1.02);
  ctx.fillStyle = leather; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.3; ctx.stroke();
  const ankleTop = at(an, thFt + Math.PI, 3.5);
  ctx.beginPath();
  ctx.moveTo(ankleTop.x, ankleTop.y - 2);
  ctx.quadraticCurveTo(heel.x - Math.sin(thFt) * 4, heel.y - 3, heel.x - Math.sin(thFt) * 1, heel.y + 1);
  ctx.lineTo(toe.x + Math.sin(thFt) * 1.5, toe.y + 1);
  ctx.quadraticCurveTo(toe.x + Math.sin(thFt) * 3, toe.y - 4.5, lerpP(an, toe, 0.55).x, lerpP(an, toe, 0.55).y - 5.5);
  ctx.quadraticCurveTo(an.x + Math.sin(thFt) * 4, an.y - 4, an.x + Math.sin(thFt) * 3, an.y - 8);
  ctx.closePath();
  ctx.fillStyle = leather; ctx.fill(); ctx.stroke();
  strokeLine(ctx, [at(heel, down, 1), at(toe, down, 1)], '#1e130a', 2.2);
  // шнуровка и отворот
  ctx.strokeStyle = it.q >= 3 ? '#cdb47c' : 'rgba(200,170,120,.6)'; ctx.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    const a = lerpP(kn, an, 0.56 + i * 0.1), b = lerpP(kn, an, 0.61 + i * 0.1);
    ctx.beginPath(); ctx.moveTo(a.x - 4, a.y); ctx.lineTo(b.x + 4, b.y); ctx.moveTo(a.x + 4, a.y); ctx.lineTo(b.x - 4, b.y); ctx.stroke();
  }
  const t0 = lerpP(kn, an, 0.5);
  ctx.strokeStyle = shade(leather, 0.25); ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(t0.x - 7 * m, t0.y + 1); ctx.lineTo(t0.x + 7 * m, t0.y - 1); ctx.stroke();
}

function drawArm(ctx, S, k, color, spec, L, m) {
  const sh = S.armJ, el = S['el' + k], wr = S['wr' + k], hand = S['hand' + k], thH = S['thH' + k];
  const fist = c => {
    c.save(); c.translate(hand.x, hand.y); c.rotate(Math.PI - thH);
    c.beginPath();
    c.moveTo(-4.4, 3); c.quadraticCurveTo(-5.4, -3, -2.5, -5.4); c.quadraticCurveTo(2.5, -6.2, 4.8, -3);
    c.quadraticCurveTo(5.6, 1.5, 3.6, 4.6); c.quadraticCurveTo(-1, 6, -4.4, 3); c.closePath();
    c.restore();
  };
  drawGroup(ctx, [
    { path: c => limbPath(c, sh, el, 'upper', m), fill: color, shade: c => celShade(c, sh, el, 8 * m, L) },
    { path: c => limbPath(c, el, wr, 'fore', m), fill: color, shade: c => celShade(c, el, wr, 6 * m, L) },
    { path: fist, fill: shade(color, -0.05), shade: c => celShade(c, wr, at(wr, thH, 9), 5, L, 0.8) },
  ]);
  ctx.strokeStyle = 'rgba(40,16,6,.25)'; ctx.lineWidth = 0.9;
  const b1 = lerpP(sh, el, 0.35), b2 = lerpP(sh, el, 0.8);
  ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
  const kn = at(hand, thH, 3.5);
  ctx.beginPath(); ctx.arc(kn.x, kn.y, 2.2, 0, Math.PI); ctx.stroke();
  // маника — на руке с оружием, у бойца с сетью или галером — на левой
  const ab = spec.arms && spec.arms.b;
  if (!ab) return;
  if (ab === 'vambraces') { drawVambrace(ctx, el, wr, spec.arms, m, k); return; }
  const side = spec.armsSide || ab === 'galerus' || (spec.offhand && spec.offhand.b === 'rete') ? 'N' : 'F';
  if (k === side) drawManica(ctx, sh, el, wr, spec.arms, m, k);
}

// Кожаные наручи на предплечьях
function drawVambrace(ctx, el, wr, it, m, k) {
  const col = k === 'F' ? '#3f2817' : it.q >= 2 ? '#6e4627' : '#5c3b20';
  ctx.lineJoin = 'round';
  limbPath(ctx, el, wr, 'fore', m, 1.2, 0.38, 0.94);
  ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.strokeStyle = it.q >= 3 ? '#cdb47c' : 'rgba(25,14,6,.7)'; ctx.lineWidth = 1.4;
  for (const t of [0.5, 0.82]) {
    const a = lerpP(el, wr, t);
    const n = angOf(el, wr) + Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(a.x + Math.sin(n) * 6 * m, a.y + Math.cos(n) * 6 * m); ctx.lineTo(a.x - Math.sin(n) * 6 * m, a.y - Math.cos(n) * 6 * m); ctx.stroke();
  }
}

function drawManica(ctx, sh, el, wr, it, m, k) {
  const q = it.q;
  const metal = it.b === 'lamManica';
  const cloth = q >= 3 ? '#d9c79b' : q >= 2 ? '#d2c3a2' : q === 0 ? '#b3a283' : '#cdbd9c';
  const base = metal ? STEEL_Q[q] : cloth;
  const col = k === 'F' ? shade(base, -0.22) : base;
  const segs = [[sh, el, 'upper', 0.12, 1], [el, wr, 'fore', 0, 0.9]];
  ctx.lineJoin = 'round';
  for (const [a, b, prof, t0, t1] of segs) {
    const n = 5;
    for (let i = n - 1; i >= 0; i--) {
      const s0 = t0 + (t1 - t0) * i / n, s1 = t0 + (t1 - t0) * (i + 1.15) / n;
      limbPath(ctx, a, b, prof, m, 1.6, s0, Math.min(t1, s1));
      ctx.fillStyle = metal ? metalGrad(ctx, a.x - 6, a.y, a.x + 6, a.y + 4, col) : col;
      ctx.fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.1; ctx.stroke();
      if (!metal) {
        ctx.strokeStyle = 'rgba(110,90,60,.6)'; ctx.lineWidth = 0.6;
        const p = lerpP(a, b, (s0 + s1) / 2);
        ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }
}

function drawTorso(ctx, S, spec, skin, L, g, m) {
  const gg = g * (0.92 + m * 0.08);
  const sh = S.sh;
  const neckBase = at(sh, S.thU + Math.PI, 4);
  drawGroup(ctx, [
    { path: c => neckPath(c, neckBase, S.neck, gg), fill: shade(skin, -0.06) },
    { path: c => torsoPath(c, S, gg), fill: skin, shade: c => celShade(c, spineAt(S, 0.1), spineAt(S, 0.95), 14 * gg, L) },
    { path: c => headSkinPath(c, S), fill: skin, shade: c => celShade(c, S.neck, S.headTop, 12, L, 0.9) },
  ]);
  // мышечный рельеф
  ctx.save();
  torsoPath(ctx, S, gg); ctx.clip();
  ctx.strokeStyle = shade(skin, -0.5); ctx.globalAlpha = 0.32; ctx.lineWidth = 1.1;
  const pt = (t, side, f) => { const s = spineAt(S, t); const w = interp(side > 0 ? TF : TB, t) * gg * f; return { x: s.x + s.nx * w * side, y: s.y + s.ny * w * side }; };
  const p1 = pt(0.7, 1, 0.15), p2 = pt(0.66, 1, 0.75), p3 = pt(0.72, 1, 1.0);
  ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.quadraticCurveTo(p2.x, p2.y, p3.x, p3.y); ctx.stroke();
  for (const t of [0.36, 0.46, 0.56]) { const a = pt(t, 1, 0.45), b = pt(t + 0.01, 1, 0.92); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  const ab1 = pt(0.3, 1, 0.7), ab2 = pt(0.6, 1, 0.72);
  ctx.beginPath(); ctx.moveTo(ab1.x, ab1.y); ctx.lineTo(ab2.x, ab2.y); ctx.stroke();
  const s1 = pt(0.9, -1, 0.4), s2 = pt(0.72, -1, 0.8), s3 = pt(0.52, -1, 0.55);
  ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.quadraticCurveTo(s2.x, s2.y, s3.x, s3.y); ctx.stroke();
  ctx.restore();
}

function neckPath(c, a, b, g) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const w0 = 7 * g, w1 = 5.4 * g;
  c.beginPath();
  c.moveTo(a.x + nx * w0, a.y + ny * w0);
  c.lineTo(b.x + nx * w1, b.y + ny * w1);
  c.lineTo(b.x - nx * w1, b.y - ny * w1);
  c.lineTo(a.x - nx * w0, a.y - ny * w0);
  c.closePath();
}

// ------------------------------------------------------------
//  Голова (кадр головы: начало — верх шеи, «вверх» — к макушке)
// ------------------------------------------------------------
function headFrame(c, S) { c.translate(S.neck.x, S.neck.y); c.rotate(Math.PI - S.thH); }
function headSkinPath(c, S) {
  c.save(); headFrame(c, S);
  c.beginPath();
  c.moveTo(-5, 1);
  c.bezierCurveTo(-10.5, -2, -12.2, -12, -9.5, -17);
  c.bezierCurveTo(-7, -22.5, 3, -24, 8, -18.5);
  c.quadraticCurveTo(10.4, -16, 10.6, -13);
  c.lineTo(10.9, -12);
  c.quadraticCurveTo(10.3, -11.2, 11.2, -9.6);
  c.lineTo(13.6, -6.6);
  c.quadraticCurveTo(13.4, -5.6, 11.2, -5.6);
  c.quadraticCurveTo(12.0, -4.6, 11.4, -3.9);
  c.quadraticCurveTo(11.8, -3.1, 11.2, -2.4);
  c.quadraticCurveTo(11.6, -0.6, 10.4, 0.6);
  c.quadraticCurveTo(8.5, 2.2, 4.5, 1.8);
  c.quadraticCurveTo(1.5, 1.5, 0, 3.5);
  c.closePath();
  c.restore();
}

function drawHead(ctx, S, spec, skin, sway) {
  const look = spec.look, hair = HAIR[look.hair];
  const helm = spec.helmet;
  const enclosed = helm && (helm.b === 'crestHelm' || (helm.b === 'galea' && ['secutor', 'murmillo', 'thraex', 'hoplomachus'].includes(spec.cls)));
  ctx.save(); headFrame(ctx, S);
  if (!enclosed && !spec.dummy) {
    // ухо
    ctx.fillStyle = shade(skin, -0.12);
    ctx.beginPath(); ctx.ellipse(-1.5, -9.5, 2.6, 3.8, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(40,16,6,.55)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(-1.3, -9.5, 1.6, -1.2, 1.6); ctx.stroke();
    // глаз
    ctx.fillStyle = '#efe4d2';
    ctx.beginPath(); ctx.moveTo(6.8, -11); ctx.quadraticCurveTo(8.4, -12.2, 9.9, -11.1); ctx.quadraticCurveTo(8.4, -10.3, 6.8, -11); ctx.fill();
    ctx.fillStyle = '#20140c';
    ctx.beginPath(); ctx.arc(8.9, -11.15, 0.95, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(30,12,4,.7)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(6.6, -11.3); ctx.quadraticCurveTo(8.4, -12.6, 10.1, -11.3); ctx.stroke();
    // бровь, ноздря, рот, скула
    strokeLine(ctx, [{ x: 6.2, y: -13.4 }, { x: 8.6, y: -13.6 }, { x: 10.6, y: -12.8 }], shade(hair, 0.05), 1.5);
    ctx.fillStyle = 'rgba(40,16,6,.6)'; ctx.beginPath(); ctx.arc(11.7, -6.1, 0.65, 0, Math.PI * 2); ctx.fill();
    strokeLine(ctx, [{ x: 10.2, y: -3.75 }, { x: 11.5, y: -3.85 }], 'rgba(70,25,15,.7)', 0.8);
    ctx.strokeStyle = 'rgba(40,16,6,.22)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(4, -9); ctx.quadraticCurveTo(6, -6, 9, -6.5); ctx.stroke();
    // волосы
    if (!look.bald) {
      ctx.beginPath();
      ctx.moveTo(9.5, -17.5);
      ctx.bezierCurveTo(5, -25.5, -7, -25, -11, -18);
      ctx.bezierCurveTo(-13.5, -13, -12, -6, -7, -1.2);
      ctx.quadraticCurveTo(-5, -4.5, -4.5, -6.5);
      ctx.quadraticCurveTo(-3.5, -12, -2.5, -13.5);
      ctx.quadraticCurveTo(3.5, -16, 9.5, -17.5);
      ctx.closePath();
      ctx.fillStyle = hair; ctx.fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = shade(hair, 0.25); ctx.lineWidth = 0.6;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath(); ctx.moveTo(6 - i * 3, -18.5 + i * 0.3); ctx.quadraticCurveTo(2 - i * 3, -21.5 + i, -3 - i * 2.2, -16 + i * 2.2); ctx.stroke();
      }
    } else {
      ctx.strokeStyle = 'rgba(255,240,220,.35)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-6, -19); ctx.quadraticCurveTo(0, -23, 5, -20.5); ctx.stroke();
    }
    if (look.beard) {
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(2.6, -10);
      ctx.quadraticCurveTo(3.4, -6.5, 5, -5.2);
      ctx.quadraticCurveTo(8.5, -4.4, 11.7, -4.9);
      ctx.lineTo(12.1, -3.9); ctx.lineTo(10.4, -3.55); ctx.lineTo(11.6, -2.6);
      ctx.quadraticCurveTo(12.3, -0.4, 11.2, 1.4);
      ctx.quadraticCurveTo(8, 3.4, 4, 2.6);
      ctx.quadraticCurveTo(0.5, 1, -0.5, -2.5);
      ctx.closePath();
      ctx.fillStyle = hair; ctx.fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.strokeStyle = shade(hair, 0.22); ctx.lineWidth = 0.5;
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(2 + i * 1.4, -3 + (i % 2)); ctx.lineTo(2.6 + i * 1.4, 1 + (i % 3) * 0.4); ctx.stroke(); }
    }
  }
  if (helm) drawHelmet(ctx, helm, spec, sway);
  ctx.restore();
}

// ------------------------------------------------------------
//  Шлемы
// ------------------------------------------------------------
function plume(ctx, pts, color, sway, len = 12, dense = 3) {
  ctx.lineCap = 'round';
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    for (let j = 0; j < dense; j++) {
      const a = p.a + sway * (0.4 + i / pts.length) + (j - 1) * 0.12;
      const l = len * (0.8 + ((i * 7 + j * 3) % 5) * 0.08);
      const ex = p.x + Math.sin(a) * l, ey = p.y - Math.cos(a) * l;
      ctx.strokeStyle = shade(color, ((i + j) % 3 - 1) * 0.18);
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + Math.sin(a - 0.4) * l * 0.6, p.y - Math.cos(a - 0.4) * l * 0.6, ex, ey);
      ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';
}

function drawHelmet(ctx, h, spec, sway) {
  const q = h.q, col = BRONZE_Q[q];
  const crest = CREST[spec.look.crest];
  const trim = q >= 4 ? '#f3d27a' : q >= 3 ? '#e4e8ea' : shade(col, 0.45);
  const fillMetal = (x0, y0, x1, y1, c = col) => {
    ctx.fillStyle = metalGrad(ctx, x0, y0, x1, y1, c); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.3; ctx.stroke();
  };
  const dents = pts => {
    if (q > 0) return;
    ctx.fillStyle = 'rgba(40,25,10,.45)';
    for (const [x, y, r] of pts) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  };
  const glow = () => { if (q >= 4) { ctx.shadowColor = 'rgba(255,215,120,.6)'; ctx.shadowBlur = 8; } };
  const noGlow = () => { ctx.shadowBlur = 0; };

  if (h.b === 'leatherHelm') {
    ctx.beginPath();
    ctx.moveTo(9.8, -16);
    ctx.bezierCurveTo(8, -25.5, -7, -27, -12.5, -17);
    ctx.lineTo(-13.4, -8.5);
    ctx.quadraticCurveTo(-12, -3, -7.5, -3);
    ctx.lineTo(-4.5, -6.5);
    ctx.quadraticCurveTo(-3.5, -12.5, 2.5, -14.5);
    ctx.quadraticCurveTo(6.5, -15.5, 9.8, -16);
    ctx.closePath();
    const lg = ctx.createLinearGradient(0, -26, 0, -4);
    lg.addColorStop(0, q >= 2 ? '#8a6038' : '#765132'); lg.addColorStop(1, '#3a2615');
    ctx.fillStyle = lg; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(220,190,140,.5)'; ctx.setLineDash([1.4, 1.4]); ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(8.5, -16.8); ctx.bezierCurveTo(5, -24, -6, -25, -11, -16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1, -25); ctx.quadraticCurveTo(-6, -15, -8, -4.5); ctx.stroke();
    ctx.setLineDash([]);
    strokeLine(ctx, [{ x: -4.5, y: -6 }, { x: 2, y: -1 }, { x: 7, y: 1.5 }], '#3a2615', 1.2);
    if (q >= 2) { ctx.fillStyle = BRONZE_Q[q]; for (const [x, y] of [[4, -21], [-4, -23], [-10, -15]]) { ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill(); } }
    return;
  }

  if (h.b === 'conicHelm') { drawConicHelm(ctx, h, spec, sway); return; }
  if (h.b === 'gallicHelm') { drawGallicHelm(ctx, h, spec, sway); return; }
  const style = h.b === 'crestHelm' ? 'murmillo'
    : ({ secutor: 'secutor', thraex: 'thraex', murmillo: 'murmillo', hoplomachus: 'hoplo' })[spec.cls] || 'galea';

  if (style === 'secutor') {
    glow();
    ctx.beginPath();
    ctx.moveTo(-12.8, 3.5);
    ctx.bezierCurveTo(-15.5, -14, -11.5, -27.5, 1, -28);
    ctx.bezierCurveTo(11.5, -28.3, 16, -17, 15.2, -8);
    ctx.bezierCurveTo(14.8, -1.5, 11, 4, 6, 4.5);
    ctx.closePath();
    fillMetal(-14, -20, 15, -4);
    noGlow();
    ctx.strokeStyle = 'rgba(255,250,235,.55)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-8, -20); ctx.quadraticCurveTo(-2, -26, 6, -25); ctx.stroke();
    for (const [x, y, r] of [[10.8, -12, 1.9], [13.4, -12.3, 1.4]]) {
      ctx.fillStyle = '#080503'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = trim; ctx.lineWidth = 0.7; ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-12.4, -16.5);
    ctx.bezierCurveTo(-8.5, -30, 4, -32, 11.5, -25);
    ctx.lineTo(10.2, -23.2);
    ctx.bezierCurveTo(4, -28.2, -6, -27.5, -10.8, -15.2);
    ctx.closePath();
    fillMetal(-12, -30, 12, -20, shade(col, 0.1));
    ctx.strokeStyle = trim; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-12.5, 2); ctx.quadraticCurveTo(0, 5.5, 11, 3.2); ctx.stroke();
    if (q >= 3) { ctx.fillStyle = trim; ctx.beginPath(); ctx.arc(4, -7, 1.4, 0, Math.PI * 2); ctx.fill(); }
    dents([[-6, -12, 1.5], [3, -20, 1.1]]);
    return;
  }

  // купол
  glow();
  ctx.beginPath();
  ctx.moveTo(11.2, -13.2);
  ctx.bezierCurveTo(11.6, -25.5, -6, -30, -12.8, -18.5);
  ctx.lineTo(-13.6, -11);
  ctx.quadraticCurveTo(-15, -6.5, -18.5, -4.5);
  ctx.lineTo(-17.2, -2.4);
  ctx.quadraticCurveTo(-12, -4, -10.5, -9);
  ctx.lineTo(-4, -12.4);
  ctx.closePath();
  fillMetal(-13, -28, 12, -10);
  noGlow();
  if (q >= 2) { ctx.strokeStyle = trim; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-11, -15); ctx.bezierCurveTo(-5, -26, 6, -25, 10, -15); ctx.stroke(); }
  dents([[-7, -20, 1.4], [4, -23, 1]]);

  if (style === 'galea') {
    ctx.beginPath(); ctx.moveTo(-14.5, -12.4); ctx.quadraticCurveTo(0, -15.2, 13.5, -13.6); ctx.quadraticCurveTo(0, -11.2, -14.5, -12.4);
    fillMetal(-14, -14, 13, -11, shade(col, -0.1));
    ctx.beginPath();
    ctx.moveTo(1.5, -13); ctx.lineTo(8.6, -12.8);
    ctx.quadraticCurveTo(10.4, -6, 7.8, 0.6);
    ctx.lineTo(3, 1.2);
    ctx.quadraticCurveTo(0.5, -5, 1.5, -13);
    ctx.closePath();
    fillMetal(1, -10, 9, -2);
    ctx.fillStyle = trim; for (const [x, y] of [[3.5, -11], [6.5, -1.5]]) { ctx.beginPath(); ctx.arc(x, y, 0.8, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = shade(col, -0.2); ctx.fillRect(-2.2, -30.5, 4.4, 3.5);
    const pts = [];
    for (let i = 0; i < 9; i++) pts.push({ x: -8 + i * 2, y: -28.8 - Math.sin(i / 8 * Math.PI) * 1.5, a: -1.2 + i * 0.12 });
    plume(ctx, pts, crest, sway.plume, q >= 3 ? 15 : 11, q >= 3 ? 4 : 3);
    return;
  }

  // широкие поля
  ctx.beginPath(); ctx.moveTo(-20.5, -12); ctx.quadraticCurveTo(0, -17.5, 21, -13.4); ctx.quadraticCurveTo(0, -9.4, -20.5, -12);
  fillMetal(-20, -15, 20, -10, shade(col, -0.08));
  ctx.strokeStyle = trim; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-19.5, -12.2); ctx.quadraticCurveTo(0, -16.6, 20, -13.4); ctx.stroke();
  // забрало с решёткой
  ctx.beginPath();
  ctx.moveTo(2.5, -12.6); ctx.lineTo(13, -12.9);
  ctx.quadraticCurveTo(15.2, -5, 11.4, 3);
  ctx.lineTo(2.4, 3.6);
  ctx.quadraticCurveTo(-1.5, -4, 2.5, -12.6);
  ctx.closePath();
  fillMetal(2, -8, 14, 0);
  ctx.beginPath(); ctx.ellipse(9, -7.4, 3.9, 4.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0604'; ctx.fill();
  ctx.fillStyle = shade(col, 0.4);
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    if (i * i + j * j > 6) continue;
    ctx.beginPath(); ctx.arc(9 + i * 1.5, -7.4 + j * 1.75, 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = trim; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(9, -7.4, 4.2, 4.9, 0, 0, Math.PI * 2); ctx.stroke();

  if (style === 'hoplo') {
    // гопломах: гребень и высокий султан из перьев
    glow();
    ctx.beginPath();
    ctx.moveTo(-10.5, -24); ctx.bezierCurveTo(-8, -33, 6, -34, 10, -25.5); ctx.lineTo(6.5, -23.5); ctx.closePath();
    fillMetal(-10, -33, 10, -23);
    noGlow();
    const pts = [];
    for (let i = 0; i < 11; i++) { const t = i / 10; pts.push({ x: -9 + t * 17, y: -27 - Math.sin(t * Math.PI) * 5, a: -0.75 + t * 0.9 }); }
    plume(ctx, pts, crest, sway.plume, q >= 3 ? 19 : 15, q >= 3 ? 4 : 3);
    for (const [bx, a] of [[-11.5, -0.25], [12, 0.25]]) {
      ctx.save(); ctx.translate(bx, -17); ctx.rotate(a + sway.plume * 0.6);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-3.2, -11, 0, -24); ctx.quadraticCurveTo(3.2, -11, 0, 0);
      ctx.fillStyle = q >= 3 ? '#efe6d2' : shade(crest, 0.25); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.restore();
    }
    return;
  }

  if (style === 'thraex') {
    glow();
    ctx.beginPath();
    ctx.moveTo(-9.5, -25.5);
    ctx.bezierCurveTo(-9.5, -41, 8, -45.5, 16, -37.5);
    ctx.lineTo(19.5, -34.8); ctx.lineTo(15.6, -33.8);
    ctx.bezierCurveTo(10, -38.5, -2, -37, -3, -25);
    ctx.closePath();
    fillMetal(-10, -42, 18, -30);
    noGlow();
    ctx.fillStyle = '#0a0604'; ctx.beginPath(); ctx.arc(14.4, -37, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shade(col, -0.45); ctx.lineWidth = 0.7;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-7 + i * 3, -28 - i * 1.6); ctx.lineTo(-5 + i * 3.4, -35 - i * 1.2); ctx.stroke(); }
    for (const [bx, a] of [[-11, -0.35], [-12.8, -0.55]]) {
      ctx.save(); ctx.translate(bx, -21); ctx.rotate(a + sway.plume * 0.6);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-3, -9, 0, -20); ctx.quadraticCurveTo(3, -9, 0, 0);
      ctx.fillStyle = crest; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.strokeStyle = shade(crest, 0.4); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -19); ctx.stroke();
      ctx.restore();
    }
    return;
  }

  // мурмиллон: высокий «рыбий» гребень с плюмажем
  glow();
  ctx.beginPath();
  ctx.moveTo(-11.5, -23.5);
  ctx.bezierCurveTo(-8, -38, 6, -39, 10.5, -28);
  ctx.lineTo(7, -24.5);
  ctx.closePath();
  fillMetal(-11, -38, 11, -24);
  noGlow();
  ctx.strokeStyle = shade(col, -0.45); ctx.lineWidth = 0.7;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-8 + i * 3, -25.5); ctx.lineTo(-7 + i * 3.1, -31.5 - Math.sin(i / 5 * Math.PI) * 4); ctx.stroke(); }
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    pts.push({ x: -10 + t * 19, y: -26 - Math.sin(t * Math.PI) * 11.5 - (1 - t) * 2, a: -1.0 + t * 1.3 });
  }
  plume(ctx, pts, crest, sway.plume, q >= 3 ? 13 : 9, q >= 3 ? 4 : 3);
}

// Остроконечный шлем сагиттария: купол-шишак, наносник, кольчужная бармица
function drawConicHelm(ctx, h, spec, sway) {
  const q = h.q, col = STEEL_Q[q], trim = q >= 4 ? '#f3d27a' : BRONZE_Q[Math.max(1, q)];
  // бармица
  ctx.beginPath();
  ctx.moveTo(-12.5, -12); ctx.quadraticCurveTo(-15, -2, -10, 3.5); ctx.lineTo(-2, 2.5); ctx.quadraticCurveTo(-5, -5, -4, -12); ctx.closePath();
  ctx.fillStyle = shade(col, -0.35); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = 'rgba(230,235,240,.35)'; ctx.lineWidth = 0.6;
  for (let y = -10; y < 3; y += 2.2) for (let x = -13; x < -3; x += 2.2) { ctx.beginPath(); ctx.arc(x + (y % 4 ? 1 : 0), y, 0.9, 0, Math.PI * 2); ctx.stroke(); }
  // купол
  if (q >= 4) { ctx.shadowColor = 'rgba(255,215,120,.6)'; ctx.shadowBlur = 8; }
  ctx.beginPath();
  ctx.moveTo(11, -13.5); ctx.bezierCurveTo(11, -24, 5, -30, 0.5, -38); ctx.bezierCurveTo(-5, -30, -13, -25, -12.8, -13.5);
  ctx.quadraticCurveTo(0, -15.5, 11, -13.5); ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, -12, -25, 11, -20, col); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.shadowBlur = 0;
  // сегменты и обод
  ctx.strokeStyle = shade(col, -0.45); ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(0.5, -37); ctx.quadraticCurveTo(-1, -25, -1.5, -15); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.5, -37); ctx.quadraticCurveTo(6, -25, 7.5, -14.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-13.2, -13.8); ctx.quadraticCurveTo(0, -16.6, 11.6, -13.6); ctx.lineTo(11.4, -11.6); ctx.quadraticCurveTo(0, -14.2, -13, -11.8); ctx.closePath();
  ctx.fillStyle = trim; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.9; ctx.stroke();
  // наносник
  ctx.beginPath(); ctx.moveTo(9.4, -12.5); ctx.lineTo(12, -12.6); ctx.lineTo(12.3, -5.5); ctx.lineTo(10.6, -5); ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, 9, -10, 12.5, -6, col); ctx.fill(); ctx.stroke();
  // навершие — с флажком у дорогих
  ctx.fillStyle = trim; ctx.beginPath(); ctx.arc(0.5, -38.5, 1.6, 0, Math.PI * 2); ctx.fill();
  if (q >= 2) {
    ctx.save(); ctx.translate(0.5, -39); ctx.rotate(-0.9 + sway.plume * 0.8);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-4, -6, -2, -13); ctx.quadraticCurveTo(2, -7, 0, 0);
    ctx.fillStyle = CREST[spec.look.crest]; ctx.fill(); ctx.restore();
  }
}

// Галльский шлем (монтефортино): шишак, назатыльник, нащёчники; у лучших — рога
function drawGallicHelm(ctx, h, spec, sway) {
  const q = h.q, col = BRONZE_Q[q];
  const trim = q >= 4 ? '#f3d27a' : q >= 3 ? '#e4e8ea' : shade(col, 0.45);
  if (q >= 3) {
    for (const [x, d] of [[-7, -1], [6, 1]]) {
      ctx.beginPath(); ctx.moveTo(x - 2, -24); ctx.quadraticCurveTo(x + d * 9, -27, x + d * 9, -38); ctx.quadraticCurveTo(x + d * 4, -29, x + 2, -25); ctx.closePath();
      ctx.fillStyle = metalGrad(ctx, x - 4, -36, x + 6, -24, q >= 4 ? '#e6c06e' : col); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  if (q >= 4) { ctx.shadowColor = 'rgba(255,215,120,.6)'; ctx.shadowBlur = 8; }
  ctx.beginPath();
  ctx.moveTo(11, -12.5); ctx.bezierCurveTo(12, -27, -6, -31, -12.6, -18.5);
  ctx.lineTo(-13.4, -12); ctx.quadraticCurveTo(-17, -9, -18.6, -6.8); ctx.lineTo(-17.6, -5);
  ctx.quadraticCurveTo(-12, -6.5, -10, -11); ctx.quadraticCurveTo(0, -14.5, 11, -12.5); ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, -13, -27, 12, -12, col); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.shadowBlur = 0;
  // шишак
  ctx.beginPath(); ctx.moveTo(-2.4, -27.6); ctx.lineTo(-1.8, -32); ctx.lineTo(1.8, -32); ctx.lineTo(2.4, -27.8); ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, -2, -32, 2, -28, col); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -33, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // ободок с узором
  ctx.strokeStyle = trim; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-12.4, -13.6); ctx.quadraticCurveTo(0, -16.2, 10.6, -13.6); ctx.stroke();
  ctx.setLineDash([1.2, 1.6]); ctx.beginPath(); ctx.moveTo(-11.8, -16); ctx.quadraticCurveTo(0, -19, 10.2, -16); ctx.stroke(); ctx.setLineDash([]);
  // нащёчник
  ctx.beginPath(); ctx.moveTo(-3, -12.6); ctx.lineTo(5.4, -12.4); ctx.quadraticCurveTo(7.2, -6, 4.6, -1.4); ctx.lineTo(0, -1.6); ctx.quadraticCurveTo(-3.2, -6, -3, -12.6); ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, -3, -10, 6, -3, shade(col, -0.05)); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.strokeStyle = trim; ctx.lineWidth = 0.7;
  for (const [x, y] of [[1, -9.5], [3, -6], [1.6, -3.4]]) { ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.stroke(); }
  if (q === 0) { ctx.fillStyle = 'rgba(40,25,10,.45)'; ctx.beginPath(); ctx.arc(-5, -21, 1.3, 0, Math.PI * 2); ctx.fill(); }
}

function drawGalerus(ctx, S, spec) {
  const col = BRONZE_Q[spec.arms ? spec.arms.q : 1];
  ctx.save();
  ctx.translate(S.armJ.x, S.armJ.y);
  ctx.rotate(Math.PI - S.thU);
  ctx.beginPath();
  ctx.moveTo(-7, 9); ctx.lineTo(-10.5, -17); ctx.quadraticCurveTo(-4, -22, 2, -16); ctx.lineTo(6, 10);
  ctx.quadraticCurveTo(0, 13, -7, 9);
  ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, -10, 0, 6, 0, col); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.strokeStyle = shade(col, 0.5); ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-8, -12); ctx.quadraticCurveTo(-3, -16, 1, -12); ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------
//  Набедренник, пояс, доспех
// ------------------------------------------------------------
function drawCloth(ctx, S, spec, g, sway) {
  const cloth = CLOTH[spec.look.cloth];
  ctx.lineJoin = 'round';
  torsoPath(ctx, S, g, 0, 0.33, 1.6);
  const cg = ctx.createLinearGradient(S.hip.x, S.hip.y - 14, S.hip.x, S.hip.y + 12);
  cg.addColorStop(0, shade(cloth, 0.1)); cg.addColorStop(1, shade(cloth, -0.3));
  ctx.fillStyle = cg; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.6; ctx.stroke();
  // передний клапан, колышется от движения
  const f0 = torsoPt(S, g, 0.24, 1, 1.2), f1 = torsoPt(S, g, 0.05, 1, 1.5);
  const s = spineAt(S, 0.05);
  const ang = Math.atan2(-s.ty, -s.tx) + sway.cloth * 0.8;
  const tip = { x: f1.x + Math.cos(ang) * 17 - s.nx * 4, y: f1.y + Math.sin(ang) * 17 - s.ny * 4 };
  const back0 = { x: f0.x - s.nx * 9, y: f0.y - s.ny * 9 };
  ctx.beginPath();
  ctx.moveTo(f0.x, f0.y);
  ctx.quadraticCurveTo(f1.x + s.nx * 3, f1.y + s.ny * 3, tip.x + s.nx * 3, tip.y + s.ny * 3);
  ctx.lineTo(tip.x - s.nx * 6, tip.y - s.ny * 6);
  ctx.quadraticCurveTo(f1.x - s.nx * 7, f1.y - s.ny * 7, back0.x, back0.y);
  ctx.closePath();
  ctx.fillStyle = shade(cloth, -0.08); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = shade(cloth, -0.45); ctx.lineWidth = 0.7;
  for (const k of [0.3, 0.6]) {
    const a = lerpP(f0, back0, k);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(tip.x - s.nx * (6 * k - 3), tip.y - s.ny * (6 * k - 3)); ctx.stroke();
  }
}

// Набедренник и пояс (у манекена — только пояс)
function drawLoin(ctx, S, spec, g, sway) {
  if (!spec.dummy) drawCloth(ctx, S, spec, g, sway);
  const belt = spec.belt && spec.belt.b;
  if (!belt) return;
  const bq = spec.belt.q;
  if (belt === 'cingulum') {
    // узкий кожаный пояс с бляхами
    torsoPath(ctx, S, g, 0.3, 0.37, 2);
    ctx.fillStyle = bq >= 2 ? '#5e3b20' : '#4c3019'; ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2; ctx.stroke();
    const a = torsoPt(S, g, 0.335, -1, 2), b = torsoPt(S, g, 0.335, 1, 2);
    ctx.fillStyle = bq >= 4 ? '#f3d27a' : bq >= 3 ? '#e4e8ea' : BRONZE_Q[bq];
    for (let i = 1; i < 5; i++) { const p = lerpP(a, b, i / 5); ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, Math.PI * 2); ctx.fill(); }
    const bk = lerpP(a, b, 0.9);
    ctx.fillRect(bk.x - 2, bk.y - 2.4, 4, 4.8);
    return;
  }
  // бронзовый бальтеус
  const bc = BRONZE_Q[bq];
  torsoPath(ctx, S, g, 0.27, 0.41, 2.4);
  const a = torsoPt(S, g, 0.34, -1, 2.4), b = torsoPt(S, g, 0.34, 1, 2.4);
  ctx.fillStyle = metalGrad(ctx, a.x, a.y - 4, a.x, a.y + 4, bc); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = shade(bc, 0.45);
  for (let i = 1; i < 6; i++) {
    const p = lerpP(a, b, i / 6);
    if (bq >= 2) ctx.fillRect(p.x - 1.4, p.y - 2.6, 2.8, 5.2);
    else { ctx.beginPath(); ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2); ctx.fill(); }
  }
  if (bq >= 3) {
    const p = lerpP(a, b, 0.92);
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2); ctx.fillStyle = bq >= 4 ? '#f3d27a' : '#e4e8ea'; ctx.fill(); ctx.stroke();
  }
}

function drawBodyArmor(ctx, S, spec, g, sway) {
  const ar = spec.armor && spec.armor.b;
  if (ar === 'mail') { drawMail(ctx, S, spec, g); return; }
  if (ar !== 'leather' && ar !== 'squama') return;
  const q = spec.armor.q;
  const col = ar === 'squama' ? BRONZE_Q[q] : (q >= 3 ? '#7a5230' : '#664328');
  // птеруги — ремни поверх набедренника
  const s = spineAt(S, 0.36);
  const dn = Math.atan2(-s.ty, -s.tx) + sway.cloth * 0.7;
  const pa = torsoPt(S, g, 0.36, -1, 0.5), pb = torsoPt(S, g, 0.36, 1, 0.5);
  for (let i = 0; i < 6; i++) {
    const p = lerpP(pa, pb, i / 5);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(dn - Math.PI / 2);
    ctx.beginPath(); ctx.rect(-2.8, 0, 5.6, 17 + (i % 2) * 2);
    ctx.fillStyle = ar === 'squama' ? '#5a3a20' : shade(col, -0.1); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = BRONZE_Q[q]; ctx.beginPath(); ctx.arc(0, 15 + (i % 2) * 2, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // кираса
  const xa = torsoPt(S, g, 0.6, -1).x, xb = torsoPt(S, g, 0.6, 1).x;
  torsoPath(ctx, S, g, 0.36, 0.98, 1.4);
  if (ar === 'leather') {
    const lg = ctx.createLinearGradient(xa, 0, xb, 0);
    lg.addColorStop(0, shade(col, -0.45)); lg.addColorStop(0.45, shade(col, 0.15)); lg.addColorStop(1, shade(col, -0.3));
    ctx.fillStyle = lg;
  } else ctx.fillStyle = metalGrad(ctx, xa, 0, xb, 0, col);
  ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.save();
  torsoPath(ctx, S, g, 0.36, 0.98, 1.4); ctx.clip();
  if (ar === 'squama') {
    ctx.strokeStyle = shade(col, -0.55); ctx.lineWidth = 0.8;
    ctx.fillStyle = shade(col, 0.35);
    let row = 0;
    for (let t = 0.4; t < 0.98; t += 0.055, row++) {
      const a = torsoPt(S, g, t, -1, 2), b = torsoPt(S, g, t, 1, 2);
      const n = 9;
      for (let i = 0; i <= n; i++) {
        const p = lerpP(a, b, (i + (row % 2) * 0.5) / n);
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x - 0.6, p.y + 0.6, 0.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else {
    ctx.strokeStyle = 'rgba(225,190,140,.5)'; ctx.setLineDash([1.5, 1.6]); ctx.lineWidth = 0.8;
    for (const side of [1, -1]) {
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) { const p = torsoPt(S, g, 0.38 + i * 0.04, side, -1.2); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (q >= 2) {
      ctx.strokeStyle = 'rgba(30,15,5,.5)'; ctx.lineWidth = 1;
      const p1 = torsoPt(S, g, 0.62, 1, -3), p2 = torsoPt(S, g, 0.76, 1, -2), p3 = torsoPt(S, g, 0.7, -1, -4);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.quadraticCurveTo(p2.x, p2.y, p3.x, p3.y); ctx.stroke();
    }
  }
  ctx.restore();
  // плечевой ремень
  const st = torsoPt(S, g, 0.98, -1, 0), sf = torsoPt(S, g, 0.98, 1, 0), mid = spineAt(S, 1);
  ctx.beginPath(); ctx.moveTo(st.x, st.y); ctx.quadraticCurveTo(mid.x + mid.tx * 6, mid.y + mid.ty * 6, sf.x, sf.y);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5.5; ctx.stroke();
  ctx.strokeStyle = ar === 'squama' ? shade(col, 0.2) : '#7a5534'; ctx.lineWidth = 3.6; ctx.stroke();
  if (q >= 3) {
    ctx.fillStyle = q >= 4 ? '#f3d27a' : '#e4e8ea';
    const p = torsoPt(S, g, 0.7, 1, -4);
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.8; ctx.stroke();
  }
}

// Кольчуга: кольца рядами, подол поверх набедренника
function drawMail(ctx, S, spec, g) {
  const q = spec.armor.q, col = STEEL_Q[q];
  const xa = torsoPt(S, g, 0.6, -1).x, xb = torsoPt(S, g, 0.6, 1).x;
  torsoPath(ctx, S, g, 0.16, 0.98, 1.6);
  ctx.fillStyle = metalGrad(ctx, xa, 0, xb, 0, shade(col, -0.15)); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.save();
  torsoPath(ctx, S, g, 0.16, 0.98, 1.6); ctx.clip();
  ctx.lineWidth = 0.7;
  let row = 0;
  for (let t = 0.17; t < 0.99; t += 0.032, row++) {
    const a = torsoPt(S, g, t, -1, 3), b = torsoPt(S, g, t, 1, 3);
    for (let i = 0; i <= 12; i++) {
      const p = lerpP(a, b, (i + (row % 2) * 0.5) / 12);
      ctx.strokeStyle = (i + row) % 3 ? 'rgba(25,25,30,.55)' : 'rgba(240,244,248,.45)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
  // кожаная окантовка подола и ворота
  const h0 = torsoPt(S, g, 0.17, -1, 1.6), h1 = torsoPt(S, g, 0.17, 1, 1.6);
  strokeLine(ctx, [h0, h1], q >= 3 ? '#cdb47c' : '#4a3019', 2.2);
  if (q >= 4) { ctx.fillStyle = '#f3d27a'; const p = torsoPt(S, g, 0.72, 1, -4); ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2); ctx.fill(); }
}

// ------------------------------------------------------------
//  Щиты, сеть, лук и колчан
// ------------------------------------------------------------
const SHIELD_FLAT = -1.5, BOW_FLAT = 0;
function drawShield(ctx, oh, S, spec) {
  const q = oh.q;
  const paint = PAINT[spec.look.paint];
  const rim = BRONZE_Q[q];
  const deco = q >= 4 ? '#f3d27a' : q >= 3 ? '#e2d2a0' : shade(rim, 0.2);
  // у павшего щит лежит плашмя вдоль тела
  const tilt = clamp((S.thFN - Math.PI / 2) * 0.4, -0.7, 0.7) * (1 - S.slack) + SHIELD_FLAT * S.slack;
  ctx.save();
  ctx.translate(S.handN.x, S.handN.y);
  ctx.rotate(tilt);
  ctx.lineJoin = 'round';
  if (oh.b === 'scutum') {
    const w = 30, h = 106, x0 = -4;
    // торец щита — видимая толщина
    ctx.beginPath(); ctx.rect(x0 - 5, -h / 2 + 3, 6, h - 6);
    ctx.fillStyle = shade(paint, -0.6); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.6; ctx.stroke();
    const face = c => {
      c.beginPath();
      c.moveTo(x0, -h / 2 + 4); c.quadraticCurveTo(x0 + w / 2, -h / 2 - 3, x0 + w, -h / 2 + 4);
      c.lineTo(x0 + w, h / 2 - 4); c.quadraticCurveTo(x0 + w / 2, h / 2 + 3, x0, h / 2 - 4);
      c.closePath();
    };
    face(ctx);
    const pg = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    pg.addColorStop(0, shade(paint, -0.55)); pg.addColorStop(0.42, shade(paint, 0.16)); pg.addColorStop(0.58, shade(paint, 0.05)); pg.addColorStop(1, shade(paint, -0.5));
    ctx.fillStyle = pg; ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.save(); face(ctx); ctx.clip();
    ctx.strokeStyle = metalGrad(ctx, x0, 0, x0 + w, 0, rim); ctx.lineWidth = 3.4; face(ctx); ctx.stroke();
    ctx.fillStyle = metalGrad(ctx, x0 + w / 2 - 2, 0, x0 + w / 2 + 2, 0, rim);
    ctx.fillRect(x0 + w / 2 - 1.6, -h / 2, 3.2, h);
    ctx.strokeStyle = deco; ctx.fillStyle = deco; ctx.lineWidth = 1.5;
    if (q >= 1) {
      // молнии Юпитера
      for (const sgn of [-1, 1]) for (const d of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(x0 + w / 2, sgn * 14); ctx.lineTo(x0 + w / 2 + 5 * d, sgn * 24); ctx.lineTo(x0 + w / 2 - 3 * d, sgn * 28); ctx.lineTo(x0 + w / 2 + 4 * d, sgn * 42);
        ctx.stroke();
      }
    }
    if (q >= 2) {
      // крылья вокруг умбона
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x0 + w / 2, sgn * 4);
        ctx.quadraticCurveTo(x0 + 3, sgn * 6, x0 + 3, sgn * 16);
        ctx.quadraticCurveTo(x0 + w / 2 - 2, sgn * 10, x0 + w / 2, sgn * 4);
        ctx.fill();
      }
    }
    if (q >= 3) { ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x0 + w / 2, 0, w / 2 - 4, 36, 0, 0, Math.PI * 2); ctx.stroke(); }
    if (q === 0) {
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x0 + 4, 20); ctx.lineTo(x0 + 14, 30); ctx.moveTo(x0 + 8, -30); ctx.lineTo(x0 + 20, -22); ctx.moveTo(x0 + 18, 5); ctx.lineTo(x0 + 26, 12); ctx.stroke();
    }
    ctx.restore();
    // умбон
    ctx.beginPath(); ctx.ellipse(x0 + w / 2 + 1, 0, 7, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = metalGrad(ctx, x0 + w / 2 - 6, -6, x0 + w / 2 + 8, 6, q >= 4 ? '#e6c06e' : rim); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = 'rgba(255,248,230,.6)'; ctx.beginPath(); ctx.ellipse(x0 + w / 2 - 1.5, -3, 2, 3, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    // парма
    const face = c => { c.beginPath(); c.ellipse(7, 0, 16, 25, 0, 0, Math.PI * 2); };
    ctx.beginPath(); ctx.ellipse(4.5, 0, 16, 25, 0, 0, Math.PI * 2);
    ctx.fillStyle = shade(paint, -0.6); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.6; ctx.stroke();
    face(ctx);
    const pg = ctx.createLinearGradient(-9, 0, 23, 0);
    pg.addColorStop(0, shade(paint, -0.55)); pg.addColorStop(0.45, shade(paint, 0.14)); pg.addColorStop(1, shade(paint, -0.5));
    ctx.fillStyle = pg; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = metalGrad(ctx, -9, 0, 23, 0, rim); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(7, 0, 14.6, 23.6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = deco; ctx.lineWidth = 1.1;
    if (q >= 1) { ctx.beginPath(); ctx.ellipse(7, 0, 10, 16, 0, 0, Math.PI * 2); ctx.stroke(); }
    if (q >= 3) {
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(7 + Math.cos(a) * 6, Math.sin(a) * 9.5); ctx.lineTo(7 + Math.cos(a) * 9.6, Math.sin(a) * 15.4); ctx.stroke();
      }
    }
    ctx.beginPath(); ctx.ellipse(8, 0, 5, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = metalGrad(ctx, 3, -5, 13, 5, q >= 4 ? '#e6c06e' : rim); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = 'rgba(255,248,230,.6)'; ctx.beginPath(); ctx.ellipse(6.5, -2.5, 1.5, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// Геометрия лука: стрела идёт вдоль ближнего предплечья, тетива натянута на draw (0..1)
function bowGeom(S, pose, w) {
  const draw = clamp(pose.draw || 0, 0, 1);
  const dir = (S.thFN + (S.thHN - S.thFN) * 0.4) * (1 - S.slack) + BOW_FLAT * S.slack;
  const hand = S.handN;
  const pull = 7 + draw * 36;
  const P = (u, v) => ({ x: hand.x + u * Math.cos(dir) + v * Math.sin(dir), y: hand.y - u * Math.sin(dir) + v * Math.cos(dir) });
  return { draw, dir, hand, P, nock: P(0, -pull), pull, len: w.b === 'compBow' ? 33 : 39 };
}

function drawBow(ctx, w, G) {
  const q = w.q, comp = w.b === 'compBow';
  const L = G.len, bend = 6 + G.draw * 9;
  ctx.save();
  ctx.translate(G.hand.x, G.hand.y);
  ctx.rotate(-G.dir);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // плечи лука: местная ось +y — направление выстрела, x — вдоль лука
  const tip = s => ({ x: s * L, y: comp ? -bend * 0.6 + 4 : -bend });
  const limb = s => {
    ctx.beginPath(); ctx.moveTo(0, 3);
    if (comp) ctx.bezierCurveTo(s * L * 0.35, 6, s * L * 0.8, 2 - bend * 0.3, tip(s).x, tip(s).y);
    else ctx.quadraticCurveTo(s * L * 0.55, 6, tip(s).x, tip(s).y);
  };
  const wood = comp ? (q >= 3 ? '#3a2416' : '#4a2e1a') : (q >= 2 ? '#7a5230' : '#6a4728');
  for (const s of [-1, 1]) {
    limb(s); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5.2; ctx.stroke();
    limb(s); ctx.strokeStyle = wood; ctx.lineWidth = 3.4; ctx.stroke();
    limb(s); ctx.strokeStyle = 'rgba(255,230,190,.25)'; ctx.lineWidth = 1; ctx.stroke();
    const t = tip(s);
    ctx.fillStyle = comp ? '#d8cbb0' : BRONZE_Q[q]; ctx.beginPath(); ctx.arc(t.x, t.y, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  if (q >= 3) { ctx.fillStyle = q >= 4 ? '#f3d27a' : '#e4e8ea'; ctx.fillRect(-3.5, 1, 7, 4); }
  // тетива и стрела
  const n = { x: 0, y: -G.pull };
  const a = tip(-1), b = tip(1);
  ctx.strokeStyle = 'rgba(235,225,200,.85)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(a.x, a.y);
  if (G.draw > 0.02) ctx.lineTo(n.x, n.y);
  ctx.lineTo(b.x, b.y); ctx.stroke();
  let head = null;
  if (G.draw > 0.02) {
    strokeLine(ctx, [{ x: 0, y: n.y }, { x: 0, y: 16 }], OUTLINE, 2.6);
    strokeLine(ctx, [{ x: 0, y: n.y }, { x: 0, y: 16 }], '#b08a58', 1.4);
    ctx.fillStyle = STEEL_Q[q]; ctx.beginPath(); ctx.moveTo(-2.2, 15); ctx.lineTo(0, 22); ctx.lineTo(2.2, 15); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.fillStyle = q >= 2 ? CREST[0] : '#e6dcc6';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, n.y + 2); ctx.lineTo(s * 3, n.y + 4); ctx.lineTo(s * 2.4, n.y + 10); ctx.lineTo(0, n.y + 9); ctx.closePath(); ctx.fill(); }
  }
  const m = ctx.getTransform();
  head = { x: m.a * 0 + m.c * 20 + m.e, y: m.b * 0 + m.d * 20 + m.f };
  ctx.restore();
  return head;
}

// Колчан за спиной: торчат оперения стрел
function drawQuiver(ctx, S, it, g) {
  const q = it.q;
  const a = torsoPt(S, g, 0.42, -1, 3), b = torsoPt(S, g, 1.05, -1, -2);
  const top = { x: b.x - 4, y: b.y - 12 };
  const th = angOf(a, top);
  ctx.save();
  ctx.translate(a.x, a.y); ctx.rotate(-th);
  const len = Math.hypot(top.x - a.x, top.y - a.y);
  ctx.lineJoin = 'round';
  // оперения
  for (let i = 0; i < 5; i++) {
    const x = -4 + i * 2, y = len + 4 + (i % 2) * 3;
    strokeLine(ctx, [{ x, y: len - 2 }, { x, y }], '#8a6a42', 1.1);
    ctx.fillStyle = i % 2 ? '#e6dcc6' : (q >= 2 ? CREST[0] : '#b9a988');
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1.8, y - 5); ctx.lineTo(x, y - 7); ctx.lineTo(x + 1.8, y - 5); ctx.closePath(); ctx.fill();
  }
  ctx.beginPath(); ctx.rect(-6, -2, 12, len + 1);
  const lg = ctx.createLinearGradient(-6, 0, 6, 0);
  const lc = q >= 3 ? '#6a2a1c' : '#5a3a20';
  lg.addColorStop(0, shade(lc, -0.4)); lg.addColorStop(0.5, shade(lc, 0.15)); lg.addColorStop(1, shade(lc, -0.35));
  ctx.fillStyle = lg; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = q >= 4 ? '#f3d27a' : BRONZE_Q[q];
  ctx.fillRect(-6.5, len - 3, 13, 3); ctx.fillRect(-6.5, -2, 13, 2.5);
  if (q >= 2) { ctx.strokeStyle = shade(BRONZE_Q[q], 0.3); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(0, len - 6); ctx.stroke(); }
  ctx.restore();
}

function drawNetBundle(ctx, hand, sway = 0) {
  ctx.save();
  ctx.translate(hand.x, hand.y + 2);
  ctx.rotate(sway * 0.8);
  const path = c => { c.beginPath(); c.moveTo(-3, 0); c.quadraticCurveTo(-16, 18, -9, 38); c.quadraticCurveTo(2, 45, 12, 36); c.quadraticCurveTo(14, 16, 4, 0); c.closePath(); };
  path(ctx);
  ctx.fillStyle = 'rgba(110,92,64,.32)'; ctx.fill();
  ctx.save(); path(ctx); ctx.clip();
  ctx.strokeStyle = 'rgba(214,194,150,.85)'; ctx.lineWidth = 0.9;
  for (let i = -24; i < 44; i += 4) {
    ctx.beginPath(); ctx.moveTo(-18, i); ctx.quadraticCurveTo(0, i + 9, 18, i + 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, i); ctx.quadraticCurveTo(0, i + 9, -18, i + 16); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(60,45,25,.7)'; ctx.lineWidth = 0.8; path(ctx); ctx.stroke();
  ctx.fillStyle = '#5a5a5a'; ctx.strokeStyle = OUTLINE;
  for (const [x, y] of [[-9, 37], [-3, 41], [4, 41], [11, 35]]) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}

function drawNetOverlay(ctx, S) {
  ctx.save();
  const c = lerpP(S.hip, S.sh, 0.45);
  ctx.beginPath(); ctx.ellipse(c.x, c.y - 4, 32, 64, Math.PI - S.thU, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(90,75,50,.2)'; ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(220,200,155,.85)'; ctx.lineWidth = 1;
  for (let i = -100; i < 100; i += 6) {
    ctx.beginPath(); ctx.moveTo(c.x - 45, c.y + i); ctx.quadraticCurveTo(c.x, c.y + i + 26, c.x + 45, c.y + i + 44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x + 45, c.y + i); ctx.quadraticCurveTo(c.x, c.y + i + 26, c.x - 45, c.y + i + 44); ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------
//  Оружие: начало координат — кисть, клинок вдоль направления th.
//  Возвращает основание и острие клинка в координатах устройства (для «смаза»).
// ------------------------------------------------------------
function drawWeapon(ctx, w, hand, th) {
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(Math.PI - th);
  const q = w.q, steel = STEEL_Q[q], bronze = BRONZE_Q[q];
  const hiltCol = q >= 4 ? '#e2b85a' : q >= 2 ? '#5a2e1c' : '#4a3220';
  ctx.lineJoin = 'round';
  const out = (path, fill) => { path(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.3; ctx.stroke(); };
  const glow = () => { if (q >= 3) { ctx.shadowColor = q >= 4 ? 'rgba(255,210,120,.7)' : 'rgba(210,225,255,.45)'; ctx.shadowBlur = 7; } };
  const blade = (len, wid, curve = 0) => {
    glow();
    out(() => {
      ctx.beginPath();
      ctx.moveTo(-wid / 2, -5);
      ctx.quadraticCurveTo(-wid / 2 - 0.8 + curve, -len * 0.55, -wid * 0.42 + curve * 1.6, -len * 0.86);
      ctx.lineTo(curve * 1.9, -len);
      ctx.lineTo(wid * 0.42 + curve * 1.6, -len * 0.86);
      ctx.quadraticCurveTo(wid / 2 + 1 + curve, -len * 0.55, wid / 2, -5);
      ctx.closePath();
    }, metalGrad(ctx, -wid / 2, 0, wid / 2, 0, steel));
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(40,40,45,.5)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(curve * 0.3, -7); ctx.quadraticCurveTo(curve, -len * 0.5, curve * 1.3, -len * 0.78); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(wid / 2 - 0.6, -6); ctx.quadraticCurveTo(wid / 2 + curve, -len * 0.55, wid * 0.36 + curve * 1.6, -len * 0.86); ctx.stroke();
    if (q === 0) { ctx.fillStyle = 'rgba(110,60,25,.45)'; ctx.beginPath(); ctx.arc(0.5, -len * 0.35, 1.6, 0, Math.PI * 2); ctx.arc(-0.5, -len * 0.62, 1.2, 0, Math.PI * 2); ctx.fill(); }
  };
  const hilt = (gw, gl = 11) => {
    out(() => { ctx.beginPath(); ctx.rect(-2.2, -1, 4.4, gl); }, hiltCol);
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 0.6;
    for (let i = 0; i < gl / 2.8; i++) { ctx.beginPath(); ctx.moveTo(-2.2, 1 + i * 2.4); ctx.lineTo(2.2, 2.2 + i * 2.4); ctx.stroke(); }
    out(() => { ctx.beginPath(); ctx.moveTo(-gw / 2, -5.5); ctx.quadraticCurveTo(0, -7.5, gw / 2, -5.5); ctx.lineTo(gw / 2 - 1, -1.5); ctx.lineTo(-gw / 2 + 1, -1.5); ctx.closePath(); }, metalGrad(ctx, -gw / 2, 0, gw / 2, 0, bronze));
    out(() => { ctx.beginPath(); ctx.ellipse(0, gl + 0.5, 3.4, 2.6, 0, 0, Math.PI * 2); }, metalGrad(ctx, -3, gl - 2, 3, gl + 3, bronze));
  };
  const shaft = (from, to) => {
    const g = ctx.createLinearGradient(-2.2, 0, 2.2, 0);
    g.addColorStop(0, '#3a2715'); g.addColorStop(0.5, '#86603a'); g.addColorStop(1, '#2a1b0e');
    out(() => { ctx.beginPath(); ctx.rect(-1.9, to, 3.8, from - to); }, g);
    if (q >= 2) { ctx.fillStyle = bronze; ctx.fillRect(-2.2, to + 2, 4.4, 3); ctx.fillRect(-2.2, from - 5, 4.4, 3); }
  };
  let len = 44;
  switch (w.b) {
    case 'gladius': len = 44; hilt(13); blade(44, 6.4); break;
    case 'pugio': len = 32; hilt(11); blade(32, 5.4); break;
    case 'spatha': len = 60; hilt(14); blade(60, 5.6); break;
    case 'longsword': len = 80; hilt(16, 21); blade(80, 7); break;
    case 'axe': {
      len = 82; shaft(24, -76); glow();
      const g2 = metalGrad(ctx, -4, -70, 22, -70, steel);
      out(() => {
        ctx.beginPath();
        ctx.moveTo(1.8, -60); ctx.quadraticCurveTo(10, -60, 16, -52); ctx.quadraticCurveTo(25, -68, 18, -86);
        ctx.quadraticCurveTo(10, -76, 1.8, -77); ctx.closePath();
      }, g2);
      out(() => { ctx.beginPath(); ctx.moveTo(-1.8, -64); ctx.lineTo(-11, -69); ctx.lineTo(-1.8, -73); ctx.closePath(); }, g2);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(16.5, -53.5); ctx.quadraticCurveTo(23.5, -68, 17.5, -84); ctx.stroke();
      break;
    }
    case 'arcus': case 'compBow': {
      // лук на земле (в руках его рисует drawBow)
      len = 40;
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4.6;
      ctx.beginPath(); ctx.moveTo(-7, 34); ctx.quadraticCurveTo(-14, 0, -7, -34); ctx.stroke();
      ctx.strokeStyle = '#6a4728'; ctx.lineWidth = 3; ctx.stroke();
      strokeLine(ctx, [{ x: -7, y: 34 }, { x: -7, y: -34 }], 'rgba(235,225,200,.7)', 0.8);
      break;
    }
    case 'sica': {
      len = 42; hilt(11); glow();
      out(() => {
        ctx.beginPath();
        ctx.moveTo(-3, -5); ctx.quadraticCurveTo(-4.4, -25, 9, -40); ctx.lineTo(11.5, -37.5);
        ctx.quadraticCurveTo(3.6, -24, 3, -5); ctx.closePath();
      }, metalGrad(ctx, -4, 0, 8, 0, steel));
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(2.5, -6); ctx.quadraticCurveTo(3, -24, 10.6, -37.2); ctx.stroke();
      break;
    }
    case 'trident': {
      len = 104; shaft(62, -80); glow();
      const g2 = metalGrad(ctx, -10, 0, 10, 0, steel);
      out(() => { ctx.beginPath(); ctx.moveTo(-10, -79); ctx.quadraticCurveTo(0, -84, 10, -79); ctx.lineTo(10, -82); ctx.quadraticCurveTo(0, -87, -10, -82); ctx.closePath(); }, g2);
      for (const x of [-9, 0, 9]) {
        const k = Math.abs(x) * 0.5;
        out(() => {
          ctx.beginPath();
          ctx.moveTo(x - 1.6, -82); ctx.lineTo(x * 1.05 - 1.2, -100 + k); ctx.lineTo(x * 1.05 - 3.2, -97 + k);
          ctx.lineTo(x * 1.05, -106 + k); ctx.lineTo(x * 1.05 + 1.6, -100 + k); ctx.lineTo(x + 1.6, -82);
          ctx.closePath();
        }, g2);
      }
      ctx.shadowBlur = 0;
      break;
    }
    case 'spear': {
      len = 104; shaft(62, -80); glow();
      out(() => { ctx.beginPath(); ctx.moveTo(-2.2, -80); ctx.quadraticCurveTo(-6.5, -90, 0, -106); ctx.quadraticCurveTo(6.5, -90, 2.2, -80); ctx.closePath(); }, metalGrad(ctx, -6, 0, 6, 0, steel));
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(40,40,45,.5)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(0, -82); ctx.lineTo(0, -103); ctx.stroke();
      break;
    }
    case 'mace': {
      len = 42; shaft(11, -30); glow();
      out(() => {
        ctx.beginPath();
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, rr = i % 2 ? 5 : 9; ctx.lineTo(Math.cos(a) * rr, -36 + Math.sin(a) * rr * 1.1); }
        ctx.closePath();
      }, metalGrad(ctx, -8, -36, 8, -36, steel));
      ctx.shadowBlur = 0;
      break;
    }
  }
  const m = ctx.getTransform();
  const tf = (x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
  const res = { base: tf(0, -len * 0.3), tip: tf(0, -len) };
  ctx.restore();
  return res;
}

// Упавшее на песок снаряжение (для коленопреклонённых)
function drawDroppedGear(ctx, spec, x, groundY, sc, facing) {
  if (spec.offhand && (spec.offhand.b === 'scutum' || spec.offhand.b === 'parma')) {
    ctx.save();
    ctx.translate(x - 44 * sc * facing, groundY);
    ctx.scale(sc, sc * 0.32);
    const big = spec.offhand.b === 'scutum';
    ctx.beginPath(); ctx.ellipse(0, -8, big ? 32 : 20, big ? 54 : 24, 0.25, 0, Math.PI * 2);
    ctx.fillStyle = shade(PAINT[spec.look.paint], -0.2); ctx.fill();
    ctx.strokeStyle = BRONZE_Q[spec.offhand.q]; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
  }
  if (spec.weapon) {
    ctx.save();
    ctx.translate(x + 40 * sc * facing, groundY - 2);
    ctx.scale(sc * facing, sc);
    drawWeapon(ctx, spec.weapon, { x: 0, y: 0 }, Math.PI / 2 + 0.08);
    ctx.restore();
  }
}

// ------------------------------------------------------------
//  Портреты (кешируются)
// ------------------------------------------------------------
const PORTRAITS = new Map();
function portrait(g, w = 96, h = 120, opts = {}) {
  ensureLook(g);
  const eqKey = Object.values(g.equip || {}).map(i => (i ? i.base + i.q : '-')).join(',');
  const key = [g.id, g.cls, JSON.stringify(g.look), eqKey, g.attrs.str, g.attrs.end, w, h, opts.bust ? 1 : 0, opts.gray ? 1 : 0, opts.enemy ? 1 : 0].join('|');
  if (PORTRAITS.has(key)) return PORTRAITS.get(key);
  const dpr = 2;
  const c = document.createElement('canvas');
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const bg = ctx.createRadialGradient(w * 0.45, h * 0.35, 4, w * 0.5, h * 0.5, h * 0.8);
  bg.addColorStop(0, opts.enemy ? '#3b2420' : '#3d3022'); bg.addColorStop(1, '#0d0a08');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const sand = ctx.createLinearGradient(0, h * 0.82, 0, h);
  sand.addColorStop(0, 'rgba(150,115,70,0)'); sand.addColorStop(1, 'rgba(150,115,70,.35)');
  ctx.fillStyle = sand; ctx.fillRect(0, h * 0.75, w, h * 0.25);
  const spec = figureSpec(g);
  const sc = opts.bust ? h / 82 : h / 215;
  const gy = opts.bust ? h * 2.1 : h * 0.96;
  drawFigure(ctx, spec, stancePose(g.cls), w * (opts.bust ? 0.4 : 0.45), gy, { scale: sc, facing: 1, filter: opts.gray ? 'grayscale(1) brightness(.75)' : null });
  const url = c.toDataURL('image/png');
  if (PORTRAITS.size > 300) PORTRAITS.clear();
  PORTRAITS.set(key, url);
  return url;
}

// ------------------------------------------------------------
//  Изображения предметов (кешируются). Оружие и щиты — сами по себе,
//  доспехи, шлемы, поножи, пояса — на деревянном тренировочном манекене
// ------------------------------------------------------------
const ICONS = new Map();
// [длина за кистью, длина перед кистью] — чтобы оружие помещалось целиком
const WEAPON_SPAN = { gladius: [13, 44], pugio: [12, 32], spatha: [14, 60], sica: [12, 42], trident: [62, 106], spear: [62, 106], mace: [11, 45], longsword: [22, 80], axe: [24, 86] };
function itemIcon(it, size = 52) {
  const B = ITEM_BASES[it.base];
  const look = B.look || it.base;
  const key = it.base + '|' + it.q + '|' + size;
  if (ICONS.has(key)) return ICONS.get(key);
  const W = size, dpr = 2;
  const c = document.createElement('canvas');
  c.width = W * dpr; c.height = W * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const bg = ctx.createRadialGradient(W * 0.5, W * 0.42, 2, W * 0.5, W * 0.5, W * 0.72);
  bg.addColorStop(0, B.artifact ? '#3a2448' : B.rare ? '#1f3a3a' : '#3a2f24'); bg.addColorStop(1, '#0e0b08');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, W);
  const eqv = { b: look, q: it.q };
  const spec = {
    cls: null, look: { skin: 0, hair: 0, beard: false, bald: true, cloth: 0, paint: 2, crest: 0 }, m: 1, gth: 1, dummy: true,
    weapon: null, offhand: null, helmet: null, armor: null, arms: null, legs: null, belt: null, twoHanded: false, ranged: false,
  };
  ctx.save();
  if (B.slot === 'weapon' && !B.ranged) {
    // клинок по диагонали снизу-слева вверх-вправо
    const [back, front] = WEAPON_SPAN[look] || [12, 48];
    const k = W * 1.22 / (back + front), m = (front - back) / 2 * k * Math.SQRT1_2;
    ctx.translate(W * 0.5 - m, W * 0.5 + m);
    ctx.scale(k, k);
    drawWeapon(ctx, eqv, { x: 0, y: 0 }, Math.PI * 0.75);
  } else if (B.ranged) {
    // лук с наложенной стрелой
    const k = W / 92;
    ctx.translate(W * 0.42, W * 0.5); ctx.rotate(-0.35); ctx.scale(k, k);
    drawBow(ctx, eqv, { hand: { x: 0, y: 0 }, dir: Math.PI / 2, draw: 0.55, pull: 7 + 0.55 * 36, len: look === 'compBow' ? 36 : 42 });
  } else if (look === 'pharetra') {
    // колчан со стрелами
    const k = W / 70;
    ctx.translate(W * 0.5, W * 0.88); ctx.rotate(0.35); ctx.scale(k, k);
    const q = it.q, len = 52;
    for (let i = 0; i < 5; i++) {
      const x = -6 + i * 3, y = -len - 6 - (i % 2) * 4;
      strokeLine(ctx, [{ x, y: -len + 4 }, { x, y }], '#8a6a42', 1.4);
      ctx.fillStyle = i % 2 ? '#e6dcc6' : (q >= 2 ? CREST[0] : '#b9a988');
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2.4, y + 6); ctx.lineTo(x, y + 9); ctx.lineTo(x + 2.4, y + 6); ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.rect(-9, -len, 18, len);
    const lg = ctx.createLinearGradient(-9, 0, 9, 0), lc = B.rare ? '#4a3a1a' : q >= 3 ? '#6a2a1c' : '#5a3a20';
    lg.addColorStop(0, shade(lc, -0.4)); lg.addColorStop(0.5, shade(lc, 0.15)); lg.addColorStop(1, shade(lc, -0.35));
    ctx.fillStyle = lg; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = B.rare || q >= 4 ? '#f3d27a' : BRONZE_Q[q];
    ctx.fillRect(-9.5, -len, 19, 4); ctx.fillRect(-9.5, -4, 19, 4); ctx.fillRect(-9.5, -len * 0.55, 19, 3);
  } else if (look === 'scutum' || look === 'parma') {
    const big = look === 'scutum', k = W / (big ? 118 : 60);
    ctx.translate(W * 0.5 - (big ? 11 : 7) * k, W * 0.5); ctx.scale(k, k);
    drawShield(ctx, eqv, { handN: { x: 0, y: 0 }, thFN: Math.PI / 2 }, spec);
  } else if (look === 'rete') {
    const k = W / 56;
    ctx.translate(W * 0.5, W * 0.5 - 21 * k); ctx.scale(k, k);
    drawNetBundle(ctx, { x: 0, y: 0 }, 0);
  } else if (look === 'pugio') {
    const k = W * 1.22 / 44, m = 10 * k * Math.SQRT1_2;
    ctx.translate(W * 0.5 - m, W * 0.5 + m); ctx.scale(k, k);
    drawWeapon(ctx, eqv, { x: 0, y: 0 }, Math.PI * 0.75);
  } else {
    // манекен: центр нужной части тела — в центр картинки
    const slot = B.slot;
    spec[slot] = eqv;
    if (slot === 'arms') spec.armsSide = 'N';
    const pose = { ...BASE_POSE, nA: 0.75, nE: 0.9 };
    const S = skeleton(pose);
    const at2 = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const view = {
      helmet: [{ x: S.headC.x, y: S.headC.y - 7 }, 46],
      armor: [at2(S.waist, S.sh, 0.4), 80],
      arms: [S.elN, 64],
      legs: [at2(S.knN, S.anN, 0.25), 92],
      belt: [at2(S.hip, S.waist, 0.65), 52],
      offhand: [{ x: S.sh.x - 10, y: S.sh.y + 14 }, 80],
    }[slot] || [S.waist, 80];
    const [cpt, box] = view;
    const k = W / box;
    const facing = slot === 'offhand' ? -1 : 1;
    const x = W / 2 - cpt.x * k * facing, gy = W / 2 - cpt.y * k + S.ground * k;
    drawFigure(ctx, spec, pose, x, gy, { scale: k, facing, dummy: true });
  }
  ctx.restore();
  // рамка по редкости
  ctx.strokeStyle = B.artifact ? '#c77dff' : B.rare ? '#5fd0c0' : ['#6f675c', '#a89f90', '#8fb46a', '#6aa2d4', '#d49a3c'][it.q];
  ctx.lineWidth = 1.5; ctx.strokeRect(0.75, 0.75, W - 1.5, W - 1.5);
  const url = c.toDataURL('image/png');
  if (ICONS.size > 400) ICONS.clear();
  ICONS.set(key, url);
  return url;
}
