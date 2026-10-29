const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { ev } = require('./harness');

const stored = ctx => ev(ctx, 'localStorage.getItem(SAVE_KEY)');
const sha = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

module.exports = [
  { name: 'подпись: SHA-256 совпадает с эталоном, в том числе для кириллицы', fn: ctx => {
    for (const s of ['', 'abc', 'Лудус Батиата, день 23', '{"gold":1590,"name":"Ромул"}', 'Ж'.repeat(55) + '😀' + 'x'.repeat(5000)]) {
      ctx.__s = s;
      assert.equal(ev(ctx, 'sha256(__s)'), sha(s), s);
    }
  } },
  { name: 'сохранение в браузере подписано и загружается обратно', fn: ctx => {
    ev(ctx, 'newGame("Тест"); STATE.gold = 777; save()');
    const raw = JSON.parse(stored(ctx));
    assert.equal(raw.v, 2);
    assert.equal(typeof raw.sig, 'string');
    ev(ctx, 'STATE = null');
    assert.equal(ev(ctx, 'load()'), true);
    assert.equal(ev(ctx, 'STATE.gold'), 777);
  } },
  { name: 'сохранение, изменённое вручную в браузере, не загружается', fn: ctx => {
    ev(ctx, 'newGame("Тест"); STATE.gold = 200; save()');
    const raw = JSON.parse(stored(ctx));
    raw.data = raw.data.replace('"gold":200', '"gold":99999');
    ctx.__raw = JSON.stringify(raw);
    ev(ctx, 'localStorage.setItem(SAVE_KEY, __raw); STATE = null');
    assert.equal(ev(ctx, 'load()'), false);
    assert.equal(ev(ctx, 'STATE'), null);
    assert.equal(ev(ctx, 'SAVE_TAMPERED'), true);
  } },
  { name: 'старое неподписанное сохранение переносится один раз и сразу подписывается', fn: ctx => {
    ev(ctx, 'newGame("Тест"); STATE.gold = 321; var plain = JSON.stringify(STATE); localStorage.clear(); localStorage.setItem(SAVE_KEY, plain); STATE = null');
    assert.equal(ev(ctx, 'load()'), true);
    assert.equal(ev(ctx, 'STATE.gold'), 321);
    assert.equal(JSON.parse(stored(ctx)).v, 2);
  } },
  { name: 'неподписанное сохранение после подписанных не загружается', fn: ctx => {
    ev(ctx, 'newGame("Тест"); save(); STATE.gold = 99999; localStorage.setItem(SAVE_KEY, JSON.stringify(STATE)); STATE = null');
    assert.equal(ev(ctx, 'load()'), false);
    assert.equal(ev(ctx, 'SAVE_TAMPERED'), true);
  } },
  { name: 'файл сохранения: подписанный принимается, изменённый, старый и чужой отклоняются', fn: ctx => {
    ev(ctx, 'newGame("Тест"); STATE.gold = 500; var file = saveFileText(STATE)');
    assert.equal(ev(ctx, 'parseSaveData(file).st.gold'), 500);
    ev(ctx, 'var bad = file.replace(/\\\\"gold\\\\":500/, \'\\\\"gold\\\\":50000\')');
    assert.notEqual(ev(ctx, 'bad'), ev(ctx, 'file'));
    assert.equal(ev(ctx, 'parseSaveData(bad).err'), 'tampered');
    assert.equal(ev(ctx, 'parseSaveData(JSON.stringify({ game: SAVE_FILE_TAG, version: 2, state: STATE })).err'), 'unsigned');
    assert.equal(ev(ctx, 'parseSaveData(JSON.stringify(STATE)).err'), 'unsigned');
    assert.equal(ev(ctx, 'parseSaveData("не json").err'), 'invalid');
    assert.equal(ev(ctx, 'parseSaveData(JSON.stringify({ hello: 1 })).err'), 'invalid');
  } },
];
