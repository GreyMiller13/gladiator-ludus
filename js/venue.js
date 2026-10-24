// ============================================================
//  Арены городов: фон амфитеатра и расстановка зрителей
// ============================================================

// ------------------------------------------------------------
//  Детерминированный генератор для фона
// ------------------------------------------------------------
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const curveY = (x, y) => y - (HORIZON - y) * 0.16 * ((x - AW / 2) / (AW / 2)) ** 2;

// ------------------------------------------------------------
//  Описание арен (для звука и текста). Индекс = TIERS[i]
// ------------------------------------------------------------
const VENUES = [
  { key: 'pompeii', crowdSize: 0 },
  { key: 'capua', crowdSize: 1 },
  { key: 'statilius', crowdSize: 2 },
  { key: 'colosseum', crowdSize: 3 },
];
const VENUE_SEEDS = [1234, 2207, 3391, 4423];

// ------------------------------------------------------------
//  Палитры зрителей
// ------------------------------------------------------------
// 0–7 — дневные цвета, 8–11 — некрашеная шерсть провинции,
// 12–17 — те же цвета в сумерках, 18 — пурпур, 19 — золото, 20 — белая тога
const CROWD_CLOTH = [
  '#d8d0bf', '#c9b99a', '#8c2e24', '#6a4a2e', '#a68a5a', '#4a5a6a', '#e8e2d2', '#7a6a3a',
  '#9a8a72', '#7d6a52', '#a2604a', '#5e6650',
  '#86705e', '#5e2a22', '#3e3026', '#735a3e', '#3a3c46', '#9a8068',
  '#5a2a62', '#c9a24a', '#f2eee4',
];
// 0–3 — днём, 4–6 — в отсветах огня
const CROWD_SKIN = ['#c99a72', '#a8754e', '#8a5a3a', '#e0b38e', '#a46c48', '#7a5034', '#bc8460'];

// ------------------------------------------------------------
//  Кисти и художники арен (спрятаны от глобальной области)
// ------------------------------------------------------------
const VENUE_ART = (() => {
  const SKIN_DAY = [0, 1, 2, 3];
  const SKIN_DUSK = [4, 5, 6];
  const PAL_POMPEII = [0, 1, 3, 4, 8, 8, 9, 9, 10, 11, 6, 7];
  const PAL_CAPUA = [0, 1, 2, 2, 3, 4, 5, 6, 6, 7, 10, 20];
  const PAL_STATILIUS = [12, 13, 13, 14, 14, 15, 16, 17];
  const PAL_COLOSSEUM = [0, 1, 2, 3, 4, 5, 6, 6, 7, 20, 20, 19];
  const PAL_SENATE = [20, 20, 20, 20, 6, 6, 0];

  // ------------------------------------------------------------
  //  Общие кисти
  // ------------------------------------------------------------
  const rpick = (R, arr) => arr[(R() * arr.length) | 0];

  // путь полосы, изогнутой по чаше амфитеатра
  function bandPath(ctx, y0, y1, xa = 0, xb = AW) {
    ctx.beginPath();
    for (let x = xa; x <= xb; x += 16) ctx.lineTo(x, curveY(x, y0));
    ctx.lineTo(xb, curveY(xb, y0));
    ctx.lineTo(xb, curveY(xb, y1));
    for (let x = xb; x >= xa; x -= 16) ctx.lineTo(x, curveY(x, y1));
    ctx.lineTo(xa, curveY(xa, y1));
    ctx.closePath();
  }
  function band(ctx, y0, y1, fill, xa, xb) {
    bandPath(ctx, y0, y1, xa, xb);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function curveLine(ctx, y, stroke, lw, dy = 0, xa = 0, xb = AW) {
    ctx.strokeStyle = stroke; ctx.lineWidth = lw;
    ctx.beginPath();
    for (let x = xa; x <= xb; x += 16) ctx.lineTo(x, curveY(x, y) + dy);
    ctx.lineTo(xb, curveY(xb, y) + dy);
    ctx.stroke();
  }
  function vGrad(ctx, y0, y1, stops) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  }
  function hGrad(ctx, x0, x1, stops) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  }
  // области без зрителей: [x0, x1, yMin] — пусто только для рядов ниже yMin
  function inSkip(x, y, skip) {
    if (!skip) return false;
    for (const s of skip) if (x > s[0] && x < s[1] && y > (s[2] || 0)) return true;
    return false;
  }
  function archPath(ctx, x, yb, w, h) {
    const r = w / 2;
    ctx.moveTo(x, yb); ctx.lineTo(x, yb - h + r); ctx.arc(x + r, yb - h + r, r, Math.PI, 0); ctx.lineTo(x + w, yb); ctx.closePath();
  }
  // мягкое свечение (огонь, солнце)
  function glow(ctx, x, y, r, rgb, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  function flame(ctx, x, y, h) {
    const f = (k, col) => {
      const hh = h * k;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(x - hh * 0.3, y);
      ctx.quadraticCurveTo(x - hh * 0.36, y - hh * 0.5, x + hh * 0.05, y - hh);
      ctx.quadraticCurveTo(x + hh * 0.34, y - hh * 0.45, x + hh * 0.3, y);
      ctx.closePath(); ctx.fill();
    };
    f(1, '#c8562a'); f(0.75, '#ec8a32'); f(0.45, '#ffd27a');
  }
  // гирлянда-фестон из зелени с лентами
  function garland(ctx, R, x0, x1, yTop, sag, leaf, ribbon) {
    const y0 = curveY(x0, yTop), y1 = curveY(x1, yTop);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + sag * 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = shade(leaf, -0.25); ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke();
    for (let t = 0.04; t < 1; t += 0.06) {
      const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1;
      const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1;
      ctx.fillStyle = R() < 0.5 ? leaf : shade(leaf, 0.18);
      ctx.beginPath(); ctx.ellipse(x, y - 1, 2.6, 1.8, R() * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = ribbon;
    ctx.fillRect(x0 - 1, y0, 2, 9); ctx.fillRect(x0 + 1.5, y0, 2, 7);
    ctx.lineCap = 'butt';
  }
  // колонна с капителью
  function column(ctx, cx, yt, yb, w, col, cap) {
    ctx.fillStyle = hGrad(ctx, cx - w / 2, cx + w / 2, [shade(col, -0.22), col, shade(col, -0.12)]);
    ctx.fillRect(cx - w / 2, yt, w, yb - yt);
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    for (let x = cx - w / 2 + 2; x < cx + w / 2 - 1; x += 2.5) ctx.fillRect(x, yt + 3, 0.8, yb - yt - 5);
    ctx.fillStyle = cap;
    ctx.fillRect(cx - w / 2 - 2, yt - 1, w + 4, 3.5);
    ctx.fillRect(cx - w / 2 - 1.5, yb - 2.5, w + 3, 2.5);
  }
  // статуя: пьедестал, фигура, затенённая справа
  function statue(ctx, cx, yb, h, col, pose) {
    ctx.fillStyle = shade(col, -0.3);
    ctx.fillRect(cx - h * 0.17, yb - h * 0.12, h * 0.34, h * 0.12);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx - h * 0.1, yb - h * 0.78); ctx.lineTo(cx + h * 0.1, yb - h * 0.78);
    ctx.lineTo(cx + h * 0.13, yb - h * 0.12); ctx.lineTo(cx - h * 0.13, yb - h * 0.12);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, yb - h * 0.87, h * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, h * 0.06); ctx.lineCap = 'round';
    ctx.beginPath();
    if (pose === 0) { ctx.moveTo(cx + h * 0.09, yb - h * 0.74); ctx.lineTo(cx + h * 0.2, yb - h * 1.0); }
    else if (pose === 1) { ctx.moveTo(cx - h * 0.09, yb - h * 0.74); ctx.lineTo(cx - h * 0.2, yb - h * 0.45); }
    else { ctx.moveTo(cx + h * 0.09, yb - h * 0.74); ctx.lineTo(cx + h * 0.16, yb - h * 0.5); }
    ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = 'rgba(40,25,10,.22)';
    ctx.fillRect(cx, yb - h * 0.78, h * 0.13, h * 0.66);
  }
  // гора / гряда холмов по опорным точкам
  function ridge(ctx, pts, baseY, fill) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], baseY); ctx.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1];
    ctx.lineTo(l[0], l[1]); ctx.lineTo(l[0], baseY); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
  }

  // Зритель, нарисованный прямо в фон (дальние ряды)
  function staticFigure(ctx, p, dark, cache) {
    const kc = 'c' + p.c, kk = 'k' + p.k;
    const cc = cache[kc] || (cache[kc] = shade(CROWD_CLOTH[p.c], dark));
    const ck = cache[kk] || (cache[kk] = shade(CROWD_SKIN[p.k], dark));
    ctx.fillStyle = cc; ctx.fillRect(p.x - 2 * p.s, p.y - 6 * p.s, 4 * p.s, 6 * p.s);
    ctx.fillStyle = ck; ctx.fillRect(p.x - 1.4 * p.s, p.y - 9 * p.s, 2.8 * p.s, 2.8 * p.s);
  }

  // Ярус сидений: камень, ступени, лестницы-проходы и зрители
  function seats(ctx, R, crowd, o) {
    const { y0, y1, rows, size } = o;
    band(ctx, y0, y1, o.stone);
    if (o.texture) o.texture(y0, y1);
    const rh = (y1 - y0) / rows;
    const aisles = (o.aisles || []).filter(a => !inSkip(a, y1, o.skip));
    const aw = o.aisleW || 6;
    const ax = (a, y) => AW / 2 + (a - AW / 2) * (1 + (y1 - y) * 0.003);
    for (let r = 0; r < rows; r++) {
      const ry = y0 + rh * (r + 1);
      band(ctx, ry - rh * 0.42, ry, o.riser || 'rgba(0,0,0,.13)');
      curveLine(ctx, ry - rh * 0.42, o.hi || 'rgba(255,235,200,.16)', 1, 0.5);
      curveLine(ctx, ry, o.lo || 'rgba(0,0,0,.28)', 1.2, 1.2);
      if (o.joint) {
        ctx.strokeStyle = o.joint; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = R() * o.jointStep; x < AW; x += o.jointStep * (0.6 + R() * 0.8)) {
          ctx.moveTo(x, curveY(x, ry - rh * 0.42) + 1); ctx.lineTo(x, curveY(x, ry));
        }
        ctx.stroke();
      }
    }
    // радиальные лестницы между клиньями
    for (const a of aisles) {
      const xb = ax(a, y1), xt = ax(a, y0);
      ctx.fillStyle = o.aisleFill || 'rgba(0,0,0,.16)';
      ctx.beginPath();
      ctx.moveTo(xt - aw * 0.8, curveY(xt, y0)); ctx.lineTo(xt + aw * 0.8, curveY(xt, y0));
      ctx.lineTo(xb + aw, curveY(xb, y1)); ctx.lineTo(xb - aw, curveY(xb, y1));
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,235,200,.13)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i <= rows * 2; i++) {
        const y = y0 + (y1 - y0) * i / (rows * 2), x = ax(a, y), w = aw * (0.8 + 0.2 * (y - y0) / (y1 - y0));
        ctx.moveTo(x - w, curveY(x, y)); ctx.lineTo(x + w, curveY(x, y));
      }
      ctx.stroke();
    }
    // зрители
    const cache = {};
    const dens = o.density === undefined ? 0.92 : o.density;
    let gap = 0;
    for (let r = 0; r < rows; r++) {
      const ry = y0 + rh * (r + 1);
      const step = 6.2 * size * (o.step || 1);
      for (let x = R() * step; x < AW; x += step * (0.8 + R() * 0.5)) {
        if (gap > 0) { gap--; continue; }
        if (R() < (o.gaps || 0)) { gap = 1 + ((R() * (o.gapLen || 5)) | 0); continue; }
        if (R() > dens) continue;
        if (inSkip(x, ry, o.skip)) continue;
        let blocked = false;
        for (const a of aisles) if (Math.abs(x - ax(a, ry)) < aw + 1.6 * size) { blocked = true; break; }
        if (blocked) continue;
        const s = size * (0.85 + R() * 0.3);
        const p = { x, y: curveY(x, ry), s, c: rpick(R, o.pal), k: rpick(R, o.skin || SKIN_DAY), ph: R() * 6.28 };
        if (o.dynamic) crowd.push(p);
        else staticFigure(ctx, p, o.dark === undefined ? -0.35 : o.dark, cache);
      }
    }
  }

  // Стена-пресинкция с арками (и статуями в них)
  function arcade(ctx, R, o) {
    band(ctx, o.y0, o.y1, o.fill);
    for (let x = o.offset; x < AW + o.archW; x += o.spacing) {
      const cx = x + o.archW / 2;
      if (inSkip(cx, o.y1, o.skip)) continue;
      const yb = curveY(cx, o.y1) - (o.sill || 1.5);
      const hl = curveY(cx, o.y1) - curveY(cx, o.y0);
      const ah = hl * o.archFrac;
      ctx.beginPath(); archPath(ctx, x, yb, o.archW, ah);
      ctx.fillStyle = vGrad(ctx, yb - ah, yb, [o.dark, shade(o.dark, 0.25)]);
      ctx.fill();
      if (o.ring) {
        ctx.strokeStyle = o.ring; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, yb - ah + o.archW / 2, o.archW / 2 + 1, Math.PI, 0); ctx.stroke();
      }
      if (o.statues && R() < o.statues) {
        const col = o.gilt && R() < o.gilt ? '#c9a656' : (o.statueCol || '#e6decb');
        statue(ctx, cx, yb, ah * 0.86, col, (R() * 3) | 0);
      }
      if (o.pilaster) {
        const pxl = x - (o.spacing - o.archW) / 2 - 2.5;
        const pt = curveY(pxl, o.y0) + 2, pb = curveY(pxl, o.y1) - 1;
        ctx.fillStyle = o.pilaster; ctx.fillRect(pxl, pt, 5, pb - pt);
        ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(pxl + 3.5, pt, 1.5, pb - pt);
        if (o.cap) { ctx.fillStyle = o.cap; ctx.fillRect(pxl - 1.5, pt, 8, 2.5); }
      }
    }
    curveLine(ctx, o.y0, o.top || 'rgba(255,240,215,.35)', 2, 1);
    curveLine(ctx, o.y1, 'rgba(0,0,0,.3)', 2, -1);
  }

  // Велариум: веер полотнищ, сходящихся к кольцу над ареной
  function velarium(ctx, o) {
    const vx = AW / 2, vy = o.vy, top = -140;
    const ext = xb => {
      const yb = curveY(xb, o.yb), t = (top - vy) / (yb - vy);
      return [vx + (xb - vx) * t, top];
    };
    for (let i = 0; i < o.xs.length - 1; i++) {
      const col = o.color(i); if (!col) continue;
      const a = o.xs[i], b = o.xs[i + 1];
      const ya = curveY(a, o.yb), yb = curveY(b, o.yb);
      const ea = ext(a), eb = ext(b);
      ctx.beginPath(); ctx.moveTo(a, ya);
      ctx.quadraticCurveTo((a + b) / 2, (ya + yb) / 2 + (o.sag || 5), b, yb);
      ctx.lineTo(eb[0], eb[1]); ctx.lineTo(ea[0], ea[1]); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = vGrad(ctx, -30, (ya + yb) / 2 + 4, [o.shadeTop || 'rgba(40,20,5,.4)', 'rgba(40,20,5,0)']);
      ctx.fill();
    }
    ctx.strokeStyle = o.rope || 'rgba(70,45,25,.55)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const a of o.xs) { const e = ext(a); ctx.moveTo(a, curveY(a, o.yb)); ctx.lineTo(e[0], e[1]); }
    ctx.stroke();
  }

  // Песок арены
  function sandFloor(ctx, R, o) {
    ctx.fillStyle = vGrad(ctx, SAND_TOP, AH, o.cols);
    ctx.fillRect(0, SAND_TOP, AW, AH - SAND_TOP);
    ctx.fillStyle = vGrad(ctx, SAND_TOP, SAND_TOP + 34, [`rgba(${o.shadow},.45)`, `rgba(${o.shadow},0)`]);
    ctx.fillRect(0, SAND_TOP, AW, 34);
    // зерно
    for (let i = 0; i < (o.grain || 16000); i++) {
      const x = R() * AW, y = SAND_TOP + R() * (AH - SAND_TOP);
      ctx.fillStyle = R() < 0.5 ? `rgba(${o.dark},${0.05 + R() * 0.1})` : `rgba(${o.light},${0.04 + R() * 0.08})`;
      ctx.fillRect(x, y, 1 + R(), 1);
    }
    if (o.specks) {
      for (let i = 0; i < o.specks; i++) {
        ctx.fillStyle = `rgba(45,38,32,${0.12 + R() * 0.18})`;
        ctx.fillRect(R() * AW, SAND_TOP + 6 + R() * (AH - SAND_TOP), 1.5 + R(), 1.2 + R());
      }
    }
    // следы граблей
    ctx.strokeStyle = o.rake; ctx.lineWidth = 2;
    for (let i = 0; i < (o.rakes || 30); i++) {
      const y = SAND_TOP + 20 + R() * 260, x = R() * AW - 60;
      const len = o.neat ? 420 + R() * 300 : 260;
      ctx.beginPath(); ctx.moveTo(x, y);
      if (o.neat) ctx.quadraticCurveTo(x + len / 2, y + 3, x + len, y);
      else ctx.quadraticCurveTo(x + 120, y + R() * 10 - 5, x + len, y + R() * 16 - 8);
      ctx.stroke();
    }
    // старые пятна
    for (let i = 0; i < (o.stains || 9); i++) {
      ctx.fillStyle = `rgba(${o.stain || '90,30,20'},${0.08 + R() * 0.08})`;
      ctx.beginPath(); ctx.ellipse(R() * AW, SAND_TOP + 40 + R() * 220, 10 + R() * 30, 4 + R() * 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    // тень трибун / велариума сбоку
    if (o.side) {
      const right = o.side === 'right';
      ctx.fillStyle = right
        ? hGrad(ctx, AW * 0.55, AW, [`rgba(${o.shadow},0)`, `rgba(${o.shadow},${o.sideA})`])
        : hGrad(ctx, 0, AW * 0.45, [`rgba(${o.shadow},${o.sideA})`, `rgba(${o.shadow},0)`]);
      ctx.fillRect(0, SAND_TOP, AW, AH - SAND_TOP);
    }
  }

  // Подиум — полоса от нижнего ряда до песка
  function podium(ctx, cols) {
    band(ctx, 264, 334, vGrad(ctx, 262, 332, cols));
  }

  // Проём ворот (общая часть)
  function gateOpening(ctx, w, top) {
    const px = AW / 2, r = w / 2, cy = top + r;
    ctx.beginPath(); ctx.moveTo(px - r, SAND_TOP + 4); ctx.lineTo(px - r, cy); ctx.arc(px, cy, r, Math.PI, 0); ctx.lineTo(px + r, SAND_TOP + 4); ctx.closePath();
    ctx.fillStyle = vGrad(ctx, top, SAND_TOP, ['#0c0806', '#1a120c']);
    ctx.fill();
    return { px, r, cy };
  }
  function gateBars(ctx, w, top, col, lw) {
    const px = AW / 2, r = w / 2, cy = top + r;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(px - r, SAND_TOP + 4); ctx.lineTo(px - r, cy); ctx.arc(px, cy, r, Math.PI, 0); ctx.lineTo(px + r, SAND_TOP + 4); ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath();
    for (let x = px - r + 6; x <= px + r - 4; x += 10) { ctx.moveTo(x, SAND_TOP + 4); ctx.lineTo(x, top); }
    for (let y = top + 10; y < SAND_TOP; y += 14) { ctx.moveTo(px - r, y); ctx.lineTo(px + r, y); }
    ctx.stroke();
    ctx.restore();
  }
  // кольцо клинчатых камней вокруг арки
  function voussoirs(ctx, w, top, col, n, depth) {
    const px = AW / 2, r = w / 2, cy = top + r;
    ctx.strokeStyle = col; ctx.lineWidth = depth;
    ctx.beginPath(); ctx.arc(px, cy, r + depth / 2, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = col;
    ctx.fillRect(px - r - depth, cy, depth, SAND_TOP - cy + 2);
    ctx.fillRect(px + r, cy, depth, SAND_TOP - cy + 2);
    ctx.strokeStyle = 'rgba(40,25,10,.4)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < n; i++) {
      const a = Math.PI + Math.PI * i / n;
      ctx.moveTo(px + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.lineTo(px + Math.cos(a) * (r + depth), cy + Math.sin(a) * (r + depth));
    }
    ctx.stroke();
  }

  // ------------------------------------------------------------
  //  Помпеи: старый провинциальный амфитеатр под открытым небом
  // ------------------------------------------------------------
  function paintPompeii(ctx, R, crowd) {
    const px = AW / 2;
    // небо
    ctx.fillStyle = vGrad(ctx, 0, 200, ['#a3b9c4', '#c8d1ca', '#ecdfc2']);
    ctx.fillRect(0, 0, AW, 210);
    for (let i = 0; i < 12; i++) {
      const x = R() * AW, y = 12 + R() * 60;
      ctx.fillStyle = `rgba(255,250,240,${0.12 + R() * 0.14})`;
      ctx.beginPath(); ctx.ellipse(x, y, 60 + R() * 120, 5 + R() * 9, 0, 0, Math.PI * 2); ctx.fill();
    }
    // дальние горы справа
    ridge(ctx, [[740, 190], [830, 150], [920, 128], [1000, 138], [1090, 112], [1180, 124], [1300, 104]], 220,
      vGrad(ctx, 100, 200, ['#a2ada9', '#c6c9bc']));
    // Везувий — ещё спящий, с двойной вершиной Соммы
    ridge(ctx, [[-30, 190], [40, 160], [130, 118], [205, 82], [258, 58], [292, 48], [318, 53], [344, 46], [380, 56], [440, 84], [530, 122], [640, 158], [760, 192]], 220,
      vGrad(ctx, 45, 190, ['#76848d', '#949e9c', '#bfc1b3']));
    // виноградники на склонах
    for (let i = 0; i < 160; i++) {
      const x = 20 + R() * 660;
      const y = 120 + R() * 60;
      if (y < 48 + Math.abs(x - 300) * 0.38 + 30) continue;
      ctx.fillStyle = `rgba(78,92,58,${0.12 + R() * 0.12})`;
      ctx.fillRect(x, y, 6 + R() * 10, 1.5);
    }
    ctx.fillStyle = vGrad(ctx, 110, 200, ['rgba(236,224,196,0)', 'rgba(236,224,196,.6)']);
    ctx.fillRect(0, 110, AW, 100);

    // деревья за краем чаши
    const rimY = 170;
    const cypress = (x, h) => {
      const yb = curveY(x, rimY) + 2, w = h * 0.2;
      ctx.fillStyle = '#36412d';
      ctx.beginPath(); ctx.moveTo(x, yb - h);
      ctx.quadraticCurveTo(x + w * 0.75, yb - h * 0.45, x + w * 0.35, yb); ctx.lineTo(x - w * 0.35, yb);
      ctx.quadraticCurveTo(x - w * 0.75, yb - h * 0.45, x, yb - h); ctx.fill();
      ctx.fillStyle = 'rgba(120,140,90,.25)';
      ctx.beginPath(); ctx.moveTo(x, yb - h); ctx.quadraticCurveTo(x - w * 0.75, yb - h * 0.45, x - w * 0.35, yb); ctx.lineTo(x - w * 0.05, yb); ctx.fill();
    };
    const pine = (x, h, lean) => {
      const yb = curveY(x, rimY) + 2, tx = x + lean, ty = yb - h;
      ctx.strokeStyle = '#4a3a2c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, yb); ctx.quadraticCurveTo(x + lean * 0.2, yb - h * 0.6, tx, ty); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i < 4 ? '#45533a' : '#5a6a47';
        ctx.beginPath(); ctx.ellipse(tx + (R() - 0.5) * 36, ty - 4 + (i < 4 ? 2 : -3) + R() * 3, 18 + R() * 12, 6 + R() * 3, 0, 0, Math.PI * 2); ctx.fill();
      }
    };
    pine(170, 58, 14); pine(1080, 62, -16); pine(905, 46, 10);
    cypress(52, 92); cypress(84, 74); cypress(760, 64); cypress(1150, 86); cypress(1186, 70); cypress(1236, 96);

    // венчающая стена с шестами для навеса
    band(ctx, rimY - 8, rimY + 8, '#9c8768');
    curveLine(ctx, rimY - 8, 'rgba(255,240,215,.35)', 1.5, 1);
    for (let x = 40; x < AW; x += 150) {
      const y = curveY(x, rimY - 8);
      ctx.fillStyle = '#5a4630'; ctx.fillRect(x, y - 34, 3, 34);
    }
    ctx.strokeStyle = 'rgba(70,55,40,.45)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 40; x < AW - 150; x += 150) {
      const ya = curveY(x, rimY - 8) - 33, yb = curveY(x + 150, rimY - 8) - 33;
      ctx.moveTo(x + 1.5, ya); ctx.quadraticCurveTo(x + 76, (ya + yb) / 2 + 10, x + 151.5, yb);
    }
    ctx.stroke();
    for (let x = 110; x < AW; x += 210) {
      const y = curveY(x, rimY - 4);
      ctx.fillStyle = '#3a2c1e'; ctx.fillRect(x, y, 9, 10);
    }

    // выветренный туф
    const weather = (y0, y1, n) => {
      ctx.save(); bandPath(ctx, y0, y1); ctx.clip();
      for (let i = 0; i < n; i++) {
        const v = R();
        ctx.fillStyle = v < 0.45 ? `rgba(50,35,20,${0.05 + R() * 0.09})` : v < 0.85 ? `rgba(230,215,185,${0.05 + R() * 0.08})` : `rgba(95,105,60,${0.1 + R() * 0.15})`;
        const x = R() * AW, y = curveY(x, y0 + R() * (y1 - y0));
        ctx.beginPath(); ctx.ellipse(x, y, 5 + R() * 26, 2 + R() * 5, 0, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < n / 8; i++) {
        const x = R() * AW, y = curveY(x, y0 + R() * (y1 - y0));
        ctx.fillStyle = 'rgba(45,30,18,.22)'; ctx.fillRect(x, y, 8 + R() * 14, 3 + R() * 3);
      }
      ctx.restore();
    };
    const aisles = [120, 330, 520, 760, 950, 1160];
    // верхний ярус: редкие зрители, много пустых мест
    seats(ctx, R, crowd, {
      y0: rimY + 8, y1: 224, rows: 5, size: 0.62, dynamic: true, stone: '#8f7b5d',
      density: 0.5, gaps: 0.07, gapLen: 7, pal: PAL_POMPEII, aisles, aisleW: 5,
      riser: 'rgba(40,25,10,.16)', joint: 'rgba(50,35,20,.25)', jointStep: 24,
      texture: (a, b) => weather(a, b, 110),
    });
    // пресинкция с проходами
    band(ctx, 224, 235, '#a48d6a');
    weather(224, 235, 30);
    curveLine(ctx, 224, 'rgba(255,240,215,.3)', 1.5, 1);
    for (const x of [210, 430, 850, 1070]) {
      ctx.beginPath(); archPath(ctx, x - 8, curveY(x, 235), 16, 11);
      ctx.fillStyle = '#2a1f15'; ctx.fill();
    }
    // нижний ярус
    seats(ctx, R, crowd, {
      y0: 235, y1: 266, rows: 4, size: 0.88, dynamic: true, stone: '#9a8564',
      density: 0.58, gaps: 0.05, gapLen: 6, pal: PAL_POMPEII, aisles, aisleW: 6,
      skip: [[px - 90, px + 90, 0]],
      riser: 'rgba(40,25,10,.16)', joint: 'rgba(50,35,20,.25)', jointStep: 30,
      texture: (a, b) => weather(a, b, 60),
    });

    // трибуна магистрата с простым полотняным навесом
    ctx.fillStyle = '#7d6a50'; ctx.fillRect(px - 86, 236, 172, 16);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(px - 86, 214, 172, 38);
    for (const dx of [-80, -30, 30, 80]) { ctx.fillStyle = '#5a4630'; ctx.fillRect(px + dx - 1.5, 208, 3, 44); }
    ctx.save();
    ctx.beginPath(); ctx.moveTo(px - 96, 202); ctx.lineTo(px + 96, 202); ctx.lineTo(px + 90, 214);
    for (let i = 0; i < 8; i++) ctx.quadraticCurveTo(px + 90 - i * 22.5 - 11.25, 221, px + 90 - (i + 1) * 22.5, 214);
    ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#d6c49c'; ctx.fillRect(px - 100, 198, 200, 26);
    ctx.fillStyle = 'rgba(160,100,50,.55)';
    for (let x = px - 96; x < px + 96; x += 24) ctx.fillRect(x, 198, 10, 26);
    ctx.fillStyle = '#bfa77e'; ctx.fillRect(px + 22, 203, 26, 11);
    ctx.strokeStyle = 'rgba(80,55,30,.5)'; ctx.setLineDash([2, 2]); ctx.lineWidth = 1; ctx.strokeRect(px + 22, 203, 26, 11); ctx.setLineDash([]);
    ctx.fillStyle = vGrad(ctx, 202, 221, ['rgba(255,245,220,.15)', 'rgba(60,35,15,.3)']); ctx.fillRect(px - 100, 198, 200, 26);
    ctx.restore();
    ctx.fillStyle = '#a99270'; ctx.fillRect(px - 88, 251, 176, 15);
    ctx.fillStyle = 'rgba(160,70,45,.35)'; ctx.fillRect(px - 62, 254, 124, 9);
    ctx.fillStyle = 'rgba(255,240,215,.3)'; ctx.fillRect(px - 88, 251, 176, 1.5);
    [8, 6, 20, 10, 0].forEach((c, i) => crowd.push({ x: px - 50 + i * 25, y: 251, s: 0.95, c, k: rpick(R, SKIN_DAY), ph: R() * 6 }));

    // свет: ясный день, солнце справа
    ctx.fillStyle = hGrad(ctx, 0, AW, ['rgba(40,25,10,.16)', 'rgba(0,0,0,0)', 'rgba(255,240,200,.1)']);
    ctx.fillRect(0, rimY - 10, AW, 270 - rimY);

    // низкий туфовый подиум с выцветшими фресками
    podium(ctx, ['#a38d6b', '#8a7556', '#6e5c43']);
    weather(264, 334, 50);
    for (let x = 20; x < AW; x += 112) {
      if (Math.abs(x + 46 - px) < 110) continue;
      const y = curveY(x, 290);
      ctx.fillStyle = 'rgba(150,80,55,.15)'; ctx.fillRect(x, y, 92, 32);
      ctx.fillStyle = 'rgba(200,170,110,.12)'; ctx.fillRect(x + 6, y + 6, 80, 20);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = R() < 0.5 ? 'rgba(165,140,105,.6)' : 'rgba(70,50,30,.25)';
        ctx.beginPath(); ctx.ellipse(x + R() * 92, y + R() * 32, 3 + R() * 8, 2 + R() * 4, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // деревянная ограда по краю подиума
    for (const [xa, xb] of [[0, px - 58], [px + 58, AW]]) {
      band(ctx, 262, 266.5, '#6d5236', xa, xb);
      band(ctx, 279, 283, '#614730', xa, xb);
      curveLine(ctx, 262, 'rgba(255,220,170,.3)', 1, 0.5, xa, xb);
    }
    for (let x = 8; x < AW; x += 38) {
      if (Math.abs(x - px) < 60) continue;
      const yt = curveY(x, 257), yb = curveY(x, 294);
      ctx.fillStyle = '#5a4330'; ctx.fillRect(x, yt, 5, yb - yt);
      ctx.fillStyle = 'rgba(255,220,170,.22)'; ctx.fillRect(x, yt, 1.5, yb - yt);
    }
    // ворота: туфовая арка и деревянная решётка
    const W = 80, T = 276;
    const { r, cy } = gateOpening(ctx, W, T);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(px - r, SAND_TOP + 4); ctx.lineTo(px - r, cy); ctx.arc(px, cy, r, Math.PI, 0); ctx.lineTo(px + r, SAND_TOP + 4); ctx.clip();
    ctx.strokeStyle = '#4e3a28'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let d = -120; d < 120; d += 15) { ctx.moveTo(px + d, SAND_TOP + 4); ctx.lineTo(px + d + 70, T - 4); ctx.moveTo(px - d, SAND_TOP + 4); ctx.lineTo(px - d - 70, T - 4); }
    ctx.stroke();
    ctx.fillStyle = '#5a4430'; ctx.fillRect(px - r, cy + 2, W, 5);
    ctx.restore();
    voussoirs(ctx, W, T, '#b19b76', 9, 8);

    // песок: темнее и серее, с вулканической крошкой
    sandFloor(ctx, R, {
      cols: ['#bba889', '#ab9777', '#937f5f'], shadow: '35,25,15', dark: '70,58,45', light: '245,235,215',
      specks: 2200, rake: 'rgba(90,70,45,.08)', rakes: 22, stains: 7, side: 'left', sideA: 0.14,
    });
    // у краёв: амфоры и грабли у стены
    const amphora = (x, y, tilt) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
      ctx.fillStyle = '#8e6248';
      ctx.beginPath(); ctx.ellipse(0, -14, 7, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(0, 6); ctx.lineTo(2, 0); ctx.fill();
      ctx.fillRect(-2.5, -34, 5, 9);
      ctx.strokeStyle = '#7a523c'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-2.5, -31); ctx.quadraticCurveTo(-8, -30, -6, -23); ctx.moveTo(2.5, -31); ctx.quadraticCurveTo(8, -30, 6, -23); ctx.stroke();
      ctx.fillStyle = 'rgba(40,20,10,.25)'; ctx.beginPath(); ctx.ellipse(3, -13, 3, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    ctx.fillStyle = 'rgba(30,20,10,.2)';
    ctx.beginPath(); ctx.ellipse(66, 350, 46, 6, 0, 0, Math.PI * 2); ctx.fill();
    amphora(38, 348, -0.08); amphora(60, 350, 0.05); amphora(90, 352, 0.32);
    ctx.strokeStyle = '#5e4630'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(1238, 360); ctx.lineTo(1206, 288); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(1224, 362); ctx.lineTo(1254, 356); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const x = 1226 + i * 5.5; ctx.moveTo(x, 361 - i); ctx.lineTo(x + 1, 367 - i); }
    ctx.stroke();
  }

  // ------------------------------------------------------------
  //  Капуя: гордый травертиновый амфитеатр
  // ------------------------------------------------------------
  function paintCapua(ctx, R, crowd) {
    const px = AW / 2;
    ctx.fillStyle = vGrad(ctx, -40, 80, ['#d4dcd8', '#efe4c8', '#e6cf9f']);
    ctx.fillRect(0, 0, AW, 90);
    // велариум раскрыт слева и в центре, справа свёрнут к мачтам
    const xs = [];
    for (let x = -220; x <= AW + 220; x += 54) xs.push(x);
    const edge = 838;
    velarium(ctx, { yb: 52, vy: -700, xs, sag: 6, shadeTop: 'rgba(40,20,5,.5)', color: i => xs[i + 1] <= edge ? (i % 2 ? '#d8c69e' : '#86402c') : null });
    // свёрнутое полотнище вдоль крайнего каната
    {
      const yb = curveY(edge, 52), t = (-140 + 700) / (yb + 700);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#8a3020'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(edge, yb); ctx.lineTo(px + (edge - px) * t, -140); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,220,180,.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(edge - 2, yb); ctx.lineTo(px + (edge - px) * t - 2, -140); ctx.stroke();
      ctx.lineCap = 'butt';
    }
    // аттик с пилястрами и мачтами
    band(ctx, 50, 76, '#c9b089');
    for (let x = 16; x < AW; x += 64) {
      const yt = curveY(x, 52), yb = curveY(x, 76);
      ctx.fillStyle = '#dcc79f'; ctx.fillRect(x, yt, 8, yb - yt);
      ctx.fillStyle = '#3a2a1c'; ctx.fillRect(x + 26, curveY(x + 26, 58), 11, 9);
      ctx.fillStyle = '#6a5038'; ctx.fillRect(x + 2.5, yt - 36, 3, 36);
      if ((x / 64 | 0) % 2 === 0) {
        ctx.fillStyle = (x / 128 | 0) % 2 ? '#a8823a' : '#8a3424';
        ctx.beginPath(); ctx.moveTo(x + 5.5, yt - 36); ctx.lineTo(x + 18, yt - 32); ctx.lineTo(x + 5.5, yt - 28); ctx.fill();
      }
    }
    band(ctx, 48, 52, '#e4d2ac');
    curveLine(ctx, 76, 'rgba(0,0,0,.25)', 2, -1);

    const aisles = [80, 250, 430, 850, 1030, 1200];
    // верхние ряды
    seats(ctx, R, crowd, {
      y0: 76, y1: 138, rows: 6, size: 0.54, dynamic: false, dark: -0.28, stone: '#b59c78',
      density: 0.9, gaps: 0.01, pal: PAL_CAPUA, aisles, aisleW: 5,
      joint: 'rgba(80,60,40,.2)', jointStep: 28,
    });
    // аркада с флагами между арками
    arcade(ctx, R, {
      y0: 138, y1: 170, fill: vGrad(ctx, 138, 170, ['#dcc69e', '#c4ab82']), offset: 12, spacing: 58, archW: 20, archFrac: 0.78,
      dark: '#2a1f15', pilaster: '#e6d4b0', cap: '#f2e4c4',
    });
    for (let x = 12 - 19 - 2.5; x < AW; x += 58 * 3) {
      const bx = x - 2, yt = curveY(bx, 140), yb = curveY(bx, 166);
      const col = ((x / 174) | 0) % 2 ? '#b8862e' : '#8e2a1e';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(bx, yt); ctx.lineTo(bx + 10, yt); ctx.lineTo(bx + 10, yb); ctx.lineTo(bx + 5, yb - 4); ctx.lineTo(bx, yb); ctx.fill();
      ctx.fillStyle = '#d9b860'; ctx.fillRect(bx, yt + 4, 10, 1.5);
    }
    // средний ярус
    seats(ctx, R, crowd, {
      y0: 170, y1: 232, rows: 6, size: 0.72, dynamic: true, stone: '#b8a07a',
      density: 0.86, gaps: 0.012, pal: PAL_CAPUA, aisles, aisleW: 6,
      skip: [[px - 98, px + 98, 200]], joint: 'rgba(80,60,40,.18)', jointStep: 34,
    });
    // балтеус с красной полосой
    band(ctx, 232, 242, '#d8c49e');
    band(ctx, 236.5, 239, '#8e3424');
    curveLine(ctx, 232, 'rgba(255,245,225,.45)', 1.5, 1);
    // нижний ярус — всадники
    seats(ctx, R, crowd, {
      y0: 242, y1: 264, rows: 2, size: 0.95, dynamic: true, stone: '#c2aa84',
      density: 0.9, pal: [0, 6, 6, 20, 20, 2, 1, 5], aisles, aisleW: 7,
      skip: [[px - 98, px + 98, 0]],
    });

    // украшенная трибуна устроителя игр
    ctx.fillStyle = '#6e2a20'; ctx.fillRect(px - 92, 206, 184, 58);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(px - 92, 216, 184, 10);
    for (const dx of [-84, -30, 30, 84]) column(ctx, px + dx, 216, 264, 7, '#ece0c2', '#c9a24e');
    ctx.save();
    ctx.beginPath(); ctx.moveTo(px - 104, 198); ctx.lineTo(px + 104, 198); ctx.lineTo(px + 98, 214);
    for (let i = 0; i < 8; i++) ctx.quadraticCurveTo(px + 98 - i * 24.5 - 12.25, 223, px + 98 - (i + 1) * 24.5, 214);
    ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#8e2a1e'; ctx.fillRect(px - 110, 194, 220, 32);
    ctx.fillStyle = 'rgba(200,150,60,.6)';
    for (let x = px - 104; x < px + 104; x += 26) ctx.fillRect(x, 194, 8, 32);
    ctx.fillStyle = vGrad(ctx, 198, 223, ['rgba(255,230,180,.12)', 'rgba(40,10,5,.35)']); ctx.fillRect(px - 110, 194, 220, 32);
    ctx.restore();
    ctx.fillStyle = '#d4aa52'; ctx.fillRect(px - 106, 196, 212, 3);
    ctx.fillStyle = '#e8dcbe'; ctx.fillRect(px - 96, 250, 192, 14);
    ctx.fillStyle = '#8e2a1e'; ctx.fillRect(px - 60, 253, 120, 8);
    ctx.fillStyle = '#d4aa52'; ctx.beginPath(); ctx.arc(px, 257, 4.5, 0, Math.PI * 2); ctx.fill();
    garland(ctx, R, px - 96, px - 4, 250, 4, '#4a6a32', '#9b2e20');
    garland(ctx, R, px + 4, px + 96, 250, 4, '#4a6a32', '#9b2e20');
    [6, 2, 20, 20, 2, 6].forEach((c, i) => crowd.push({ x: px - 60 + i * 24, y: 250, s: 1.0, c, k: rpick(R, SKIN_DAY), ph: R() * 6 }));

    // свет: солнце пробивается справа, под велариумом тень
    ctx.fillStyle = hGrad(ctx, 0, AW, ['rgba(40,20,5,.28)', 'rgba(40,20,5,.08)', 'rgba(255,230,180,.08)']);
    ctx.fillRect(0, 40, AW, 230);

    // подиум из травертина с балюстрадой и рельефами
    podium(ctx, ['#e6d6b4', '#cdb894', '#a99272']);
    for (let i = 0; i * 150 < AW; i++) {
      const x = 12 + i * 150;
      if (Math.abs(x + 52 - px) < 120) continue;
      const y = curveY(x, 282);
      ctx.fillStyle = 'rgba(120,95,60,.14)'; ctx.fillRect(x, y, 104, 34);
      ctx.fillStyle = 'rgba(255,250,235,.4)'; ctx.fillRect(x, y, 104, 1.5); ctx.fillRect(x, y, 1.5, 34);
      ctx.fillStyle = 'rgba(70,50,30,.3)'; ctx.fillRect(x, y + 32.5, 104, 1.5); ctx.fillRect(x + 102.5, y, 1.5, 34);
      ctx.fillStyle = 'rgba(110,85,55,.2)';
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(x + 24 + k * 28, y + 18, 7, 11, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    band(ctx, 257, 266, '#efe3c6');
    ctx.fillStyle = 'rgba(90,70,45,.3)';
    for (let x = 4; x < AW; x += 8) ctx.fillRect(x, curveY(x, 259.5), 3, 4.5);
    curveLine(ctx, 257, '#f8f0dc', 1.5, 0.5);
    curveLine(ctx, 266, 'rgba(0,0,0,.25)', 2, 0);
    // красные и охристые полотнища
    for (let i = 0; i * 150 < AW + 150; i++) {
      const cx = i * 150 - 11;
      if (Math.abs(cx - px) < 90 || cx < 0) continue;
      const yt = curveY(cx, 266), col = i % 2 ? '#b8862e' : '#8e2a1e';
      ctx.fillStyle = col; ctx.fillRect(cx - 9, yt, 18, 44);
      ctx.fillStyle = shade(col, -0.25); ctx.fillRect(cx + 4, yt, 5, 44);
      ctx.fillStyle = '#e8cf86'; ctx.fillRect(cx - 9, yt + 6, 18, 2); ctx.fillRect(cx - 9, yt + 36, 18, 2);
      ctx.beginPath(); ctx.moveTo(cx - 9, yt + 44); ctx.lineTo(cx, yt + 53); ctx.lineTo(cx + 9, yt + 44); ctx.fillStyle = col; ctx.fill();
    }
    // ворота: арка из клинчатых камней и железная решётка
    const W = 86, T = 276;
    gateOpening(ctx, W, T);
    gateBars(ctx, W, T, '#3e3a34', 2.5);
    voussoirs(ctx, W, T, '#e2d2ae', 11, 10);
    ctx.fillStyle = '#efe3c6'; ctx.fillRect(px - 7, T - 11, 14, 13);
    ctx.strokeStyle = 'rgba(70,50,30,.4)'; ctx.lineWidth = 1; ctx.strokeRect(px - 7, T - 11, 14, 13);

    sandFloor(ctx, R, {
      cols: ['#dcbd8c', '#cfab78', '#b8915d'], shadow: '40,20,5', dark: '90,60,30', light: '255,240,210',
      rake: 'rgba(110,80,45,.08)', rakes: 30, stains: 9, side: 'left', sideA: 0.26,
    });
  }

  // ------------------------------------------------------------
  //  Статилиев амфитеатр: дерево и кирпич, вечер, огонь и дым
  // ------------------------------------------------------------
  function paintStatilius(ctx, R, crowd) {
    const px = AW / 2;
    // закатное небо
    ctx.fillStyle = vGrad(ctx, -50, 60, ['#2a1a2e', '#5e2a34', '#a84e36', '#d4843e']);
    ctx.fillRect(0, 0, AW, 70);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = `rgba(50,22,36,${0.25 + R() * 0.25})`;
      ctx.beginPath(); ctx.ellipse(R() * AW, R() * 30, 80 + R() * 160, 3 + R() * 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    // черепичный навес верхней деревянной галереи
    band(ctx, 30, 42, '#3a2216');
    ctx.strokeStyle = 'rgba(120,60,35,.5)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < AW; x += 9) { const y = curveY(x, 40); ctx.moveTo(x, y); ctx.arc(x + 4.5, y, 4.5, Math.PI, 0); }
    ctx.stroke();
    curveLine(ctx, 30, 'rgba(230,140,80,.4)', 1.5, 0.5);
    // галерея со стоящими зрителями
    band(ctx, 42, 64, '#1c120c');
    {
      const cache = {};
      for (let x = R() * 5; x < AW; x += 3.6 + R() * 2.4) {
        if (R() < 0.15) continue;
        staticFigure(ctx, { x, y: curveY(x, 60), s: 0.48 * (0.85 + R() * 0.3), c: rpick(R, PAL_STATILIUS), k: rpick(R, SKIN_DUSK) }, -0.55, cache);
      }
    }
    for (let x = 6; x < AW; x += 38) {
      const yt = curveY(x, 42), yb = curveY(x, 64);
      ctx.fillStyle = '#4e3220'; ctx.fillRect(x, yt, 5, yb - yt);
    }
    band(ctx, 57, 64, '#5a3a24');
    curveLine(ctx, 57, 'rgba(240,150,90,.25)', 1, 0.5);

    const aisles = [100, 300, 500, 780, 980, 1180];
    // деревянные ряды
    seats(ctx, R, crowd, {
      y0: 64, y1: 140, rows: 7, size: 0.54, dynamic: false, dark: -0.5, stone: '#5e4230',
      density: 0.96, pal: PAL_STATILIUS, skin: SKIN_DUSK, aisles, aisleW: 5,
      joint: 'rgba(25,14,8,.45)', jointStep: 14, riser: 'rgba(20,10,5,.25)', hi: 'rgba(255,190,130,.1)',
      texture: (y0, y1) => {
        for (let x = 70; x < AW; x += 160) {
          const yt = curveY(x, y0), yb = curveY(x, y1);
          ctx.fillStyle = '#3a2416'; ctx.fillRect(x, yt, 8, yb - yt);
          ctx.fillStyle = 'rgba(255,170,110,.12)'; ctx.fillRect(x, yt, 2, yb - yt);
        }
      },
    });
    // кирпичная стена с арками, в которых горят факелы
    const brick = (y0, y1, col) => {
      band(ctx, y0, y1, col);
      ctx.strokeStyle = 'rgba(30,12,6,.35)'; ctx.lineWidth = 1;
      for (let y = y0 + 4; y < y1; y += 4) curveLine(ctx, y, 'rgba(30,12,6,.32)', 0.8);
      ctx.beginPath();
      for (let y = y0, row = 0; y < y1 - 1; y += 4, row++) {
        for (let x = (row % 2) * 7; x < AW; x += 14) { const yy = curveY(x, y); ctx.moveTo(x, yy); ctx.lineTo(x, yy + 4); }
      }
      ctx.stroke();
    };
    brick(140, 160, '#6e3422');
    const torchArches = [];
    for (let x = 60; x < AW; x += 140) {
      if (Math.abs(x + 9 - px) < 60) continue;
      const yb = curveY(x + 9, 160) - 1;
      ctx.beginPath(); archPath(ctx, x, yb, 18, 17);
      ctx.fillStyle = '#1a0c06'; ctx.fill();
      torchArches.push([x + 9, yb - 8]);
    }
    curveLine(ctx, 140, 'rgba(240,150,90,.3)', 1.5, 1);
    // каменные ряды — плотная шумная толпа
    seats(ctx, R, crowd, {
      y0: 160, y1: 228, rows: 6, size: 0.74, dynamic: true, stone: '#5c4434',
      density: 0.98, pal: PAL_STATILIUS, skin: SKIN_DUSK, aisles, aisleW: 6,
      skip: [[px - 96, px + 96, 204]], riser: 'rgba(20,10,5,.22)', hi: 'rgba(255,190,130,.1)',
      joint: 'rgba(25,14,8,.3)', jointStep: 30,
    });
    brick(228, 238, '#6a3020');
    for (let x = 0; x < AW; x += 64) garland(ctx, R, x, x + 64, 229, 3, '#3e5a2a', '#8e2a1e');
    seats(ctx, R, crowd, {
      y0: 238, y1: 262, rows: 2, size: 0.95, dynamic: true, stone: '#644a38',
      density: 0.98, pal: PAL_STATILIUS, skin: SKIN_DUSK, aisles, aisleW: 7,
      skip: [[px - 96, px + 96, 0]], riser: 'rgba(20,10,5,.22)', hi: 'rgba(255,190,130,.1)',
    });

    // ложа устроителя: тёмный пурпур, бронза, трофейные щиты
    ctx.fillStyle = '#2a120e'; ctx.fillRect(px - 92, 206, 184, 56);
    for (const dx of [-60, -20, 20, 60]) {
      ctx.fillStyle = '#8a6030'; ctx.beginPath(); ctx.arc(px + dx, 226, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c89a52'; ctx.beginPath(); ctx.arc(px + dx - 1.5, 224.5, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save();
    ctx.beginPath(); ctx.moveTo(px - 100, 198); ctx.lineTo(px + 100, 198); ctx.lineTo(px + 94, 212);
    for (let i = 0; i < 8; i++) ctx.quadraticCurveTo(px + 94 - i * 23.5 - 11.75, 220, px + 94 - (i + 1) * 23.5, 212);
    ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#5e1a14'; ctx.fillRect(px - 104, 194, 208, 30);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let x = px - 100; x < px + 100; x += 20) ctx.fillRect(x, 194, 9, 30);
    ctx.restore();
    ctx.fillStyle = '#a8783a'; ctx.fillRect(px - 102, 196, 204, 3);
    ctx.fillStyle = '#4a1d15'; ctx.fillRect(px - 94, 248, 188, 14);
    ctx.fillStyle = '#a8783a'; ctx.fillRect(px - 94, 248, 188, 2);
    [12, 13, 17, 12, 13].forEach((c, i) => crowd.push({ x: px - 52 + i * 26, y: 248, s: 1.0, c, k: rpick(R, SKIN_DUSK), ph: R() * 6 }));
    // бронзовые треножники у ложи
    const tripod = (x, yb, h) => {
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - h * 0.28, yb); ctx.lineTo(x, yb - h * 0.8); ctx.lineTo(x + h * 0.28, yb); ctx.moveTo(x, yb); ctx.lineTo(x, yb - h * 0.8); ctx.stroke();
      ctx.fillStyle = '#6a4a28';
      ctx.beginPath(); ctx.moveTo(x - h * 0.3, yb - h * 0.82); ctx.lineTo(x + h * 0.3, yb - h * 0.82); ctx.lineTo(x + h * 0.16, yb - h * 0.7); ctx.lineTo(x - h * 0.16, yb - h * 0.7); ctx.fill();
      flame(ctx, x, yb - h * 0.8, h * 0.55);
    };
    tripod(px - 106, 262, 36); tripod(px + 106, 262, 36);

    // дым и сумрак
    for (let i = 0; i < 46; i++) {
      ctx.fillStyle = R() < 0.7 ? `rgba(60,42,38,${0.05 + R() * 0.06})` : `rgba(200,130,90,${0.03 + R() * 0.04})`;
      ctx.beginPath(); ctx.ellipse(R() * AW, 30 + R() * 220, 60 + R() * 140, 8 + R() * 18, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = vGrad(ctx, 0, 262, ['rgba(12,4,8,.45)', 'rgba(12,4,8,.12)']);
    ctx.fillRect(0, 20, AW, 244);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hGrad(ctx, 0, AW, ['rgba(255,130,60,.1)', 'rgba(255,130,60,0)', 'rgba(0,0,0,0)']);
    ctx.fillRect(0, 0, AW, 264);
    ctx.restore();
    for (const [x, y] of torchArches) { flame(ctx, x, y + 6, 10); glow(ctx, x, y, 34, '255,140,60', 0.32); }
    glow(ctx, px - 106, 228, 70, '255,140,60', 0.35); glow(ctx, px + 106, 228, 70, '255,140,60', 0.35);

    // подиум: тёмно-красная штукатурка, щиты, гирлянды, жаровни на кронштейнах
    podium(ctx, ['#5e261c', '#4a1d15', '#36140e']);
    for (let i = 0; i * 140 < AW; i++) {
      const x = 16 + i * 140;
      if (Math.abs(x + 50 - px) < 116) continue;
      const y = curveY(x, 282);
      ctx.fillStyle = '#1e0c08'; ctx.fillRect(x, y, 100, 34);
      ctx.strokeStyle = '#8a6030'; ctx.lineWidth = 1.2; ctx.strokeRect(x + 3, y + 3, 94, 28);
      ctx.fillStyle = '#7a5428'; ctx.beginPath(); ctx.arc(x + 50, y + 17, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b8884a'; ctx.beginPath(); ctx.arc(x + 48, y + 15, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    band(ctx, 262, 267, '#6a3a22');
    curveLine(ctx, 262, 'rgba(240,150,90,.35)', 1.2, 0.5);
    for (let x = 0; x < AW; x += 80) {
      if (Math.abs(x + 40 - px) < 90) continue;
      garland(ctx, R, x, x + 80, 267, 6, '#3e5a2a', '#9b2e20');
    }
    const braziers = [150, 370, 910, 1130];
    for (const x of braziers) {
      const y = curveY(x, 300);
      ctx.strokeStyle = '#1a100a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x - 8, y + 16); ctx.lineTo(x, y + 2); ctx.lineTo(x + 8, y + 16); ctx.stroke();
      ctx.fillStyle = '#3a2618';
      ctx.beginPath(); ctx.moveTo(x - 12, y - 2); ctx.lineTo(x + 12, y - 2); ctx.lineTo(x + 7, y + 4); ctx.lineTo(x - 7, y + 4); ctx.fill();
      flame(ctx, x, y - 1, 22);
    }
    // ворота: кирпичная арка и тяжёлая деревянная решётка
    const W = 84, T = 274;
    const { r, cy } = gateOpening(ctx, W, T);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(px - r, SAND_TOP + 4); ctx.lineTo(px - r, cy); ctx.arc(px, cy, r, Math.PI, 0); ctx.lineTo(px + r, SAND_TOP + 4); ctx.clip();
    ctx.strokeStyle = '#4a3422'; ctx.lineWidth = 4.5;
    ctx.beginPath();
    for (let x = px - r + 7; x < px + r; x += 13) { ctx.moveTo(x, SAND_TOP + 4); ctx.lineTo(x, T); }
    for (let y = T + 14; y < SAND_TOP; y += 16) { ctx.moveTo(px - r, y); ctx.lineTo(px + r, y); }
    ctx.stroke();
    ctx.fillStyle = '#8a7a6a';
    for (let x = px - r + 7; x < px + r; x += 13) for (let y = T + 14; y < SAND_TOP; y += 16) ctx.fillRect(x - 1, y - 1, 2, 2);
    ctx.restore();
    voussoirs(ctx, W, T, '#7a3a26', 15, 9);
    for (const dx of [-62, 62]) { flame(ctx, px + dx, 292, 16); }

    // свечение огня поверх подиума
    for (const x of braziers) glow(ctx, x, curveY(x, 290), 90, '255,130,50', 0.38);
    glow(ctx, px - 62, 285, 60, '255,140,60', 0.3); glow(ctx, px + 62, 285, 60, '255,140,60', 0.3);

    sandFloor(ctx, R, {
      cols: ['#b07c50', '#9a6a40', '#7e5432'], shadow: '25,10,5', dark: '60,35,20', light: '250,200,150',
      rake: 'rgba(60,35,20,.1)', rakes: 26, stains: 12, stain: '80,20,12', side: 'right', sideA: 0.3,
    });
    // треножники с огнём по краям арены
    for (const x of [56, 1224]) {
      const yb = 374;
      ctx.fillStyle = 'rgba(20,8,4,.3)'; ctx.beginPath(); ctx.ellipse(x, yb, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
      tripod(x, yb, 58);
      glow(ctx, x, yb - 50, 150, '255,130,50', 0.32);
    }
    for (const x of braziers) glow(ctx, x, SAND_TOP + 18, 120, '255,130,50', 0.1);
  }

  // ------------------------------------------------------------
  //  Колизей: четыре яруса, огромный велариум, пульвинар Императора
  // ------------------------------------------------------------
  function paintColosseum(ctx, R, crowd) {
    const px = AW / 2;
    ctx.fillStyle = vGrad(ctx, -40, 50, ['#f3e6c6', '#e8d2a2']);
    ctx.fillRect(0, 0, AW, 60);
    // велариум во всё небо
    const xs = [];
    for (let x = -300; x <= AW + 300; x += 44) xs.push(x);
    velarium(ctx, { yb: 52, vy: -520, xs, sag: 5, rope: 'rgba(90,70,45,.6)', shadeTop: 'rgba(60,35,10,.35)',
      color: i => (i % 6 === 3 ? '#d9c08c' : i % 2 ? '#f1e8d0' : '#e3d3ae') });
    curveLine(ctx, 2, 'rgba(90,70,45,.3)', 1, 0);
    curveLine(ctx, 26, 'rgba(90,70,45,.3)', 1, 0);
    // такелаж: мачты и канаты к полотну
    ctx.strokeStyle = 'rgba(80,60,40,.55)'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let x = 20; x < AW; x += 44) {
      const y = curveY(x, 52);
      ctx.moveTo(x, y); ctx.lineTo(x - 14, y - 30); ctx.moveTo(x, y); ctx.lineTo(x + 14, y - 30);
    }
    ctx.stroke();

    // верхняя колоннада со статуями
    band(ctx, 50, 90, '#3c2e22');
    {
      const yTop = 58;
      let n = 0;
      for (let x = 0; x < AW + 40; x += 40, n++) {
        const yt = curveY(x, yTop), yb = curveY(x, 88);
        if (n % 2) statue(ctx, x - 20, curveY(x - 20, 87), (yb - yt) * 0.7, R() < 0.25 ? '#c9a656' : '#e6decb', (R() * 3) | 0);
        column(ctx, x, yt, yb, 7, '#efe6d2', '#cfa84e');
      }
    }
    band(ctx, 48, 58, '#e8dcc0');
    band(ctx, 55, 57, '#c9a04a');
    band(ctx, 87, 92, '#d8caa8');

    // самый верх — деревянные ряды для простого люда
    seats(ctx, R, crowd, {
      y0: 92, y1: 116, rows: 4, size: 0.42, dynamic: false, dark: -0.22, stone: '#b8a27e',
      density: 0.97, pal: PAL_COLOSSEUM, joint: 'rgba(70,50,30,.25)', jointStep: 12,
    });
    // аркада со статуями в арках
    arcade(ctx, R, {
      y0: 116, y1: 136, fill: vGrad(ctx, 116, 136, ['#e8dcc2', '#d4c6a6']), offset: 6, spacing: 50, archW: 18, archFrac: 0.84,
      dark: '#3a2c20', pilaster: '#f0e8d6', cap: '#cfa84e', statues: 0.85, gilt: 0.2, ring: 'rgba(201,160,74,.6)',
    });
    const aisles = [90, 260, 430, 850, 1020, 1190];
    // мраморные ряды — море зрителей
    seats(ctx, R, crowd, {
      y0: 136, y1: 184, rows: 6, size: 0.5, dynamic: false, dark: -0.2, stone: '#cfc0a0',
      density: 0.98, pal: PAL_COLOSSEUM, aisles, aisleW: 4, skip: [[px - 110, px + 110, 168]],
      joint: 'rgba(90,70,45,.15)', jointStep: 30,
    });
    band(ctx, 184, 194, '#e9dfc8');
    band(ctx, 188.5, 190.5, '#c9a04a');
    for (let x = 70; x < AW; x += 128) {
      if (Math.abs(x - px) < 130) continue;
      ctx.beginPath(); archPath(ctx, x - 7, curveY(x, 194), 14, 9); ctx.fillStyle = '#3a2c20'; ctx.fill();
    }
    curveLine(ctx, 184, 'rgba(255,250,235,.5)', 1.5, 1);
    // средний ярус
    seats(ctx, R, crowd, {
      y0: 194, y1: 240, rows: 7, size: 0.62, dynamic: true, stone: '#d6c8a8',
      density: 0.98, pal: PAL_COLOSSEUM, aisles, aisleW: 5, skip: [[px - 112, px + 112, 0]],
      joint: 'rgba(90,70,45,.15)', jointStep: 36,
    });
    // балтеус с позолоченными перилами
    band(ctx, 240, 248, '#f0e8d6');
    band(ctx, 240, 242, '#c9a04a');
    // подиум — сенаторы в белых тогах
    seats(ctx, R, crowd, {
      y0: 248, y1: 264, rows: 2, size: 0.95, dynamic: true, stone: '#e2d6bc',
      density: 0.95, pal: PAL_SENATE, aisles, aisleW: 7, skip: [[px - 112, px + 112, 0]],
    });

    // пульвинар: пурпур и золото
    ctx.fillStyle = vGrad(ctx, 196, 264, ['#4a1a4e', '#2e0f32']); ctx.fillRect(px - 104, 196, 208, 68);
    ctx.fillStyle = 'rgba(255,200,255,.07)';
    for (let x = px - 100; x < px + 100; x += 12) ctx.fillRect(x, 212, 4, 52);
    // фронтон с орлом
    ctx.fillStyle = '#efe6d2';
    ctx.beginPath(); ctx.moveTo(px - 112, 196); ctx.lineTo(px + 112, 196); ctx.lineTo(px, 168); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d8c79e';
    ctx.beginPath(); ctx.moveTo(px - 96, 193); ctx.lineTo(px + 96, 193); ctx.lineTo(px, 173); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c9a04a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px - 112, 196); ctx.lineTo(px, 168); ctx.lineTo(px + 112, 196); ctx.stroke();
    ctx.fillStyle = '#c9a04a';
    ctx.beginPath(); ctx.ellipse(px, 186, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px - 2, 184); ctx.lineTo(px - 16, 178); ctx.lineTo(px - 12, 186); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px + 2, 184); ctx.lineTo(px + 16, 178); ctx.lineTo(px + 12, 186); ctx.closePath(); ctx.fill();
    ctx.fillRect(px - 1, 165, 2, 5);
    statue(ctx, px - 112, 196, 18, '#c9a656', 0); statue(ctx, px + 112, 196, 18, '#c9a656', 1);
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(px - 112, 196, 224, 8);
    ctx.fillStyle = '#c9a04a'; ctx.fillRect(px - 112, 202, 224, 2);
    // занавес-ламбрекен
    ctx.fillStyle = '#6a2a6e';
    ctx.beginPath(); ctx.moveTo(px - 104, 204); ctx.lineTo(px + 104, 204); ctx.lineTo(px + 104, 212);
    for (let i = 0; i < 8; i++) ctx.quadraticCurveTo(px + 104 - i * 26 - 13, 222, px + 104 - (i + 1) * 26, 212);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d4aa52'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(px + 104, 212);
    for (let i = 0; i < 8; i++) ctx.quadraticCurveTo(px + 104 - i * 26 - 13, 222, px + 104 - (i + 1) * 26, 212);
    ctx.stroke();
    for (const dx of [-98, -40, 40, 98]) column(ctx, px + dx, 206, 264, 9, '#f2eadb', '#d4aa52');
    ctx.fillStyle = '#efe6d2'; ctx.fillRect(px - 106, 250, 212, 14);
    ctx.fillStyle = vGrad(ctx, 252, 262, ['#e2bf68', '#9a7a30']); ctx.fillRect(px - 34, 252, 68, 10);
    ctx.fillStyle = '#4a3410'; ctx.font = 'bold 8px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('S·P·Q·R', px, 257.5);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    // Император, свита, преторианцы
    crowd.push({ x: px, y: 251, s: 1.12, c: 18, k: 3, ph: R() * 6 });
    [[-22, 20], [22, 20], [-48, 6], [48, 6], [-74, 2], [74, 2]].forEach(([dx, c]) =>
      crowd.push({ x: px + dx, y: 251, s: 1.0, c, k: rpick(R, SKIN_DAY), ph: R() * 6 }));

    // золотые лучи сквозь велариум и тёплая дымка
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [x0, w] of [[130, 46], [330, 70], [560, 38], [760, 64], [1010, 52]]) {
      ctx.fillStyle = vGrad(ctx, 0, 262, ['rgba(255,214,140,.13)', 'rgba(255,214,140,.02)']);
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + w, 0); ctx.lineTo(x0 + w * 1.7 + 170, 262); ctx.lineTo(x0 + 170, 262); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = hGrad(ctx, 0, AW, ['rgba(255,210,140,0)', 'rgba(255,210,140,.07)', 'rgba(255,210,140,0)']);
    ctx.fillRect(0, 0, AW, 264);
    ctx.restore();
    ctx.fillStyle = hGrad(ctx, 0, AW, ['rgba(40,20,5,.18)', 'rgba(0,0,0,0)', 'rgba(40,20,5,.18)']);
    ctx.fillRect(0, 0, AW, 264);

    // подиум из белого мрамора: позолоченные таблички и пурпурные полотнища
    podium(ctx, ['#f4ecdc', '#ddd0b4', '#bfae8c']);
    for (let i = 0; i * 150 < AW; i++) {
      const x = 16 + i * 150;
      if (Math.abs(x + 50 - px) < 120) continue;
      const y = curveY(x, 282);
      ctx.fillStyle = vGrad(ctx, y, y + 32, ['#e4c26c', '#b8913e', '#8e6e2a']); ctx.fillRect(x, y, 100, 32);
      ctx.strokeStyle = 'rgba(80,55,15,.6)'; ctx.lineWidth = 1; ctx.strokeRect(x + 3.5, y + 3.5, 93, 25);
      ctx.fillStyle = 'rgba(70,45,10,.55)';
      for (let k = 0; k < 3; k++) {
        let lx = x + 12;
        while (lx < x + 86) { const lw = 3 + R() * 7; ctx.fillRect(lx, y + 9 + k * 6, Math.min(lw, x + 88 - lx), 2); lx += lw + 2 + R() * 2; }
      }
      ctx.fillStyle = 'rgba(255,245,210,.45)'; ctx.fillRect(x, y, 100, 1.5);
    }
    band(ctx, 257, 266, '#f6efe0');
    ctx.fillStyle = 'rgba(120,100,70,.25)';
    for (let x = 4; x < AW; x += 7) ctx.fillRect(x, curveY(x, 259.5), 2.5, 4.5);
    band(ctx, 256, 258, '#c9a04a');
    curveLine(ctx, 266, 'rgba(0,0,0,.22)', 2, 0);
    for (let i = 0; i * 150 < AW + 150; i++) {
      const cx = i * 150 + 141;
      if (Math.abs(cx - px) < 100 || cx > AW) continue;
      const yt = curveY(cx, 266);
      ctx.fillStyle = '#5a2260'; ctx.fillRect(cx - 10, yt, 20, 48);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(cx + 4, yt, 6, 48);
      ctx.fillStyle = '#d4aa52'; ctx.fillRect(cx - 10, yt + 5, 20, 2.5); ctx.fillRect(cx - 10, yt + 46, 20, 3);
      ctx.beginPath(); ctx.arc(cx, yt + 24, 4, 0, Math.PI * 2); ctx.fill();
    }
    // ворота: мраморная арка, колонны, бронзовая решётка
    const W = 88, T = 278;
    gateOpening(ctx, W, T);
    gateBars(ctx, W, T, '#7a6234', 2.5);
    voussoirs(ctx, W, T, '#f0e8d6', 13, 9);
    ctx.strokeStyle = '#c9a04a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, T + W / 2, W / 2 + 10, Math.PI, 0); ctx.stroke();
    for (const dx of [-66, 66]) column(ctx, px + dx, 272, SAND_TOP + 2, 11, '#f2eadb', '#d4aa52');

    sandFloor(ctx, R, {
      cols: ['#e8d6ac', '#dcc493', '#c6a878'], shadow: '60,40,15', dark: '120,90,50', light: '255,250,235',
      rake: 'rgba(130,100,60,.07)', rakes: 40, neat: true, stains: 4, side: 'right', sideA: 0.16,
    });
  }

  // ------------------------------------------------------------
  //  Точка входа: рисует фон и возвращает зрителей для анимации
  // ------------------------------------------------------------
  const PAINTERS = [paintPompeii, paintCapua, paintStatilius, paintColosseum];

  function paint(ctx, tierIdx) {
    let i = Math.round(Number(tierIdx));
    if (!Number.isFinite(i)) i = 0;
    i = Math.max(0, Math.min(VENUES.length - 1, i));
    const R = mulberry32(VENUE_SEEDS[i]);
    const crowd = [];
    ctx.save();
    PAINTERS[i](ctx, R, crowd);
    ctx.restore();
    return crowd;
  }

  return { paint };
})();

// Рисует фон арены tierIdx (0..3) и возвращает [{x, y, s, c, k, ph}] — зрителей для анимации
function paintArena(ctx, tierIdx) {
  return VENUE_ART.paint(ctx, tierIdx);
}
