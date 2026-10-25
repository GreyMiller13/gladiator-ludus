const assert = require('node:assert/strict');
const { loadGame, ev, DEFAULT_FILES } = require('./harness');

// ставкам нужен бой (combat) — грузим его отдельно, чтобы остальные тесты не тратили время на расчёт шансов
const game = () => { const ctx = loadGame([...DEFAULT_FILES, 'combat', 'bets']); ev(ctx, 'newGame("Т")'); return ctx; };

module.exports = [
  { name: 'ставки: коэффициент — от шанса с долей устроителя, у слабого выше', fn: () => {
    const ctx = game();
    assert.equal(ev(ctx, 'betOdds(0.5)'), 1.8);
    assert.equal(ev(ctx, 'betOdds(0.2)'), 4.6);
    assert.equal(ev(ctx, 'betOdds(0.99)'), 1.05);
    assert.ok(ev(ctx, 'betOdds(0.3) > betOdds(0.7)'));
  } },
  { name: 'ставки: бой дня — два бойца текущей арены, шансы в сумме 100%', fn: () => {
    const ctx = game();
    ev(ctx, 'var b = newBet()');
    assert.equal(ev(ctx, 'b.tier'), 0);
    assert.equal(ev(ctx, 'b.day'), 1);
    assert.ok(ev(ctx, 'b.a.name !== b.b.name'));
    assert.ok(Math.abs(ev(ctx, 'b.p[0] + b.p[1]') - 1) < 1e-9);
    assert.ok(ev(ctx, '(b.p[0] > b.p[1]) === (b.odds[0] < b.odds[1]) || b.p[0] === b.p[1]'));
  } },
  { name: 'ставки: сильный боец почти всегда бьёт слабого в бою без показа', fn: () => {
    const ctx = game();
    ev(ctx, `var s = createGladiator("murmillo", 12, { autoSpend: true, quality: 3 }), w = createGladiator(null, 1);
      var e = { id: 1, kind: 'bet', tier: 0, size: 1 }; ensureField(e);
      var n = 0; for (let i = 0; i < 40; i++) if (simDuel(s, w, e) === 'player') n++;`);
    assert.ok(ev(ctx, 'n') >= 36, `побед: ${ev(ctx, 'n')}`);
  } },
  { name: 'ставки: от 50 с шагом 50, не больше предела арены и казны, одна в день', fn: () => {
    const ctx = game();
    ev(ctx, 'STATE.bet = newBet(); STATE.gold = 1000');
    assert.equal(ev(ctx, 'betMax()'), 300);
    for (const bad of [0, 40, 75, 350]) assert.equal(ev(ctx, `placeBet(0, ${bad})`), false, String(bad));
    assert.equal(ev(ctx, 'placeBet(2, 100)'), false);
    ev(ctx, 'STATE.gold = 120');
    assert.equal(ev(ctx, 'placeBet(0, 150)'), false);
    assert.equal(ev(ctx, 'placeBet(1, 100)'), true);
    assert.equal(ev(ctx, 'STATE.gold'), 20);
    assert.equal(ev(ctx, 'placeBet(0, 50)'), false);
  } },
  { name: 'ставки: выигрыш — ставка × коэффициент, проигрыш — ничего', fn: () => {
    const ctx = game();
    ev(ctx, 'STATE.bet = newBet(); STATE.bet.odds = [1.8, 2.15]; STATE.gold = 500; placeBet(1, 200)');
    assert.equal(ev(ctx, 'settleBet(1)'), 430);
    assert.equal(ev(ctx, 'STATE.gold'), 730);
    assert.equal(ev(ctx, 'settleBet(0)'), 0); // уже рассчитана
    ev(ctx, 'STATE.bet = newBet(); STATE.gold = 500; placeBet(0, 100)');
    assert.equal(ev(ctx, 'settleBet(1)'), 0);
    assert.equal(ev(ctx, 'STATE.gold'), 400);
  } },
  { name: 'ставки: предел растёт с ареной', fn: () => {
    const ctx = game();
    ev(ctx, 'STATE.fame = 400; STATE.bet = newBet()');
    assert.equal(ev(ctx, 'STATE.bet.tier'), 3);
    assert.equal(ev(ctx, 'betMax()'), 2500);
  } },
  { name: 'ставки: новый день решает несыгранную ставку и даёт новый бой', fn: () => {
    const ctx = game();
    ev(ctx, 'STATE.bet = newBet(); STATE.gold = 5000; placeBet(0, 100); var old = STATE.bet; nextDay()');
    assert.equal(ev(ctx, 'old.done'), true);
    assert.equal(ev(ctx, 'STATE.bet.day'), 2);
    assert.equal(ev(ctx, 'STATE.bet.done'), false);
    assert.ok(ev(ctx, 'STATE.journal.some(j => j.text.startsWith("Бой дня прошёл без вас"))'));
  } },
  { name: 'ставки: достижения — первая ставка, тёмная лошадка, 5000 чистого выигрыша', fn: () => {
    const ctx = loadGame([...DEFAULT_FILES, 'combat', 'bets', 'meta']);
    ev(ctx, 'newGame("Т"); STATE.gold = 100000');
    // ставка 300 на первого бойца при коэффициенте odds, и он побеждает
    const win = odds => ev(ctx, `STATE.bet = newBet(); STATE.bet.odds = [${odds}, 1.5]; placeBet(0, 300); settleBet(0)`);
    win(1.5);
    assert.ok(ev(ctx, 'STATE.meta.ach.bet1'));
    assert.ok(!ev(ctx, 'STATE.meta.ach.betUnderdog'));
    win(3);
    assert.ok(ev(ctx, 'STATE.meta.ach.betUnderdog'));
    assert.equal(ev(ctx, 'STATE.meta.c.betProfit'), 150 + 600);
    for (let i = 0; i < 7; i++) win(3); // 9 выигрышей, чистыми 4950
    assert.ok(!ev(ctx, 'STATE.meta.ach.bet10'));
    assert.ok(!ev(ctx, 'STATE.meta.ach.bet5000'));
    win(1.5); // 10 выигрышей, чистыми 5100
    assert.ok(ev(ctx, 'STATE.meta.ach.bet10'));
    assert.ok(ev(ctx, 'STATE.meta.ach.bet5000'));
  } },
  { name: 'ставки: выигрыш несмотренной ставки попадает в казну до платежа по долгу', fn: () => {
    const ctx = loadGame([...DEFAULT_FILES, 'combat', 'bets']);
    ev(ctx, 'newGame("Т", { story: true }); STATE.day = DEBT_EVERY - 1; STATE.bet = newBet(); STATE.bet.odds = [3, 1.2]');
    // в казне не хватает на первый платёж и содержание, но ставка на первого бойца закроет разницу
    ev(ctx, 'STATE.gold = upkeepCost() + 100; placeBet(0, 50); runDuel = () => "player"; var r = nextDay()');
    assert.equal(ev(ctx, 'STATE.lost'), undefined);
    assert.equal(ev(ctx, 'r.debt.type'), 'paid');
    assert.equal(ev(ctx, 'STATE.debt.paid'), ev(ctx, 'DEBT_PLAN[0]'));
  } },
  { name: 'ставки: исход боя дня задан заранее — перезагрузка и конец дня его не переигрывают', fn: () => {
    const ctx = game();
    ev(ctx, 'STATE.bet = newBet()');
    assert.equal(typeof ev(ctx, 'STATE.bet.seed'), 'number');
    // показанный бой (по ходам, как на экране) и бой при конце дня дают одно и то же
    const shown = () => ev(ctx, `(() => { const B = betBattle(STATE.bet); let g = 0;
      while (!B.over && g++ < 4000) { const t = B.beginTurn(); Math.random(); if (t.act && !B.over) B.aiTurn(t.u); Math.random(); B.events.length = 0; }
      return B.winner + ':' + B.round + ':' + B.log.length; })()`);
    const first = shown();
    for (let i = 0; i < 5; i++) assert.equal(shown(), first);
    const w = first.split(':')[0] === 'player' ? 0 : 1;
    ev(ctx, 'STATE.gold = 1000; placeBet(' + w + ', 100); nextDay()');
    assert.ok(ev(ctx, 'STATE.journal.some(j => j.text.includes("Ставка сыграла"))'));
  } },
];
