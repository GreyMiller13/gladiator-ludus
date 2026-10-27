const assert = require('node:assert/strict');
const { loadGame, ev } = require('./harness');

const FILES = ['data', 'core', 'debt', 'story', 'banner'];

// холст-заглушка: любой вызов проходит, градиенты и замер текста отвечают правдоподобно
function mockCtx() {
  const calls = { fill: 0, text: [] };
  const grad = { addColorStop() {} };
  const target = {
    createLinearGradient: () => grad, createRadialGradient: () => grad,
    measureText: s => ({ width: s.length * 10 }),
    fill: () => { calls.fill++; }, fillText: s => { calls.text.push(s); },
  };
  const ctx = new Proxy(target, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  return { ctx, calls };
}

module.exports = [
  { name: 'знамёна: десять вариантов, у каждого имя, девиз, эмблема и цвета', fn: () => {
    const ctx = loadGame(FILES);
    const list = ev(ctx, 'BANNERS');
    assert.equal(list.length, 10);
    assert.equal(new Set(list.map(b => b.id)).size, 10);
    for (const b of list) {
      assert.ok(b.name && b.motto && b.tr, b.id);
      assert.equal(typeof ev(ctx, 'BANNER_EMBLEMS')[b.emblem], 'function', b.id);
      assert.ok(b.cloth && b.trim && b.ink, b.id);
    }
  } },
  { name: 'знамёна: каждое рисуется без ошибок, с эмблемой и девизом', fn: () => {
    const ctx = loadGame(FILES);
    for (const b of ev(ctx, 'BANNERS')) {
      const m = mockCtx();
      ctx.__c = m.ctx; ctx.__b = b;
      ev(ctx, 'drawBanner(__c, __b, 0, 0, 300, 440)');
      assert.ok(m.calls.fill > 5, b.id);
      assert.deepEqual(m.calls.text, [b.motto], b.id);
    }
  } },
  { name: 'знамя: новая игра хранит выбранное, без выбора — первое', fn: () => {
    const ctx = loadGame(FILES);
    ev(ctx, 'newGame("Тест", { story: true, banner: "moon" })');
    assert.equal(ev(ctx, 'STATE.banner'), 'moon');
    ev(ctx, 'newGame("Тест")');
    assert.equal(ev(ctx, 'STATE.banner'), ev(ctx, 'BANNERS[0].id'));
  } },
  { name: 'знамя: старое сохранение без знамени получает первое, неизвестное знамя заменяется', fn: () => {
    const ctx = loadGame(FILES);
    ev(ctx, 'newGame("Тест"); delete STATE.banner; migrateState()');
    assert.equal(ev(ctx, 'STATE.banner'), ev(ctx, 'BANNERS[0].id'));
    ev(ctx, 'STATE.banner = "нет такого"; migrateState()');
    assert.equal(ev(ctx, 'STATE.banner'), ev(ctx, 'BANNERS[0].id'));
    assert.equal(ev(ctx, 'bannerOf("нет такого").id'), ev(ctx, 'BANNERS[0].id'));
  } },
];
