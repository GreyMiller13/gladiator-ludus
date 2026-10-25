const assert = require('node:assert/strict');
const { ev } = require('./harness');

const story = ctx => ev(ctx, 'newGame("Т", { story: true, lanista: { portrait: "m1", sex: "m" } })');
const days = (ctx, n) => ev(ctx, `(() => { let r = null; for (let i = 0; i < ${n}; i++) r = nextDay(); return r; })()`);
// перейти к утру дня day: вернуть результат последнего nextDay()
const toDay = (ctx, day) => days(ctx, day - ev(ctx, 'STATE.day'));
const plain = o => JSON.parse(JSON.stringify(o));

module.exports = [
  { name: 'расписание: сумма DEBT_PLAN равна DEBT_TOTAL', fn: ctx => {
    assert.equal(ev(ctx, 'DEBT_PLAN.reduce((a, b) => a + b, 0)'), ev(ctx, 'DEBT_TOTAL'));
    assert.equal(ev(ctx, 'DEBT_TOTAL'), 5000);
  } },
  { name: 'первый платёж: 100 на 7-й день', fn: ctx => {
    story(ctx);
    assert.deepEqual(plain(ev(ctx, 'debtNext()')), { amount: 100, day: 7, daysLeft: 6 });
  } },
  { name: 'первый платёж — не больше половины стартовой казны', fn: ctx => {
    story(ctx);
    assert.ok(ev(ctx, 'DEBT_PLAN[0] * 2 <= STATE.gold'));
  } },
  { name: 'платежи не убывают и кратны 10', fn: ctx => {
    assert.ok(ev(ctx, 'DEBT_PLAN.every((a, i) => a % 10 === 0 && (!i || a >= DEBT_PLAN[i - 1]))'));
  } },
  { name: 'предупреждения за 3 и за 1 день', fn: ctx => {
    story(ctx);
    ev(ctx, 'STATE.gold = 5000');
    assert.deepEqual(plain(toDay(ctx, 4).debt), { type: 'warn', amount: 100, daysLeft: 3 });
    assert.equal(toDay(ctx, 5).debt, null);
    assert.deepEqual(plain(toDay(ctx, 6).debt), { type: 'warn', amount: 100, daysLeft: 1 });
  } },
  { name: 'платёж в срок списывается после содержания', fn: ctx => {
    story(ctx);
    ev(ctx, 'STATE.gold = 1000');
    toDay(ctx, 6);
    const g = ev(ctx, 'STATE.gold');
    const r = ev(ctx, 'nextDay()');
    assert.equal(r.debt.type, 'paid');
    assert.equal(ev(ctx, 'STATE.gold'), g - r.cost - 100);
    assert.equal(ev(ctx, 'STATE.debt.idx'), 1);
    assert.equal(ev(ctx, 'debtNext().day'), 14);
  } },
  { name: 'ровно хватает: платёж проходит, казна 0', fn: ctx => {
    story(ctx);
    toDay(ctx, 6);
    ev(ctx, 'STATE.gold = 100 + upkeepCost()');
    assert.equal(ev(ctx, 'nextDay()').debt.type, 'paid');
    assert.equal(ev(ctx, 'STATE.gold'), 0);
  } },
  { name: 'не хватает 1 денария: игра проиграна', fn: ctx => {
    story(ctx);
    toDay(ctx, 6);
    ev(ctx, 'STATE.gold = 99 + upkeepCost()');
    const r = ev(ctx, 'nextDay()').debt;
    assert.equal(r.type, 'default');
    assert.equal(r.short, 1);
    assert.equal(ev(ctx, 'STATE.lost.reason'), 'debt');
    const day = ev(ctx, 'STATE.day');
    assert.deepEqual(plain(ev(ctx, 'nextDay()')), { cost: 0, debt: null });
    assert.equal(ev(ctx, 'STATE.day'), day);
  } },
  { name: 'счётчик краснеет, если после содержания на платёж не хватит', fn: ctx => {
    story(ctx);
    toDay(ctx, 6);
    ev(ctx, 'STATE.gold = 100 + upkeepCost() - 1');
    assert.equal(ev(ctx, 'debtUrgent()'), true);
    ev(ctx, 'STATE.gold = 100 + upkeepCost()');
    assert.equal(ev(ctx, 'debtUrgent()'), false);
  } },
  { name: 'повышение округляет до 10', fn: ctx => {
    story(ctx);
    ev(ctx, 'debtRaise(1.2)');
    assert.equal(ev(ctx, 'STATE.debt.plan[0]'), 120);
    assert.equal(ev(ctx, 'STATE.debt.plan[11]'), 960);
  } },
  { name: 'последний платёж гасит долг', fn: ctx => {
    story(ctx);
    ev(ctx, 'STATE.debt.idx = 11; STATE.gold = 9999');
    const r = toDay(ctx, ev(ctx, 'debtDay(11)'));
    assert.equal(r.debt.type, 'cleared');
    assert.equal(ev(ctx, 'STATE.debt.cleared'), true);
    assert.equal(ev(ctx, 'debtNext()'), null);
  } },
  { name: 'свободный режим: старая игра без долга', fn: ctx => {
    ev(ctx, 'newGame("Т")');
    assert.equal(ev(ctx, 'nextDay()').debt, null);
    assert.equal(ev(ctx, 'STATE.debt'), undefined);
  } },
];
