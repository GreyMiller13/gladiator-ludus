// ============================================================
//  История: долг отца, четыре главы по аренам, задачи,
//  хозяева арен, учебный бой, заказ сенатора и сцены разговора
// ============================================================
const STORY = (() => {
  const S = () => (typeof STATE !== 'undefined' && STATE && STATE.story) || null;
  const active = () => !!S();
  const gx = (m, f) => (STATE && STATE.lanista && STATE.lanista.sex === 'f' ? f : m);
  const holderName = () => (typeof debtHolderName === 'function' ? debtHolderName() : 'Лукрион');

  function create() {
    return { v: 1, chapter: 0, done: {}, seen: {}, hints: {}, bosses: {}, flags: {}, capuaWins: 0, queue: ['prologue'], news: [], lastCur: 'train' };
  }

  // ------------------------------------------------------------
  //  Хозяева арен
  // ------------------------------------------------------------
  const BOSSES = {
    celadus: { tier: 0, title: 'Хозяин арены: Келад', gold: 150, fame: 10,
      team: [{ name: 'Келад', cls: 'thraex', level: 5, quality: 1 }] },
    varus: { tier: 1, title: 'Чемпионы Гнея Вара', gold: 350, fame: 25,
      team: [{ name: 'Крикс', cls: 'murmillo', level: 8, quality: 2 }, { name: 'Ганник', cls: 'dimachaerus', level: 8, quality: 2 }] },
    roma: { tier: 2, title: 'Чемпионы Рима', gold: 800, fame: 50,
      team: [{ name: 'Приск', cls: 'secutor', level: 12, quality: 3 }, { name: 'Вер', cls: 'thraex', level: 12, quality: 3 }, { name: 'Тетраит', cls: 'hoplomachus', level: 12, quality: 3 }] },
  };

  function bossEvent(key) {
    const B = BOSSES[key];
    const enemies = B.team.map(m => createGladiator(m.cls, m.level, { name: m.name, autoSpend: true, quality: m.quality }));
    return { id: uid(), kind: 'arena', boss: key, title: B.title, tier: B.tier, size: enemies.length, enemies, gold: B.gold, fame: B.fame, done: false };
  }

  // Учебный бой: слабый новобранец без доспехов, только грубый гладиус
  function trainingEvent() {
    const g = createGladiator(null, 1, { name: 'Сур' });
    for (const k of ATTR_KEYS) g.attrs[k] = 3;
    g.equip.weapon = makeItem('gladius', 0);
    return { id: uid(), kind: 'arena', training: true, title: 'Учебный бой', tier: 0, size: 1, enemies: [g], gold: 30, fame: 2, done: false };
  }

  function senatorContract() {
    return {
      id: uid(), kind: 'contract', story: 'senator',
      title: 'Игры Публия Сервилия', client: 'сенатор Публий Сервилий',
      desc: 'Сенатор устраивает игры в честь предков и ждёт достойного зрелища. Победа откроет дорогу к играм Императора.',
      difficulty: 2, tier: 2, size: 3, playerSize: 3, enemies: generateEnemyTeam(2, 3),
      gold: 400, fame: 15, xpMult: 1, cond: { type: 'win', text: 'Победить' }, artifact: null, done: false,
    };
  }

  // ------------------------------------------------------------
  //  Главы и задачи
  // ------------------------------------------------------------
  const fameTask = n => ({ id: 'fame' + n, text: `Наберите ${n} славы`, tab: 'arena',
    check: () => STATE.fame >= n, progress: () => `${Math.min(STATE.fame, n)} / ${n}` });
  const bossTask = (id, boss, text) => ({ id, boss, text, tab: 'arena', check: () => !!S().bosses[boss] });

  const CHAPTERS = [
    { key: 'pompeii', title: 'Глава I. Помпеи', tasks: [
      { id: 'train', text: 'Выиграйте учебный бой', tab: 'arena', check: () => !!S().flags.trainWon },
      { id: 'recruit', text: 'Возьмите второго бойца', tab: 'market', check: () => STATE.gladiators.length >= 2,
        progress: () => `${Math.min(STATE.gladiators.length, 2)} / 2` },
      { id: 'pay1', text: 'Внесите первый платёж', check: () => !!STATE.debt && STATE.debt.idx >= 1,
        progress: () => { const n = typeof debtNext === 'function' && debtNext(); return n ? `${n.amount} к ${n.day}-му дню` : ''; } },
      fameTask(40),
      bossTask('boss0', 'celadus', 'Победите хозяина арены Келада'),
    ] },
    { key: 'capua', title: 'Глава II. Капуя', tasks: [
      { id: 'capua3', text: 'Одержите 3 победы в Капуе', tab: 'arena', check: () => S().capuaWins >= 3,
        progress: () => `${Math.min(S().capuaWins, 3)} / 3` },
      fameTask(150),
      bossTask('boss1', 'varus', 'Победите чемпионов Гнея Вара'),
    ] },
    { key: 'rome', title: 'Глава III. Рим', tasks: [
      { id: 'senator', text: 'Выиграйте бой на играх Публия Сервилия', tab: 'contracts', check: () => !!S().flags.senatorWon },
      fameTask(400),
      bossTask('boss2', 'roma', 'Победите чемпионов Рима'),
    ] },
    { key: 'colosseum', title: 'Глава IV. Колизей', tasks: [
      { id: 'debt', text: 'Выплатите долг до конца', parallel: true,
        check: () => !STATE.debt || STATE.debt.cleared || STATE.debt.cancelled,
        progress: () => `осталось ${typeof debtLeft === 'function' ? debtLeft() : 0}` },
      fameTask(1000),
      { id: 'final', text: 'Победите в Играх за рудис свободы', tab: 'arena', check: () => !!STATE.finalWon },
    ] },
  ];

  function current() {
    const st = S();
    if (!st) return null;
    const t = CHAPTERS[st.chapter].tasks.find(x => !x.parallel && !st.done[x.id]);
    return t ? view(t, 'current') : null;
  }

  function view(t, state) {
    return { id: t.id, text: t.text, progress: t.progress ? t.progress() : '', state, tab: t.tab || null, parallel: !!t.parallel, boss: t.boss || null };
  }

  function tasks(ch) {
    const st = S();
    if (!st) return [];
    const idx = ch ?? st.chapter, cur = current();
    return CHAPTERS[idx].tasks.map(t => view(t,
      st.done[t.id] || idx < st.chapter ? 'done' : (cur && cur.id === t.id) || t.parallel ? 'current' : 'todo'));
  }

  // Отметить выполненные задачи по порядку; победа над хозяином открывает следующую главу
  function update() {
    const st = S();
    const res = { completed: [], chapter: null };
    if (!st) return res;
    for (let guard = 0; guard < 8; guard++) {
      const ch = CHAPTERS[st.chapter];
      let blocked = false;
      for (const t of ch.tasks) {
        if (st.done[t.id]) continue;
        if (!t.parallel && blocked) continue;
        if (t.check()) {
          st.done[t.id] = STATE.day;
          res.completed.push(view(t, 'done'));
          news(st, 'done', t.text);
          journal(`Задача выполнена: ${t.text}.`);
        } else if (!t.parallel) blocked = true;
      }
      const boss = ch.tasks.find(t => t.boss);
      if (boss && st.done[boss.id] && st.chapter < CHAPTERS.length - 1) {
        st.chapter++;
        enterChapter(st.chapter);
        res.chapter = st.chapter;
        continue;
      }
      break;
    }
    const cur = current();
    if (cur && cur.id !== st.lastCur) news(st, 'new', cur.text);
    st.lastCur = cur ? cur.id : null;
    injectEvents();
    return res;
  }

  function news(st, type, text) { (st.news || (st.news = [])).push({ type, text }); }
  function takeNews() {
    const st = S();
    if (!st || !st.news) return [];
    const n = st.news;
    st.news = [];
    return n;
  }

  function enterChapter(n) {
    const T = TIERS[n];
    journal(`${CHAPTERS[n].title}. Открыта арена: ${T.place}.`);
    // на новой арене можно сразиться в тот же день
    if (Array.isArray(STATE.events)) for (const size of [1, 2]) {
      STATE.events.push({ id: uid(), tier: n, size, enemies: generateEnemyTeam(n, size),
        gold: Math.round(T.gold * FORMAT_MULT[size]), fame: Math.round(T.fame * FORMAT_MULT[size]), done: false });
    }
    if (n === 1) {
      if (typeof debtActive === 'function' && debtActive()) { debtRaise(DEBT_RAISE); STATE.debt.holder = 'rival'; }
      queueScene('capua');
    }
    if (n === 2) queueScene('rome');
    if (n === 3) queueScene('colosseum');
  }

  const tierOpen = i => i <= ((S() && S().chapter) || 0);

  const LOCK_TEXT = [
    '',
    'Откроется после победы над Келадом, хозяином арены Помпей.',
    'Откроется после победы над чемпионами Гнея Вара в Капуе.',
    'Откроется, когда сенатор Публий Сервилий добудет вам место на играх Императора: выиграйте его игры и одолейте чемпионов Рима.',
  ];
  const lockText = i => LOCK_TEXT[i] || '';

  // Сюжетные события в списках дня: учебный бой, бой с хозяином, заказ сенатора
  function injectEvents() {
    const st = S();
    if (!st || !STATE.events) return;
    if (!st.flags.trainWon && !STATE.events.some(e => e.training)) STATE.events.unshift(trainingEvent());
    const cur = current();
    if (cur && cur.boss && !STATE.events.some(e => e.boss === cur.boss)) {
      STATE.events.push(bossEvent(cur.boss));
      const sc = 'boss' + BOSSES[cur.boss].tier;
      if (!st.flags[sc]) { st.flags[sc] = true; queueScene(sc); }
    }
    if (cur && cur.id === 'senator' && Array.isArray(STATE.contracts)
      && !STATE.contracts.some(c => c.story === 'senator' && !c.done)) {
      STATE.contracts = STATE.contracts.filter(c => c.story !== 'senator');
      STATE.contracts.push(senatorContract());
    }
  }

  const onNewDay = () => { if (S()) injectEvents(); };

  function onBattle(info) {
    const st = S();
    if (!st || !info) return;
    if (info.training && info.win && !st.flags.trainWon) { st.flags.trainWon = STATE.day; queueScene('firstWin'); }
    if (info.boss && info.win && !st.bosses[info.boss]) {
      st.bosses[info.boss] = STATE.day;
      queueScene(`boss${BOSSES[info.boss].tier}Won`);
    }
    if ((info.kind || 'arena') === 'arena' && info.tier === 1 && info.win && st.chapter === 1) st.capuaWins++;
    if (info.story === 'senator' && info.win && !info.surrendered && !st.flags.senatorWon) {
      st.flags.senatorWon = true;
      queueScene('senatorWon');
    }
    if (info.kind === 'final' && info.win) onFinalWon();
    update();
  }

  function onFinalWon() {
    const st = S();
    const cancelled = typeof debtCancel === 'function' && STATE.debt && !STATE.debt.cleared && !STATE.debt.cancelled ? debtCancel() : 0;
    if (cancelled) { st.flags.debtCancelled = cancelled; journal(`Разорённый Вар больше ничего не может требовать: остаток долга, ${cancelled} ден., списан.`); }
    queueScene('finale');
    return { cancelled };
  }

  function onDebt(r) {
    if (!S() || !r) return;
    if (r.type === 'paid' && STATE.debt.idx === 1) queueScene('firstPayment');
    if (r.type === 'cleared') queueScene('debtCleared');
    if (r.type === 'default') queueScene('lost');
    update();
  }

  // ------------------------------------------------------------
  //  Очередь сцен
  // ------------------------------------------------------------
  function queueScene(id) {
    const st = S();
    if (st && !st.seen[id] && !st.queue.includes(id)) st.queue.push(id);
  }
  function takeScenes() {
    const st = S();
    if (!st) return [];
    const ids = st.queue.filter(id => !st.seen[id] && SCENES[id]);
    st.queue = [];
    return ids;
  }
  const markSeen = id => { if (S()) S().seen[id] = STATE.day; };

  // ------------------------------------------------------------
  //  Сцены: who — doctore | lender | rival | senator | holder (кто держит долг) | me
  // ------------------------------------------------------------
  const NAMES = { doctore: 'Ферокс', lender: 'Лукрион', rival: 'Гней Вар', senator: 'Публий Сервилий', me: 'Вы' };
  const next = () => (typeof debtNext === 'function' && debtNext()) || { amount: 0, day: 0, daysLeft: 0 };

  const SCENES = {
    prologue: [
      { who: 'doctore', text: 'Твоего отца сожгли на рассвете. Хорошие были похороны — на них ушли последние деньги лудуса.' },
      { who: 'lender', expr: 'pleased', text: () => `Лукрион, к услугам ${gx('наследника', 'наследницы')}. Покойный Марк занял у меня ${DEBT_TOTAL} денариев — вот его печать на табличке.` },
      { who: 'lender', text: () => `Я не зверь. Будешь платить частями: первые ${next().amount} денариев жду на ${next().day}-й день, дальше — каждые ${DEBT_EVERY} дней. Не заплатишь в срок — лудус мой.` },
      { who: 'me', text: 'Получишь свои деньги. Лудус моего отца не станет твоим.' },
      { who: 'lender', expr: 'pleased', text: 'Твой отец говорил так же. Слово в слово.' },
      { who: 'doctore', expr: 'angry', text: 'Хватит слов. В казарме один новобранец, а у ворот — Помпеи. Пойдём, покажу, чего он стоит.' },
    ],
    firstWin: [
      { who: 'doctore', expr: 'pleased', text: 'Песок любит победителей. Толпа запомнит имя нашего лудуса — пока что шёпотом.' },
      { who: 'doctore', text: 'Одного бойца мало. Загляни на невольничий рынок, а у кузнеца найди что-нибудь получше ржавого гладиуса.' },
    ],
    firstPayment: [
      { who: 'lender', expr: 'pleased', text: () => `Ровно ${STATE.debt ? STATE.debt.paid : 0}. Приятно иметь дело с ${gx('сыном', 'дочерью')} Марка.` },
      { who: 'lender', text: () => `Следующие ${next().amount} — на ${next().day}-й день. Я загляну.` },
      { who: 'me', expr: 'angry', text: 'Заглядывай. Только без улыбки.' },
    ],
    boss0: [
      { who: 'doctore', text: 'Келад — любимец Помпей. На стенах терм про него пишут: «по нему вздыхают девушки».' },
      { who: 'doctore', expr: 'angry', text: 'Побьём его на глазах у всего города — и в Капуе заговорят о нас. Выводи лучших.' },
    ],
    boss0Won: [
      { who: 'doctore', expr: 'pleased', text: 'Помпеи притихли. Келада унесли с песка — живым, но тише воды.' },
      { who: 'doctore', text: 'Пора в Капую. Там арена больше, а ланисты злее.' },
    ],
    capua: [
      { who: 'rival', expr: 'pleased', text: () => `${gx('Сын', 'Дочь')} Марка ${gx('пожаловал', 'пожаловала')} в Капую! Гней Вар, к твоим услугам.` },
      { who: 'rival', expr: 'pleased', text: 'Кстати, я выкупил у Лукриона долги твоего отца. Старый грек был счастлив от них избавиться.' },
      { who: 'rival', text: () => `С этого дня платишь мне. Проценты, увы, выросли: следующий платёж — ${next().amount} денариев, на ${next().day}-й день.` },
      { who: 'me', expr: 'angry', text: 'Ты разорил моего отца.' },
      { who: 'rival', expr: 'pleased', text: 'Твой отец разорился сам. Я лишь стоял рядом и считал.' },
      { who: 'doctore', expr: 'angry', text: 'Вар выставляет бойцов по всей Кампании. Бей их здесь, в Капуе, — пусть видит.' },
    ],
    boss1: [
      { who: 'doctore', text: 'Крикс и Ганник — лучшая пара Вара. Галл давит щитом, второй режет двумя клинками.' },
      { who: 'rival', expr: 'pleased', text: 'Приводи своих. Мои давно не упражнялись на живых.' },
    ],
    boss1Won: [
      { who: 'rival', expr: 'angry', text: 'Это ничего не значит. Долг остаётся долгом.' },
      { who: 'doctore', expr: 'pleased', text: 'Значит, и Капуя знает наше имя. Дорога ведёт в Рим.' },
    ],
    rome: [
      { who: 'senator', text: 'Публий Сервилий. Я видел, как твои бойцы разделались с людьми Вара.' },
      { who: 'senator', text: 'Я устраиваю игры в честь предков. Выиграй их для меня — и я замолвлю слово там, где решают, кто выйдет на песок Колизея.' },
      { who: 'me', text: 'Что ты хочешь взамен?' },
      { who: 'senator', expr: 'pleased', text: 'Хорошего зрелища. И чтобы Вар остался в стороне. Он мне неприятен.' },
    ],
    senatorWon: [
      { who: 'senator', expr: 'pleased', text: 'Достойно. Публика довольна, предки, надеюсь, тоже.' },
      { who: 'senator', text: 'Но место на играх Императора не дают за одну победу. Покажи себя против чемпионов Рима.' },
    ],
    boss2: [
      { who: 'doctore', text: 'Приск, Вер и Тетраит. О Приске и Вере поэты пишут стихи. Это плохо: значит, они ещё ни разу не проигрывали.' },
    ],
    boss2Won: [
      { who: 'senator', expr: 'pleased', text: 'Рим аплодирует. Я сдержал слово: тебя ждут на играх Императора.' },
      { who: 'rival', expr: 'angry', text: 'Колизей? Посмотрим, как ты запоёшь там. Мои чемпионы уже ждут.' },
    ],
    colosseum: [
      { who: 'doctore', text: 'Колизей. Пятьдесят тысяч глоток, и каждая хочет крови.' },
      { who: 'doctore', expr: 'angry', text: () => (typeof debtActive === 'function' && debtActive()
        ? `И помни про долг: ${holderName()} ждёт ещё ${debtLeft()} денариев. Каждый платёж — в срок.`
        : 'Долг уплачен. Теперь дерёмся только за славу.') },
      { who: 'doctore', text: () => `Наберём ${FINAL_FAME} славы — и Император позволит выставить наших против трёх величайших чемпионов. Вар ставит на них всё.` },
    ],
    debtCleared: [
      { who: 'holder', expr: 'angry', text: 'Последний денарий… Признаю: долг твоего отца уплачен.' },
      { who: 'doctore', expr: 'pleased', text: 'Марк выпил бы за это. Неразбавленного.' },
    ],
    finale: [
      { who: 'rival', expr: 'angry', text: 'Ты разорил меня. Все мои деньги стояли на этих троих.' },
      { who: 'me', expr: 'pleased', text: () => `Ты разорился сам. Я лишь ${gx('стоял', 'стояла')} рядом и ${gx('считал', 'считала')}.` },
      { who: 'doctore', expr: 'pleased', text: 'Император протягивает рудис свободы. Решай, кому он достанется.' },
    ],
    lost: [
      { who: 'holder', expr: 'pleased', text: () => `Срок вышел. ${STATE.lost ? STATE.lost.amount : 0} денариев — а у тебя не хватает ${STATE.lost ? STATE.lost.short || 0 : 0}.` },
      { who: 'holder', expr: 'pleased', text: 'Лудус, бойцы, даже ржавые мечи — теперь моё. Не печалься: твой отец тоже не умел считать.' },
      { who: 'doctore', expr: 'angry', text: 'Прости, Марк. Не уберегли.' },
    ],
  };

  // Реплики сцены с разрешёнными именами, портретами и текстом
  function lines(id) {
    return (SCENES[id] || []).map(l => {
      const who = l.who === 'holder' ? ((STATE.debt && STATE.debt.holder) || 'lender') : l.who;
      const me = who === 'me';
      return { who, me, key: me ? ((STATE.lanista && STATE.lanista.portrait) || 'm1') : who, name: NAMES[who], expr: l.expr || 'neutral',
        text: typeof l.text === 'function' ? l.text() : l.text };
    });
  }

  return {
    create, active, gx, holderName, CHAPTERS, BOSSES, SCENES, NAMES,
    current, tasks, update, enterChapter, tierOpen, lockText,
    bossEvent, trainingEvent, senatorContract, injectEvents, onNewDay, onBattle, onFinalWon, onDebt,
    queueScene, takeScenes, markSeen, lines, takeNews,
  };
})();
const gx = (m, f) => STORY.gx(m, f);
