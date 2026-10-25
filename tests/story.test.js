const assert = require('node:assert/strict');
const { ev } = require('./harness');

const plain = o => JSON.parse(JSON.stringify(o));
const story = (ctx, sex = 'm') => ev(ctx, `newGame("Т", { story: true, lanista: { portrait: "${sex}1", sex: "${sex}" } })`);
const cur = ctx => ev(ctx, 'STORY.current() && STORY.current().id');
const stateOf = (ctx, id, ch) => ev(ctx, `STORY.tasks(${ch ?? 'undefined'}).find(t => t.id === "${id}").state`);
// всё, что нужно в главе I до хозяина арены (без платежа — pay: false)
function prepPompeii(ctx, pay = true) {
  ev(ctx, `STORY.onBattle({ training: true, win: true, kind: 'arena', tier: 0 });
    STATE.gladiators.push(createGladiator(null, 1));
    ${pay ? 'STATE.debt.idx = 1;' : ''}
    STATE.fame = 40;
    STORY.update(); STORY.injectEvents();`);
}
const toChapter = (ctx, n) => ev(ctx, `STATE.story.chapter = ${n}`);

module.exports = [
  { name: 'новая история: глава 0, учебный бой в событиях, пролог в очереди', fn: ctx => {
    story(ctx);
    assert.equal(ev(ctx, 'STATE.story.chapter'), 0);
    assert.equal(ev(ctx, 'STATE.events.some(e => e.training)'), true);
    assert.deepEqual(plain(ev(ctx, 'STORY.takeScenes()')), ['prologue']);
  } },
  { name: 'победа в учебном бою отмечается как выполненная задача', fn: ctx => {
    story(ctx);
    ev(ctx, 'STORY.onBattle({ training: true, win: true, kind: "arena", tier: 0 })');
    assert.ok(ev(ctx, 'STATE.journal.some(j => j.text.includes("Задача выполнена: Выиграйте первый бой"))'));
    ev(ctx, 'STATE.gold = 5000; nextDay()');
    assert.equal(ev(ctx, 'STATE.events.some(e => e.training)'), false);
  } },
  { name: 'новости задач: выполненная и новая задача', fn: ctx => {
    story(ctx);
    assert.deepEqual(plain(ev(ctx, 'STORY.takeNews()')), []);
    ev(ctx, 'STORY.onBattle({ training: true, win: true, kind: "arena", tier: 0 })');
    assert.deepEqual(plain(ev(ctx, 'STORY.takeNews()')), [
      { type: 'done', text: 'Выиграйте первый бой' },
      { type: 'new', text: 'Возьмите второго бойца' },
    ]);
    assert.deepEqual(plain(ev(ctx, 'STORY.takeNews()')), []);
  } },
  { name: 'очередь сцен хранится, пока сцена не показана (перезагрузка посреди сцен)', fn: ctx => {
    story(ctx);
    ev(ctx, 'STORY.markSeen("prologue"); STORY.queueScene("capua"); STORY.queueScene("rome")');
    assert.deepEqual(plain(ev(ctx, 'STORY.takeScenes()')), ['capua', 'rome']);
    ev(ctx, 'STORY.markSeen("capua")');
    assert.deepEqual(plain(ev(ctx, 'STATE.story.queue')), ['rome']);
    assert.equal(ev(ctx, 'STORY.isSeen("capua")'), true);
  } },
  { name: 'пролог не повторяется после просмотра', fn: ctx => {
    story(ctx);
    ev(ctx, 'STORY.markSeen("prologue"); STORY.queueScene("prologue")');
    assert.deepEqual(plain(ev(ctx, 'STORY.takeScenes()')), []);
  } },
  { name: 'задачи по порядку: слава не засчитывается раньше учебного боя', fn: ctx => {
    story(ctx);
    ev(ctx, 'STATE.fame = 50; STORY.update()');
    assert.equal(stateOf(ctx, 'fame40'), 'todo');
    assert.equal(cur(ctx), 'train');
  } },
  { name: 'учебный бой проигран: задача остаётся, бой вернётся завтра', fn: ctx => {
    story(ctx);
    ev(ctx, 'STORY.onBattle({ training: true, win: false, kind: "arena", tier: 0 })');
    assert.equal(cur(ctx), 'train');
    ev(ctx, 'nextDay()');
    assert.equal(ev(ctx, 'STATE.events.some(e => e.training && !e.done)'), true);
  } },
  { name: 'хозяин Помпей появляется только после всех задач перед ним', fn: ctx => {
    story(ctx);
    prepPompeii(ctx, false);
    assert.equal(ev(ctx, 'STATE.events.some(e => e.boss === "celadus")'), false);
    ev(ctx, 'STATE.debt.idx = 1; STORY.update(); STORY.injectEvents()');
    assert.equal(ev(ctx, 'STATE.events.some(e => e.boss === "celadus")'), true);
    assert.equal(cur(ctx), 'boss0');
  } },
  { name: 'хозяин переживает обновление событий', fn: ctx => {
    story(ctx);
    prepPompeii(ctx);
    ev(ctx, 'STATE.gold = 5000; nextDay()');
    assert.equal(ev(ctx, 'STATE.events.some(e => e.boss === "celadus" && !e.done)'), true);
  } },
  { name: 'победа над Келадом открывает Капую и поднимает долг', fn: ctx => {
    story(ctx);
    prepPompeii(ctx);
    const left = ev(ctx, 'debtLeft()');
    ev(ctx, 'STORY.takeScenes(); STORY.onBattle({ boss: "celadus", win: true, kind: "arena", tier: 0 })');
    assert.equal(ev(ctx, 'STATE.story.chapter'), 1);
    assert.equal(ev(ctx, 'tierOpen(1)'), true);
    assert.equal(ev(ctx, 'tierOpen(2)'), false);
    assert.equal(ev(ctx, 'STATE.debt.holder'), 'rival');
    assert.ok(ev(ctx, 'debtLeft()') > left);
    assert.ok(plain(ev(ctx, 'STORY.takeScenes()')).includes('capua'));
    assert.equal(ev(ctx, 'STATE.events.filter(e => e.tier === 1 && !e.done).length'), 2, 'бои в Капуе доступны сразу, а не со следующего дня');
  } },
  { name: 'победы в Капуе считаются только в главе II', fn: ctx => {
    story(ctx);
    ev(ctx, 'STORY.onBattle({ kind: "arena", tier: 1, win: true })');
    assert.equal(ev(ctx, 'STATE.story.capuaWins'), 0);
    toChapter(ctx, 1);
    ev(ctx, 'for (let i = 0; i < 3; i++) STORY.onBattle({ kind: "arena", tier: 1, win: true })');
    assert.equal(ev(ctx, 'STATE.story.capuaWins'), 3);
    assert.equal(stateOf(ctx, 'capua3'), 'done');
  } },
  { name: 'заказ сенатора не теряется при обновлении заказов', fn: ctx => {
    story(ctx);
    toChapter(ctx, 2);
    assert.equal(cur(ctx), 'senator');
    ev(ctx, 'STATE.contracts = []; STORY.onNewDay()');
    assert.equal(ev(ctx, 'STATE.contracts.filter(c => c.story === "senator").length'), 1);
    ev(ctx, 'STATE.contracts[0].done = true; STORY.onNewDay()');
    assert.equal(ev(ctx, 'STATE.contracts.filter(c => c.story === "senator" && !c.done).length'), 1);
  } },
  { name: 'победа в заказе сенатора выполняет задачу, сдача — нет', fn: ctx => {
    story(ctx);
    toChapter(ctx, 2);
    ev(ctx, 'STORY.onBattle({ kind: "contract", story: "senator", win: true, surrendered: true })');
    assert.equal(cur(ctx), 'senator');
    ev(ctx, 'STORY.onBattle({ kind: "contract", story: "senator", win: true, surrendered: false })');
    assert.notEqual(cur(ctx), 'senator');
  } },
  { name: 'финал списывает остаток долга', fn: ctx => {
    story(ctx);
    toChapter(ctx, 3);
    ev(ctx, 'STATE.debt.idx = 5; STORY.takeScenes(); STORY.onBattle({ kind: "final", win: true })');
    assert.equal(ev(ctx, 'STATE.debt.cancelled'), true);
    assert.ok(plain(ev(ctx, 'STORY.takeScenes()')).includes('finale'));
    ev(ctx, 'STATE.fame = 1000; STATE.finalWon = true; STORY.update()');
    assert.equal(ev(ctx, 'STORY.current()'), null);
  } },
  { name: 'параллельная задача долга засчитывается в любой момент', fn: ctx => {
    story(ctx);
    toChapter(ctx, 3);
    ev(ctx, 'STATE.debt.cleared = true; STORY.update()');
    assert.equal(stateOf(ctx, 'debt'), 'done');
    assert.equal(cur(ctx), 'fame1000');
  } },
  { name: 'gx по полу ланисты', fn: ctx => {
    story(ctx, 'f');
    assert.equal(ev(ctx, 'gx("сын", "дочь")'), 'дочь');
    story(ctx, 'm');
    assert.equal(ev(ctx, 'gx("сын", "дочь")'), 'сын');
  } },
  { name: 'все сцены собираются в текст без ошибок', fn: ctx => {
    story(ctx, 'f');
    ev(ctx, 'STATE.lost = { day: 7, reason: "debt", amount: 150, short: 20, holder: "lender" }');
    const n = ev(ctx, `Object.keys(STORY.SCENES).reduce((s, id) => s + STORY.lines(id).filter(l => l.text && l.name).length, 0)`);
    assert.ok(n > 40);
  } },
  { name: 'загрузка: init дополняет историю и возвращает сюжетные события', fn: ctx => {
    story(ctx);
    ev(ctx, 'STATE.story = { v: 1, chapter: 0, done: {}, flags: {} }; STATE.events = []; STORY.init()');
    assert.equal(ev(ctx, 'typeof STATE.story.seen'), 'object');
    assert.deepEqual(plain(ev(ctx, 'STATE.story.queue')), []);
    assert.equal(ev(ctx, 'STATE.events.some(e => e.training)'), true);
  } },
  { name: 'загрузка: игра без истории не получает историю', fn: ctx => {
    ev(ctx, 'newGame("Т"); STORY.init()');
    assert.equal(ev(ctx, 'STATE.story'), undefined);
  } },
  { name: 'финал в истории открывается только в главе IV', fn: ctx => {
    story(ctx);
    toChapter(ctx, 1);
    ev(ctx, 'STATE.fame = 1000');
    assert.equal(ev(ctx, 'finalUnlocked()'), false);
    toChapter(ctx, 3);
    assert.equal(ev(ctx, 'finalUnlocked()'), true);
  } },
  { name: 'игра без истории: арены открываются славой', fn: ctx => {
    ev(ctx, 'newGame("Т")');
    ev(ctx, 'STATE.fame = 40');
    assert.equal(ev(ctx, 'tierOpen(1)'), true);
    assert.equal(ev(ctx, 'STATE.events.some(e => e.training)'), false);
    assert.equal(ev(ctx, 'STORY.current()'), null);
  } },
  { name: 'первая победа в любом бою запускает сцену и снимает учебный бой', fn: ctx => {
    story(ctx);
    ev(ctx, 'STORY.takeScenes()');
    ev(ctx, 'STORY.onBattle({ win: true, kind: "arena", tier: 0 })');
    assert.ok(ev(ctx, 'STATE.story.flags.trainWon'));
    assert.ok(ev(ctx, 'STORY.takeScenes().includes("firstWin")'));
    assert.equal(ev(ctx, 'STATE.events.some(e => e.training && !e.done)'), false);
    assert.equal(ev(ctx, 'STORY.tasks().find(t => t.id === "train").state'), 'done');
  } },
  { name: 'имена хозяев арен не достаются случайным бойцам', fn: ctx => {
    for (const n of ['Келад', 'Крикс', 'Ганник', 'Приск', 'Вер', 'Тетраит']) assert.equal(ev(ctx, 'NAMES.includes("' + n + '")'), false, n);
  } },
];
