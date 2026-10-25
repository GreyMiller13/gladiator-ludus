// ============================================================
//  Арена: фон амфитеатра, живая толпа, покадровая хореография боя, частицы
// ============================================================

const AW = 1280, AH = 620, HORIZON = 300, SAND_TOP = 330;
const depthScale = y => 0.98 + (y - 380) * 0.0014;

// Звук: безопасный вызов, если модуль звука недоступен
const sfx = (name, opts) => { if (typeof SFX !== 'undefined') SFX.play(name, opts); };
const panOf = x => clamp((x - AW / 2) / (AW / 2), -1, 1) * 0.6;

// Сетка поля на песке: ряды уходят вглубь, столбцы сужаются с перспективой
const GRID = { y0: 394, dy: 52, cw: 86 };
const rowY = r => GRID.y0 + r * GRID.dy;
const colW = y => GRID.cw * depthScale(y);
const gridX = (k, y) => AW / 2 + (k - (FIELD_COLS - 1) / 2) * colW(y);
const cellPos = (c, r) => { const y = rowY(r); return { x: gridX(c, y), y }; };
// Экранная точка → клетка (или null)
function cellAt(x, y) {
  const r = Math.round((y - GRID.y0) / GRID.dy);
  if (r < 0 || r >= FIELD_ROWS || Math.abs(y - rowY(r)) > GRID.dy * 0.62) return null;
  const c = Math.round((x - AW / 2) / colW(rowY(r)) + (FIELD_COLS - 1) / 2);
  return c >= 0 && c < FIELD_COLS ? { c, r } : null;
}


// ============================================================
//  Отображение боя
// ============================================================
class ArenaView {
  constructor(canvas, battle) {
    this.canvas = canvas;
    this.b = battle;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = AW * this.dpr; canvas.height = AH * this.dpr;
    this.ctx = canvas.getContext('2d');
    this.speed = 1; this.skip = false;
    this.parts = []; this.texts = []; this.nets = []; this.arrows = []; this.dazes = [];
    this.shake = 0; this.crowdEx = 0.2; this.active = null;
    this.banner = null; this.big = null;

    this.bg = document.createElement('canvas');
    this.bg.width = AW * this.dpr; this.bg.height = AH * this.dpr;
    const bctx = this.bg.getContext('2d'); bctx.scale(this.dpr, this.dpr);
    this.crowd = paintArena(bctx, battle.event.tier);
    this.crowdGroups = CROWD_CLOTH.map((_, i) => this.crowd.filter(p => p.c === i));
    this.decals = document.createElement('canvas');
    this.decals.width = AW * this.dpr; this.decals.height = AH * this.dpr;
    this.dctx = this.decals.getContext('2d'); this.dctx.scale(this.dpr, this.dpr);
    this.vignette = document.createElement('canvas');
    this.vignette.width = AW; this.vignette.height = AH;
    const v = this.vignette.getContext('2d');
    const vg = v.createRadialGradient(AW / 2, AH * 0.55, AH * 0.35, AW / 2, AH * 0.55, AW * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,4,2,.62)');
    v.fillStyle = vg; v.fillRect(0, 0, AW, AH);

    this.fighters = [];
    for (const u of battle.units) {
      const home = cellPos(u.c, u.r);
      this.fighters.push(makeFighter(u, home, u.side === 'player' ? 1 : -1));
    }
    this.obstacles = battle.field.obstacles.map(o => ({ ...o, ...cellPos(o.c, o.r) }));
    // подсветка для расстановки и ручного боя
    this.hl = { grid: true, zone: null, reach: null, targets: null, ability: null, selected: null, hover: null, hint: null };
    this.onPick = null;
    const toArena = e => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * AW, y: (e.clientY - r.top) / r.height * AH };
    };
    canvas.addEventListener('mousemove', e => { const p = toArena(e); this.hl.hover = this.pickAt(p.x, p.y); canvas.style.cursor = this.onPick && this.hl.hover ? 'pointer' : 'default'; });
    canvas.addEventListener('mouseleave', () => { this.hl.hover = null; });
    canvas.addEventListener('click', e => { if (!this.onPick) return; const p = toArena(e); const hit = this.pickAt(p.x, p.y); if (hit) this.onPick(hit); });
    const venue = typeof VENUES !== 'undefined' ? VENUES[clamp(battle.event.tier, 0, VENUES.length - 1)] : null;
    if (typeof SFX !== 'undefined') SFX.crowdStart({ size: venue ? venue.crowdSize : battle.event.tier });
    this.running = true;
    this.last = performance.now();
    this.now = this.last;
    const loop = t => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t; this.now = t;
      this.update(dt);
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  destroy() { this.running = false; if (typeof SFX !== 'undefined') SFX.crowdStop(); }
  F(uid) { return this.fighters.find(f => f.uid === uid); }

  // Что под курсором: живой боец (по силуэту) или клетка поля
  // Силуэты в соседних рядах перекрываются: из нескольких бойцов под курсором
  // выбираем доступную цель, затем того, на чьей клетке курсор, затем ближнего к зрителю.
  // Если курсор над свободной клеткой, куда можно шагнуть (или поставить бойца при расстановке),
  // а под ним лишь чужая для этой клетки фигура — побеждает клетка: так легко шагнуть на ряд выше.
  pickAt(x, y) {
    const cell = cellAt(x, y);
    const hits = this.fighters.filter(f => {
      if (!f.unit.alive || f.state !== 'idle') return false;
      const s = this.sc(f);
      return Math.abs(x - f.x) < 34 * s && y < f.y + 6 && y > f.y - 172 * s;
    });
    if (hits.length) {
      const H = this.hl, aim = H.ability || H.targets;
      const rank = f => (aim && aim.has(f.uid) ? 4 : 0) + (cell && f.unit.c === cell.c && f.unit.r === cell.r ? 2 : 0) + f.y / 10000;
      const f = hits.reduce((a, b) => (rank(b) > rank(a) ? b : a));
      const onOwnCell = cell && f.unit.c === cell.c && f.unit.r === cell.r;
      if (cell && !onOwnCell && !(aim && aim.has(f.uid)) && this.freeCellFor(cell)) return { uid: null, ...cell };
      return { uid: f.uid, c: f.unit.c, r: f.unit.r };
    }
    return cell ? { uid: null, ...cell } : null;
  }
  // Клетка, на которую сейчас можно шагнуть или поставить выбранного бойца
  freeCellFor(cell) {
    const H = this.hl;
    if (H.reach) { const n = H.reach.get(cellKey(cell.c, cell.r)); return !!(n && n.d > 0); }
    if (H.zone && H.selected) {
      return H.zone.includes(cell.c) && !this.b.isBlocked(cell.c, cell.r) && !this.b.units.some(u => u.alive && u.c === cell.c && u.r === cell.r);
    }
    return false;
  }
  // Переставить бойца (расстановка) — сразу, без анимации
  placeFighter(f, c, r) {
    f.home = cellPos(c, r); f.x = f.home.x; f.y = f.home.y; f.move = null;
  }
  // Повернуть стоящих бойцов к ближайшему противнику
  faceFoes() {
    for (const f of this.fighters) {
      if (!f.unit.alive || f.state !== 'idle') continue;
      const foes = this.fighters.filter(o => o.side !== f.side && o.unit.alive);
      if (!foes.length) continue;
      const n = foes.reduce((a, b) => (Math.abs(b.x - f.x) + Math.abs(b.y - f.y) * 2 < Math.abs(a.x - f.x) + Math.abs(a.y - f.y) * 2 ? b : a));
      f.baseFacing = Math.sign(n.x - f.x) || f.baseFacing;
      if (!f.move && !f.clip) f.facing = f.baseFacing;
    }
  }
  sc(f) { return depthScale(f.y); }

  // --------------------------------------------------------
  //  Время и клипы
  // --------------------------------------------------------
  wait(ms) {
    if (this.skip) return Promise.resolve();
    return new Promise(r => setTimeout(r, ms / this.speed));
  }
  clip(f, name, opts = {}) { return startClip(f, name, opts, this.skip); }
  moveTo(f, x, y, ms, run = true) {
    f.move = { x0: f.x, y0: f.y, x1: x, y1: y, t: 0, dur: Math.max(0.001, (this.skip ? 1 : ms) / 1000), run };
    return this.wait(ms);
  }
  float(f, text, kind) {
    this.texts.push({ x: f.x + (Math.random() - 0.5) * 24, y: f.topY - 8, text, kind, t0: performance.now(), dur: 1300 / Math.max(1, this.speed * 0.7) });
  }
  excite(v) { this.crowdEx = Math.min(1.6, this.crowdEx + v); }
  chest(f) { const s = this.sc(f); return { x: f.x + f.facing * 4 * s, y: f.y - 118 * s }; }

  blood(f, fromDir, n, heavy = false) {
    const c = this.chest(f);
    for (let i = 0; i < n; i++) {
      const sp = 120 + Math.random() * (heavy ? 320 : 200);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      this.parts.push({
        kind: 'blood', x: c.x + (Math.random() - 0.5) * 10, y: c.y + (Math.random() - 0.5) * 20,
        vx: fromDir * Math.abs(Math.cos(a)) * sp * 0.9 + (Math.random() - 0.5) * 60, vy: Math.sin(a) * sp * 0.8,
        gy: f.y + (Math.random() - 0.3) * 14, size: 1.4 + Math.random() * (heavy ? 3 : 2.2), life: 2,
      });
    }
  }
  drip(f, n) {
    const c = this.chest(f);
    for (let i = 0; i < n; i++) {
      this.parts.push({ kind: 'blood', x: c.x + (Math.random() - 0.5) * 16, y: c.y + 10 + Math.random() * 30, vx: (Math.random() - 0.5) * 30, vy: 20 + Math.random() * 40, gy: f.y + (Math.random() - 0.5) * 10, size: 1.3 + Math.random() * 1.6, life: 2 });
    }
  }
  sparks(x, y, n, dir) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 150 + Math.random() * 380;
      this.parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp + dir * 80, vy: Math.sin(a) * sp - 80, life: 0.25 + Math.random() * 0.25, max: 0.5 });
    }
  }
  dust(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.parts.push({ kind: 'dust', x: x + (Math.random() - 0.5) * 60, y: y - Math.random() * 8, vx: (Math.random() - 0.5) * 60, vy: -10 - Math.random() * 25, size: 6 + Math.random() * 10, life: 0.9 + Math.random() * 0.6, max: 1.5 });
    }
  }
  stain(x, y, rx, ry, a = 0.5) {
    const d = this.dctx;
    d.fillStyle = `rgba(${70 + Math.random() * 30 | 0},10,8,${a})`;
    d.beginPath(); d.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); d.fill();
  }
  pool(f, k = 1) {
    const s = this.sc(f);
    const x = f.x - f.facing * 34 * s;
    for (let i = 0; i < 5; i++) this.stain(x + (Math.random() - 0.5) * 40 * s, f.y - 2 + (Math.random() - 0.5) * 6, (12 + Math.random() * 16) * s * k, (3 + Math.random() * 4) * s * k, 0.32);
  }

  // --------------------------------------------------------
  //  Обновление и отрисовка кадра
  // --------------------------------------------------------
  update(dt) {
    for (const f of this.fighters) {
      if (f.move) {
        const m = f.move;
        m.t += dt;
        const p = clamp(m.t / m.dur, 0, 1);
        const e = p * p * (3 - 2 * p);
        const nx = m.x0 + (m.x1 - m.x0) * e, ny = m.y0 + (m.y1 - m.y0) * e;
        // фаза бега привязана к пройденному пути — ноги не скользят
        const d = (nx - f.x) * f.facing;
        f.runPhase += (d >= 0 ? 1 : -1) * Math.hypot(nx - f.x, ny - f.y) / (118 * this.sc(f)) * CLIPS.run.len;
        f.x = nx; f.y = ny;
        if (p >= 1) f.move = null;
      }
      advanceFighter(f, dt, this.speed);
    }
    this.parts = this.parts.filter(p => {
      p.life -= dt;
      if (p.kind === 'blood') {
        p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y >= p.gy && p.vy > 0) { this.stain(p.x, p.gy, p.size * 1.6, p.size * 0.6, 0.55); return false; }
      } else if (p.kind === 'spark') {
        p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      } else if (p.kind === 'dust') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.size += dt * 22;
      }
      return p.life > 0;
    });
    const now = this.now;
    this.texts = this.texts.filter(t => now - t.t0 < t.dur);
    this.nets = this.nets.filter(n => !n.dead);
    this.arrows = this.arrows.filter(a => !a.dead);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.crowdEx = Math.max(0.12, this.crowdEx - dt * 0.35);
    if (typeof SFX !== 'undefined') SFX.crowdSet(this.crowdEx);
  }

  draw() {
    const ctx = this.ctx, d = this.dpr, now = this.now;
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0, sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    ctx.setTransform(d, 0, 0, d, sx * d, sy * d);
    ctx.drawImage(this.bg, 0, 0, AW, AH);
    this.drawCrowd(ctx, now);
    ctx.drawImage(this.decals, 0, 0, AW, AH);

    this.drawGrid(ctx, now);
    const act = this.active && this.F(this.active);
    if (act && act.state === 'idle') {
      const s = this.sc(act);
      ctx.strokeStyle = `rgba(230,190,120,${0.45 + Math.sin(now / 200) * 0.2})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(act.x, act.y + 2, 46 * s, 11 * s, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (const n of this.nets) this.drawNet(ctx, n, now);
    for (const a of this.arrows) this.drawArrow(ctx, a, now);

    const depth = o => o.kind === 'ob' ? o.y + 1 : o.y - (o.state === 'idle' ? 0 : 40);
    const order = [...this.fighters, ...this.obstacles.map(o => ({ ...o, kind: 'ob' }))].sort((a, b) => depth(a) - depth(b));
    for (const o of order) { if (o.kind === 'ob') this.drawObstacle(ctx, o); else this.drawFighter(ctx, o); }
    this.drawHint(ctx);

    for (const p of this.parts) this.drawPart(ctx, p);
    for (const f of this.fighters) this.drawDaze(ctx, f, now);
    for (const f of this.fighters) this.drawBar(ctx, f);
    for (const t of this.texts) this.drawText(ctx, t, now);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.drawImage(this.vignette, 0, 0, AW, AH);
    if (this.splat) this.drawSplat(ctx, now);
    if (this.banner) this.drawBanner(ctx, now);
    if (this.big) this.drawBig(ctx, now);
  }

  // Сетка поля, зона расстановки, достижимые клетки, цели
  cellPath(ctx, c, r, inset = 0) {
    const yt = rowY(r) - GRID.dy / 2 + inset, yb = rowY(r) + GRID.dy / 2 - inset;
    const k0 = c - 0.5, k1 = c + 0.5;
    const ins = (y, k, side) => gridX(k, y) + side * inset * 1.4;
    ctx.beginPath();
    ctx.moveTo(ins(yt, k0, 1), yt); ctx.lineTo(ins(yt, k1, -1), yt);
    ctx.lineTo(ins(yb, k1, -1), yb); ctx.lineTo(ins(yb, k0, 1), yb);
    ctx.closePath();
  }
  drawGrid(ctx, now) {
    const H = this.hl;
    if (!H.grid) return;
    ctx.save();
    // тонкие линии сетки
    ctx.strokeStyle = 'rgba(60,35,15,.3)'; ctx.lineWidth = 1;
    for (let r = 0; r <= FIELD_ROWS; r++) {
      const y = rowY(r) - GRID.dy / 2;
      ctx.beginPath(); ctx.moveTo(gridX(-0.5, y), y); ctx.lineTo(gridX(FIELD_COLS - 0.5, y), y); ctx.stroke();
    }
    for (let k = -0.5; k <= FIELD_COLS - 0.5; k++) {
      const y0 = rowY(0) - GRID.dy / 2, y1 = rowY(FIELD_ROWS - 1) + GRID.dy / 2;
      ctx.beginPath(); ctx.moveTo(gridX(k, y0), y0); ctx.lineTo(gridX(k, y1), y1); ctx.stroke();
    }
    if (H.zone) {
      ctx.fillStyle = `rgba(230,185,95,${0.2 + Math.sin(now / 350) * 0.05})`; ctx.strokeStyle = 'rgba(240,200,120,.55)'; ctx.lineWidth = 1.2;
      for (const c of H.zone) for (let r = 0; r < FIELD_ROWS; r++) { if (this.b.isBlocked(c, r)) continue; this.cellPath(ctx, c, r, 2); ctx.fill(); ctx.stroke(); }
    }
    if (H.reach) {
      const pulse = 0.3 + Math.sin(now / 300) * 0.06;
      ctx.lineWidth = 1.6;
      for (const n of H.reach.values()) {
        this.cellPath(ctx, n.c, n.r, 3);
        ctx.fillStyle = n.d === 0 ? 'rgba(236,199,126,.3)' : `rgba(70,130,200,${pulse})`; ctx.fill();
        ctx.strokeStyle = n.d === 0 ? 'rgba(236,199,126,.85)' : 'rgba(110,170,235,.8)'; ctx.stroke();
      }
    }
    const hv = H.hover;
    if (hv && (H.zone || H.reach)) {
      this.cellPath(ctx, hv.c, hv.r, 2);
      ctx.strokeStyle = 'rgba(255,235,190,.9)'; ctx.lineWidth = 2; ctx.stroke();
    }
    // кольца под целями: красные — удар, золотые — умение
    const ring = (uid, color) => {
      const f = this.F(uid); if (!f || !f.unit.alive) return;
      const s = this.sc(f);
      ctx.strokeStyle = color; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(f.x, f.y + 2, 44 * s, 11 * s, 0, 0, Math.PI * 2); ctx.stroke();
    };
    if (H.targets) for (const uid of H.targets) ring(uid, `rgba(230,80,60,${0.6 + Math.sin(now / 200) * 0.25})`);
    if (H.ability) for (const uid of H.ability) ring(uid, `rgba(240,200,90,${0.6 + Math.sin(now / 200) * 0.25})`);
    if (H.selected) ring(H.selected, 'rgba(255,240,200,.95)');
    ctx.restore();
  }
  // Подсказка у курсора (например, шанс попадания)
  drawHint(ctx) {
    let h = this.hintFn && this.hl.hover ? this.hintFn(this.hl.hover) : this.hl.hint;
    // подсказка по препятствию под курсором
    const hv = this.hl.hover;
    const ob = !h && hv && !hv.uid && this.b.obstacleAt(hv.c, hv.r);
    if (ob) {
      const p = cellPos(ob.c, ob.r);
      h = isHigh(ob.type)
        ? { text: `${OBSTACLES[ob.type].name}: высокое — не пройти и не прострелить`, x: p.x, y: p.y + 26, color: '#e8c18a' }
        : { text: `${OBSTACLES[ob.type].name}: низкое — не пройти, но стрелять поверх можно`, x: p.x, y: p.y + 26, color: '#bcd6ee' };
    }
    if (!h) return;
    ctx.save();
    ctx.font = '700 14px "PT Serif", Georgia, serif';
    const w = ctx.measureText(h.text).width + 16;
    // у нижнего ряда подсказка не должна уходить за край поля
    const x = clamp(h.x - w / 2, 6, AW - w - 6), y = clamp(h.y, 20, AH - 10);
    ctx.fillStyle = 'rgba(12,8,5,.85)'; ctx.fillRect(x, y - 15, w, 22);
    ctx.strokeStyle = h.color || '#c9a25e'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y - 14.5, w - 1, 21);
    ctx.fillStyle = h.color || '#f0d49c'; ctx.textAlign = 'left'; ctx.fillText(h.text, x + 8, y + 1);
    ctx.restore();
  }

  // Препятствия: у каждой арены свои. Высокие закрывают выстрел, низкие — нет.
  // Каждое стоит на песке: контактная тень, наметённый к основанию песок, без «парения»
  drawObstacle(ctx, o) {
    const s = depthScale(o.y);
    const tier = clamp(this.b.event.tier || 0, 0, 3);
    const SAND = ['#9d8f74', '#cfae7a', '#a8805a', '#dcc79c'][tier];
    const OL = 'rgba(28,16,6,.6)';
    const R = seededRng(o.c * 7919 + o.r * 104729 + o.type.length * 31 + 7);
    const rr = (a, b) => a + R() * (b - a);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(s, s);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const line = (w = 1) => { ctx.strokeStyle = OL; ctx.lineWidth = w; ctx.stroke(); };
    // тень: мягкая, отброшенная вправо (солнце слева), и плотная под самым основанием
    const shadow = w => {
      ctx.fillStyle = 'rgba(40,22,8,.22)';
      ctx.beginPath(); ctx.ellipse(w * 0.22, 2, w * 0.72, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(25,12,4,.42)';
      ctx.beginPath(); ctx.ellipse(0, 0.5, w * 0.5, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    };
    // песок, наметённый к основанию: прячет нижнюю кромку
    const drift = (w, h = 5) => {
      ctx.beginPath();
      ctx.moveTo(-w / 2 - 8, 2);
      ctx.bezierCurveTo(-w / 2 - 2, 1 - h, -w / 4, -h - 1, 0, -h + 0.5);
      ctx.bezierCurveTo(w / 4, -h + 1, w / 2 + 3, -h * 0.6, w / 2 + 9, 2);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -h, 0, 3);
      g.addColorStop(0, shade(SAND, 0.12)); g.addColorStop(1, shade(SAND, -0.12));
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = 'rgba(70,45,20,.25)';
      for (let i = 0; i < 9; i++) { ctx.fillRect(rr(-w / 2, w / 2), rr(-h, 1), 1, 1); }
    };
    const vgrad = (x0, x1, base, k = 1) => {
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, shade(base, 0.18 * k)); g.addColorStop(0.45, base); g.addColorStop(1, shade(base, -0.38 * k));
      return g;
    };
    // камень с гранями: плоское дно, неровный верх, светлая верхняя грань, тёмный бок
    const facetRock = (cx, w, h, base) => {
      const pts = [{ x: cx - w / 2, y: 0 }];
      const n = 7;
      for (let i = 1; i < n; i++) {
        const t = i / n, a = Math.PI * (1 - t);
        pts.push({ x: cx + Math.cos(a) * w / 2 * rr(0.82, 1.05), y: -Math.sin(a) * h * rr(0.78, 1.08) - (t < 0.5 ? h * 0.08 : 0) });
      }
      pts.push({ x: cx + w / 2, y: 0 });
      const path = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
      path();
      const g = ctx.createLinearGradient(cx - w / 2, -h, cx + w / 2, 0);
      g.addColorStop(0, shade(base, 0.22)); g.addColorStop(0.5, base); g.addColorStop(1, shade(base, -0.42));
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); path(); ctx.clip();
      // тёмный бок и светлая макушка
      ctx.fillStyle = 'rgba(20,12,6,.2)';
      ctx.beginPath(); ctx.moveTo(cx + w * 0.08, -h * 1.2); ctx.lineTo(cx + w * 0.7, -h * 1.2); ctx.lineTo(cx + w * 0.7, 2); ctx.lineTo(cx + w * 0.18, 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,245,225,.16)';
      ctx.beginPath(); ctx.moveTo(cx - w * 0.45, -h * 0.55); ctx.lineTo(cx - w * 0.05, -h * 1.1); ctx.lineTo(cx + w * 0.12, -h * 0.7); ctx.lineTo(cx - w * 0.2, -h * 0.35); ctx.closePath(); ctx.fill();
      // трещины и крапины
      ctx.strokeStyle = 'rgba(30,18,8,.35)'; ctx.lineWidth = 0.8;
      for (let i = 0; i < 2; i++) { const x = cx + rr(-w / 3, w / 3); ctx.beginPath(); ctx.moveTo(x, -h * rr(0.5, 0.9)); ctx.lineTo(x + rr(-6, 6), -h * rr(0.2, 0.45)); ctx.lineTo(x + rr(-4, 8), -h * rr(0, 0.15)); ctx.stroke(); }
      for (let i = 0; i < 22; i++) { ctx.fillStyle = R() < 0.5 ? 'rgba(20,12,6,.22)' : 'rgba(255,245,225,.18)'; ctx.fillRect(cx + rr(-w / 2, w / 2), -rr(0, h), 1.2, 1.2); }
      ctx.restore();
      path(); line(1);
    };
    // деревянный кол / брус с волокнами
    const stake = (x, w, h, base, tilt = 0, sharp = true) => {
      ctx.save(); ctx.translate(x, 0); ctx.rotate(tilt);
      ctx.beginPath(); ctx.moveTo(-w / 2, 2); ctx.lineTo(-w / 2 + 0.6, -h);
      if (sharp) ctx.lineTo(0, -h - w * 1.2); ctx.lineTo(w / 2 - 0.6, -h); ctx.lineTo(w / 2, 2); ctx.closePath();
      ctx.fillStyle = vgrad(-w / 2, w / 2, base); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(30,18,8,.28)'; ctx.lineWidth = 0.7;
      for (let i = 0; i < 3; i++) { const xx = -w / 3 + i * w / 3 + rr(-0.8, 0.8); ctx.beginPath(); ctx.moveTo(xx, 0); ctx.bezierCurveTo(xx + 1, -h * 0.3, xx - 1, -h * 0.6, xx, -h); ctx.stroke(); }
      ctx.fillStyle = 'rgba(30,18,8,.3)'; ctx.beginPath(); ctx.ellipse(rr(-1, 1), -h * rr(0.3, 0.7), 1.2, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      line(0.9);
      ctx.restore();
    };
    const ropeBand = (x0, x1, y) => {
      ctx.strokeStyle = '#6f5a3a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y - 1); ctx.stroke();
      ctx.strokeStyle = 'rgba(30,18,8,.4)'; ctx.lineWidth = 0.6;
      for (let x = x0; x < x1; x += 3) { ctx.beginPath(); ctx.moveTo(x, y - 1.2); ctx.lineTo(x + 1.6, y + 1.2); ctx.stroke(); }
    };
    // каменный блок (кладка, постаменты)
    const block = (x, y, w, h, base) => {
      ctx.beginPath(); ctx.rect(x, y, w, h);
      ctx.fillStyle = vgrad(x, x + w, base, 0.8); ctx.fill(); line(0.9);
      ctx.fillStyle = 'rgba(255,245,225,.18)'; ctx.fillRect(x + 1, y + 1, w - 2, 1.6);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(30,18,8,.18)'; ctx.fillRect(x + rr(1, w - 2), y + rr(1, h - 2), 1, 1); }
    };
    const shaft = (top, base, broken, w = 15) => {
      const p = () => {
        ctx.beginPath(); ctx.moveTo(-w, -22);
        if (broken) { ctx.lineTo(-w + 1, top + 8); ctx.lineTo(-w / 2, top); ctx.lineTo(0, top + 10); ctx.lineTo(w * 0.45, top - 5); ctx.lineTo(w - 1, top + 12); }
        else { ctx.lineTo(-w + 1, top); ctx.lineTo(w - 1, top); }
        ctx.lineTo(w, -22); ctx.closePath();
      };
      p(); ctx.fillStyle = vgrad(-w, w, base); ctx.fill();
      ctx.save(); p(); ctx.clip();
      ctx.strokeStyle = 'rgba(40,25,10,.22)'; ctx.lineWidth = 1;
      for (let x = -w + 4; x < w; x += 5.5) { ctx.beginPath(); ctx.moveTo(x, -24); ctx.lineTo(x, top + 14); ctx.stroke(); }
      for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(70,55,35,.18)'; ctx.beginPath(); ctx.ellipse(rr(-w + 3, w - 3), rr(top + 20, -30), rr(2, 5), rr(3, 8), 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      p(); line(1);
    };
    const W = { boulder: 76, palisade: 70, fence: 78, amphorae: 70, column: 50, herm: 46, lowWall: 82, fallenColumn: 86, crates: 76, mantlet: 70, barricade: 84, cart: 86, statue: 54, obelisk: 44, parapet: 86, rocks: 74 }[o.type] || 70;
    shadow(W);
    switch (o.type) {
      // --- Помпеи ---
      case 'boulder': {
        facetRock(-4, 62, 104, '#7b7264');
        facetRock(26, 30, 30, '#857b6b');
        ctx.fillStyle = 'rgba(80,95,55,.35)';
        ctx.beginPath(); ctx.ellipse(-14, -88, 9, 3, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(6, -40, 6, 2, -0.2, 0, Math.PI * 2); ctx.fill();
        drift(W, 6);
        break;
      }
      case 'palisade': {
        const n = 6;
        for (let i = 0; i < n; i++) stake(-30 + i * 12 + rr(-1, 1), 10, rr(98, 116), i % 2 ? '#6a4a2c' : '#73522f', rr(-0.03, 0.03));
        ropeBand(-36, 36, -30); ropeBand(-36, 36, -80);
        // подпорка сзади
        ctx.globalAlpha = 0.9; stake(30, 6, 70, '#5a3e24', 0.45, false); ctx.globalAlpha = 1;
        drift(W, 7);
        break;
      }
      case 'fence': {
        for (const x of [-30, 0, 30]) stake(x + rr(-2, 2), 6, rr(40, 46), '#6a4a2c', rr(-0.05, 0.05), false);
        // плетень из прутьев
        for (let y = -8; y > -38; y -= 4.5) {
          ctx.strokeStyle = shade('#8a6c45', rr(-0.15, 0.1)); ctx.lineWidth = 2.6;
          ctx.beginPath(); ctx.moveTo(-34, y + rr(-1, 1));
          for (let x = -34; x <= 34; x += 15) ctx.quadraticCurveTo(x + 7.5, y + (((x + 34) / 15) % 2 ? 2.2 : -2.2), x + 15, y + rr(-0.6, 0.6));
          ctx.stroke();
          ctx.strokeStyle = 'rgba(30,18,8,.35)'; ctx.lineWidth = 0.5; ctx.stroke();
        }
        drift(W, 5);
        break;
      }
      case 'amphorae': {
        const amph = (x, y, rot, scale = 1) => {
          ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale);
          ctx.beginPath(); ctx.moveTo(-3, -30); ctx.bezierCurveTo(-14, -26, -13, -10, -9, -2); ctx.quadraticCurveTo(-4, 8, 0, 12); ctx.quadraticCurveTo(4, 8, 9, -2); ctx.bezierCurveTo(13, -10, 14, -26, 3, -30); ctx.closePath();
          ctx.fillStyle = vgrad(-12, 12, '#a3613a'); ctx.fill(); line(0.9);
          ctx.strokeStyle = 'rgba(255,220,180,.2)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-7, -22); ctx.quadraticCurveTo(-10, -12, -6, -4); ctx.stroke();
          ctx.beginPath(); ctx.rect(-3, -37, 6, 8); ctx.fillStyle = '#8a4e2c'; ctx.fill(); line(0.8);
          ctx.strokeStyle = '#8a4e2c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, -34); ctx.quadraticCurveTo(-9, -32, -7, -26); ctx.moveTo(3, -34); ctx.quadraticCurveTo(9, -32, 7, -26); ctx.stroke();
          ctx.restore();
        };
        amph(-20, -8, -1.45); amph(18, -8, 1.42); amph(-3, -14, 0.06, 1.05);
        // черепки
        ctx.fillStyle = '#9a5a35';
        for (let i = 0; i < 4; i++) { const x = rr(-30, 30); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + rr(3, 6), -rr(1, 3)); ctx.lineTo(x + rr(5, 9), 0.5); ctx.closePath(); ctx.fill(); }
        drift(W, 4);
        break;
      }
      // --- Капуя ---
      case 'column': {
        const st = ['#b9a888', '#d8cdb4', '#bfb196', '#e8e0cc'][tier];
        block(-26, -12, 52, 12, shade(st, -0.2)); block(-21, -22, 42, 10, shade(st, -0.08));
        shaft(-128, st, true);
        drift(W, 4);
        break;
      }
      case 'herm': {
        const st = '#d4c8ad';
        block(-22, -42, 44, 42, shade(st, -0.06));
        ctx.beginPath(); ctx.moveTo(-11, -42); ctx.lineTo(-9, -102); ctx.lineTo(9, -102); ctx.lineTo(11, -42); ctx.closePath();
        ctx.fillStyle = vgrad(-11, 11, st); ctx.fill(); line(0.9);
        ctx.beginPath(); ctx.ellipse(0, -114, 10, 13, 0, 0, Math.PI * 2); ctx.fillStyle = vgrad(-10, 10, st); ctx.fill(); line(0.9);
        ctx.beginPath(); ctx.moveTo(-8, -110); ctx.quadraticCurveTo(0, -93, 8, -110); ctx.fillStyle = shade(st, -0.18); ctx.fill();
        ctx.fillStyle = 'rgba(40,25,10,.3)'; ctx.fillRect(-5, -118, 3, 1.4); ctx.fillRect(2, -118, 3, 1.4);
        ctx.fillStyle = 'rgba(40,25,10,.4)'; ctx.font = '7px serif'; ctx.textAlign = 'center'; ctx.fillText('HERMES', 0, -24);
        drift(W, 4);
        break;
      }
      case 'lowWall': {
        const st = '#cbbd9d';
        for (let i = 0; i < 4; i++) block(-40 + i * 20, -16, 20, 16, shade(st, rr(-0.08, 0.04)));
        for (let i = 0; i < 3; i++) block(-34 + i * 22, -31, 22, 15, shade(st, rr(-0.06, 0.06)));
        block(-38, -37, 76, 6, shade(st, 0.05));
        // выбитый камень
        ctx.fillStyle = 'rgba(25,14,6,.45)'; ctx.fillRect(12, -30, 7, 6);
        drift(W, 6);
        break;
      }
      case 'fallenColumn': {
        const st = tier >= 3 ? '#e4dcc8' : '#cfc2a3';
        ctx.save(); ctx.rotate(-0.05);
        ctx.beginPath(); ctx.moveTo(-40, -2); ctx.lineTo(-40, -28); ctx.lineTo(28, -30); ctx.lineTo(30, -2); ctx.closePath();
        const g = ctx.createLinearGradient(0, -30, 0, -2);
        g.addColorStop(0, shade(st, 0.15)); g.addColorStop(0.45, st); g.addColorStop(1, shade(st, -0.42));
        ctx.fillStyle = g; ctx.fill(); line(1);
        ctx.strokeStyle = 'rgba(40,25,10,.22)'; ctx.lineWidth = 1;
        for (const y of [-25, -19, -13, -7]) { ctx.beginPath(); ctx.moveTo(-38, y); ctx.lineTo(27, y - 0.6); ctx.stroke(); }
        ctx.beginPath(); ctx.ellipse(29, -16, 6, 14, 0, 0, Math.PI * 2); ctx.fillStyle = shade(st, -0.08); ctx.fill(); line(0.9);
        ctx.strokeStyle = 'rgba(40,25,10,.3)'; ctx.beginPath(); ctx.arc(29, -16, 3, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        facetRock(38, 12, 9, st); facetRock(-46, 9, 6, st);
        drift(W, 5);
        break;
      }
      // --- Статилиев амфитеатр ---
      case 'crates': {
        const wd = '#7a5632';
        const crate = (x, y, sz) => {
          ctx.beginPath(); ctx.rect(x, y, sz, sz); ctx.fillStyle = vgrad(x, x + sz, wd); ctx.fill(); line(1);
          ctx.strokeStyle = 'rgba(30,18,8,.35)'; ctx.lineWidth = 0.7;
          for (let yy = y + sz / 4; yy < y + sz; yy += sz / 4) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + sz, yy); ctx.stroke(); }
          ctx.strokeStyle = shade(wd, -0.35); ctx.lineWidth = 2.6;
          ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + sz - 3, y + sz - 3); ctx.stroke();
          ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.strokeRect(x + 2, y + 2, sz - 4, sz - 4);
          ctx.fillStyle = '#3a3a3a'; for (const [a, b] of [[3, 3], [sz - 4, 3], [3, sz - 4], [sz - 4, sz - 4]]) ctx.fillRect(x + a - 0.8, y + b - 0.8, 1.6, 1.6);
        };
        crate(-36, -38, 37); crate(1, -36, 35); crate(-22, -75, 37); crate(-12, -108, 33);
        drift(W, 5);
        break;
      }
      case 'mantlet': {
        stake(-22, 5, 44, '#5a3e24', 0.25, false); stake(22, 5, 44, '#5a3e24', -0.25, false);
        const p = () => { ctx.beginPath(); ctx.moveTo(-33, -4); ctx.lineTo(-30, -110); ctx.quadraticCurveTo(0, -121, 30, -110); ctx.lineTo(33, -4); ctx.closePath(); };
        p(); ctx.fillStyle = vgrad(-33, 33, '#7a5a34'); ctx.fill();
        ctx.save(); p(); ctx.clip();
        ctx.strokeStyle = 'rgba(40,24,10,.4)'; ctx.lineWidth = 1.1;
        for (let x = -30; x <= 30; x += 7) { ctx.beginPath(); ctx.moveTo(x, -120); ctx.lineTo(x + 1, 0); ctx.stroke(); }
        for (let y = -112; y < 0; y += 6) { ctx.strokeStyle = `rgba(${R() < 0.5 ? '255,230,190,.12' : '30,18,8,.25'})`; ctx.beginPath(); ctx.moveTo(-34, y); ctx.lineTo(34, y + 2); ctx.stroke(); }
        ctx.fillStyle = 'rgba(20,12,6,.18)'; ctx.fillRect(8, -125, 30, 130);
        ctx.restore();
        p(); line(1);
        ropeBand(-31, 31, -30); ropeBand(-30, 30, -82);
        drift(W, 6);
        break;
      }
      case 'barricade': {
        const wd = '#6b4a2a';
        for (const [x, a] of [[-18, -0.62], [18, 0.62], [0, 0.04]]) {
          ctx.save(); ctx.translate(x, -2); ctx.rotate(a); stake(0, 8, 42, wd, 0, true); ctx.restore();
        }
        ctx.beginPath(); ctx.rect(-40, -21, 80, 7); ctx.fillStyle = vgrad(-40, 40, shade(wd, -0.1)); ctx.fill(); line(1);
        ropeBand(-6, 6, -17);
        drift(W, 4);
        break;
      }
      case 'cart': {
        ctx.save(); ctx.rotate(-0.05);
        ctx.beginPath(); ctx.rect(-42, -34, 62, 32); ctx.fillStyle = vgrad(-42, 20, '#78552f'); ctx.fill(); line(1);
        ctx.strokeStyle = 'rgba(30,18,8,.35)'; ctx.lineWidth = 0.8;
        for (let y = -26; y < -2; y += 8) { ctx.beginPath(); ctx.moveTo(-42, y); ctx.lineTo(20, y); ctx.stroke(); }
        ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1.6; ctx.strokeRect(-40, -32, 58, 28);
        ctx.restore();
        // колесо стоит на ребре — нижняя точка на песке
        ctx.beginPath(); ctx.ellipse(30, -17, 9, 17, 0, 0, Math.PI * 2); ctx.strokeStyle = OL; ctx.lineWidth = 5; ctx.stroke();
        ctx.strokeStyle = '#6a4728'; ctx.lineWidth = 3.4; ctx.stroke();
        ctx.strokeStyle = '#5a3c20'; ctx.lineWidth = 1.4;
        for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI; ctx.beginPath(); ctx.moveTo(30 - Math.cos(a) * 8, -17 - Math.sin(a) * 16); ctx.lineTo(30 + Math.cos(a) * 8, -17 + Math.sin(a) * 16); ctx.stroke(); }
        // оглобля, воткнувшаяся в песок
        stake(-48, 4, 30, '#5a3e24', -0.9, false);
        drift(W, 5);
        break;
      }
      // --- Колизей ---
      case 'statue': {
        const mb = '#e6dfcc';
        block(-24, -34, 48, 34, shade(mb, -0.06)); block(-27, -40, 54, 7, shade(mb, 0.04));
        ctx.fillStyle = vgrad(-12, 12, mb);
        ctx.beginPath(); ctx.moveTo(-8, -40); ctx.lineTo(-10, -86); ctx.quadraticCurveTo(-14, -112, -4, -116); ctx.lineTo(6, -116); ctx.quadraticCurveTo(14, -110, 10, -86); ctx.lineTo(9, -40); ctx.closePath(); ctx.fill(); line(1);
        ctx.strokeStyle = 'rgba(60,45,30,.25)'; ctx.lineWidth = 0.8;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-7 + i * 4, -44); ctx.quadraticCurveTo(-8 + i * 4, -70, -5 + i * 4, -88); ctx.stroke(); }
        ctx.fillStyle = vgrad(-9, 9, mb); ctx.beginPath(); ctx.arc(1, -125, 8.5, 0, Math.PI * 2); ctx.fill(); line(0.9);
        ctx.strokeStyle = shade(mb, -0.3); ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-6, -129); ctx.quadraticCurveTo(1, -140, 9, -131); ctx.stroke();
        stake(16, 2.4, 106, '#b9975a', 0, true);
        ctx.fillStyle = 'rgba(40,25,10,.4)'; ctx.font = '7px serif'; ctx.textAlign = 'center'; ctx.fillText('VIRTVS', 0, -14);
        drift(W, 4);
        break;
      }
      case 'obelisk': {
        const st = '#c4a479';
        block(-21, -16, 42, 16, shade(st, -0.18));
        const p = () => { ctx.beginPath(); ctx.moveTo(-13, -16); ctx.lineTo(-8.5, -132); ctx.lineTo(0, -146); ctx.lineTo(8.5, -132); ctx.lineTo(13, -16); ctx.closePath(); };
        p(); ctx.fillStyle = vgrad(-13, 13, st); ctx.fill(); line(1);
        ctx.fillStyle = 'rgba(70,40,15,.38)';
        for (let y = -124; y < -26; y += 12) { ctx.fillRect(-4, y, 3, 5); ctx.fillRect(1.5, y + 4, 3, 3); ctx.fillRect(-2, y + 8, 4, 1.4); }
        ctx.fillStyle = '#d9b665'; ctx.beginPath(); ctx.moveTo(-8.5, -132); ctx.lineTo(0, -146); ctx.lineTo(8.5, -132); ctx.closePath(); ctx.fill(); line(0.8);
        drift(W, 4);
        break;
      }
      case 'parapet': {
        const mb = '#e2dac8';
        block(-42, -6, 84, 6, shade(mb, -0.15));
        for (let i = 0; i < 5; i++) {
          const x = -34 + i * 17;
          ctx.beginPath(); ctx.moveTo(x - 4, -29); ctx.quadraticCurveTo(x - 7.5, -16, x - 4, -6); ctx.lineTo(x + 4, -6); ctx.quadraticCurveTo(x + 7.5, -16, x + 4, -29); ctx.closePath();
          ctx.fillStyle = vgrad(x - 6, x + 6, mb); ctx.fill(); line(0.8);
        }
        block(-42, -36, 84, 7, shade(mb, 0.06));
        ctx.fillStyle = '#5a1d55'; ctx.fillRect(-42, -33, 84, 2);
        drift(W, 4);
        break;
      }
      default: {
        // камни
        const rock = ['#776e60', '#8a7f6e', '#6e6052', '#968c7c'][tier];
        facetRock(-14, 34, 26, rock); facetRock(16, 28, 18, shade(rock, 0.05)); facetRock(-2, 22, 36, shade(rock, -0.04));
        drift(W, 4);
      }
    }
    ctx.restore();
  }

  drawCrowd(ctx, now) {
    const ex = this.crowdEx;
    this.crowdGroups.forEach((group, ci) => {
      ctx.fillStyle = CROWD_CLOTH[ci];
      for (const p of group) {
        const jump = Math.max(0, Math.sin(now * 0.011 + p.ph)) * ex * 5 * p.s;
        ctx.fillRect(p.x - 2.1 * p.s, p.y - 6.5 * p.s - jump, 4.2 * p.s, 6.5 * p.s);
      }
    });
    for (const p of this.crowd) {
      const jump = Math.max(0, Math.sin(now * 0.011 + p.ph)) * ex * 5 * p.s;
      ctx.fillStyle = CROWD_SKIN[p.k];
      ctx.fillRect(p.x - 1.5 * p.s, p.y - 9.6 * p.s - jump, 3 * p.s, 3 * p.s);
      if (ex > 0.7 && (p.ph * 10 | 0) % 3 === 0) ctx.fillRect(p.x + 1.2 * p.s, p.y - 12 * p.s - jump * 1.4, 1 * p.s, 4 * p.s);
    }
  }

  drawFighter(ctx, f) {
    const s = this.sc(f);
    ctx.fillStyle = 'rgba(40,22,8,.32)';
    const lying = f.state === 'fallen' || f.state === 'dead';
    ctx.beginPath(); ctx.ellipse(f.x - (lying ? f.facing * 30 * s : 0), f.y + 1, (lying ? 66 : 38) * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
    if (f.disarmed) drawDroppedGear(ctx, f.spec, f.x - f.facing * 10 * s, f.y + 4, s, f.facing);
    const res = renderFighter(ctx, f, s, f.x, f.y);
    f.topY = (f.state === 'idle' || f.state === 'kneel') ? res.topY : f.y - 40 * s;
    if (res.bow) f.bowPt = { x: res.bow.x / this.dpr, y: res.bow.y / this.dpr };
  }

  drawBar(ctx, f) {
    if (f.state === 'dead') return;
    const w = 78, x = f.x - w / 2, y = Math.max(16, f.topY - 22);
    ctx.font = '600 13px "PT Serif", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillText(f.unit.g.name, f.x + 1, y - 5);
    ctx.fillStyle = f.side === 'player' ? '#f0d49c' : '#f2a596';
    if (f.state !== 'idle') ctx.globalAlpha = 0.7;
    ctx.fillText(f.unit.g.name, f.x, y - 6);
    ctx.fillStyle = 'rgba(10,6,4,.75)'; ctx.fillRect(x - 1, y - 1, w + 2, 7);
    const hp = Math.max(0, f.hp) / f.maxHp;
    ctx.fillStyle = f.side === 'player' ? '#c49a55' : '#b23a2e';
    ctx.fillRect(x, y, w * hp, 5);
    ctx.globalAlpha = 1;
    const tags = [];
    if (f.state === 'fallen') tags.push(['повержен', '#d0473a']);
    if (f.guard) tags.push(['оборона', '#e6c27a']);
    if (f.wall) tags.push(['копейный заслон', '#e6c27a']);
    if (f.unit.bleeds.length && f.unit.alive) tags.push(['кровь', '#e07a6e']);
    if ((f.netted || f.stunned) && f.state === 'idle') {
      // плашка «пропустит ход» — видно, что ход будет потерян
      const label = f.netted ? 'В СЕТИ · пропустит ход' : 'ОГЛУШЁН · пропустит ход';
      ctx.font = '700 12px "PT Serif", Georgia, serif';
      const tw = ctx.measureText(label).width + 14;
      const by = y - 40;
      ctx.fillStyle = 'rgba(14,22,34,.82)'; ctx.fillRect(f.x - tw / 2, by - 12, tw, 17);
      ctx.strokeStyle = f.netted ? '#9fc0de' : '#e8d27a'; ctx.lineWidth = 1; ctx.strokeRect(f.x - tw / 2 + 0.5, by - 11.5, tw - 1, 16);
      ctx.fillStyle = f.netted ? '#cfe2f3' : '#f3e3a0'; ctx.fillText(label, f.x, by + 1);
    }
    if (tags.length) {
      ctx.font = 'italic 11px "PT Serif", Georgia, serif';
      const txt = tags.map(t => t[0]).join(' · ');
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(txt, f.x + 1, y + 18);
      ctx.fillStyle = tags[0][1]; ctx.fillText(txt, f.x, y + 17);
    }
  }

  drawPart(ctx, p) {
    if (p.kind === 'blood') {
      ctx.fillStyle = '#7a0f0a';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'spark') {
      ctx.strokeStyle = `rgba(255,${200 + Math.random() * 55 | 0},140,${clamp(p.life / 0.3, 0, 1)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); ctx.stroke();
    } else if (p.kind === 'dust') {
      ctx.fillStyle = `rgba(190,160,110,${clamp(p.life / p.max, 0, 1) * 0.35})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawText(ctx, t, now) {
    const p = (now - t.t0) / t.dur;
    const colors = { hit: '#f6e6cf', crit: '#ff7a52', block: '#a9b8c6', miss: '#d6c8b0', bleed: '#e0483a', heal: '#a6d27e', status: '#c8dcec', skill: '#ecc77e', kill: '#ff5a46' };
    const size = t.kind === 'crit' ? 34 : t.kind === 'hit' || t.kind === 'bleed' ? 26 : 19;
    ctx.font = `700 ${size * (p < 0.12 ? 0.8 + p * 3 : 1)}px "Cormorant SC", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
    const y = t.y - p * 46;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,5,2,.85)';
    ctx.strokeText(t.text, t.x, y);
    ctx.fillStyle = colors[t.kind] || '#fff';
    ctx.fillText(t.text, t.x, y);
    ctx.globalAlpha = 1;
  }

  drawBanner(ctx, now) {
    const b = this.banner, p = (now - b.t0) / b.dur;
    if (p >= 1) { this.banner = null; return; }
    const a = p < 0.15 ? p / 0.15 : p > 0.75 ? (1 - p) / 0.25 : 1;
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(AW / 2 - 300, 0, AW / 2 + 300, 0);
    g.addColorStop(0, 'rgba(10,6,3,0)'); g.addColorStop(0.5, 'rgba(10,6,3,.72)'); g.addColorStop(1, 'rgba(10,6,3,0)');
    ctx.fillStyle = g; ctx.fillRect(AW / 2 - 300, AH - 66, 600, 54);
    ctx.textAlign = 'center';
    ctx.font = '700 30px "Cormorant SC", Georgia, serif';
    ctx.fillStyle = b.side === 'player' ? '#ecc77e' : '#ee8a7a';
    ctx.fillText(b.text, AW / 2, AH - 36);
    ctx.font = 'italic 13px "PT Serif", Georgia, serif';
    ctx.fillStyle = '#cbbfa9';
    ctx.fillText(b.sub, AW / 2, AH - 19);
    ctx.globalAlpha = 1;
  }

  drawBig(ctx, now) {
    const b = this.big, p = (now - b.t0) / b.dur;
    if (p >= 1) { this.big = null; return; }
    const a = p < 0.1 ? p / 0.1 : p > 0.8 ? (1 - p) / 0.2 : 1;
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = `700 ${78 + (1 - Math.min(1, p * 5)) * 30}px "Cormorant SC", Georgia, serif`;
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(8,4,2,.8)';
    ctx.strokeText(b.text, AW / 2, 200);
    ctx.fillStyle = b.color; ctx.fillText(b.text, AW / 2, 200);
    ctx.font = 'italic 20px "PT Serif", Georgia, serif';
    ctx.fillStyle = '#e8dcc6';
    ctx.lineWidth = 4; ctx.strokeText(b.sub, AW / 2, 236); ctx.fillText(b.sub, AW / 2, 236);
    ctx.globalAlpha = 1;
  }

  // Брызги крови по краю экрана — только при падении и казни
  bloodScreen(strength = 1) {
    if (this.skip) return;
    const spots = [];
    const n = Math.round(5 + strength * 6);
    for (let i = 0; i < n; i++) {
      const edge = Math.random() < 0.5 ? (Math.random() < 0.5 ? 0 : AW) : Math.random() * AW;
      const y = edge === 0 || edge === AW ? Math.random() * AH : (Math.random() < 0.5 ? 0 : AH);
      const drops = [];
      for (let k = 0; k < 14; k++) drops.push({ a: Math.random() * Math.PI * 2, d: 10 + Math.random() * 70 * strength, r: 1.5 + Math.random() * 6 });
      spots.push({ x: edge, y, r: 30 + Math.random() * 70 * strength, drops });
    }
    this.splat = { t0: performance.now(), dur: 2600, spots, strength };
  }
  drawSplat(ctx, now) {
    const S = this.splat, p = (now - S.t0) / S.dur;
    if (p >= 1) { this.splat = null; return; }
    const a = (p < 0.06 ? p / 0.06 : 1 - (p - 0.06) / 0.94) * 0.75;
    ctx.save();
    ctx.globalAlpha = a;
    for (const sp of S.spots) {
      const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.r);
      g.addColorStop(0, 'rgba(110,8,4,.95)'); g.addColorStop(0.6, 'rgba(90,6,3,.7)'); g.addColorStop(1, 'rgba(70,4,2,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(105,8,4,.9)';
      for (const d of sp.drops) {
        const x = sp.x + Math.cos(d.a) * (sp.r * 0.6 + d.d), y = sp.y + Math.sin(d.a) * (sp.r * 0.6 + d.d) + p * 14;
        ctx.beginPath(); ctx.arc(x, y, d.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    // красная дымка по краям
    const v = ctx.createRadialGradient(AW / 2, AH / 2, AH * 0.35, AW / 2, AH / 2, AW * 0.7);
    v.addColorStop(0, 'rgba(120,0,0,0)'); v.addColorStop(1, `rgba(120,6,2,${0.35 * S.strength})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, AW, AH);
    ctx.restore();
  }

  drawDaze(ctx, f, now) {
    if (!f.stunned || f.state !== 'idle') return;
    const s = this.sc(f), cy = f.topY + 4 * s;
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const a = now / 260 + i * Math.PI / 2;
      const x = f.x + Math.cos(a) * 20 * s, y = cy + Math.sin(a) * 6 * s;
      ctx.globalAlpha = 0.55 + Math.sin(a) * 0.35;
      ctx.fillStyle = '#f3e3a0';
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const r = k % 2 ? 1.6 : 4.2; const b = k / 10 * Math.PI * 2; ctx.lineTo(x + Math.cos(b) * r * s, y + Math.sin(b) * r * s); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  drawArrow(ctx, a, now) {
    const p = clamp((now - a.t0) / a.dur, 0, 1);
    const x = a.x0 + (a.x1 - a.x0) * p, y = a.y0 + (a.y1 - a.y0) * p - Math.sin(p * Math.PI) * a.arc;
    const dy = (a.y1 - a.y0) - Math.cos(p * Math.PI) * Math.PI * a.arc;
    const ang = Math.atan2(dy, a.x1 - a.x0);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.strokeStyle = 'rgba(255,245,220,.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(-20, 0); ctx.stroke();
    ctx.strokeStyle = '#2a1a0e'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(6, 0); ctx.stroke();
    ctx.strokeStyle = '#b08a58'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(6, 0); ctx.stroke();
    ctx.fillStyle = '#c9ced2'; ctx.beginPath(); ctx.moveTo(5, -2.6); ctx.lineTo(12, 0); ctx.lineTo(5, 2.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e6dcc6'; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-31, -3.5); ctx.lineTo(-21, 0); ctx.lineTo(-31, 3.5); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (p >= 1 && !a.dead) { a.dead = true; a.resolve(); }
  }

  shootArrow(A, D, hit) {
    const s = this.sc(D);
    const from = A.bowPt || { x: A.x + A.facing * 40 * this.sc(A), y: A.y - 130 * this.sc(A) };
    const to = { x: D.x - A.facing * (hit ? 4 : -30) * s, y: D.y - (hit ? 118 : 160) * s };
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    sfx('arrow', { pan: panOf(from.x), vol: 0.7 });
    return new Promise(resolve => {
      this.arrows.push({ x0: from.x, y0: from.y, x1: to.x, y1: to.y, arc: Math.min(40, dist * 0.06), t0: performance.now(), dur: clamp(dist / 1.6, 180, 520) / this.speed, resolve });
    });
  }

  drawNet(ctx, n, now) {
    let x, y, r, alpha = 1;
    if (n.flying) {
      const p = clamp((now - n.t0) / n.dur, 0, 1);
      x = n.x0 + (n.x1 - n.x0) * p; y = n.y0 + (n.y1 - n.y0) * p - Math.sin(p * Math.PI) * 90;
      r = 10 + p * 26;
      if (p >= 1) { n.flying = false; n.t1 = now; n.resolve(); if (n.ok) { n.dead = true; return; } }
    } else {
      const p = (now - n.t1) / (n.miss ? 900 : 2200);
      if (p >= 1) { n.dead = true; return; }
      x = n.x1; y = n.gy; r = 30; alpha = 1 - p;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (!n.flying) ctx.scale(1, 0.3);
    else ctx.rotate(now / 120);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120,100,70,.18)'; ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(220,200,155,.8)'; ctx.lineWidth = 1;
    for (let i = -r; i < r; i += 6) {
      ctx.beginPath(); ctx.moveTo(-r, i); ctx.lineTo(r, i + r * 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r, i); ctx.lineTo(-r, i + r * 0.6); ctx.stroke();
    }
    ctx.restore();
  }

  // --------------------------------------------------------
  //  Хореография
  // --------------------------------------------------------
  async intro(walkIn = true) {
    if (walkIn) for (const f of this.fighters) {
      f.x = f.side === 'player' ? -60 - Math.random() * 80 : AW + 60 + Math.random() * 80;
      f.facing = f.side === 'player' ? 1 : -1;
    }
    this.excite(0.8);
    sfx('horn', { vol: 0.8 });
    if (walkIn) await Promise.all(this.fighters.map(f => this.moveTo(f, f.home.x, f.home.y, 1500 + Math.random() * 300)));
    sfx('cheer', { vol: 0.7 });
    // приветствие толпы
    this.excite(1);
    await Promise.all(this.fighters.map(f => this.clip(f, 'salute').done));
    this.faceFoes();
    await this.wait(150);
  }

  async salute(side) {
    this.excite(1.2);
    sfx('cheer');
    await Promise.all(this.fighters.filter(f => f.side === side && f.state === 'idle').map(f => this.clip(f, 'salute').done));
  }

  weaponClip(f) {
    const w = f.spec.weapon && f.spec.weapon.b;
    if (f.spec.ranged) return 'shoot';
    if (w === 'longsword' || w === 'axe') return Math.random() < 0.35 ? 'cleave' : 'swing';
    if (w === 'trident' || w === 'spear') return 'thrust';
    if (w === 'mace' || w === 'spatha') return 'swing';
    if (w === 'sica') return Math.random() < 0.5 ? 'swing' : 'slash';
    if (w === 'gladius') return Math.random() < 0.55 ? 'thrust' : 'swing';
    return 'thrust';
  }

  async approach(A, D) {
    const dir = Math.sign(D.x - A.x) || A.baseFacing;
    const far = cheb(A.unit, D.unit) > 1;
    const eng = (far ? 150 : 86) * (this.sc(A) + this.sc(D)) / 2;
    const tx = D.x - dir * eng, ty = far ? A.y + (D.y - A.y) * 0.5 : D.y;
    const dist = Math.hypot(tx - A.x, ty - A.y);
    A.facing = dir;
    if (dist < 8) return;
    await this.moveTo(A, tx, ty, clamp(dist / 0.75, 180, 700));
  }

  async returnHome() {
    const moves = this.fighters.filter(f => f.state === 'idle' && !f.downing && Math.hypot(f.x - f.home.x, f.y - f.home.y) > 4)
      .map(f => { f.facing = f.baseFacing; return this.moveTo(f, f.home.x, f.home.y, clamp(Math.hypot(f.x - f.home.x, f.y - f.home.y) / 0.6, 200, 800)); });
    await Promise.all(moves);
    this.faceFoes();
    for (const f of this.fighters) if (f.state === 'idle') f.facing = f.baseFacing;
  }

  // Перемещение по клеткам пути
  async walk(f, path) {
    for (const p of path) {
      const to = cellPos(p.c, p.r);
      const dx = to.x - f.x;
      if (Math.abs(dx) > 4) f.facing = Math.sign(dx);
      const d = Math.hypot(to.x - f.x, to.y - f.y);
      await this.moveTo(f, to.x, to.y, clamp(d / 0.42, 170, 320));
      if (this.skip) break;
    }
    const last = path[path.length - 1];
    f.home = cellPos(last.c, last.r);
    if (this.skip) { f.x = f.home.x; f.y = f.home.y; f.move = null; }
  }

  sync() {
    for (const f of this.fighters) {
      const u = f.unit;
      f.hp = u.hp;
      f.stunned = u.alive && u.stun > 0;
      f.netted = u.alive && u.net > 0;
      f.guard = u.alive && u.defending;
      f.wall = u.alive && u.spearWall;
      if (!u.alive && f.state === 'idle' && (!f.downing || this.skip)) { f.state = 'fallen'; f.downing = false; f.clip = null; f.move = null; }
      if (u.alive) f.home = cellPos(u.c, u.r);
      if (this.skip && f.state === 'idle') { f.x = f.home.x; f.y = f.home.y; f.move = null; f.clip = null; f.facing = f.baseFacing; }
    }
  }

  fall(f, from = 'fall') {
    f.netted = false; f.stunned = false; f.guard = false;
    f.move = null;
    f.downing = true;
    return this.clip(f, from, { onEnd: () => { f.state = from === 'fallFromKneel' ? 'dead' : 'fallen'; f.downing = false; this.dust(f.x - f.facing * 30, f.y, 8); this.pool(f, from === 'fallFromKneel' ? 1.7 : 1); } });
  }

  async play(events) {
    if (this.skip) { this.applyInstant(events); return; }
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e._done) continue;
      const f = e.u ? this.F(e.u) : null;
      switch (e.t) {
        case 'turn': this.active = e.u; await this.wait(e.extra ? 250 : 120); break;
        case 'move': this.active = e.u; await this.walk(f, e.path); break;
        case 'wait': if (!e.silent) this.float(f, 'Выжидает', 'status'); await this.wait(e.silent ? 120 : 380); break;
        case 'bleed':
          this.drip(f, 8); this.float(f, `−${e.dmg}`, 'bleed'); f.hp = e.hp; f.flash = 0.6;
          sfx('bleed', { pan: panOf(f.x) });
          this.clip(f, 'hit'); await this.wait(520); break;
        case 'skip': await this.playSkip(f, e.why); break;
        case 'stance':
          f.wall = true; this.float(f, 'Копейный заслон', 'skill');
          this.clip(f, 'brace'); await this.wait(420); break;
        case 'defend':
          f.guard = true; this.float(f, 'Оборона', 'status'); await this.wait(520); break;
        case 'ability': await this.playAbility(e, events, i); break;
        case 'strike': await this.playStrike(e); break;
        case 'control': await this.playControl(e); break;
        case 'bleedOn': this.drip(f, 5); break;
        case 'heal':
          f.hp = e.hp; this.float(f, `+${e.amount}`, 'heal');
          if (e.kind !== 'vamp') await this.wait(380);
          break;
        case 'fall':
          this.fall(f); this.excite(1.1); this.shake = Math.max(this.shake, 6);
          if (!this.b.nonLethal) this.bloodScreen(f.side === 'player' ? 1 : 0.6);
          sfx('fall', { pan: panOf(f.x) }); sfx('cheer', { vol: 0.8 });
          this.float(f, 'Повержен!', 'kill');
          await this.wait(750); break;
        case 'extra': this.float(f, 'Ещё ход!', 'skill'); await this.wait(350); break;
      }
    }
    await this.returnHome();
    this.sync();
  }

  // Пропуск хода: видно, что боец потерял ход
  async playSkip(f, why) {
    this.active = f.uid;
    this.banner = { text: 'Пропуск хода', sub: `${f.unit.g.name} ${why === 'stun' ? 'приходит в себя после оглушения' : 'бьётся в сети'}`, side: f.side, t0: performance.now(), dur: 1500 / this.speed };
    this.float(f, why === 'stun' ? 'Оглушён — пропуск хода' : 'В сети — пропуск хода', 'status');
    if (why === 'net') {
      sfx('netHit', { pan: panOf(f.x) });
      await this.clip(f, 'struggle').done;
      // сеть сброшена: остаётся лежать на песке
      f.netted = false;
      this.nets.push({ flying: false, x1: f.x - f.facing * 26, gy: f.y + 4, t1: performance.now(), dead: false });
      this.dust(f.x, f.y, 4);
      await this.wait(250);
    } else {
      await this.clip(f, 'stagger').done;
      f.stunned = false;
      await this.wait(150);
    }
  }

  applyInstant(events) {
    for (const e of events) {
      if (e.t === 'move') { const f = this.F(e.u), l = e.path[e.path.length - 1]; f.home = cellPos(l.c, l.r); f.x = f.home.x; f.y = f.home.y; f.move = null; }
      if (e.t === 'strike') this.F(e.d).hp = e.hp;
      else if (e.t === 'bleed' || e.t === 'heal') this.F(e.u).hp = e.hp;
      else if (e.t === 'fall') { const f = this.F(e.u); f.state = 'fallen'; f.downing = false; f.clip = null; f.move = null; this.pool(f); }
    }
    this.sync();
  }

  async playAbility(e, events, i) {
    const A = this.F(e.u);
    this.banner = { text: e.name, sub: A.unit.g.name, side: A.side, t0: performance.now(), dur: 1500 / this.speed };
    this.excite(0.35);
    if (e.id === 'netThrow') {
      const ctrls = [];
      for (let j = i + 1; j < events.length && events[j].t === 'control'; j++) { ctrls.push(events[j]); events[j]._done = true; }
      const first = this.F(ctrls[0]?.u || e.targets[0]);
      A.facing = Math.sign(first.x - A.x) || A.baseFacing;
      const c = this.clip(A, 'throw');
      await c.impact;
      sfx('net', { pan: panOf(A.x) });
      A.noNet = true;
      await Promise.all(ctrls.map(cc => this.throwNet(A, this.F(cc.u), cc.ok)));
      for (const cc of ctrls) {
        const D = this.F(cc.u);
        if (cc.ok) { D.netted = true; this.float(D, `Опутан! (${cc.p}%)`, 'status'); this.clip(D, 'hit'); this.excite(0.4); sfx('netHit', { pan: panOf(D.x) }); }
        else { this.float(D, cc.immune ? 'Неумолим' : `Ушёл от сети (${cc.p}%)`, 'miss'); this.clip(D, 'dodgeDuck'); }
      }
      await this.wait(500);
      A.noNet = false;
    } else if (e.id === 'whirl') {
      const foes = e.targets.map(u => this.F(u)).filter(f => f.state === 'idle');
      if (foes.length) {
        const dir = Math.sign(foes[0].x - A.x) || A.baseFacing;
        const front = dir > 0 ? Math.min(...foes.map(f => f.x)) : Math.max(...foes.map(f => f.x));
        const ty = foes.reduce((s, f) => s + f.y, 0) / foes.length;
        A.facing = dir;
        await this.moveTo(A, front - dir * 64, ty, clamp(Math.abs(front - A.x) / 0.8, 200, 700));
      }
    } else {
      await this.wait(160);
    }
  }

  throwNet(A, D, ok) {
    const s = this.sc(A);
    return new Promise(resolve => {
      this.nets.push({
        flying: true, ok, x0: A.x + A.facing * 26 * s, y0: A.y - 140 * s,
        x1: D.x + (ok ? 0 : A.facing * 110), y1: D.y - (ok ? 100 : 30) * this.sc(D), gy: D.y + (ok ? 4 : 18), miss: !ok,
        t0: performance.now(), dur: 480 / this.speed, resolve,
      });
    });
  }

  async playStrike(e) {
    const A = this.F(e.a), D = this.F(e.d);
    const kind = e.kind;
    // бьют со своей клетки: никто не шагает в чужую клетку и не возвращается
    if (kind === 'intercept') this.float(A, 'Встречный удар!', 'skill');
    const dx = D.x - A.x;
    A.facing = Math.abs(dx) > 12 ? Math.sign(dx) : A.facing;
    const hasShield = A.spec.offhand && (A.spec.offhand.b === 'scutum' || A.spec.offhand.b === 'parma');
    const name = {
      shieldBash: hasShield ? 'bash' : 'swing', onslaught: 'heavy', slash: 'slash', whirl: 'spin', twin: 'offhand',
      lunge: 'lunge', cleave: 'cleave', cleave2: 'swing', aimed: 'aimed', intercept: 'thrust',
    }[kind] || this.weaponClip(A);
    const c = this.clip(A, name);
    const clip = CLIPS[name];
    if (!e.ranged && clip.impact) setTimeout(() => sfx('swing', { pan: panOf(A.x), vol: 0.6 }), Math.max(0, (clip.impact - 4) / CLIP_FPS * 1000 / this.speed));
    await c.impact;
    if (e.ranged) {
      sfx('bow', { pan: panOf(A.x) });
      await this.shootArrow(A, D, e.res !== 'miss');
    }
    this.impact(A, D, e, name);
    await c.done;
  }

  impact(A, D, e, attackClip = '') {
    const dir = Math.sign(D.x - A.x) || A.facing;
    const pan = panOf(D.x);
    if (D.state === 'idle' && !D.netted && !D.stunned) D.facing = -dir;
    if (e.res === 'miss') {
      sfx('miss', { pan });
      if (e.helpless) { this.float(D, 'Промах', 'miss'); return; }
      // широкие удары — нырок, колющие и стрелы — отклонение корпусом
      const wide = ['swing', 'slash', 'spin', 'cleave', 'heavy'].includes(attackClip);
      this.clip(D, wide && Math.random() < 0.6 ? 'dodgeDuck' : 'dodge');
      this.float(D, 'Уклонение', 'miss');
      return;
    }
    D.hp = e.hp;
    const c = this.chest(D);
    if (e.res === 'block') {
      const shield = D.spec.offhand && (D.spec.offhand.b === 'scutum' || D.spec.offhand.b === 'parma');
      this.clip(D, shield ? 'block' : 'parry');
      sfx(shield ? 'block' : 'parry', { pan });
      this.sparks(c.x - dir * 16, c.y + 6, 16, -dir);
      this.float(D, `−${e.dmg}`, 'block');
      this.excite(0.1);
    } else {
      this.clip(D, e.crit ? 'hitHard' : 'hit');
      if (attackClip === 'bash') sfx('bash', { pan });
      sfx(e.ranged ? 'arrowHit' : e.crit ? 'crit' : 'hit', { pan });
      this.blood(D, dir, e.crit ? 24 : 11, e.crit);
      D.flash = 1;
      this.float(D, `−${e.dmg}`, e.crit ? 'crit' : 'hit');
      if (e.crit) { this.shake = 10; this.excite(0.7); this.float(D, 'Крит!', 'crit'); sfx('gasp', { vol: 0.7 }); }
      else this.excite(0.12);
    }
  }

  async playControl(e) {
    const D = this.F(e.u);
    if (e.ok && e.kind === 'stun') {
      D.stunned = true; this.clip(D, 'hitHard'); this.float(D, `Оглушён! (${e.p}%)`, 'status'); this.excite(0.3);
      sfx('stun', { pan: panOf(D.x) });
      await this.wait(650);
    } else if (e.ok && e.kind === 'net') {
      D.netted = true; this.float(D, `Опутан! (${e.p}%)`, 'status'); await this.wait(500);
    } else {
      this.float(D, e.immune ? 'Неумолим' : `Устоял (${e.p}%)`, 'miss');
      await this.wait(400);
    }
  }

  // --------------------------------------------------------
  //  Приговор толпы
  // --------------------------------------------------------
  async kneel(uids) {
    await Promise.all(uids.map(async uid => {
      const f = this.F(uid);
      f.disarmed = true; f.netted = false; f.stunned = false; f.guard = false; f.move = null;
      await this.wait(Math.random() * 300);
      const fromFloor = f.state === 'fallen' || f.downing || !f.unit.alive;
      if (fromFloor) { f.state = 'fallen'; f.downing = false; }
      await this.clip(f, fromFloor ? 'kneelUp' : 'toKneel', { onEnd: () => { f.state = 'kneel'; } }).done;
      f.state = 'kneel';
    }));
  }

  async execution(victimUid, execUid, result, sub) {
    const V = this.F(victimUid), X = this.F(execUid);
    if (!V) return;
    this.active = null;
    if (X) {
      const d = Math.sign(X.home.x - V.x) || -V.baseFacing;
      const tx = V.x + d * 70 * this.sc(V), ty = V.y + 3;
      X.facing = -d;
      await this.moveTo(X, tx, ty, clamp(Math.hypot(tx - X.x, ty - X.y) / 0.55, 300, 1300));
      X.facing = -d;
      V.facing = d;
    }
    this.excite(0.6);
    if (result === 'die') sfx('boo', { vol: 0.5 });
    await this.wait(1000);
    if (result === 'die') {
      if (X) await this.clip(X, 'execute').impact;
      this.blood(V, -V.facing, 34, true);
      this.shake = 12; this.excite(1.5);
      this.big = { text: 'IUGULA', sub, color: '#c0392b', t0: performance.now(), dur: 2400 / this.speed };
      sfx('iugula'); sfx('crit', { vol: 0.8 });
      this.bloodScreen(1.4);
      await this.fall(V, 'fallFromKneel').done;
      V.state = 'dead';
      await this.wait(700);
    } else {
      this.big = { text: 'MISSIO', sub, color: '#a3c26e', t0: performance.now(), dur: 2400 / this.speed };
      sfx('missio');
      this.excite(0.9);
      await this.wait(500);
      await this.clip(V, 'rise', { onEnd: () => { V.state = 'idle'; } }).done;
      V.state = 'idle';
      await this.wait(300);
    }
    if (X) {
      X.facing = X.baseFacing;
      await this.moveTo(X, X.home.x, X.home.y, clamp(Math.hypot(X.home.x - X.x, X.home.y - X.y) / 0.6, 300, 1100));
    }
  }
}

// ============================================================
//  Боец: состояние, покадровое проигрывание клипов, инерция плюмажа и ткани.
//  Используется и на арене, и в превью снаряжения.
// ============================================================
function makeFighter(u, home, facing) {
  return {
    uid: u.uid, unit: u, side: u.side, spec: figureSpec(u.g), home,
    x: home.x, y: home.y, facing, baseFacing: facing,
    state: 'idle', clip: null, move: null, hp: u.hp, maxHp: u.maxHp,
    flash: 0, netted: false, stunned: false, guard: false, wall: false, disarmed: false, noNet: false, bowPt: null,
    loopFrame: Math.random() * 40, runPhase: 0, curPose: null, clipFrom: null, blendFrom: null, blendT: 1,
    sway: { plume: 0, pv: 0, cloth: 0, cv: 0 }, lastHead: null, lastHip: null, prevBlade: null, prevBladeN: null,
    topY: home.y - 180,
  };
}

function startClip(f, name, opts = {}, instant = false) {
  const c = { name, frame: 0, fired: false, onEnd: opts.onEnd };
  c.impact = new Promise(r => { c.impactRes = r; });
  c.done = new Promise(r => { c.doneRes = r; });
  if (f.clip) { const o = f.clip; f.clip = null; o.impactRes(); o.doneRes(); if (o.onEnd) o.onEnd(); }
  if (instant) {
    c.impactRes(); c.doneRes(); if (c.onEnd) c.onEnd();
    f.clip = null;
    return c;
  }
  f.clipFrom = f.curPose;
  f.clip = c;
  return c;
}

function advanceFighter(f, dt, speed) {
  const step = dt * CLIP_FPS * speed;
  f.loopFrame += step;
  if (f.flash > 0) f.flash = Math.max(0, f.flash - dt * 4);
  if (f.blendT < 1) f.blendT = Math.min(1, f.blendT + step / 3);
  const c = f.clip;
  if (c) {
    const clip = CLIPS[c.name];
    c.frame += step;
    if (!c.fired && clip.impact != null && c.frame >= clip.impact) { c.fired = true; c.impactRes(); }
    if (c.frame >= clip.len) {
      f.clip = null;
      c.impactRes(); c.doneRes();
      f.blendFrom = f.curPose; f.blendT = 0;
      if (c.onEnd) c.onEnd();
    }
  }
}

function loopClipOf(f) {
  if (f.state === 'fallen' || f.state === 'dead') return 'lie';
  if (f.state === 'kneel') return 'kneel';
  if (f.netted) return 'struggle';
  if (f.stunned) return 'stagger';
  if (f.guard) return 'guard';
  return 'idle';
}

function poseOfFighter(f) {
  const base = stancePose(f.unit.g.cls);
  let pose;
  if (f.move && f.move.run && f.state === 'idle') {
    const n = CLIPS.run.len;
    pose = sampleClip('run', ((Math.floor(f.runPhase) % n) + n) % n, base);
  } else {
    const name = loopClipOf(f);
    pose = sampleClip(name, Math.floor(f.loopFrame) % CLIPS[name].len, base);
  }
  if (f.clip) {
    const c = f.clip, clip = CLIPS[c.name];
    const fr = Math.min(clip.len, Math.floor(c.frame));
    const cp = sampleClip(c.name, fr, base);
    pose = (f.clipFrom && c.frame < 3) ? lerpPose(f.clipFrom, cp, (Math.floor(c.frame) + 1) / 3) : cp;
  } else if (f.blendFrom && f.blendT < 1) {
    pose = lerpPose(f.blendFrom, pose, f.blendT);
  }
  f.curPose = pose;
  return pose;
}

// Рисует бойца: поза кадра, инерция плюмажа и ткани, «смаз» клинка
function renderFighter(ctx, f, s, x, y) {
  const pose = poseOfFighter(f);
  let filter = null;
  if (f.state === 'dead') filter = 'brightness(.6) saturate(.6)';
  else if (f.flash > 0) filter = `brightness(${1 + f.flash * 0.7}) sepia(${f.flash * 0.6}) saturate(${1 + f.flash * 2})`;
  const res = drawFigure(ctx, f.spec, pose, x, y, {
    scale: s, facing: f.facing, disarmed: f.disarmed, netted: f.netted, filter, noNet: f.noNet,
    sway: { plume: f.sway.plume, cloth: f.sway.cloth },
  });
  // инерция: плюмаж и ткань отстают от движения головы и таза
  const head = { x, y: res.topY }, hip = { x: x + (pose.dx || 0) * s * f.facing, y: res.hipY };
  if (f.lastHead) {
    const hv = (head.x - f.lastHead.x) * f.facing, hvy = head.y - f.lastHead.y;
    const cv = (hip.x - f.lastHip.x) * f.facing;
    const sw = f.sway;
    sw.pv += (clamp(-hv * 0.06 - hvy * 0.03, -0.9, 0.9) - sw.plume) * 0.18; sw.pv *= 0.82; sw.plume += sw.pv;
    sw.cv += (clamp(-cv * 0.05, -0.7, 0.7) - sw.cloth) * 0.2; sw.cv *= 0.8; sw.cloth += sw.cv;
  }
  f.lastHead = head; f.lastHip = hip;
  // «смаз» клинка на ударных кадрах
  const c = f.clip, clip = c && CLIPS[c.name];
  const fr = c ? Math.floor(c.frame) : -1;
  const smear = (prev, cur, range) => {
    if (!prev || !cur || !inRange(range, fr)) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createLinearGradient(prev.tip.x, prev.tip.y, cur.tip.x, cur.tip.y);
    g.addColorStop(0, 'rgba(255,250,235,0)'); g.addColorStop(1, 'rgba(255,250,235,.55)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(prev.base.x, prev.base.y); ctx.lineTo(prev.tip.x, prev.tip.y);
    ctx.lineTo(cur.tip.x, cur.tip.y); ctx.lineTo(cur.base.x, cur.base.y);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  if (clip) { smear(f.prevBlade, res.blade, clip.smear); smear(f.prevBladeN, res.bladeN, clip.smearN); }
  f.prevBlade = res.blade; f.prevBladeN = res.bladeN;
  return res;
}

// ============================================================
//  Превью снаряжения (окно гладиатора)
// ============================================================
class FigurePreview {
  constructor(canvas, g) {
    this.canvas = canvas;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = canvas.width; this.h = canvas.height;
    canvas.width = this.w * this.dpr; canvas.height = this.h * this.dpr;
    this.ctx = canvas.getContext('2d');
    this.f = makeFighter({ uid: 'preview', g, side: 'player', hp: 1, maxHp: 1 }, { x: this.w * 0.44, y: this.h - 18 }, 1);
    this.queue = [];
    this.last = performance.now();
    const loop = t => {
      if (!canvas.isConnected) return;
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      advanceFighter(this.f, dt, 1);
      if (!this.f.clip && this.queue.length) startClip(this.f, this.queue.shift());
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  play(names) { this.queue = [...names]; if (this.f.clip) this.f.clip = null; }
  draw() {
    const ctx = this.ctx, w = this.w, h = this.h;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.4, 10, w * 0.5, h * 0.5, h * 0.75);
    bg.addColorStop(0, '#3a2d20'); bg.addColorStop(1, '#0d0a08');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    const sand = ctx.createLinearGradient(0, h - 50, 0, h);
    sand.addColorStop(0, 'rgba(170,130,80,0)'); sand.addColorStop(1, 'rgba(170,130,80,.45)');
    ctx.fillStyle = sand; ctx.fillRect(0, h - 50, w, 50);
    ctx.fillStyle = 'rgba(20,10,4,.4)';
    ctx.beginPath(); ctx.ellipse(this.f.x, this.f.home.y + 1, 40, 7, 0, 0, Math.PI * 2); ctx.fill();
    renderFighter(ctx, this.f, h / 250, this.f.x, this.f.home.y);
  }
}
