# Сюжет, долг, портреты и обучение — план работ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** дать игре историю (долг отца, четыре главы по аренам, сюжетные персонажи с портретами), выбор своего ланисты, строку задач и обучение через первый бой.

**Architecture:**
- Логика долга и сюжета живёт в двух новых файлах, `js/debt.js` и `js/story.js`. Это чистые функции над глобальным `STATE`, без DOM. Их проверяют node-тесты, которые грузят файлы игры в `vm`.
- Отображение живёт в трёх новых файлах:
  - `js/portrait.js` — портреты на canvas, IIFE `PORTRAIT`;
  - `js/scene.js` — сцены разговора, строка задач, подсказки наставника;
  - правки в `ui.js`/`menu.js`.
- Отображение проверяется в Playwright. Существующие модули подключаются через `typeof X !== 'undefined'`, как сейчас `META`.

**Tech Stack:** обычные `<script>` без сборки, canvas 2D, Node 18+ (`node:vm`, `node:assert`) для тестов, Playwright MCP для проверки в браузере. Локальный сервер: `npx --yes http-server -p 8765 -s -c-1 .`.

**Spec:** `docs/superpowers/specs/2026-10-25-story-debt-portraits-design.md`. Одобренный образец портретов: `docs/superpowers/specs/assets/2026-10-25-portraits-spike.html`.

## Global Constraints

- Никаких браузерных `confirm`/`alert`/`prompt`, только `showDialog`/`askConfirm` из `ui.js`.
- Внешних картинок нет, всё рисуется кодом.
- Деплой копирует только `index.html`, `css`, `js`. Папка `tests/` в игру не попадает.
- Все тексты на русском. От игрока везде «Вы». Реплики по полу проходят через `gx(m, f)`.
- Ширина от 360px, касания работают.
- Досрочного погашения долга нет. Бойцы автоматически не продаются. Отсрочек нет.
- Правила боя, формулы и баланс бойцов не меняются. Меняются только экономика долга и сюжетные бои.
- Старые сохранения без `STATE.story` работают как раньше: без долга, задач, хозяев арен и сцен.
- Портреты только в стиле «на щите», голова в три четверти. Вариант A (фреска) и фронтальные женщины из образца не переносятся.
- Комментарии в коде на русском, в стиле окружающего кода. Глобальные имена не должны пересекаться: весь код портретов закрыт в IIFE.
- Каждый коммит заканчивается строкой `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Платёж и содержание в один день при казне около суммы платежа.** Сначала списывается содержание, потом проверяется платёж. При ровно `amount + upkeep` платёж проходит и в казне остаётся 0. При деньгах на 1 меньше игра проиграна. Покрыто тестом в задаче 2.
2. **Перезагрузка страницы посреди сцены, обучения или в день проигрыша.** После перезагрузки показанная сцена не повторяется, а непоказанная из очереди показывается. Проигранная игра открывает итог, а не лудус. Покрыто тестом в задаче 3 и шагом в задаче 7.
3. **Учебный бой проигран или игрок сдался.** Боец жив, задача «Выиграйте учебный бой» остаётся текущей, учебный бой появляется снова на следующий день. Покрыто тестом в задаче 3 и шагом в задаче 10.
4. **Ежедневное обновление списков вытирает сюжетные события.** `generateEvents()` и `META.onNewDay()` заменяют события и заказы. Хозяин арены, учебный бой и заказ сенатора должны вернуться в списки после каждого `nextDay()`. Покрыто тестом в задаче 3.
5. **Импорт старого файла сохранения в новую версию и наоборот.** Старый файл открывается в свободном режиме без ошибок. Новый файл после экспорта и импорта сохраняет долг, главу, задачи и выбранный портрет. Покрыто шагом в задаче 12.

---

## Файлы

| Файл | Что делает |
|---|---|
| `tests/harness.js` (новый) | Загружает файлы `js/*.js` в `vm`-контекст с заглушками `localStorage`/`sessionStorage` |
| `tests/run.js` (новый) | Запускает `tests/*.test.js`, печатает PASS/FAIL, при ошибках выходит с кодом 1 |
| `tests/debt.test.js`, `tests/story.test.js` (новые) | Тесты логики |
| `tests/sim.js` (новый) | Ускоренная симуляция дней с автобоем для подбора чисел долга |
| `js/data.js` | Константы долга |
| `js/debt.js` (новый) | Расписание, платёж, предупреждения, проигрыш, повышение и списание долга |
| `js/core.js` | `newGame(name, opts)`, `nextDay()` возвращает `{ cost, debt }`, `tierOpen(i)` |
| `js/story.js` (новый) | `STORY`: главы, задачи, хозяева арен, учебный бой, заказ сенатора, сцены (данные), очередь сцен, `gx` |
| `js/portrait.js` (новый) | `PORTRAIT`: отрисовка и кеш портретов |
| `js/scene.js` (новый) | Слой `#scene`, строка задач под шапкой, окно задач, подсказки наставника, учебные шаги |
| `js/ui.js` | Шапка, новая игра, конец дня, арена, бой, Некрополь, итог проигрыша |
| `js/menu.js` | Старый `TOUR_STEPS` удаляется, «Продолжить» для проигранной игры |
| `index.html` | `#scene`, `#coach`, порядок скриптов |
| `css/style.css` | Стили сцены, щита-портрета, строки задач, счётчика долга, выбора портрета, подсказок |
| `README.md`, справочник (`GUIDE` в `ui.js`) | Описание сюжета, долга и задач |

Порядок скриптов в `index.html`: `data, core, debt, story, combat, figure, clips, audio, venue, arena, portrait, ui, meta, scene, menu, main`.

---

### Task 1: Тестовый стенд

**Files:**
- Create: `tests/harness.js`, `tests/run.js`, `tests/smoke.test.js`

**Interfaces:**
- Produces:
  - `loadGame(files: string[] = ['data','core','debt','story']) → vm.Context`. Скрипты исполняются в одном контексте по порядку, в нём есть `localStorage`, `sessionStorage` (на основе `Map`) и `console`. Верхнеуровневые `const`/`let` видны следующим скриптам, как в браузере.
  - `ev(ctx, code: string) → any` — `vm.runInContext(code, ctx)`.
  - Формат файла тестов: `module.exports = [{ name: string, fn: (ctx) => void }]`. `run.js` для каждого теста создаёт свежий контекст через `loadGame()` и пропускает файлы, которых ещё нет.

- [ ] **Step 1: Написать `tests/smoke.test.js`**

```js
const assert = require('node:assert/strict');
const { ev } = require('./harness');
module.exports = [
  { name: 'новая игра создаёт лудус с одним бойцом', fn: ctx => {
    ev(ctx, 'newGame("Тест")');
    assert.equal(ev(ctx, 'STATE.gladiators.length'), 1);
    assert.equal(ev(ctx, 'STATE.gold'), 200);
  } },
];
```

- [ ] **Step 2:** Запустить `node tests/run.js`. Ожидается падение: `harness` не найден.
- [ ] **Step 3:** Написать `harness.js` и `run.js`.
- [ ] **Step 4:** Запустить `node tests/run.js`. Ожидается `PASS новая игра создаёт лудус с одним бойцом`, код выхода 0.
- [ ] **Step 5: Коммит** `Тестовый стенд: логика игры в node:vm`.

---

### Task 2: Долг

**Files:**
- Modify: `js/data.js` (в конце), `js/core.js:341-355` (`newGame`), `js/core.js:507-520` (`nextDay`), `js/ui.js:1368-1375` (`ACTIONS.nextDay` — только под новый возврат), `index.html` (скрипт `debt.js`)
- Create: `js/debt.js`, `tests/debt.test.js`

**Interfaces:**
- Produces (`data.js`):
  - `DEBT_TOTAL = 5000`
  - `DEBT_EVERY = 7`
  - `DEBT_PLAN = [150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 600, 650]` (черновик, подбирается в задаче 13)
  - `DEBT_RAISE = 1.2`
- Produces (`debt.js`, глобальные функции):
  - `newDebt() → { plan: number[], idx: 0, paid: 0, holder: 'lender', cleared: false, cancelled: false }` — `plan` копия `DEBT_PLAN`.
  - `debtDay(i: number) → number` — день платежа `i`: `DEBT_EVERY * (i + 1)`.
  - `debtNext() → { amount, day, daysLeft } | null` — `null`, если нет `STATE.debt`, долг погашен или списан.
  - `debtLeft() → number` — сумма `plan` начиная с `idx`.
  - `debtOnNewDay() → DebtResult | null`. Вызывается из `nextDay()` после списания содержания и `STATE.day++`. Варианты результата:
    - `{ type: 'paid', amount, left }`
    - `{ type: 'cleared', amount }`
    - `{ type: 'default', amount, short }` — заодно ставит `STATE.lost = { day, reason: 'debt', amount, holder }`
    - `{ type: 'warn', amount, daysLeft }` — при `daysLeft` 3 или 1
    - `null`

    Каждый вариант, кроме `null`, пишет запись в `journal()`.
  - `debtRaise(k: number) → void` — каждый оставшийся платёж становится `Math.round(a * k / 10) * 10`.
  - `debtCancel() → number` — ставит `cancelled: true` и возвращает списанный остаток.
  - `debtUrgent() → boolean` — `daysLeft <= 2 && STATE.gold < amount`.
- Produces (`core.js`):
  - `newGame(ludusName, opts = {})`. `opts`: `{ story?: boolean, lanista?: { portrait: string, sex: 'm'|'f' } }`. При `opts.story` ставятся `STATE.lanista`, `STATE.debt = newDebt()` и `STATE.story = STORY.create()`; последнее появится в задаче 3, пока только при `typeof STORY !== 'undefined'`.
  - `nextDay() → { cost: number, debt: DebtResult | null }`. Если `STATE.lost` уже стоит, ничего не делает и возвращает `{ cost: 0, debt: null }`.

- [ ] **Step 1: Написать `tests/debt.test.js`** со следующими тестами. Во всех тестах `const story = () => ev(ctx, 'newGame("Т", { story: true, lanista: { portrait: "m1", sex: "m" } })')`, `const days = n => ev(ctx, \`for (let i = 0; i < ${n}; i++) nextDay()\`)`.
  - `расписание: сумма DEBT_PLAN равна DEBT_TOTAL` — `assert.equal(ev(ctx,'DEBT_PLAN.reduce((a,b)=>a+b,0)'), 5000)`.
  - `первый платёж: 150 на 7-й день` — после `story()`: `debtNext()` deepEqual `{ amount: 150, day: 7, daysLeft: 6 }`.
  - `предупреждения за 3 и за 1 день` — `STATE.gold = 5000`, `days(3)`. Последний `nextDay().debt` при переходе на день 4 deepEqual `{ type: 'warn', amount: 150, daysLeft: 3 }`. На день 6 — `daysLeft: 1`. На день 5 — `null`.
  - `платёж в срок списывается после содержания` — `STATE.gold = 1000`, `days(6)`. Запомнить `g = STATE.gold`. `r = nextDay()`. Ожидается: `r.debt.type === 'paid'`, `STATE.gold === g - r.cost - 150`, `STATE.debt.idx === 1`, `debtNext().day === 14`.
  - `ровно хватает: платёж проходит, казна 0` — на день 6 поставить `STATE.gold = 150 + upkeepCost()`. После `nextDay()` `STATE.gold === 0`, тип `paid`.
  - `не хватает 1 денария: игра проиграна` — то же с `149 + upkeepCost()`. Тип `default`, `short === 1`, `STATE.lost.reason === 'debt'`. Следующий `nextDay()` возвращает `{ cost: 0, debt: null }`, а `STATE.day` не меняется.
  - `повышение округляет до 10` — `debtRaise(1.2)` при `idx 0`: `STATE.debt.plan[0] === 180`, `plan[11] === 780`.
  - `последний платёж гасит долг` — `STATE.debt.idx = 11`, `STATE.gold = 9999`, перейти к дню `debtDay(11)`. Тип `cleared`, `STATE.debt.cleared === true`, `debtNext() === null`.
  - `свободный режим: старая игра без долга` — `newGame("Т")` без `opts`, затем `nextDay().debt === null` и `STATE.debt === undefined`.
- [ ] **Step 2:** Запустить `node tests/run.js`. Ожидается FAIL: `newDebt is not defined` и другие.
- [ ] **Step 3:** Добавить константы в `data.js`, написать `js/debt.js`, переделать `newGame`/`nextDay` в `core.js`. В `nextDay` долг обрабатывается после `refresh…()` и `generateEvents()` и до `META.onNewDay()`. В `ACTIONS.nextDay` взять `const { cost } = nextDay()`; остальное поведение UI появится в задаче 7. Подключить `js/debt.js` в `index.html` после `core.js`. Добавить `debt` в список файлов по умолчанию в `harness.js`.
- [ ] **Step 4:** Запустить `node tests/run.js`. Ожидается, что все тесты проходят.
- [ ] **Step 5: Коммит** `Долг отца: расписание платежей, автосписание, проигрыш`.

---

### Task 3: Сюжет и задачи (логика)

**Files:**
- Create: `js/story.js`, `tests/story.test.js`
- Modify:
  - `js/core.js:397` — `unlockedTiers` через `tierOpen`;
  - `js/core.js` `newGame` — вызвать `STORY.create()` и `STORY.injectEvents()`;
  - `js/core.js` `nextDay` — после `META.onNewDay()` вызвать `STORY.onNewDay()`;
  - `js/ui.js:1085` `battleInfo` — новые поля;
  - `index.html` — скрипт `story.js` после `debt.js`;
  - `tests/harness.js` — `story` в списке по умолчанию.

**Interfaces:**
- Consumes: `newDebt`, `debtRaise`, `debtCancel`, `debtNext`, `debtLeft` (задача 2), `createGladiator`, `makeItem`, `generateEnemyTeam`, `journal`, `uid`.
- Produces (`core.js`):
  - `tierOpen(i: number) → boolean` — `STATE.story ? STORY.tierOpen(i) : STATE.fame >= TIERS[i].fameReq`;
  - `unlockedTiers()` фильтрует по `tierOpen`.
- Produces (`ui.js` `battleInfo`): к объекту добавляются поля `eventId: ev.id`, `training: !!ev.training`, `boss: ev.boss || null`, `story: ev.story || null`.
- Produces (`story.js`, IIFE `const STORY = (() => { … })()`):
  - `create() → { v: 1, chapter: 0, done: {}, seen: {}, hints: {}, bosses: {}, flags: {}, capuaWins: 0, queue: ['prologue'] }`
  - `active() → boolean` — `!!(STATE && STATE.story)`
  - `CHAPTERS: [{ key, title, tasks: Task[] }]`, где `Task = { id, text, check(): boolean, progress?(): string, tab?: string, parallel?: boolean }`. Главы и задачи — дословно из раздела «Задачи» спеки:

    | Глава | Ключ | Задачи (id → условие) |
    |---|---|---|
    | 0 | `pompeii`, «Глава I. Помпеи» | `train` → `done.train`; `recruit` → `STATE.gladiators.length >= 2`, вкладка `market`; `pay1` → `STATE.debt.idx >= 1`; `fame40` → `STATE.fame >= 40`; `boss0` → `bosses.celadus` |
    | 1 | `capua`, «Глава II. Капуя» | `capua3` → `capuaWins >= 3`, вкладка `arena`; `fame150`; `boss1` → `bosses.varus` |
    | 2 | `rome`, «Глава III. Рим» | `senator` → `flags.senatorWon`, вкладка `contracts`; `fame400`; `boss2` → `bosses.roma` |
    | 3 | `colosseum`, «Глава IV. Колизей» | `debt` (`parallel: true`) → `STATE.debt.cleared \|\| STATE.debt.cancelled`; `fame1000`; `final` → `STATE.finalWon` |

    У славы прогресс `«12 / 40»`. У `pay1` прогресс: `«150 к 7-му дню»` из `debtNext()`.
  - `tasks(ch = chapter) → [{ id, text, progress, state: 'done'|'current'|'todo', tab, parallel }]`
  - `current() → TaskView | null` — первая невыполненная непараллельная задача текущей главы; после финала `null`.
  - `update() → { completed: TaskView[], chapter: number | null }`. Отмечает задачи по порядку: задача засчитывается, только когда выполнены все непараллельные задачи перед ней, а параллельная — в любой момент. Если засчитан босс главы `i < 3`, вызывает `enterChapter(i + 1)`. Каждая выполненная задача пишется в `journal()`.
  - `enterChapter(n)` при входе в главу:
    - 1 → `debtRaise(DEBT_RAISE)`, `STATE.debt.holder = 'rival'`, сцена `capua` в очередь;
    - 2 → сцена `rome`;
    - 3 → сцена `colosseum`.
  - `tierOpen(i) → i <= chapter`
  - `lockText(i) → string` — например «Откроется после победы над Келадом в Помпеях».
  - `BOSSES` — значения ниже я задаю сам; уровни подстраиваются в задаче 13:

    | Ключ | Арена | Состав | Награда |
    |---|---|---|---|
    | `celadus` | tier 0 | `[{ name: 'Келад', cls: 'thraex', level: 5, quality: 1 }]` | `gold: 150, fame: 10` |
    | `varus` | tier 1 | `[{ name: 'Крикс', cls: 'murmillo', level: 8, quality: 2 }, { name: 'Ганник', cls: 'dimachaerus', level: 8, quality: 2 }]` | `gold: 350, fame: 25` |
    | `roma` | tier 2 | `[{ name: 'Приск', cls: 'secutor', level: 12, quality: 3 }, { name: 'Вер', cls: 'thraex', level: 12, quality: 3 }, { name: 'Тетраит', cls: 'hoplomachus', level: 12, quality: 3 }]` | `gold: 800, fame: 50` |

    Бойцы создаются как в `finalEvent()`: `createGladiator(cls, level, { name, autoSpend: true, quality })`.
  - `bossEvent(key) → { id, kind: 'arena', boss: key, tier, size, enemies, gold, fame, done: false }`
  - `trainingEvent() → { id, kind: 'arena', training: true, tier: 0, size: 1, enemies: [Сур], gold: 30, fame: 2, done: false }`. Сур — `createGladiator(null, 1, { name: 'Сур' })`, все атрибуты 3, только `makeItem('gladius', 0)`.
  - `senatorContract() → { id, kind: 'contract', story: 'senator', title: 'Игры Публия Сервилия', client: 'сенатор Публий Сервилий', desc, difficulty: 2, tier: 2, size: 3, playerSize: 3, enemies: generateEnemyTeam(2, 3), gold: 400, fame: 15, xpMult: 1, cond: { type: 'win', text: 'Победить' }, artifact: null, done: false }`
  - `injectEvents()` — добавляет в `STATE.events`, если их там нет: учебный бой (пока не выполнена `train`) и бой с хозяином главы (если `current()` — задача-босс). Если в `STATE.contracts` нет активного заказа сенатора, а `current().id === 'senator'`, добавляет его.
  - `onNewDay()` — `injectEvents()`.
  - `onBattle(info)`:
    - `info.training && info.win` → `done.train = true`;
    - `info.boss && info.win` → `bosses[info.boss] = STATE.day`;
    - `info.kind === 'arena' && info.tier === 1 && info.win && chapter === 1` → `capuaWins++`;
    - `info.story === 'senator' && info.win && !info.surrendered` → `flags.senatorWon = true`;
    - `info.kind === 'final' && info.win` → `onFinalWon()`;
    - после всего `update()`.
  - `onFinalWon() → { cancelled: number }` — если долг не погашен, вызывает `debtCancel()`; ставит в очередь сцену `finale`.
  - `onDebt(r: DebtResult)`: `paid` при `idx === 1` → сцена `firstPayment`; `cleared` → `debtCleared`; `default` → `lost`.
  - `queueScene(id)` и `takeScenes() → string[]`. `takeScenes` выдаёт очередь без уже просмотренных (`seen`) и очищает очередь. `markSeen(id)`.
  - `SCENES: { [id]: Line[] }`, `Line = { who: 'doctore'|'lender'|'rival'|'senator'|'me', expr?: 'neutral'|'angry'|'pleased', text: string | (() => string) }`. Набор `id`: `prologue`, `firstWin`, `firstPayment`, `boss0`, `boss0Won`, `capua`, `boss1`, `boss1Won`, `rome`, `senatorWon`, `boss2`, `boss2Won`, `colosseum`, `debtCleared`, `finale`, `lost`. Сцены `bossN` ставятся в очередь, когда бой с хозяином впервые появился, `bossNWon` — после победы. Тексты пишет исполнитель в тоне спеки, 1–3 фразы на реплику, 3–8 реплик на сцену. Суммы в репликах берутся из `debtNext()`/`debtLeft()`, а не пишутся числом.
  - `gx(m: string, f: string) → string` — экспортируется глобально (`const gx = STORY.gx`).
  - `holderName() → 'Лукрион' | 'Гней Вар'`.

- [ ] **Step 1: Написать `tests/story.test.js`** со следующими тестами (`story()` как в задаче 2):
  - `новая история: глава 0, учебный бой в событиях, пролог в очереди` — `STATE.story.chapter === 0`, `STATE.events.some(e => e.training)`, `STORY.takeScenes()` deepEqual `['prologue']`.
  - `пролог не повторяется после просмотра` — `STORY.markSeen('prologue'); STORY.queueScene('prologue'); STORY.takeScenes()` deepEqual `[]`.
  - `задачи по порядку: слава не засчитывается раньше учебного боя` — `STATE.fame = 50; STORY.update()`. `fame40` в состоянии `todo`, текущая задача — `train`.
  - `учебный бой проигран: задача остаётся, бой вернётся завтра` — `STORY.onBattle({ training: true, win: false, kind: 'arena', tier: 0 })`. Текущая задача — `train`. После `nextDay()` в `STATE.events` снова есть `training`.
  - `хозяин Помпей появляется только после всех задач перед ним` — выполнить `train`, `recruit` (добавить бойца), `pay1` (`STATE.debt.idx = 1`), `fame40`; `STORY.update(); STORY.injectEvents()`. Есть событие с `boss === 'celadus'`. Без `pay1` такого события нет.
  - `хозяин переживает обновление событий` — при открытом боссе после `nextDay()` событие `celadus` снова в `STATE.events`.
  - `победа над Келадом открывает Капую и поднимает долг` — запомнить `left = debtLeft()`. `STORY.onBattle({ boss: 'celadus', win: true, kind: 'arena', tier: 0 })`. Ожидается: `chapter === 1`, `tierOpen(1) === true`, `tierOpen(2) === false`, `STATE.debt.holder === 'rival'`, `debtLeft() > left`, в очереди `capua`.
  - `победы в Капуе считаются только в главе II` — три `onBattle({ kind:'arena', tier:1, win:true })` в главе 1 дают `capuaWins === 3`; в главе 0 счётчик не растёт.
  - `заказ сенатора не теряется при обновлении заказов` — глава 2, текущая задача `senator`. `STATE.contracts = []; STORY.onNewDay()` возвращает заказ с `story === 'senator'`. После неудачи (`done: true`) и `onNewDay()` в списке новый невыполненный заказ.
  - `финал списывает остаток долга` — глава 3, `STATE.debt.idx = 5`. `STORY.onBattle({ kind:'final', win:true })`: `STATE.debt.cancelled === true`, в очереди `finale`, `current() === null` после `STATE.finalWon = true; STORY.update()`.
  - `параллельная задача долга засчитывается в любой момент` — глава 3, `STATE.debt.cleared = true; STORY.update()`. `debt` в состоянии `done`, текущая задача `fame1000`.
  - `gx по полу ланисты` — при `sex: 'f'` `gx('сын','дочь') === 'дочь'`.
  - `свободный режим: арены открываются славой` — `newGame("Т")`, `STATE.fame = 40`: `tierOpen(1) === true`, учебного боя в событиях нет.
- [ ] **Step 2:** Запустить `node tests/run.js`. Ожидается FAIL: `STORY is not defined`.
- [ ] **Step 3:** Написать `js/story.js` (логика и данные сцен) и правки в `core.js`/`ui.js` по Interfaces.
- [ ] **Step 4:** Запустить `node tests/run.js`. Ожидается, что все тесты проходят, включая задачи 1–2.
- [ ] **Step 5: Коммит** `Сюжет: главы, задачи, хозяева арен, учебный бой, заказ сенатора`.

---

### Task 4: Портреты в игре

**Files:**
- Create: `js/portrait.js`
- Modify: `index.html` (скрипт `portrait.js` перед `ui.js`)

**Interfaces:**
- Produces: `const PORTRAIT = (() => { … })()` со следующим:
  - `PORTRAIT.url(key: string, expr = 'neutral', size = 120, flip = false) → string` — dataURL. Холст рисуется размером `size * 2` пикселя и кешируется в `Map` по ключу `` `${key}|${expr}|${size}|${flip}` ``.
  - `PORTRAIT.LANISTAS: [{ key: 'm1'|'m2'|'m3'|'f1'|'f2'|'f3', sex: 'm'|'f', title, desc }]` — заголовки и описания из `LANISTAS` образца v3.
  - `PORTRAIT.NAMES: { doctore: 'Ферокс', lender: 'Лукрион', rival: 'Гней Вар', senator: 'Публий Сервилий' }`.
- Из образца v3 переносятся: `rng`, цветовые помощники, `paintWall`, `drawBust` с одеждой и предметами, весь блок «три четверти» (`geo34`, `face34`, `eye34`, `nose34`, `mouth34`, `neck34`, `ear34`, `hair34`, `beard34`, `cap34`, `fringe34`, `hairF34`, `capF34`, `bun34`, `veilBack34`, `veilFront34`, `earring34`, `necklace34`, `fist`, предметы), `weather` (лёгкая часть), рамка щита и `PEOPLE`. Не переносятся: фронтальные функции (`geo`, `drawFace`, `drawEye`, `frontHair`, `backHair`, `veilBack`/`veilFront`, `drawBeard`, `drawWreath`, `drawJewels`, `drawEar`, `drawMouth`, `drawNose`), вариант фрески и код страницы образца.

- [ ] **Step 1:** Перенести код в IIFE, оставив только стиль `clipeus`. Портрет каждого персонажа выглядит как в образце.
- [ ] **Step 2: Доработать недочёты из спеки.**
  - Волосы-«парик» у `lender` и `senator`: у `hairTex: 'comb'` линия роста волос неровная, между лбом и прядями мягкий переход (полупрозрачный край), объём `hairVol` повторяет форму черепа.
  - Кисти рук в `fist`: пальцы разной длины, у костяшек тень, большой палец меньше.
  - Сверить на снимке с образцом.
- [ ] **Step 3: Проверить в браузере.** Открыть `http://localhost:8765/`. В консоли Playwright выполнить отрисовку всех 10 ключей во всех трёх выражениях и с `flip = true` и вывести их на временную страницу (`document.body.innerHTML = …img…`). Сделать снимок `.playwright-mcp/portraits-check.png`. Ожидается: 0 ошибок в консоли, на снимке 40 портретов в щитах, лица в три четверти, у `m2` нет бороды.
- [ ] **Step 4: Коммит** `Портреты персонажей на щите`.

---

### Task 5: Сцены разговора

**Files:**
- Create: `js/scene.js`
- Modify: `index.html` (`<div id="scene" hidden></div>` после `#tour`, скрипт `scene.js` после `meta.js`), `css/style.css`, `js/ui.js` (обработчик `keydown` в `bindEvents`)

**Interfaces:**
- Consumes: `STORY.SCENES`, `STORY.markSeen`, `STORY.takeScenes`, `PORTRAIT.url`, `STATE.lanista.portrait`.
- Produces (`scene.js`):
  - `playScenes(ids: string[], onDone?: () => void) → void` — по очереди, каждую помечает просмотренной сразу при показе.
  - `flushScenes(onDone?)` — `playScenes(STORY.takeScenes(), onDone)`. Если очередь пуста, сразу `onDone`.
  - `sceneOpen() → boolean`
  - `sceneKey(e: KeyboardEvent) → boolean` — Enter и пробел листают, Esc пропускает сцену целиком.
  - Действия: `ACTIONS.sceneNext`, `ACTIONS.sceneSkip`.
- Разметка: портрет `PORTRAIT.url(who, expr, 120)`. Ланиста игрока справа, `flip = true`. Имя для `who: 'me'` — «Вы». Кнопка «Далее», на последней реплике «Продолжить», ссылка «Пропустить сцену». На ширине до 560px портрет 84px над текстом. Слой `#scene` z-index 59: выше `#tour` (58), ниже `#dialog` (60).
- `keydown` в `bindEvents`: сразу после ветки `UI.dlg` добавить `if (typeof sceneKey === 'function' && sceneKey(e)) return;`.

- [ ] **Step 1:** Написать `scene.js`, стили и подключение.
- [ ] **Step 2: Проверить в браузере.** В консоли:

  ```js
  newGame('Т', { story: true, lanista: { portrait: 'f1', sex: 'f' } });
  render();
  flushScenes(() => console.log('done'));
  ```

  Ожидается: пролог с портретом Лукриона, реплики «Вы» справа с отражённым портретом `f1`, тексты в женском роде. Enter листает. Повторный `flushScenes` ничего не показывает. Esc на второй сцене (`STORY.queueScene('capua')`) закрывает её целиком. Снимки на 1280 и 375. 0 ошибок в консоли.
- [ ] **Step 3: Коммит** `Сцены разговора с портретами`.

---

### Task 6: Новая игра с выбором ланисты

**Files:**
- Modify: `js/ui.js:693-722` (`showNewGameDialog`, `startNewGame`), `css/style.css`

**Interfaces:**
- Consumes: `PORTRAIT.LANISTAS`, `PORTRAIT.url`, `flushScenes`, `newGame(name, opts)`.
- Produces:
  - `startNewGame(name: string, tour: boolean, lanista: { portrait, sex })` вызывает `newGame(name, { story: true, lanista })`. После `render()` — `flushScenes(() => tour ? startTutorial() : toast('Начата новая игра.'))`. `startTutorial` появится в задаче 10; до неё — `typeof`-проверка.
  - В `showNewGameDialog` в `after` добавляется сетка `.lanista-pick`:
    - шесть кнопок `button.lp` с `data-act="pickLanista" data-k="m1"`, внутри `img` портрета 88px и `title`;
    - выбранная кнопка с классом `on`, по умолчанию `m1`;
    - на телефоне три в ряд.
  - `ACTIONS.pickLanista` переключает класс. `onOk` читает выбранную кнопку.

- [ ] **Step 1:** Реализовать.
- [ ] **Step 2: Проверить в браузере.** Меню → «Новая игра» → выбрать `f3`, ввести название, «Начать игру». Ожидается: пролог с портретом `f3` справа, `STATE.lanista` deepEqual `{ portrait: 'f3', sex: 'f' }`, `STATE.debt.plan[0] === 150`. Снимок окна на 375px: все шесть портретов видны без горизонтальной прокрутки.
- [ ] **Step 3: Коммит** `Выбор ланисты при новой игре`.

---

### Task 7: Долг в интерфейсе и проигрыш

**Files:**
- Modify: `js/ui.js` (`renderHeader`, `ACTIONS.nextDay`, `checkGameOver`, новые `showDebtDialog`, `showDebtLost`), `js/meta.js` (достижение), `js/menu.js` (`renderMenu`, «Продолжить»), `js/main.js` (загрузка проигранной игры), `css/style.css`

**Interfaces:**
- Consumes: `debtNext`, `debtLeft`, `debtUrgent`, `STATE.debt`, `STATE.lost`, `STORY.onDebt`, `STORY.holderName`, `flushScenes`.
- Produces:
  - В шапке после денариев блок `<button class="res debt ${debtUrgent() ? 'urgent' : ''}" data-act="debtInfo">`:
    - подпись «долг»;
    - значение `debtLeft()`;
    - строка `«платёж 300 через 3 дн.»`; в день срока — «сегодня», на следующий день — «завтра».

    Блок показывается, только если есть `STATE.debt` и `debtNext()`.
  - `showDebtDialog()` (действие `debtInfo`):
    - кто держит долг;
    - сколько осталось и сколько выплачено;
    - ближайшие три платежа с днями;
    - фраза «Платёж списывается сам в день срока. Если денег не хватит — лудус отберут.»
  - `ACTIONS.nextDay`. Если `debtNext()?.daysLeft === 1 && STATE.gold - upkeepCost() < amount`, сначала показать `showDialog`:
    - `title: 'Завтра платёж'`;
    - `text: «Завтра платёж ${amount} ден. ${holderName()}. В казне после содержания не хватит ${short} ден. Всё равно завершить день?»`;
    - `danger: true`, `ok: 'Завершить день'`.

    Потом `nextDay()` и по `debt.type`:
    - `warn` — `toast(…, true)`;
    - `paid` — `toast` с портретом держателя 28px (`PORTRAIT.url(holder, 'pleased', 28)`) и текстом «Платёж ${amount} ден. внесён. Осталось ${left}.»;
    - `cleared` и `default` — `STORY.onDebt(r)`, затем `flushScenes`; после `default` — `showDebtLost()`;
    - `cleared` — ещё `track('debtCleared')`. В `meta.js`: счётчик `debtCleared: 0` в `COUNTERS`, ветка `case 'debtCleared': c.debtCleared = 1`, достижение `{ id: 'debtFree', group: 'special', name: 'Долг отца уплачен', desc: 'Выплатить долг отца до последнего денария.', key: 'debtCleared', target: 1, reward: { fame: 20 } }`.
  - `showDebtLost()` — в `#modal` по образцу `checkGameOver`:
    - заголовок «Лудус отобран»;
    - портрет держателя долга (`lender` или `rival` по `STATE.debt.holder`) с выражением `pleased`, 120px;
    - итоги: дни, бойцы, павшие, выплачено;
    - кнопки «Новая игра» (`newGameAsk`) и «Загрузить сохранение» (`saveAsk`).
  - Если `STATE.lost` стоит, проигранная игра в главном меню показывает вместо «Продолжить» кнопку «Итог: лудус отобран» (`data-act="menuLost"`, открывает `showDebtLost()`). `main.js` при загрузке такого сохранения показывает меню.

- [ ] **Step 1:** Реализовать.
- [ ] **Step 2: Проверить в браузере.**
  - Новая история, `STATE.gold = 40`, завершать дни до 6-го. На 4-м дне сообщение о платеже через 3 дня. На 6-м «Завершить день» спрашивает подтверждение, «Отмена» не меняет день. Подтверждение ведёт к сцене `lost`, затем к окну «Лудус отобран».
  - Перезагрузка (F5): меню без «Продолжить», есть «Итог». Счётчик в шапке на 5–6-й день красный.
  - Второй прогон с `STATE.gold = 1000`: на 7-м дне сообщение «Платёж 150 ден. внесён» и сцена `firstPayment`.
  - Третий прогон: `STATE.debt.idx = 11`, `STATE.gold = 9999`, дойти до срока — сцена `debtCleared` и достижение «Долг отца уплачен».
  - Снимок шапки на 375px: счётчик не ломает строку.
- [ ] **Step 3: Коммит** `Долг в шапке, предупреждения, подтверждение конца дня, проигрыш`.

---

### Task 8: Строка задач и список задач

**Files:**
- Modify: `js/scene.js` (функции задач), `js/ui.js` (`render` — вызвать `renderTaskBar()` после `renderNav()`; новые вызовы `storyTick()`), `index.html` (`<div id="taskbar"></div>` после `nav`), `css/style.css`

**Interfaces:**
- Consumes: `STORY.current`, `STORY.tasks`, `STORY.update`, `STORY.CHAPTERS`, `debtNext`.
- Produces:
  - `renderTaskBar()` — строка `«${chapter.title} · ${task.text}${progress ? ` (${progress})` : ''}»` с `data-act="tasksOpen"`. После финала текст «История завершена · свободная игра». Без `STATE.story` строка скрыта.
  - `showTasksDialog()` — `showDialog` со списком задач главы с отметками ✓, ▸, ·. У текущей задачи с `tab` есть кнопка «Перейти» (`data-act="tab" data-tab=…`, закрывает диалог). Последняя строка — ближайший платёж.
  - `storyTick()` в `ui.js` — `STORY.update()`. Для каждой выполненной задачи `toast('Задача выполнена: …')`. Новая текущая задача — `toast('Новая задача: …')`. Затем `flushScenes()`. Вызывается:
    - в конце `closeBattle()`;
    - после `ACTIONS.buyGlad`;
    - после `ACTIONS.nextDay`;
    - после `revealVerdicts()`.

- [ ] **Step 1:** Реализовать.
- [ ] **Step 2: Проверить в браузере.**
  - Новая история: строка «Глава I. Помпеи · Выиграйте учебный бой».
  - Купить бойца на рынке, когда задача `recruit` текущая (поставить `STATE.story.done.train = true`): toast «Задача выполнена», строка переходит к «Внесите первый платёж (150 к 7-му дню)».
  - Окно задач: «Перейти» у рынка ведёт на вкладку.
  - Снимок 375px.
- [ ] **Step 3: Коммит** `Строка задач и список задач главы`.

---

### Task 9: Арена: хозяева, закрытые арены, сюжетные бои

**Files:**
- Modify: `js/ui.js` (`screenArena` 345-362, `eventCard` 377, `startBattle` 789, `finishBattle`, `revealVerdicts`, `closeBattle`), `js/meta.js` (`contractCard` — пометка сюжетного заказа), `css/style.css`

**Interfaces:**
- Consumes: `tierOpen`, `STORY.lockText`, `STORY.onBattle`, `ev.boss`, `ev.training`, `ev.story`.
- Produces:
  - `screenArena`. Арена закрыта, если `!tierOpen(i)`. Текст закрытой арены: `STATE.story ? STORY.lockText(i) : «откроется при славе лудуса N»`.
  - `eventCard`:
    - бой с хозяином — класс `boss`, заголовок «Хозяин арены: Келад», бронзовая рамка;
    - учебный бой — класс `training`, подпись «Учебный бой · без смертей · ручное управление».
  - `startBattle`: `const mode = ev.training ? 'manual' : battleMode();`
  - `revealVerdicts`: если `B.event.training`, исход всегда `live`.
  - `finishBattle`: в обеих ветках (заказ и арена/финал) сразу после `track('battleEnd', info)` вызвать `if (typeof STORY !== 'undefined' && STATE.story) STORY.onBattle(info);`.
  - Сюжетный заказ в `contractCard` получает пометку «Сюжетный заказ».

- [ ] **Step 1:** Реализовать.
- [ ] **Step 2: Проверить в браузере.**
  - Учебный бой: при «Автобой» в настройках он всё равно начинается с расстановки.
  - Проигрыш или сдача: боец помилован. На следующий день учебный бой снова в списке.
  - Подготовить задачи главы I в консоли и `STORY.injectEvents()`: карточка хозяина, сцена `boss0` при появлении. Победа (в консоли урезать здоровье врагов: `UI.battle.b.units.filter(u => u.side === 'enemy').forEach(u => u.hp = 1)`) ведёт к сценам `boss0Won` и `capua`, Капуя открыта, Рим закрыт с текстом «после победы над чемпионом Гнея Вара».
- [ ] **Step 3: Коммит** `Хозяева арен, учебный бой и сюжетный заказ на арене`.

---

### Task 10: Обучение наставника

**Files:**
- Modify:
  - `js/scene.js` — модуль `TUTOR`;
  - `js/menu.js` — удалить `TOUR_STEPS`, `TOUR`, `startTour`, `endTour`, `tourSteps`, `showTourStep`, `tourKey` и действия `tour*`; `placeTour` и стили `.tour-*` переносятся в `scene.js` как `coachPlace`;
  - `js/ui.js` — вызовы `coach(…)` в бою; ссылки `startTour` и `tourKey` → `startTutorial` и `coachKey`;
  - `index.html` — `#tour` переименовать в `#coach`;
  - `css/style.css`.

**Interfaces:**
- Produces (`scene.js`):
  - `startTutorial()` и `endTutorial(done: boolean)`. Нынешнее поведение `TOUR_PREF` сохраняется: после конца или пропуска ставится `'0'`.
  - `TUTOR = { on: boolean, step: string | null }` в `STATE.story.tutor`, чтобы шаг пережил перезагрузку.
  - `coachEvent(evName: string, data?: any) → void` — точка входа; `ui.js` зовёт её через свою обёртку `coach` (см. ниже).
  - `coachKey(e) → boolean`.
  - `tabHint(tab: string) → void` — подсказка при первом заходе на вкладку. Работает только при включённом обучении. Отмечается в `STATE.story.hints[tab]`. Вызывается из `ACTIONS.tab`.
- Карточка наставника `.coach-card`: портрет `doctore` 64px, 1–2 фразы, «Далее» (если шаг ждёт кнопку) и «Пропустить обучение». Подсветка цели — рамка `.coach-hole`.
  - **Модальные шаги** (затемнение, клики только по карточке) — шаги вне боя до учебного боя.
  - **Немодальные шаги** (без затемнения, пульсирующая рамка на цели, игрок кликает в игру) — шаги в бою и шаги «перейдите на вкладку».
- Шаги, `id` и событие перехода:

  | id | Цель (селектор) | Переход |
  |---|---|---|
  | `money` | `header .res` (казна, слава, долг) | «Далее» |
  | `debt` | `header .debt` | «Далее» |
  | `glad` | `main .gcard` | «Далее» |
  | `toArena` | `nav [data-tab="arena"]` | `tab:arena` |
  | `pickTraining` | `.event.training` | `pick` (выбор события) |
  | `pickGlad` | `.picker` | `battleStart` |
  | `deploy` | `#bTact` | `deployPlace` |
  | `deployGo` | `[data-act="dStart"]` | `fightStart` |
  | `move` | холст | `moved` |
  | `aim` | холст | `hoverEnemy` |
  | `attack` | холст | `attacked` |
  | `ability` | `[data-act="tAbility"]` | `ability` или «Далее»; пропускается, если у бойца нет приёма |
  | `endTurn` | `[data-act="tWait"]` | `turnEnd` |
  | `enemy` | — | `turnStart` |
  | `mercy` | `#bresults` | `results` |
  | `toSmith` | `nav [data-tab="smith"]` | `tab:smith` |
  | `smith` | `main` | «Далее» |
  | `toMarket` | `nav [data-tab="market"]` | `tab:market` |
  | `market` | `main` | «Далее» |
  | `endDay` | `[data-act="nextDay"]` | «Далее» → конец обучения |

  Шаги `move`/`aim`/`attack` повторяются в каждом ходе игрока, пока не выполнены. Если бой кончился раньше, оставшиеся боевые шаги пропускаются и наступает `mercy`.
- Вызовы `coach` в `ui.js`:
  - `startDeploy` → `deployStart`;
  - `onPick` в расстановке после перестановки → `deployPlace`;
  - `deployDone` → `fightStart`;
  - `playerTurn`: начало → `turnStart`; после `cmdMove` → `moved`; `hintFn` с шансом попадания → `hoverEnemy`; после `cmdAttack` → `attacked`; после `cmdAbility` → `ability`; `finish` → `turnEnd`;
  - `renderResults` → `results`;
  - `ACTIONS.pickEvent` → `pick`;
  - `startBattle` → `battleStart`;
  - `ACTIONS.tab` → `tab:${tab}`.

  Все вызовы через `const coach = (n, d) => { if (typeof TUTOR !== 'undefined') coachEvent(n, d); };`.
- Тексты: 1–2 фразы на шаг, от лица Ферокса.
- Подсказки при первом заходе (`tabHint`): одна фраза для каждой из вкладок `contracts`, `armory`, `glory`, `necro`, `rules`, `bazaar`.

- [ ] **Step 1:** Реализовать `TUTOR` и вызовы. Удалить старый обзор.
- [ ] **Step 2: Проверить в браузере (1280px).** Новая игра с галочкой: пролог → `money` → … → учебный бой → проходить шаги. Ожидается:
  - каждый шаг сменяется после своего действия;
  - подсказка шанса попадания вызывает `attack`;
  - после боя наступает `mercy`, потом кузнец и рынок;
  - `endDay` завершает обучение;
  - первый заход на «Склад» показывает одну подсказку, второй — нет.
- [ ] **Step 3: Проверить в браузере (375px).** То же до `move`. Затем F5 посреди обучения вне боя: шаг восстановился. Esc пропускает обучение. Новая игра без галочки: пролог есть, подсказок нет, учебный бой есть.
- [ ] **Step 4: Коммит** `Обучение наставника через учебный бой`.

---

### Task 11: Эпилог, вольная и Некрополь

**Files:**
- Modify: `js/ui.js` (`showEnding`, `screenNecro`, `ACTIONS`), `css/style.css`

**Interfaces:**
- Consumes: `STORY.onFinalWon` (уже вызван из `onBattle`), `flushScenes`.
- Produces:
  - `showEnding()` в истории. Перед итогами — `flushScenes()` (сцена `finale`). Затем выбор:
    - «Вручить рудис ${best.name}» (`data-act="freeBest"`);
    - «Оставить в лудусе» (`data-act="keepBest"`).

    Если долг был списан, добавляется фраза «Разорённый Вар больше ничего не может требовать: остаток долга, ${n} ден., списан.»
  - `freeBest`: боец удаляется из `STATE.gladiators`. В `STATE.graveyard` добавляется запись `{ freed: true, name, cls, level, origin, record, look, attrs, equip, day, place: 'Колизей' }`, в хронику — запись. Снаряжение уходит с бойцом. Потом итоги, как сейчас.
  - `screenNecro`:
    - заголовок «Здесь покоятся павшие и вспоминают отпущенных на волю»;
    - запись с `freed`: портрет не серый, подпись «Отпущен на волю в день N, Колизей. Получил рудис из рук ланисты.», класс `tomb freed`;
    - пустая надпись прежняя.
  - В свободном режиме `showEnding` без выбора, как сейчас.

- [ ] **Step 1:** Реализовать.
- [ ] **Step 2: Проверить в браузере.** В консоли перейти в главу 3, `STATE.fame = 1000`, начать финал и выиграть, урезав здоровье врагов. Ожидается: сцена `finale`, выбор, «Вручить рудис» — боец исчез, в Некрополе запись «Отпущен на волю», строка задач «История завершена · свободная игра». Отдельный прогон с `STATE.debt.idx = 8`: в эпилоге фраза о списании.
- [ ] **Step 3: Коммит** `Эпилог: вольная лучшему бойцу и запись в Некрополе`.

---

### Task 12: Старые сохранения и перенос

**Files:**
- Modify: `js/main.js` (`prepareState`), `js/ui.js` (`saveExport`, `parseSaveFile`, `saveSummary`), `js/story.js` (`init()` для загрузки)

**Interfaces:**
- Produces:
  - `STORY.init()` вызывается из `prepareState()`. При `STATE.story` дополняет недостающие поля по `create()`, кроме `queue`, и вызывает `injectEvents()`. Без `STATE.story` ничего не делает.
  - Файл сохранения пишется с `version: 2`. `parseSaveFile` принимает `version` 1 и 2.
  - `saveSummary` для истории добавляет главу: `«…, глава II»`.

- [ ] **Step 1:** Реализовать.
- [ ] **Step 2: Проверить в браузере.**
  - Записать в `localStorage` сохранение старого формата: взять `STATE` из `newGame('Старый')` без `opts` и удалить `story`, `debt`, `lanista`. F5 → «Продолжить»: нет счётчика долга и строки задач, арены открываются славой, 0 ошибок.
  - История на главе II: экспорт файла → «Новая игра» → импорт → долг, глава, задачи и портрет на месте.
  - Импорт файла `version: 1` (старый экспорт): свободный режим.
- [ ] **Step 3: Коммит** `Старые сохранения в свободном режиме, файл сохранения версии 2`.

---

### Task 13: Подбор чисел долга

**Files:**
- Create: `tests/sim.js`
- Modify: `js/data.js` (`DEBT_PLAN`, `DEBT_RAISE`), `js/story.js` (`BOSSES` — уровни, если нужно), `tests/debt.test.js` (значения, зависящие от `DEBT_PLAN`)

**Interfaces:**
- Consumes: `loadGame(['data','core','debt','story','combat'])`, `Battle`, `STORY`.
- `node tests/sim.js [runs=40]` прогоняет историю простым игроком:
  - каждый день все готовые бойцы участвуют в лучших доступных событиях (автобой: `new Battle(glads, ev.enemies, ev, { mode: 'auto' })`, цикл `beginTurn`/`aiTurn` до `over`);
  - победы и поражения применяются как в `finishBattle`/`revealVerdicts`, упрощённо: золото, слава, смерть по шансу помилования;
  - новый боец покупается на рынке, если после покупки остаётся следующий платёж плюс 50;
  - хозяева и учебный бой проводятся, как только появляются;
  - платежи идут через `nextDay()`.

  Печатает медианы и 10-й процентиль: день открытия каждой главы, день последнего платежа, долю проигрышей из-за долга, минимальный запас казны перед каждым платежом.

**Цели подбора** (из спеки):
- проигрышей из-за долга до 14-го дня 0%;
- первый платёж оплачивается во всех прогонах;
- медианный день последнего платежа в пределах ±7 дней от медианного дня открытия Колизея;
- доля проигрышей из-за долга за всю игру у простого игрока от 10 до 35% (середина напряжённая, но проходимая);
- сумма до повышения ровно 5000.

- [ ] **Step 1:** Написать `tests/sim.js` и запустить `node tests/sim.js 40` с черновыми числами. Записать вывод.
- [ ] **Step 2:** Менять `DEBT_PLAN` (12–14 платежей, сумма 5000, неубывающие, кратные 10) и при необходимости `DEBT_RAISE` (1.1–1.3) и уровни хозяев, пока цели не выполнены. Итоговый вывод сохранить в комментарии над `DEBT_PLAN`: медианы, процентиль, доля проигрышей.
- [ ] **Step 3:** Обновить тесты, завязанные на конкретные суммы, и запустить `node tests/run.js`. Ожидается, что все тесты проходят.
- [ ] **Step 4: Коммит** `Подбор расписания долга по симуляции`.

---

### Task 14: Справочник, README и итоговая проверка

**Files:**
- Modify: `js/ui.js` (`GUIDE` — новая глава «История и долг»), `README.md`

- [ ] **Step 1: Глава справочника «История и долг».** Что в ней:
  - завязка;
  - главы и хозяева арен;
  - задачи;
  - как работает долг: расписание, автосписание, проигрыш, повышение в Капуе, списание при победе в финале;
  - свободный режим старых сохранений.

  README: короткий раздел о сюжете, долге, выборе ланисты и обучении, плюс запуск тестов `node tests/run.js`.
- [ ] **Step 2:** Запустить `node tests/run.js`. Ожидается, что все тесты проходят.
- [ ] **Step 3: Полный проход в браузере** по разделу «Проверка» спеки на 1280 и 375, консоль без ошибок и предупреждений:
  - новая игра каждым из 6 портретов (быстро, до пролога);
  - обучение целиком;
  - платёж;
  - проигрыш;
  - погашение;
  - каждая арена через хозяина;
  - заказ сенатора;
  - финал и эпилог;
  - старое сохранение;
  - экспорт и импорт.
- [ ] **Step 4: Коммит** `Справочник и README: история и долг`. Пуш в `origin/main` — только после подтверждения владельца.
