// Знамёна лудуса: выбираются при новой игре, видны на вкладке «Лудус».
// Рисуются кодом на canvas, как вся графика игры; drawBanner(ctx, знамя, x, y, ширина, высота).
const BANNERS = [
  { id: 'wreath', name: 'Венок победителя', motto: 'VINCERE AVT MORI', tr: 'Победить или умереть', emblem: 'wreath', shape: 'fringe', top: 'spear',
    cloth: '#8e1a12', trim: '#d4aa68', ink: '#dcb562', ink2: '#dcb562' },
  { id: 'gladii', name: 'Скрещённые мечи', motto: 'FERRVM ET SANGVIS', tr: 'Железо и кровь', emblem: 'gladii', shape: 'swallow', top: 'spear',
    cloth: '#1d1815', trim: '#a8291a', text: '#d9c9a8', ink: '#c9d0d6', ink2: '#b48d4f' },
  { id: 'trident', name: 'Трезубец и сеть', motto: 'RETE ET TRIDENS', tr: 'Сеть и трезубец', emblem: 'trident', shape: 'tabs', top: 'ring',
    cloth: '#1d4a63', trim: '#cdd5da', ink: '#dfe6ea', ink2: 'rgba(222,232,238,.5)' },
  { id: 'bull', name: 'Бычья голова', motto: 'VIS TAVRI', tr: 'Сила быка', emblem: 'bull', shape: 'fringe', top: 'ring',
    cloth: '#b98a3e', trim: '#3a1c12', ink: '#2c1710', ink2: '#ece0c4' },
  { id: 'sun', name: 'Непобедимое солнце', motto: 'SOL INVICTVS', tr: 'Непобедимое солнце', emblem: 'sun', shape: 'point', top: 'spear',
    cloth: '#d19f36', trim: '#8e1a12', ink: '#a3230f', ink2: '#a3230f' },
  { id: 'palm', name: 'Пальмовая ветвь', motto: 'PALMA VICTORI', tr: 'Пальма победителю', emblem: 'palm', shape: 'fringe', top: 'spear',
    cloth: '#4a1f4f', trim: '#d4aa68', ink: '#e2ba5c', ink2: '#c7321f' },
  { id: 'rudis', name: 'Рудис свободы', motto: 'RVDE DONATVS', tr: 'Награждённый рудисом', emblem: 'rudis', shape: 'swallow', top: 'spear',
    cloth: '#2b3a2a', trim: '#b48d4f', ink: '#d7b47c', ink2: '#b3bcc3' },
  { id: 'sica', name: 'Сика и парма', motto: 'VIRTVTE ET FERRO', tr: 'Доблестью и железом', emblem: 'sica', shape: 'arch', top: 'ring',
    cloth: '#6b2a17', trim: '#e2d3b2', ink: '#c99f58', ink2: '#d3d9de' },
  { id: 'moon', name: 'Луна и звёзды', motto: 'NOX NOSTRA', tr: 'Ночь наша', emblem: 'moon', shape: 'tabs', top: 'crescent',
    cloth: '#161d33', trim: '#b9c3cf', ink: '#e1e7ef', ink2: '#e1e7ef' },
  { id: 'helmet', name: 'Шлем с гребнем', motto: 'GLORIA ARENAE', tr: 'Слава арены', emblem: 'helmet', shape: 'tabs', top: 'spear',
    cloth: '#dccfb3', trim: '#8e1a12', ink: '#a8814a', ink2: '#9b1d14' },
];
const bannerOf = id => BANNERS.find(b => b.id === id) || BANNERS[0];

// Эмблемы рисуются в квадрате -50..50
const BN_TAU = Math.PI * 2;
const BN_EDGE = 'rgba(0,0,0,.35)';
function bnStar(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath(); c.fill();
}
const BANNER_EMBLEMS = {
  wreath(c, k) {
    c.strokeStyle = k.ink; c.fillStyle = k.ink; c.lineWidth = 2.4; c.lineCap = 'round';
    c.beginPath(); c.arc(0, 2, 34, Math.PI * 0.58, Math.PI * 1.45); c.stroke();
    c.beginPath(); c.arc(0, 2, 34, Math.PI * 0.42, -Math.PI * 0.45, true); c.stroke();
    for (const side of [-1, 1]) {
      for (let t = 0; t < 11; t++) {
        const a = side < 0 ? Math.PI * 0.62 + t * Math.PI * 0.08 : Math.PI * 0.38 - t * Math.PI * 0.08;
        const dir = side < 0 ? a + Math.PI / 2 : a - Math.PI / 2;
        const px = Math.cos(a) * 34, py = 2 + Math.sin(a) * 34, sc = 1 - t * 0.035;
        for (const tilt of [-0.6, 0.6]) {
          const d = dir + tilt;
          c.save(); c.translate(px + Math.cos(d) * 5.5 * sc, py + Math.sin(d) * 5.5 * sc); c.rotate(d);
          c.beginPath(); c.ellipse(0, 0, 6.4 * sc, 2.5 * sc, 0, 0, BN_TAU); c.fill();
          c.restore();
        }
      }
    }
    // лента внизу
    c.beginPath(); c.ellipse(-5.5, 37, 5.5, 3.2, -0.3, 0, BN_TAU); c.ellipse(5.5, 37, 5.5, 3.2, 0.3, 0, BN_TAU); c.fill();
    c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(-1, 38); c.quadraticCurveTo(-6, 44, -12, 49); c.moveTo(1, 38); c.quadraticCurveTo(6, 44, 12, 49); c.stroke();
    c.beginPath(); c.arc(0, 37, 2.6, 0, BN_TAU); c.fill();
  },
  gladii(c, k) {
    const sword = () => {
      c.beginPath(); c.moveTo(-4.6, 18); c.lineTo(-4.6, -24); c.lineTo(0, -40); c.lineTo(4.6, -24); c.lineTo(4.6, 18); c.closePath();
      c.fillStyle = k.ink; c.fill(); c.strokeStyle = BN_EDGE; c.lineWidth = 1; c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(0, -30); c.lineTo(0, 16); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-2.6, -24); c.lineTo(-2.6, 16); c.stroke();
      c.fillStyle = k.ink2;
      c.beginPath(); c.roundRect(-11, 18, 22, 5.5, 2.5); c.fill(); c.strokeStyle = BN_EDGE; c.stroke();
      c.fillStyle = '#3b2416'; c.fillRect(-3.2, 23.5, 6.4, 13);
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.beginPath();
      for (let y = 26; y < 36; y += 3) { c.moveTo(-3.2, y); c.lineTo(3.2, y); }
      c.stroke();
      c.fillStyle = k.ink2; c.beginPath(); c.ellipse(0, 40, 6.5, 4.2, 0, 0, BN_TAU); c.fill(); c.strokeStyle = BN_EDGE; c.stroke();
    };
    for (const r of [-0.62, 0.62]) { c.save(); c.translate(0, 4); c.rotate(r); sword(); c.restore(); }
  },
  trident(c, k) {
    // сеть ретиария свисает с трезубца, по краю свинцовые грузила
    const P = (u, v) => {
      const tx = -17 + 34 * u, ty = -22, bx = -42 + 84 * u, by = 37 + 5 * Math.sin(Math.PI * u);
      const cx = (tx + bx) / 2 + (u - 0.5) * 16, cy = 8;
      return [(1 - v) * (1 - v) * tx + 2 * (1 - v) * v * cx + v * v * bx, (1 - v) * (1 - v) * ty + 2 * (1 - v) * v * cy + v * v * by];
    };
    const NU = 9, SL = 0.55;
    c.strokeStyle = k.ink2; c.lineWidth = 1; c.lineJoin = 'round';
    // ромбовидная ячейка: две косые нити через всё полотно сети
    for (const dir of [-1, 1]) {
      for (let u0 = -SL; u0 <= 1 + SL + 1e-6; u0 += 1 / 7) {
        c.beginPath(); let on = false;
        for (let j = 0; j <= 30; j++) {
          const v = j / 30, u = u0 + dir * v * SL;
          if (u < 0 || u > 1) { on = false; continue; }
          const [x, y] = P(u, v); on ? c.lineTo(x, y) : c.moveTo(x, y); on = true;
        }
        c.stroke();
      }
    }
    c.lineWidth = 1.8;
    c.beginPath(); for (let i = 0; i <= 30; i++) c.lineTo(...P(i / 30, 1)); c.stroke();
    for (const u of [0, 1]) { c.beginPath(); for (let j = 0; j <= 30; j++) c.lineTo(...P(u, j / 30)); c.stroke(); }
    for (let i = 0; i <= NU; i++) {
      const [x, y] = P(i / NU, 1);
      c.fillStyle = '#4e5459'; c.beginPath(); c.arc(x, y + 2, 2.7, 0, BN_TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(x - 0.8, y + 1.2, 0.9, 0, BN_TAU); c.fill();
    }
    // древко
    c.fillStyle = '#6b4a2c'; c.fillRect(-2.4, -4, 4.8, 52);
    c.fillStyle = 'rgba(255,235,200,.22)'; c.fillRect(-1.6, -4, 1.2, 52);
    c.fillStyle = '#3b2416'; for (let y = 18; y < 32; y += 3) c.fillRect(-2.8, y, 5.6, 1.8);
    // железо
    c.fillStyle = k.ink; c.strokeStyle = BN_EDGE; c.lineWidth = 0.9;
    c.beginPath(); c.roundRect(-3.2, 44, 6.4, 5, 1.5); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(-4, -11, 8, 9, 1.5); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-19.5, -24); c.quadraticCurveTo(-19.5, -8, 0, -9); c.quadraticCurveTo(19.5, -8, 19.5, -24);
    c.lineTo(15, -24); c.quadraticCurveTo(15, -13.5, 0, -14); c.quadraticCurveTo(-15, -13.5, -15, -24); c.closePath(); c.fill(); c.stroke();
    const prong = (x, top, base) => {
      c.beginPath(); c.rect(x - 2.2, top, 4.4, base - top); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x, top - 12); c.lineTo(x + 6, top + 4); c.lineTo(x + 2.2, top + 1); c.lineTo(x - 2.2, top + 1); c.lineTo(x - 6, top + 4); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.moveTo(x - 0.9, top - 7); c.lineTo(x - 0.9, base - 1); c.stroke(); c.strokeStyle = BN_EDGE;
    };
    prong(-17.25, -36, -23); prong(17.25, -36, -23); prong(0, -40, -13);
  },
  bull(c, k) {
    c.fillStyle = k.ink2; c.strokeStyle = BN_EDGE; c.lineWidth = 1;
    for (const s of [-1, 1]) {
      c.save(); c.scale(s, 1);
      c.beginPath(); c.moveTo(-12, -13);
      c.bezierCurveTo(-30, -11, -42, -22, -40, -44);
      c.bezierCurveTo(-35, -29, -27, -23, -12, -23);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = k.ink;
      c.beginPath(); c.moveTo(-15, -9); c.lineTo(-32, -6); c.quadraticCurveTo(-26, 2, -14, 1); c.closePath(); c.fill();
      c.fillStyle = k.ink2;
      c.restore();
    }
    c.fillStyle = k.ink;
    c.beginPath(); c.moveTo(-17, -20); c.quadraticCurveTo(0, -27, 17, -20); c.quadraticCurveTo(20, -2, 13, 14);
    c.quadraticCurveTo(11, 25, 13, 31); c.quadraticCurveTo(0, 42, -13, 31); c.quadraticCurveTo(-11, 25, -13, 14);
    c.quadraticCurveTo(-20, -2, -17, -20); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.ellipse(0, 30, 11, 7.5, 0, 0, BN_TAU); c.fill();
    c.fillStyle = k.cloth;
    c.beginPath(); c.ellipse(-4.6, 31, 2, 2.7, 0.2, 0, BN_TAU); c.ellipse(4.6, 31, 2, 2.7, -0.2, 0, BN_TAU); c.fill();
    c.beginPath(); c.ellipse(-8, -5, 3.4, 1.6, 0.25, 0, BN_TAU); c.ellipse(8, -5, 3.4, 1.6, -0.25, 0, BN_TAU); c.fill();
    c.strokeStyle = k.ink2; c.lineWidth = 2.4; c.beginPath(); c.arc(0, 36, 5.5, 0.15, Math.PI - 0.15); c.stroke();
  },
  sun(c, k) {
    c.fillStyle = k.ink;
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8, len = i % 2 ? 31 : 46, w = i % 2 ? 0.13 : 0.17;
      c.beginPath(); c.moveTo(Math.cos(a - w) * 19, Math.sin(a - w) * 19); c.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      c.lineTo(Math.cos(a + w) * 19, Math.sin(a + w) * 19); c.closePath(); c.fill();
    }
    c.beginPath(); c.arc(0, 0, 21, 0, BN_TAU); c.fill();
    c.strokeStyle = k.cloth; c.lineWidth = 1.8; c.beginPath(); c.arc(0, 0, 15.5, 0, BN_TAU); c.stroke();
    c.beginPath(); c.arc(0, 0, 4, 0, BN_TAU); c.fillStyle = k.cloth; c.fill();
  },
  palm(c, k) {
    // пальмовая ветвь, награда победителю, перевязана лентой
    const P0 = [6, 48], P1 = [11, 0], P2 = [-7, -47];
    const at = t => [(1 - t) * (1 - t) * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0], (1 - t) * (1 - t) * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1]];
    const ang = t => Math.atan2(2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]), 2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]));
    c.fillStyle = k.ink;
    for (let t = 0.24; t < 0.985; t += 0.042) {
      const [x, y] = at(t), th = ang(t), len = 7 + 27 * Math.sin(Math.PI * Math.min(1, (1 - t) / 0.85) * 0.62 + 0.25) * (1 - t * 0.55);
      for (const sd of [-1, 1]) {
        const d = th + sd * 0.78, tx = x + Math.cos(d) * len, ty = y + Math.sin(d) * len + len * 0.18;
        const mx = (x + tx) / 2, my = (y + ty) / 2, nx = -Math.sin(d) * sd, ny = Math.cos(d) * sd;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx - nx * 2.6, my - ny * 2.6 - 1.5, tx, ty); c.quadraticCurveTo(mx + nx * 0.8, my + ny * 0.8, x, y); c.fill();
      }
    }
    c.strokeStyle = k.ink; c.lineWidth = 2.6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(...P0); c.quadraticCurveTo(...P1, ...P2); c.stroke();
    const [rx, ry] = at(0.13);
    c.fillStyle = k.ink2;
    c.beginPath(); c.ellipse(rx - 6, ry - 1, 6, 3.2, 0.35, 0, BN_TAU); c.ellipse(rx + 6, ry - 1, 6, 3.2, -0.35, 0, BN_TAU); c.fill();
    c.strokeStyle = k.ink2; c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(rx - 1, ry); c.quadraticCurveTo(rx - 9, ry + 6, rx - 15, ry + 12); c.moveTo(rx + 1, ry); c.quadraticCurveTo(rx + 7, ry + 8, rx + 10, ry + 15); c.stroke();
    c.beginPath(); c.arc(rx, ry, 2.8, 0, BN_TAU); c.fill();
  },
  rudis(c, k) {
    // деревянный меч свободы и разорванная цепь
    for (const sd of [-1, 1]) {
      c.save(); c.scale(sd, 1);
      const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([-46 + 34 * t, -8 + 16 * t + 5.4 * Math.sin(Math.PI * t)]); }
      c.strokeStyle = k.ink2; c.lineCap = 'round';
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], mx = (x0 + x1) / 2, my = (y0 + y1) / 2, a = Math.atan2(y1 - y0, x1 - x0);
        c.save(); c.translate(mx, my); c.rotate(a);
        if (i % 2 === 0) {
          c.lineWidth = 1.9; c.beginPath();
          if (i === pts.length - 2) c.ellipse(0, 0, 4.4, 2.8, 0, 0.7, BN_TAU - 0.4); else c.ellipse(0, 0, 4.4, 2.8, 0, 0, BN_TAU);
          c.stroke();
        } else { c.lineWidth = 2.8; c.beginPath(); c.moveTo(-4.6, 0); c.lineTo(4.6, 0); c.stroke(); }
        c.restore();
      }
      c.lineWidth = 3.6; c.beginPath(); c.arc(-46, -14, 6.5, 0.2, BN_TAU - 0.6); c.stroke();
      c.restore();
    }
    c.fillStyle = k.ink; c.strokeStyle = BN_EDGE; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-6, 16); c.lineTo(-6, -33); c.quadraticCurveTo(-6, -45, 0, -46); c.quadraticCurveTo(6, -45, 6, -33); c.lineTo(6, 16); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(90,55,20,.4)'; c.beginPath();
    c.moveTo(-2.5, 14); c.quadraticCurveTo(-3.2, -10, -1.8, -38); c.moveTo(2.2, 12); c.quadraticCurveTo(3, -14, 1.4, -34); c.stroke();
    c.fillStyle = '#8a6038'; c.strokeStyle = BN_EDGE;
    c.beginPath(); c.roundRect(-12.5, 16, 25, 6, 2.5); c.fill(); c.stroke();
    c.fillStyle = '#4a2c18'; c.fillRect(-3.4, 22, 6.8, 15);
    c.strokeStyle = 'rgba(255,230,190,.2)'; c.beginPath(); for (let y = 24.5; y < 37; y += 3) { c.moveTo(-3.4, y); c.lineTo(3.4, y + 1.2); } c.stroke();
    c.fillStyle = '#8a6038'; c.beginPath(); c.arc(0, 41, 5.2, 0, BN_TAU); c.fill(); c.strokeStyle = BN_EDGE; c.stroke();
  },
  sica(c, k) {
    // парма фракийца и кривая сика поверх
    const g = c.createRadialGradient(-12, -8, 4, -4, 2, 32);
    g.addColorStop(0, '#e6c487'); g.addColorStop(0.6, k.ink); g.addColorStop(1, '#7a5a30');
    c.fillStyle = g; c.beginPath(); c.arc(-4, 2, 31, 0, BN_TAU); c.fill();
    c.strokeStyle = '#5c4122'; c.lineWidth = 3; c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1.2; c.beginPath(); c.arc(-4, 2, 21, 0, BN_TAU); c.stroke();
    c.fillStyle = '#6e5230';
    for (let i = 0; i < 14; i++) { const a = i * BN_TAU / 14; c.beginPath(); c.arc(-4 + Math.cos(a) * 26, 2 + Math.sin(a) * 26, 1.3, 0, BN_TAU); c.fill(); }
    c.fillStyle = k.ink; c.beginPath(); c.arc(-4, 2, 8.5, 0, BN_TAU); c.fill(); c.strokeStyle = '#5c4122'; c.lineWidth = 1.4; c.stroke();
    c.fillStyle = 'rgba(255,245,220,.45)'; c.beginPath(); c.arc(-6.5, -0.5, 3, 0, BN_TAU); c.fill();
    c.save(); c.translate(8, 4); c.rotate(0.6);
    c.fillStyle = k.ink2; c.strokeStyle = BN_EDGE; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-3.2, 26); c.lineTo(-3.2, -12); c.quadraticCurveTo(-3.2, -36, 17, -46); c.quadraticCurveTo(6.5, -28, 4, -10); c.lineTo(4, 26); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.moveTo(0.4, 22); c.lineTo(0.4, -10); c.quadraticCurveTo(0.4, -26, 9, -36); c.stroke();
    c.fillStyle = '#b48d4f'; c.beginPath(); c.roundRect(-9, 26, 18, 4.5, 2); c.fill(); c.strokeStyle = BN_EDGE; c.stroke();
    c.fillStyle = '#3b2416'; c.fillRect(-2.6, 30.5, 5.2, 12);
    c.fillStyle = '#b48d4f'; c.beginPath(); c.ellipse(0, 45, 5, 3.4, 0, 0, BN_TAU); c.fill(); c.stroke();
    c.restore();
  },
  moon(c, k) {
    c.fillStyle = k.ink;
    c.save(); c.beginPath(); c.rect(-60, -60, 120, 120); c.arc(11, -7, 23, 0, BN_TAU); c.clip('evenodd');
    c.beginPath(); c.arc(-2, 0, 29, 0, BN_TAU); c.fill(); c.restore();
    for (const [x, y, r] of [[13, -7, 7], [34, -32, 3.6], [-30, -38, 3.2], [40, 5, 3.4], [30, 32, 3.8], [-36, 34, 3], [2, -44, 3]]) bnStar(c, x, y, r);
  },
  helmet(c, k) {
    c.save(); c.translate(0, 4);
    c.fillStyle = k.ink2;
    c.beginPath(); c.arc(-3, -6, 41, Math.PI * 1.06, Math.PI * 1.9); c.arc(-3, -6, 28, Math.PI * 1.9, Math.PI * 1.06, true); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1; c.beginPath();
    for (let a = 1.1; a < 1.88; a += 0.06) { c.moveTo(-3 + Math.cos(a * Math.PI) * 29, -6 + Math.sin(a * Math.PI) * 29); c.lineTo(-3 + Math.cos(a * Math.PI) * 40, -6 + Math.sin(a * Math.PI) * 40); }
    c.stroke();
    c.fillStyle = k.ink; c.strokeStyle = BN_EDGE;
    c.beginPath(); c.moveTo(-27, 9); c.bezierCurveTo(-29, -16, -8, -27, 6, -24); c.bezierCurveTo(21, -20, 28, -6, 27, 9); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-30, 13); c.lineTo(-2, 13); c.lineTo(-3, 29); c.quadraticCurveTo(-18, 33, -33, 25); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(1, 13, 22, 25, 4); c.fill(); c.stroke();
    c.fillStyle = 'rgba(0,0,0,.55)';
    for (let x = 5; x <= 19; x += 4.6) for (let y = 17.5; y <= 34; y += 4.4) { c.beginPath(); c.arc(x, y, 1.35, 0, BN_TAU); c.fill(); }
    c.fillStyle = k.ink; c.beginPath(); c.moveTo(-38, 14); c.quadraticCurveTo(-32, 7, -26, 7); c.lineTo(30, 7);
    c.quadraticCurveTo(40, 8, 43, 15); c.lineTo(-38, 15); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1.6; c.beginPath(); c.arc(0, 4, 22, Math.PI * 1.2, Math.PI * 1.55); c.stroke();
    c.fillStyle = k.ink; c.fillRect(-7, -29, 9, 5);
    c.restore();
  },
};

// Полотнище, кайма, девиз, складки, древко с перекладиной и навершием
const BN_MOTTO_Y = { fringe: 0.83, swallow: 0.7, point: 0.7, tabs: 0.72, arch: 0.75 };
function bnCloth(c, shape, L, T, W, H) {
  const R = L + W, B = T + H, M = L + W / 2;
  c.beginPath(); c.moveTo(L, T); c.lineTo(R, T);
  if (shape === 'swallow') { c.lineTo(R, B); c.lineTo(M, T + H * 0.8); c.lineTo(L, B); }
  else if (shape === 'point') { c.lineTo(R, T + H * 0.8); c.lineTo(M, B); c.lineTo(L, T + H * 0.8); }
  else if (shape === 'arch') { c.lineTo(R, T + H * 0.84); c.quadraticCurveTo(M, B + H * 0.16, L, T + H * 0.84); }
  else if (shape === 'tabs') {
    const g = W * 0.07, tw = (W - 2 * g) / 3, cut = T + H * 0.85;
    c.lineTo(R, B);
    for (let i = 2; i >= 0; i--) {
      const x0 = L + i * (tw + g);
      if (i < 2) { c.lineTo(x0 + tw, cut); }
      c.lineTo(x0 + tw, B); c.lineTo(x0 + tw / 2, B + H * 0.035); c.lineTo(x0, B);
      if (i > 0) c.lineTo(x0, cut);
    }
  }
  else { c.lineTo(R, B); c.lineTo(L, B); }
  c.closePath();
}
function bnTabTips(L, T, W, H) {
  const g = W * 0.07, tw = (W - 2 * g) / 3;
  return [0, 1, 2].map(i => [L + i * (tw + g) + tw / 2, T + H * 1.035]);
}

function bnTassel(c, x, y, s, col) {
  c.fillStyle = col; c.strokeStyle = col; c.lineWidth = Math.max(1, s * 0.12);
  c.beginPath(); c.arc(x, y + s * 0.5, s * 0.5, 0, BN_TAU); c.fill();
  c.beginPath();
  for (let i = -2; i <= 2; i++) { c.moveTo(x + i * s * 0.16, y + s * 0.7); c.lineTo(x + i * s * 0.28, y + s * 2.1); }
  c.stroke();
}

function drawBanner(c, b, x, y, w, h) {
  const px = x + w / 2, poleW = w * 0.036, barY = y + h * 0.16, barH = w * 0.03;
  const W = w * 0.72, L = px - W / 2, T = barY + barH * 0.3, H = h * 0.66;
  // древко
  const wood = c.createLinearGradient(px - poleW / 2, 0, px + poleW / 2, 0);
  wood.addColorStop(0, '#3b2416'); wood.addColorStop(0.45, '#7a5232'); wood.addColorStop(1, '#2c1a10');
  c.fillStyle = wood; c.fillRect(px - poleW / 2, barY - h * 0.05, poleW, y + h - (barY - h * 0.05));
  // навершие
  const bronze = c.createLinearGradient(px - w * 0.06, 0, px + w * 0.06, 0);
  bronze.addColorStop(0, '#6e5230'); bronze.addColorStop(0.5, '#e0bb78'); bronze.addColorStop(1, '#6e5230');
  const topY = barY - h * 0.05;
  c.fillStyle = bronze; c.strokeStyle = bronze;
  c.fillRect(px - poleW * 0.8, topY - h * 0.012, poleW * 1.6, h * 0.016);
  if (b.top === 'spear') {
    const len = h * 0.1, bw = w * 0.05;
    c.beginPath(); c.moveTo(px, topY - h * 0.012 - len); c.quadraticCurveTo(px + bw, topY - h * 0.012 - len * 0.35, px + poleW * 0.4, topY - h * 0.012);
    c.lineTo(px - poleW * 0.4, topY - h * 0.012); c.quadraticCurveTo(px - bw, topY - h * 0.012 - len * 0.35, px, topY - h * 0.012 - len); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1; c.beginPath(); c.moveTo(px, topY - h * 0.012 - len * 0.9); c.lineTo(px, topY - h * 0.014); c.stroke();
  } else if (b.top === 'ring') {
    const r = w * 0.06, cy = topY - h * 0.012 - r - w * 0.01;
    c.lineWidth = w * 0.018; c.beginPath(); c.arc(px, cy, r, 0, BN_TAU); c.stroke();
    c.beginPath(); c.arc(px, cy, r * 0.42, 0, BN_TAU); c.fill();
    c.fillRect(px - poleW * 0.3, cy + r, poleW * 0.6, w * 0.012);
  } else if (b.top === 'crescent') {
    const r = w * 0.07, cy = topY - h * 0.012 - r * 0.55;
    c.save(); c.beginPath(); c.rect(px - r * 2, cy - r * 2, r * 4, r * 4); c.arc(px, cy - r * 0.42, r * 0.85, 0, BN_TAU); c.clip('evenodd');
    c.beginPath(); c.arc(px, cy, r, 0, BN_TAU); c.fill(); c.restore();
  }
  // полотнище
  c.save();
  bnCloth(c, b.shape, L, T, W, H);
  c.fillStyle = b.cloth; c.fill();
  c.clip();
  // кайма
  bnCloth(c, b.shape, L, T, W, H);
  c.strokeStyle = b.trim; c.lineWidth = w * 0.05; c.stroke();
  bnCloth(c, b.shape, L, T, W, H);
  c.strokeStyle = b.cloth; c.lineWidth = w * 0.032; c.stroke();
  bnCloth(c, b.shape, L, T, W, H);
  c.strokeStyle = b.trim; c.lineWidth = w * 0.014; c.stroke();
  // эмблема
  const s = Math.min(W * 0.74, H * (b.shape === 'swallow' ? 0.44 : 0.5)) / 100;
  c.save(); c.translate(L + W / 2, T + H * (b.shape === 'swallow' ? 0.33 : 0.37)); c.scale(s, s);
  BANNER_EMBLEMS[b.emblem](c, b);
  c.restore();
  // девиз
  const my = T + H * BN_MOTTO_Y[b.shape];
  let fs = w * 0.068;
  c.font = `${fs}px Forum, Georgia, serif`;
  try { c.letterSpacing = `${(fs * 0.1).toFixed(1)}px`; } catch (e) {}
  const maxW = W * (b.shape === 'swallow' || b.shape === 'point' ? 0.8 : 0.84);
  const mw = c.measureText(b.motto).width;
  if (mw > maxW) { fs *= maxW / mw; c.font = `${fs}px Forum, Georgia, serif`; try { c.letterSpacing = `${(fs * 0.1).toFixed(1)}px`; } catch (e) {} }
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = b.text || b.trim;
  c.fillText(b.motto, L + W / 2 + (c.letterSpacing ? parseFloat(c.letterSpacing) / 2 : 0), my);
  c.strokeStyle = b.trim; c.lineWidth = Math.max(1, w * 0.004);
  c.beginPath(); c.moveTo(L + W * 0.3, my - fs * 0.85); c.lineTo(L + W * 0.7, my - fs * 0.85); c.stroke();
  try { c.letterSpacing = '0px'; } catch (e) {}
  // складки и свет
  const folds = c.createLinearGradient(L, 0, L + W, 0);
  for (let i = 0; i <= 10; i++) folds.addColorStop(i / 10, i % 2 ? 'rgba(255,240,215,.07)' : 'rgba(0,0,0,.2)');
  c.fillStyle = folds; c.fillRect(L - 5, T - 5, W + 10, H * 1.3);
  const shade = c.createLinearGradient(0, T, 0, T + H * 1.1);
  shade.addColorStop(0, 'rgba(0,0,0,.35)'); shade.addColorStop(0.08, 'rgba(0,0,0,0)'); shade.addColorStop(0.75, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,.3)');
  c.fillStyle = shade; c.fillRect(L - 5, T - 5, W + 10, H * 1.3);
  c.restore();
  // бахрома и кисти
  if (b.shape === 'fringe') {
    c.strokeStyle = b.trim; c.lineWidth = Math.max(1, w * 0.007);
    c.beginPath();
    for (let fx = L + 2; fx <= L + W - 1; fx += w * 0.017) { c.moveTo(fx, T + H); c.lineTo(fx + w * 0.003, T + H + h * 0.045); }
    c.stroke();
    c.fillStyle = b.trim; c.fillRect(L, T + H - 1, W, h * 0.008);
  } else if (b.shape === 'tabs') {
    for (const [tx, ty] of bnTabTips(L, T, W, H)) bnTassel(c, tx, ty - 1, w * 0.035, b.trim);
  } else if (b.shape === 'swallow') {
    bnTassel(c, L + 1, T + H - 1, w * 0.035, b.trim); bnTassel(c, L + W - 1, T + H - 1, w * 0.035, b.trim);
  } else if (b.shape === 'point') {
    bnTassel(c, L + W / 2, T + H - 1, w * 0.04, b.trim);
  } else if (b.shape === 'arch') {
    bnTassel(c, L + 1, T + H * 0.84 - 1, w * 0.035, b.trim); bnTassel(c, L + W - 1, T + H * 0.84 - 1, w * 0.035, b.trim);
  }
  // перекладина, шары на концах, шнуры с кистями
  const bx0 = L - w * 0.06, bx1 = L + W + w * 0.06;
  const bar = c.createLinearGradient(0, barY - barH / 2, 0, barY + barH / 2);
  bar.addColorStop(0, '#8a6038'); bar.addColorStop(0.5, '#5a3a22'); bar.addColorStop(1, '#2c1a10');
  c.fillStyle = bar; c.fillRect(bx0, barY - barH / 2, bx1 - bx0, barH);
  c.fillStyle = bronze;
  for (const ex of [bx0, bx1]) { c.beginPath(); c.arc(ex, barY, barH * 0.85, 0, BN_TAU); c.fill(); }
  c.strokeStyle = b.trim; c.lineWidth = Math.max(1, w * 0.008);
  for (const ex of [bx0, bx1]) {
    const end = barY + h * 0.24;
    c.beginPath(); c.moveTo(ex, barY + barH * 0.8); c.quadraticCurveTo(ex + (ex < px ? -2 : 2), barY + h * 0.12, ex, end); c.stroke();
    bnTassel(c, ex, end, w * 0.032, b.trim);
  }
}

// Картинка знамени 300×440 для <img data-banner="id">. Пока шрифт девиза не загружен, девиз пишется запасным,
// а после загрузки все такие картинки на странице перерисовываются
const BANNER_IMG = {};
let bannerFontWait = false;
function bannerUrl(id) {
  const b = bannerOf(id);
  const font = document.fonts && document.fonts.check('20px Forum') ? 1 : 0;
  if (!font && !bannerFontWait && document.fonts) {
    bannerFontWait = true;
    document.fonts.load('20px Forum').then(() => document.querySelectorAll('img[data-banner]').forEach(im => { im.src = bannerUrl(im.dataset.banner); }), () => {});
  }
  const key = b.id + font;
  if (!BANNER_IMG[key]) {
    const cv = document.createElement('canvas');
    cv.width = 300; cv.height = 440;
    drawBanner(cv.getContext('2d'), b, 20, 14, 260, 420);
    BANNER_IMG[key] = cv.toDataURL();
  }
  return BANNER_IMG[key];
}

// Выбор знамени: выбранное крупно, рядом все варианты
function bannerPickHtml(cur) {
  const b = bannerOf(cur);
  return `<div class="banner-wrap"><span>Знамя лудуса</span><div class="banner-pick">
    <img class="bp-big" data-banner="${b.id}" src="${bannerUrl(b.id)}" alt="">
    <div class="bp-side"><div class="bp-grid">${BANNERS.map(x => `<button type="button" class="bp ${x.id === b.id ? 'on' : ''}" data-act="pickBanner" data-k="${x.id}" title="${x.name}" aria-label="${x.name}" aria-pressed="${x.id === b.id}"><img data-banner="${x.id}" src="${bannerUrl(x.id)}" alt=""></button>`).join('')}</div>
    <div class="bp-name">${bannerNameHtml(b)}</div></div></div></div>`;
}
const bannerNameHtml = b => `<b>${b.name}</b><span>${b.motto}, «${b.tr}»</span>`;
const pickedBanner = () => { const el = document.querySelector('.banner-pick .bp.on'); return el ? el.dataset.k : ''; };
