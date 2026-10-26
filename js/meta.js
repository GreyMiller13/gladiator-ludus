// ============================================================
//  Мета-системы: достижения, реликвии (уникальные артефакты)
//  и ежедневные заказы — показательные бои не насмерть
// ============================================================

// ------------------------------------------------------------
//  Реликвии: уникальные предметы. Характеристики итоговые —
//  от качества не зависят. Каждая выдаётся не больше раза за игру.
//  look — обычный предмет того же слота, по которому рисуется реликвия.
// ------------------------------------------------------------
const ARTIFACTS = {
  // Оружие
  art_spartacus: { slot: 'weapon', name: 'Сика Спартака', look: 'sica', price: 1400,
    classes: ['thraex', 'dimachaerus'],
    stats: { dmgMin: 13, dmgMax: 21, crit: 18, agi: 3, skl: 2, wil: 2 },
    desc: 'Изогнутый клинок фракийца, бежавшего из лудуса в Капуе и три года громившего легионы Республики.' },
  art_flamma: { slot: 'weapon', name: 'Гладиус Фламмы', look: 'gladius', price: 1400,
    classes: ['murmillo', 'secutor', 'dimachaerus'],
    stats: { dmgMin: 14, dmgMax: 23, acc: 18, str: 3, crit: 6, mercy: 10 },
    desc: 'Меч сирийца Фламмы: тридцать четыре боя, и четырежды он отказывался от деревянного меча свободы. Толпа помнит этот клинок.' },
  art_achilles: { slot: 'weapon', name: 'Копьё Ахилла', look: 'spear', price: 1400,
    classes: ['hoplomachus', 'retiarius'],
    stats: { dmgMin: 18, dmgMax: 29, acc: 6, init: 12, crit: 13, skl: 3 },
    desc: 'Ясеневое копьё с Пелиона, которое, кроме героя, никто не мог поднять. Так, по крайней мере, клянётся продавец.' },
  art_apollo: { slot: 'weapon', name: 'Лук Аполлона', look: 'compBow', price: 1800, twoHanded: true, ranged: true,
    classes: ['sagittarius'],
    stats: { dmgMin: 22, dmgMax: 33, acc: 18, crit: 16, skl: 3 },
    desc: 'Лук сребролукого бога. Говорят, его стрелы сами находят щель между пластинами доспеха.' },
  art_brennus: { slot: 'weapon', name: 'Секира Бренна', look: 'axe', price: 1800, twoHanded: true,
    classes: ['gallus'],
    stats: { dmgMin: 27, dmgMax: 41, acc: -4, stun: 18, str: 3, crit: 6 },
    desc: 'Секира вождя сенонов, взявшего Рим. «Vae victis!» — «Горе побеждённым!» — до сих пор читается на обухе.' },
  art_rudis: { slot: 'weapon', name: 'Рудис свободы', look: 'gladius', price: 2000,
    classes: CLASS_KEYS.slice(),
    stats: { dmgMin: 12, dmgMax: 20, acc: 15, crit: 6, wil: 4, mercy: 25 },
    desc: 'Деревянный меч, окованный бронзой, — его вручают вместе со свободой. Перед ним склоняется любая толпа.' },
  // Вторая рука
  art_commodus: { slot: 'offhand', name: 'Скутум Коммода', look: 'scutum', price: 1300,
    classes: ['murmillo', 'secutor'],
    stats: { block: 50, armor: 7, dodge: -3, end: 3, resist: 10 },
    desc: 'Позолоченный щит императора, выходившего на арену Геркулесом Римским. Он не проиграл ни одного боя — враги ему не позволили.' },
  art_neptune: { slot: 'offhand', name: 'Сеть Нептуна', look: 'rete', price: 1000,
    classes: ['retiarius'],
    stats: { dodge: 14, acc: 12, agi: 3, wil: 3, resist: 10 },
    desc: 'Сеть, сплетённая, по преданию, из волос нереид. Она остаётся мокрой даже в полдень на раскалённом песке.' },
  art_priscus: { slot: 'offhand', name: 'Клинок Приска', look: 'pugio', price: 1100,
    classes: ['dimachaerus'],
    stats: { dmgMin: 10, dmgMax: 16, acc: 5, crit: 12, dodge: 8, agi: 3 },
    desc: 'Второй клинок Приска. Его бой с Вером длился так долго, что император Тит даровал свободу обоим.' },
  // Шлем
  art_spiculus: { slot: 'helmet', name: 'Шлем Спикула', look: 'galea', price: 1200,
    classes: ['murmillo', 'secutor', 'thraex', 'hoplomachus'],
    stats: { armor: 11, wil: 3, hp: 16, resist: 15 },
    desc: 'Шлем Спикула, любимца Нерона, получившего за свои победы дворцы и поместья. Забрало не мешает видеть — редкая работа.' },
  // Доспех
  art_mars: { slot: 'armor', name: 'Чешуя Марса', look: 'squama', price: 1600,
    classes: ['murmillo', 'secutor', 'hoplomachus', 'gallus'],
    stats: { armor: 18, dodge: -3, end: 3, hp: 20, resist: 10 },
    desc: 'Чешуйчатый доспех из храма Марса Мстителя. Каждая пластина помнит чью-то клятву перед боем.' },
  // Руки
  art_carpophorus: { slot: 'arms', name: 'Наручи Карпофора', look: 'vambraces', price: 900,
    classes: ['sagittarius', 'gallus', 'dimachaerus', 'retiarius'],
    stats: { armor: 4, acc: 12, crit: 6, agi: 2, str: 2 },
    desc: 'Наручи бестиария Карпофора, который за один день одолел двадцать зверей — медведя, льва и леопарда среди них.' },
  // Поножи
  art_hector: { slot: 'legs', name: 'Поножи Гектора', look: 'ocreaeHigh', price: 1000,
    classes: ['thraex', 'hoplomachus', 'murmillo', 'secutor'],
    stats: { armor: 10, agi: 3, hp: 14, init: 4, resist: 5 },
    desc: 'Бронзовые поножи защитника Трои. Ахилл снял их с поверженного, а какой-то грек, говорят, продал их в Капуе.' },
  // Пояс
  art_hercules: { slot: 'belt', name: 'Пояс Геракла', look: 'balteus', price: 1200,
    classes: CLASS_KEYS.slice(),
    stats: { hp: 40, str: 3, end: 3, wil: 2 },
    desc: 'Пояс, добытый Гераклом у царицы амазонок Ипполиты. Тяжелее, чем кажется, — и держит крепче любой клятвы.' },
};

// Новые характеристики (их механику реализует бой)
STAT_NAMES.resist = 'Стойкость';
STAT_NAMES.mercy = 'Милость толпы';
PCT_STATS.add('resist');
PCT_STATS.add('mercy');

// Регистрация реликвий в общем справочнике предметов
for (const [id, A] of Object.entries(ARTIFACTS)) {
  const look = ITEM_BASES[A.look] || {};
  ITEM_BASES[id] = {
    ...A, bonus: [], artifact: true, source: '',
    twoHanded: A.twoHanded ?? look.twoHanded, ranged: A.ranged ?? look.ranged, needsBow: A.needsBow ?? look.needsBow,
  };
  for (const k of ['twoHanded', 'ranged', 'needsBow']) if (!ITEM_BASES[id][k]) delete ITEM_BASES[id][k];
}

// ------------------------------------------------------------
//  Достижения, реликвии и заказы
// ------------------------------------------------------------
const META = (() => {
  // Группы достижений
  const GROUPS = { arena: 'Арена', fighters: 'Бойцы', ludus: 'Лудус', contracts: 'Заказы', bets: 'Ставки', special: 'Особые' };

  // key — счётчик в STATE.meta.c, target — сколько нужно
  const ACH = [
    // Арена
    { id: 'firstWin', group: 'arena', name: 'Первая кровь', desc: 'Победить в бою на арене.', key: 'arenaWins', target: 1, reward: { gold: 40 } },
    { id: 'wins10', group: 'arena', name: 'Любимцы публики', desc: 'Одержать 10 побед на арене.', key: 'arenaWins', target: 10, reward: { gold: 150, fame: 5 } },
    { id: 'wins50', group: 'arena', name: 'Ветераны песка', desc: 'Одержать 50 побед на арене.', key: 'arenaWins', target: 50, reward: { fame: 20, art: 'art_mars' } },
    { id: 'win3v3', group: 'arena', name: 'Тройка', desc: 'Победить в бою 3 на 3.', key: 'wins3', target: 1, reward: { gold: 100 } },
    { id: 'flawless3', group: 'arena', name: 'Без потерь', desc: 'Победить в бою 3 на 3 на арене так, чтобы ни один ваш боец не был повержен.', key: 'flawless3', target: 1, reward: { gold: 200, fame: 5 } },
    { id: 'capua', group: 'arena', name: 'Гром Капуи', desc: 'Победить в амфитеатре Капуи.', key: 'tier1', target: 1, reward: { gold: 120 } },
    { id: 'rome', group: 'arena', name: 'Покоритель Рима', desc: 'Победить в Статилиевом амфитеатре.', key: 'tier2', target: 1, reward: { gold: 300, fame: 10 } },
    { id: 'colosseum', group: 'arena', name: 'Колизей', desc: 'Победить на Играх Императора в Колизее.', key: 'tier3', target: 1, reward: { art: 'art_commodus' } },
    { id: 'iugula', group: 'arena', name: 'Iugula!', desc: 'Толпа приговорила к смерти 25 противников, поверженных вашими бойцами.', key: 'executed', target: 25, reward: { gold: 200 } },
    // Бойцы
    { id: 'kills10', group: 'fighters', name: 'Кровавый песок', desc: 'Ваши бойцы повергли 10 противников на арене.', key: 'kills', target: 10, reward: { gold: 100 } },
    { id: 'kills50', group: 'fighters', name: 'Гроза арены', desc: 'Ваши бойцы повергли 50 противников на арене.', key: 'kills', target: 50, reward: { art: 'art_spartacus' } },
    { id: 'kills200', group: 'fighters', name: 'Жатва Плутона', desc: 'Ваши бойцы повергли 200 противников на арене.', key: 'kills', target: 200, reward: { gold: 1000, fame: 30 } },
    { id: 'lvl10', group: 'fighters', name: 'Мастер школы', desc: 'Вырастить гладиатора до 10-го уровня.', key: 'bestLevel', target: 10, reward: { gold: 250 } },
    { id: 'lvl20', group: 'fighters', name: 'Живая легенда', desc: 'Вырастить гладиатора до 20-го уровня.', key: 'bestLevel', target: 20, reward: { art: 'art_hercules' } },
    { id: 'champion', group: 'fighters', name: 'Чемпион', desc: 'Один гладиатор одержал 20 побед.', key: 'bestGladWins', target: 20, reward: { art: 'art_flamma' } },
    { id: 'missio', group: 'fighters', name: 'Missio', desc: 'Толпа помиловала ваших бойцов 5 раз.', key: 'spared', target: 5, reward: { gold: 150 } },
    // Лудус
    { id: 'schools4', group: 'ludus', name: 'Разные школы', desc: 'Одновременно держать в лудусе бойцов 4 разных школ.', key: 'schools', target: 4, reward: { gold: 100 } },
    { id: 'schools8', group: 'ludus', name: 'Все школы империи', desc: 'Одновременно держать в лудусе бойцов всех 8 школ.', key: 'schools', target: 8, reward: { gold: 500, fame: 15 } },
    { id: 'fame150', group: 'ludus', name: 'Имя в Риме', desc: 'Слава лудуса достигла 150.', key: 'bestFame', target: 150, reward: { gold: 250 } },
    { id: 'fame400', group: 'ludus', name: 'Любимец императора', desc: 'Слава лудуса достигла 400.', key: 'bestFame', target: 400, reward: { art: 'art_spiculus' } },
    { id: 'fame1000', group: 'ludus', name: 'Бессмертная слава', desc: 'Слава лудуса достигла 1000.', key: 'bestFame', target: 1000, reward: { gold: 2000 } },
    { id: 'crassus', group: 'ludus', name: 'Казна Красса', desc: 'Заработать в сумме 5000 денариев (награды за бои и заказы).', key: 'earned', target: 5000, reward: { fame: 15 } },
    // Заказы
    { id: 'contract1', group: 'contracts', name: 'Первый заказ', desc: 'Выполнить заказ.', key: 'contracts', target: 1, reward: { gold: 30 } },
    { id: 'contract10', group: 'contracts', name: 'Надёжный подрядчик', desc: 'Выполнить 10 заказов.', key: 'contracts', target: 10, reward: { gold: 200 } },
    { id: 'contract40', group: 'contracts', name: 'Поставщик двора', desc: 'Выполнить 40 заказов.', key: 'contracts', target: 40, reward: { gold: 600, fame: 15 } },
    { id: 'contractHard', group: 'contracts', name: 'Опасное ремесло', desc: 'Выполнить заказ уровня «Опасный».', key: 'contractsHard', target: 1, reward: { gold: 250 } },
    { id: 'contractFew', group: 'contracts', name: 'Меньшинством', desc: 'Выполнить заказ, сражаясь в меньшинстве.', key: 'contractsOutnumbered', target: 1, reward: { gold: 150 } },
    // Ставки
    { id: 'bet1', group: 'bets', name: 'Глаз знатока', desc: 'Выиграть ставку на бой дня.', key: 'betsWon', target: 1, reward: { gold: 50 } },
    { id: 'betUnderdog', group: 'bets', name: 'Вера в слабого', desc: `Выиграть ставку на бойца с коэффициентом не ниже ${typeof BET_UNDERDOG !== 'undefined' ? BET_UNDERDOG : 2.5}.`, key: 'betUnderdog', target: 1, reward: { gold: 150 } },
    { id: 'bet10', group: 'bets', name: 'Завсегдатай трибун', desc: 'Выиграть 10 ставок.', key: 'betsWon', target: 10, reward: { gold: 300 } },
    { id: 'bet5000', group: 'bets', name: 'Любимец Фортуны', desc: 'Выиграть на ставках в сумме 5000 денариев сверх поставленного.', key: 'betProfit', target: 5000, reward: { fame: 20 } },
    // Особые
    { id: 'manual', group: 'special', name: 'Рука ланисты', desc: 'Победить, лично отдавая приказы (ручное управление боем).', key: 'manualWins', target: 1, reward: { gold: 75 } },
    { id: 'lastBreath', group: 'special', name: 'На волоске', desc: 'Победить, когда у вашего бойца на ногах осталось не больше 10% здоровья.', key: 'lastBreath', target: 1, reward: { gold: 150 } },
    { id: 'legendary', group: 'special', name: 'Работа мастера', desc: 'Владеть легендарным предметом.', key: 'legendary', target: 1, reward: { gold: 150 } },
    { id: 'debtFree', group: 'special', name: 'Долг отца уплачен', desc: 'Выплатить долг отца до последнего денария.', key: 'debtCleared', target: 1, reward: { fame: 20 } },
    { id: 'day50', group: 'special', name: 'Полвека', desc: 'Продержать лудус 50 дней.', key: 'day', target: 50, reward: { gold: 300 } },
    { id: 'relics3', group: 'special', name: 'Собиратель реликвий', desc: 'Получить 3 реликвии.', key: 'artifacts', target: 3, reward: { gold: 400, fame: 10 } },
    { id: 'freedom', group: 'special', name: 'Рудис свободы', desc: 'Победить в финальной битве.', key: 'finalWins', target: 1, reward: { fame: 50, art: 'art_rudis' } },
  ];
  const ACH_BY_ID = Object.fromEntries(ACH.map(a => [a.id, a]));

  // Счётчики STATE.meta.c
  const COUNTERS = {
    arenaFights: 0, arenaWins: 0, kills: 0, wins3: 0, flawless3: 0, tier1: 0, tier2: 0, tier3: 0,
    executed: 0, spared: 0, manualWins: 0, lastBreath: 0, finalWins: 0,
    contracts: 0, contractsFailed: 0, contractsHard: 0, contractsOutnumbered: 0, earned: 0,
    bestLevel: 0, bestGladWins: 0, schools: 0, bestFame: 0, day: 0, legendary: 0, artifacts: 0, debtCleared: 0,
    betsWon: 0, betUnderdog: 0, betProfit: 0,
  };

  // Откуда берутся реликвии: из достижений или из «легендарных заказов»
  const ACH_ARTS = new Set(ACH.filter(a => a.reward.art).map(a => a.reward.art));
  const CONTRACT_ARTS = Object.keys(ARTIFACTS).filter(id => !ACH_ARTS.has(id));
  for (const a of ACH) if (a.reward.art) ITEM_BASES[a.reward.art].source = `Достижение «${a.name}»: ${a.desc.charAt(0).toLowerCase()}${a.desc.slice(1)}`;
  for (const id of CONTRACT_ARTS) ITEM_BASES[id].source = 'Легендарный заказ: изредка среди заказов дня появляется «Опасный» заказ, за который обещана эта реликвия.';

  // ------------------------------------------------------------
  //  Заказы: справочники
  // ------------------------------------------------------------
  const DIFFICULTY = [
    { name: 'Лёгкий',  lvl: -2, pay: 0.6, fame: 0, xp: 0.5 },
    { name: 'Обычный', lvl: 0,  pay: 1.0, fame: 1, xp: 0.6 },
    { name: 'Трудный', lvl: 2,  pay: 1.6, fame: 2, xp: 0.75 },
    { name: 'Опасный', lvl: 4,  pay: 2.4, fame: 4, xp: 0.9 },
  ];
  const SIZE_PAY = { 1: 1, 2: 1.6, 3: 2.2 };
  const COND_PAY = { win: 1, survive: 0.8, rounds: 1.15, flawless: 1.25, outnumbered: 1.5 };
  const CONDS_BY_DIFF = [
    ['win', 'win', 'survive'],
    ['win', 'survive', 'rounds'],
    ['win', 'flawless', 'rounds', 'outnumbered'],
    ['win', 'flawless', 'rounds', 'outnumbered'],
  ];
  const ROUNDS_LIMIT = [12, 11, 10, 9];   // «победить не позднее N-го раунда»
  const SURVIVE_ROUNDS = [5, 6, 7, 8];   // «продержаться N раундов»
  const FAIL_FEE = 0.15;                 // плата за выход при неудаче

  // tier: число — фон арены (не выше открытой), 'any' — случайная открытая, 'top' — лучшая открытая
  const TEMPLATES = [
    { title: 'Пир у сенатора', tier: 0,
      clients: ['сенатор Гней Кальпурний', 'сенатор Луций Аррунций', 'сенатор Публий Сульпиций'],
      desc: 'Хозяин развлекает гостей между переменами блюд. Кровь на мозаике ему не нужна — бой до первого падения, лекарь ждёт у триклиния.' },
    { title: 'Праздник магистрата', tier: 'any',
      clients: ['дуумвир Гней Аллей Нигидий Май', 'эдил Капуи', 'квестор провинции'],
      desc: 'Игры в честь Флоралий за счёт магистрата. Городу нужно зрелище, магистрату — переизбрание, поэтому мёртвых не будет: на песке только мастерство.' },
    { title: 'Спарринг с соперниками', tier: 'any',
      clients: ['ланиста Солоний', 'ланиста Тулий из Капуи', 'лудус Аврелия Скавра'],
      desc: 'Соседний лудус предлагает учебный бой — проверить своих бойцов на чужих. На кону гордость двух школ, но добивать никто не станет.' },
    { title: 'Свадьба купца', tier: 0,
      clients: ['Умбриций Скавр, торговец гарумом', 'вольноотпущенник Цецилий Юкунд', 'виноторговец из Геркуланума'],
      desc: 'Свадебное зрелище: невеста желает видеть настоящих гладиаторов, жених — чтобы никто не забрызгал кровью тоги гостей.' },
    { title: 'Учение для новобранцев', tier: 'any',
      clients: ['центурион Тит Пуллон', 'префект лагеря в Мизене', 'трибун Второго легиона'],
      desc: 'Легион набирает рекрутов. Командир хочет показать им, как держат удар профессионалы, — против своих лучших ветеранов.' },
    { title: 'Пари патрона', tier: 'any',
      clients: ['ваш патрон Марк Лициний', 'всадник Квинт Аврелий', 'патрон лудуса Гай Вибий'],
      desc: 'Покровитель поставил крупную сумму на ваших бойцов. Ему нужен не труп, а выигранный спор — и ваша услужливость.' },
    { title: 'Наёмная охрана', tier: 0,
      clients: ['меняла Луций Цецилий', 'судовладелец из Остии', 'откупщик налогов Сей Страбон'],
      desc: 'Заказчик нанимает ваших бойцов охранять обоз и сперва проверяет их против своих телохранителей. Клинки затуплены, но бьют всерьёз.' },
    { title: 'Поминальные игры', tier: 'any',
      clients: ['вдова декуриона', 'семья Аппулеев', 'наследники хлеботорговца'],
      desc: 'Семья устраивает мунус в память покойного. По его завету — без смертей: пусть боги видят доблесть, а не бойню.' },
    { title: 'Смотр для префекта', tier: 'top',
      clients: ['распорядитель императорских игр', 'прокуратор Большого лудуса', 'префект претория'],
      desc: 'Люди с Палатина присматривают бойцов для будущих императорских игр. Смотр идёт без крови, но зрители взыскательны.' },
    { title: 'Испытание чести', tier: 'any',
      clients: ['молодой патриций Корнелий', 'сын сенатора Валерия', 'юный всадник Фабий'],
      desc: 'Знатный юнец нанял бойцов, чтобы доказать отцу, что его люди сильнее ваших. Проигравший платит, но уходит на своих ногах.' },
    { title: 'Ярмарочное зрелище', tier: 0,
      clients: ['коллегия сукновалов', 'коллегия пекарей Помпей', 'старшина рыночной площади'],
      desc: 'Коллегия ремесленников развлекает народ в рыночный день. Публика простая: щедрая на крики и скупая на кровь.' },
  ];
  const COMMISSIONS = [
    { title: 'Дар храма Марса', tier: 'top', clients: ['жрецы храма Марса Мстителя'],
      desc: 'Жрецы ищут бойцов, достойных храмовой реликвии. Испытание — против лучших, кого удалось найти.' },
    { title: 'Пир Тримальхиона', tier: 0, clients: ['Тримальхион, богатейший вольноотпущенник Кампании'],
      desc: 'Тщеславный богач хвастается коллекцией древностей и готов расстаться с одной из них, если ваши бойцы одолеют его чемпионов.' },
    { title: 'Наследство старого ланисты', tier: 'any', clients: ['вдова ланисты Лентула'],
      desc: 'Вдова распродаёт сокровищницу мужа. Самую ценную вещь она отдаст лишь тем, кто выдержит бой с его последними бойцами.' },
  ];

  // ------------------------------------------------------------
  //  Служебное
  // ------------------------------------------------------------
  const ready = () => typeof STATE !== 'undefined' && !!STATE && !!STATE.meta;
  const M = () => STATE.meta;
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const round5 = v => Math.max(5, Math.round(v / 5) * 5);
  const say = (text, bad = false) => { if (typeof toast === 'function') { try { toast(text, bad); } catch (e) { /* нет контейнера */ } } };
  const log = text => { if (typeof journal === 'function') journal(text); };
  const persist = () => { if (typeof save === 'function') save(); };
  const safeMaxTier = () => { try { return clamp(maxTier(), 0, TIERS.length - 1); } catch (e) { return 0; } };
  const escH = s => (typeof esc === 'function' ? esc(s) : String(s));
  const allGladiators = () => (STATE && Array.isArray(STATE.gladiators) ? STATE.gladiators : []);
  const equippedItems = g => Object.values((g && g.equip) || {}).filter(Boolean);
  const ownedItems = () => [...(STATE.armory || []), ...allGladiators().flatMap(equippedItems)];

  // ------------------------------------------------------------
  //  Инициализация и миграция
  // ------------------------------------------------------------
  function init() {
    if (typeof STATE === 'undefined' || !STATE) return;
    const fresh = !STATE.meta || typeof STATE.meta !== 'object';
    if (fresh) STATE.meta = {};
    const m = STATE.meta;
    m.v = 1;
    m.ach = m.ach && typeof m.ach === 'object' ? m.ach : {};
    m.artifacts = m.artifacts && typeof m.artifacts === 'object' ? m.artifacts : {};
    m.c = Object.assign({}, COUNTERS, m.c || {});
    m.lastCommission = m.lastCommission || 0;
    if (fresh) seedFromHistory();
    // реликвии, уже лежащие в лудусе, считаются выданными
    for (const it of ownedItems()) {
      if (it && ARTIFACTS[it.base] && !m.artifacts[it.base]) m.artifacts[it.base] = { day: STATE.day || 1, from: 'save' };
    }
    if (!Array.isArray(STATE.contracts) || !STATE.contracts.length) generateContracts();
    else STATE.contracts.forEach(c => (c.enemies || []).forEach(lookOf));
    check();
  }

  // Старое сохранение без мета-данных: восстанавливаем то, что можно, из послужных списков
  function seedFromHistory() {
    const c = M().c;
    const records = [...allGladiators(), ...(STATE.graveyard || [])].map(g => (g && g.record) || {});
    const sum = k => records.reduce((s, r) => s + (r[k] || 0), 0);
    // победы и убийства — с арены
    // (победа в бою 2 на 2 или 3 на 3 записана каждому бойцу — делим сумму примерно на размер команды)
    const best = k => Math.max(0, ...records.map(r => r[k] || 0));
    c.arenaWins = Math.max(best('wins'), Math.round(sum('wins') / 2));
    c.arenaFights = Math.max(best('fights'), Math.round(sum('fights') / 2));
    c.kills = sum('kills');
    c.spared = sum('spared');
  }

  const lookOf = g => { if (g && typeof ensureLook === 'function') ensureLook(g); return g; };

  // ------------------------------------------------------------
  //  Достижения
  // ------------------------------------------------------------
  // Значения, которые проверяются осмотром лудуса (храним максимум)
  function refreshScan() {
    const c = M().c;
    const gl = allGladiators();
    for (const g of gl) {
      c.bestLevel = Math.max(c.bestLevel, g.level || 0);
      c.bestGladWins = Math.max(c.bestGladWins, (g.record && g.record.wins) || 0);
    }
    c.schools = Math.max(c.schools, new Set(gl.map(g => g.cls).filter(k => CLASSES[k])).size);
    c.bestFame = Math.max(c.bestFame, STATE.fame || 0);
    c.day = Math.max(c.day, STATE.day || 0);
    if (!c.legendary && ownedItems().some(it => it && it.q >= 4 && ITEM_BASES[it.base] && !ITEM_BASES[it.base].artifact)) c.legendary = 1;
    c.artifacts = Object.keys(M().artifacts).length;
  }

  const achValue = a => M().c[a.key] || 0;

  function rewardText(r, html = false) {
    const parts = [];
    if (r.gold) parts.push(`${r.gold} ден.`);
    if (r.fame) parts.push(`+${r.fame} славы`);
    if (r.art && ITEM_BASES[r.art]) parts.push(html ? `<b class="q4">${ITEM_BASES[r.art].name}</b>` : `«${ITEM_BASES[r.art].name}»`);
    return parts.join(', ');
  }

  function unlock(a) {
    const m = M();
    m.ach[a.id] = { day: STATE.day || 1 };
    const r = a.reward || {};
    let art = null;
    if (r.gold) STATE.gold += r.gold;
    if (r.fame) STATE.fame += r.fame;
    if (r.art) {
      art = giveArtifact(r.art, `достижение «${a.name}»`, true);
      if (!art) STATE.gold += 300; // реликвия уже выдана — утешительная награда
    }
    log(`Достижение «${a.name}»: ${a.desc}${rewardText(r) ? ` Награда: ${rewardText(r)}.` : ''}`);
    return art;
  }

  function check() {
    if (!ready()) return [];
    const m = M();
    const fresh = [];
    refreshScan();
    // награда (слава, реликвия) может открыть следующее достижение — несколько проходов
    for (let pass = 0; pass < 5; pass++) {
      let any = false;
      for (const a of ACH) {
        if (m.ach[a.id] || achValue(a) < a.target) continue;
        unlock(a);
        fresh.push(a);
        any = true;
      }
      if (!any) break;
      refreshScan();
    }
    if (fresh.length) {
      if (fresh.length <= 3) {
        for (const a of fresh) say(`<b>Достижение:</b> ${escH(a.name)}${rewardText(a.reward) ? ` — ${rewardText(a.reward, true)}` : ''}`);
      } else {
        say(`<b>Открыто достижений: ${fresh.length}</b> — ${fresh.map(a => escH(a.name)).join(', ')}`);
      }
      if (typeof sfx === 'function') { try { sfx('coin'); } catch (e) { /* без звука */ } }
      persist();
    }
    return fresh;
  }

  // ------------------------------------------------------------
  //  Реликвии
  // ------------------------------------------------------------
  function giveArtifact(id, from = '', silent = false) {
    if (!ready() || !ARTIFACTS[id] || M().artifacts[id]) return null;
    const it = makeItem(id, 4);
    STATE.armory.push(it);
    M().artifacts[id] = { day: STATE.day || 1, from, itemId: it.id };
    log(`Получена реликвия «${it.name}»${from ? ` (${from})` : ''}. Она ждёт на складе лудуса.`);
    if (!silent) say(`<b>Реликвия:</b> <span class="q4">${escH(it.name)}</span> — на складе.`);
    return it;
  }

  // Где сейчас реликвия
  function locateArtifact(id) {
    for (const g of allGladiators()) if (equippedItems(g).some(it => it.base === id)) return `Носит ${escH(g.name)}.`;
    if ((STATE.armory || []).some(it => it && it.base === id)) return 'Лежит на складе лудуса.';
    const grave = (STATE.graveyard || []).find(d => d.equip && Object.values(d.equip).some(it => it && it.base === id));
    if (grave) return `Утрачена: пала вместе с ${escH(grave.name)}.`;
    return 'Утрачена — реликвии не возвращаются.';
  }

  // ------------------------------------------------------------
  //  События
  // ------------------------------------------------------------
  function track(type, data) {
    if (!ready()) return;
    const c = M().c;
    const d = data || {};
    switch (type) {
      case 'battleEnd': {
        const units = Array.isArray(d.playerUnits) ? d.playerUnits : [];
        const kind = d.kind || 'arena';
        const flawless = d.flawless ?? (units.length > 0 && units.every(u => u && u.alive));
        if (kind === 'arena' || kind === 'final') {
          c.arenaFights++;
          c.kills += units.reduce((s, u) => s + ((u && u.kills) || 0), 0);
          if (d.win) {
            c.arenaWins++;
            if (d.size === 3 && (d.playerUnits || []).length >= 3) { c.wins3++; if (flawless) c.flawless3++; }
            if (kind === 'arena' && d.tier >= 1 && d.tier <= 3) c['tier' + d.tier]++;
            if (kind === 'final') c.finalWins++;
          }
        }
        if (d.win) {
          if (d.mode === 'manual') c.manualWins++;
          if (units.some(u => u && u.alive && u.hpLeftPct > 0 && u.hpLeftPct <= 10)) c.lastBreath++;
        }
        break;
      }
      case 'verdict':
        if (d.result === 'live') c.spared++;
        break;
      case 'enemyExecuted':
        c.executed++;
        break;
      case 'levelUp':
        c.bestLevel = Math.max(c.bestLevel, +d.level || (d.g && d.g.level) || 0);
        break;
      case 'debtCleared':
        c.debtCleared = 1;
        break;
      case 'bet':
        if (d.won) {
          c.betsWon++;
          c.betProfit += Math.max(0, Math.round(+d.profit || 0));
          if (+d.odds >= (typeof BET_UNDERDOG !== 'undefined' ? BET_UNDERDOG : 2.5)) c.betUnderdog++;
        }
        break;
      case 'gold':
        if (+d.amount > 0) c.earned += Math.round(+d.amount);
        break;
      default: // chooseClass, recruit, buyItem — только осмотр
        break;
    }
    check();
    persist();
  }

  function onNewDay() {
    if (!ready()) { init(); return; }
    generateContracts();
    check();
    persist();
  }

  // ------------------------------------------------------------
  //  Заказы: генерация
  // ------------------------------------------------------------
  function makeCond(type, diff, size, playerSize) {
    switch (type) {
      case 'flawless':
        return { type, text: 'Победить, не потеряв ни одного бойца' };
      case 'rounds': {
        const rounds = ROUNDS_LIMIT[diff] + (size - 1) * 2;
        return { type, rounds, text: `Победить не позднее ${rounds}-го раунда` };
      }
      case 'outnumbered':
        return { type, text: `Победить в меньшинстве: ${playerSize} против ${size}` };
      case 'survive': {
        const rounds = SURVIVE_ROUNDS[diff] + (size - 1);
        return { type, rounds, text: `Продержаться ${rounds} ${plural3(rounds, 'раунд', 'раунда', 'раундов')} (хотя бы один ваш боец на ногах) или победить` };
      }
      default:
        return { type: 'win', text: 'Победить' };
    }
  }
  const plural3 = (n, a, b, c) => (typeof plural === 'function' ? plural(n, a, b, c) : c);

  function pickTier(pref, mt) {
    if (pref === 'top') return mt;
    if (pref === 'any') return rnd(0, mt);
    return clamp(+pref || 0, 0, mt);
  }

  // Противники заказа
  function makeEnemies(n, baseLvl, diff, used) {
    const mt = safeMaxTier();
    const qMin = clamp(Math.round(mt * 0.6) + [-1, 0, 1, 1][diff], 0, 4);
    const qMax = clamp(qMin + [0, 1, 0, 1][diff], 0, 4);
    const q = () => rnd(qMin, qMax);
    const team = [];
    for (let i = 0; i < n; i++) {
      const free = NAMES.filter(x => !used.has(x));
      const name = pick(free.length ? free : NAMES);
      used.add(name);
      const lvl = clamp(baseLvl + rnd(-1, 1), 1, MAX_LEVEL);
      const g = createGladiator(pick(CLASS_KEYS), lvl, { name, autoSpend: true, quality: q });
      if (!g.equip.helmet && chance(25)) g.equip.helmet = makeItem(pick(['leatherHelm', 'galea', 'conicHelm', 'gallicHelm']), q());
      if (diff >= 2 && !g.equip.armor && chance(40)) g.equip.armor = makeItem(pick(['leather', 'mail', 'squama']), q());
      team.push(lookOf(g));
    }
    return team;
  }

  function buildContract(diff, used, tpl, artifactId = null) {
    const D = DIFFICULTY[diff];
    const mt = safeMaxTier();
    const L = Math.round(ludusLevel());
    const n = Math.max(1, allGladiators().length);
    const maxSize = clamp(n, 1, 3);
    let type = artifactId ? (n >= 2 ? pick(['win', 'flawless']) : 'win') : pick(CONDS_BY_DIFF[diff]);
    let size = clamp(pick([1, 1, 2, 2, 3]), 1, maxSize);
    if (artifactId) size = clamp(rnd(2, 3), 1, maxSize);
    let playerSize = size;
    if (type === 'flawless') {
      if (maxSize < 2) type = 'rounds';
      else size = playerSize = Math.max(size, 2);
    }
    if (type === 'outnumbered') {
      playerSize = clamp(rnd(1, 2), 1, Math.min(2, n));
      size = playerSize + 1;
    }
    const lvlBase = L + D.lvl - (type === 'outnumbered' ? 1 : 0);
    const enemies = makeEnemies(size, lvlBase, diff, used);
    const avgLvl = enemies.reduce((s, e) => s + e.level, 0) / enemies.length;
    // в меньшинстве плата считается по числу ваших бойцов (надбавка — в COND_PAY)
    let gold = (25 + 10 * avgLvl) * D.pay * SIZE_PAY[playerSize] * COND_PAY[type] * (0.9 + Math.random() * 0.2);
    if (artifactId) gold *= 0.5; // главная награда — реликвия
    const art = artifactId && ITEM_BASES[artifactId];
    return {
      id: uid(), kind: 'contract',
      title: tpl.title, client: pick(tpl.clients),
      desc: tpl.desc + (art ? ` Наградой обещана реликвия — «${art.name}».` : ''),
      difficulty: diff, tier: pickTier(tpl.tier, mt),
      size, playerSize, enemies,
      gold: round5(gold),
      fame: D.fame + (size - 1) + (art ? 3 : 0),
      xpMult: D.xp,
      cond: makeCond(type, diff, size, playerSize),
      artifact: artifactId || null,
      done: false,
    };
  }

  // Реликвия для легендарного заказа: ещё не выданная, лучше — для школ, что есть в лудусе
  function commissionArtifact() {
    const left = CONTRACT_ARTS.filter(id => !M().artifacts[id]);
    if (!left.length) return null;
    const schools = new Set(allGladiators().map(g => g.cls).filter(Boolean));
    const fitting = left.filter(id => ITEM_BASES[id].classes.some(c => schools.has(c)));
    return pick(fitting.length ? fitting : left);
  }

  function generateContracts() {
    if (!ready()) return [];
    const m = M();
    const used = new Set(allGladiators().map(g => g.name));
    const diffs = [0, 1, 2, chance(70) ? 3 : pick([1, 2])];
    // примерно раз в шесть дней (и не реже чем раз в десять) — легендарный заказ
    const day = STATE.day || 1;
    let artId = null;
    if (day >= 4 && (chance(12) || day - m.lastCommission >= 10)) artId = commissionArtifact();
    const tpls = shuffle(TEMPLATES.slice());
    const list = diffs.map((d, i) => {
      if (artId && i === diffs.length - 1) return buildContract(3, used, pick(COMMISSIONS), artId);
      return buildContract(d, used, tpls[i % tpls.length]);
    });
    if (artId) m.lastCommission = day;
    list.sort((a, b) => a.difficulty - b.difficulty || a.size - b.size);
    STATE.contracts = list;
    m.contractsDay = day;
    return list;
  }

  // ------------------------------------------------------------
  //  Заказы: итог
  // ------------------------------------------------------------
  function condMet(c, info) {
    const i = info || {};
    const cond = (c && c.cond) || { type: 'win' };
    const win = !!i.win && !i.surrendered;
    const units = Array.isArray(i.playerUnits) ? i.playerUnits : [];
    const fallen = Number.isFinite(i.playerFallen) ? i.playerFallen : units.filter(u => u && !u.alive).length;
    const rounds = +i.rounds || 0;
    switch (cond.type) {
      case 'flawless': return win && fallen === 0;
      case 'rounds': return win && (!rounds || rounds <= cond.rounds);
      case 'survive': return win || !!i.survived || rounds > cond.rounds;
      default: return win; // win, outnumbered
    }
  }

  // Сколько раундов нужно продержаться (для условия «survive»); иначе null.
  // Бой можно остановить после этого раунда и передать info.survived = true.
  const contractRoundLimit = c => (c && c.cond && c.cond.type === 'survive' ? c.cond.rounds : null);

  function contractResult(contract, info) {
    const none = { success: false, gold: 0, text: '', artifact: null };
    if (!ready() || !contract) return none;
    if (contract.done && contract.result) return { ...contract.result, artifact: null };
    const c = M().c;
    const ok = condMet(contract, info);
    let gold, fame = 0, art = null, text;
    if (ok) {
      gold = contract.gold || 0;
      fame = contract.fame || 0;
      STATE.gold += gold;
      STATE.fame += fame;
      if (contract.artifact) art = giveArtifact(contract.artifact, `заказ «${contract.title}»`, true);
      c.contracts++;
      if (contract.difficulty >= 3) c.contractsHard++;
      if (contract.cond && contract.cond.type === 'outnumbered') c.contractsOutnumbered++;
      text = `Заказ «${contract.title}» выполнен: +${gold} ден.${fame ? `, +${fame} славы` : ''}${art ? `. Реликвия «${art.name}» — на складе!` : '.'}`;
    } else {
      gold = Math.round((contract.gold || 0) * FAIL_FEE);
      STATE.gold += gold;
      c.contractsFailed++;
      text = `Заказ «${contract.title}» провален (${contract.cond ? contract.cond.text.toLowerCase() : 'победить'}). Плата за выход: ${gold} ден.`;
    }
    c.earned += gold;
    contract.done = true;
    contract.success = ok;
    contract.result = { success: ok, gold, fame, text, artifactName: art ? art.name : null };
    log(text);
    if (art) say(`<b>Реликвия:</b> <span class="q4">${escH(art.name)}</span> — на складе.`);
    check();
    persist();
    return { success: ok, gold, fame, text, artifact: art };
  }

  const findContract = id => (ready() && Array.isArray(STATE.contracts) ? STATE.contracts.find(c => c.id === +id) || null : null);
  const pendingCount = () => (ready() && Array.isArray(STATE.contracts) ? STATE.contracts.filter(c => !c.done).length : 0);
  const isArtifact = baseId => !!(ITEM_BASES[baseId] && ITEM_BASES[baseId].artifact);

  // ------------------------------------------------------------
  //  Экран «Заказы»
  // ------------------------------------------------------------
  function contractCard(c) {
    const D = DIFFICULTY[c.difficulty] || DIFFICULTY[0];
    const art = c.artifact && ITEM_BASES[c.artifact];
    const sel = typeof UI !== 'undefined' && UI && UI.eventId === c.id;
    const foes = typeof foeRows === 'function' ? foeRows({ ...c, enemies: c.enemies || [] }) : '';
    const outcome = c.done
      ? `<div class="m-outcome ${c.success ? 'ok' : 'fail'}">${c.success ? 'Выполнен' : 'Провален'}${c.result ? ` · ${c.result.gold} ден.` : ''}</div>` : '';
    return `<div class="panel event contract ${c.story ? 'storyc' : ''} ${art ? 'legend' : ''} ${sel ? 'sel' : ''} ${c.done ? 'done' : ''}" data-act="${c.done ? '' : 'pickEvent'}" data-id="${c.id}">
      <div class="eh"><h3>${escH(c.title)}</h3><span class="fmt">${c.playerSize} на ${c.size}</span></div>
      <div class="m-cl">${c.story ? '<span class="m-diff story">Сюжетный заказ</span>' : `<span class="m-diff d${c.difficulty}">${D.name}</span>`}<span class="muted small">${escH(c.client)}</span></div>
      <div class="small m-desc">${escH(c.desc)}</div>
      <div class="m-cond"><span class="m-lbl">Условие</span>${escH(c.cond ? c.cond.text : 'Победить')}</div>
      <div class="foes">${foes}</div>
      ${!c.done && typeof enemyPower === 'function' ? `<div class="reward">${enemyPower(c)}</div>` : ''}
      <div class="small muted m-heads">Ваших бойцов: <b>${c.playerSize}</b>${c.playerSize < c.size ? ' — в меньшинстве' : ''} · бой не насмерть</div>
      <div class="reward"><span>Плата <b>${c.gold}</b> ден.</span>${c.fame ? `<span>Слава <b>+${c.fame}</b></span>` : ''}<span>Опыт <b>×${c.xpMult}</b></span></div>
      ${art ? `<div class="m-artline">Реликвия: <b class="q4">${escH(art.name)}</b> <span class="tiny muted">(${SLOTS[art.slot].toLowerCase()})</span></div>` : ''}
      ${c.done ? outcome : `<div class="tiny muted m-fee">При неудаче — плата за выход ${Math.round(c.gold * FAIL_FEE)} ден.</div>`}
    </div>`;
  }

  function screenContracts() {
    if (!ready()) return '';
    const list = Array.isArray(STATE.contracts) ? STATE.contracts : [];
    const c = M().c;
    const left = CONTRACT_ARTS.filter(id => !M().artifacts[id]).length;
    return `<div class="screen-title"><h2>Заказы</h2><p>Показательные бои по найму — <b>не насмерть</b>: побеждённых не добивают, толпа не выносит приговора, но раны и усталость настоящие. Список заказов обновляется каждый день; чем опаснее заказ, тем щедрее плата.</p></div>
    <div class="m-sum">
      <span>Выполнено заказов <b>${c.contracts}</b></span><span>Провалено <b>${c.contractsFailed}</b></span>
      <span>Реликвий за легендарные заказы осталось <b>${left}</b></span>
    </div>
    <div class="grid m-contracts scrollfill">${list.map(contractCard).join('') || '<p class="empty-note">Сегодня заказчиков нет. Загляните завтра.</p>'}</div>
    ${typeof eventPicker === 'function' ? eventPicker('contract') : ''}`;
  }

  // ------------------------------------------------------------
  //  Экран «Достижения»
  // ------------------------------------------------------------
  const MEDAL = '<svg class="m-medal" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">'
    + '<circle cx="20" cy="20" r="11"/><path d="M20 13.5l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z"/>'
    + '<path d="M7 27c-3-5-3-11 0-16M33 27c3-5 3-11 0-16" opacity=".8"/>'
    + '<path d="M6 15l-2.5-1.5M5.3 20H2.5M6 25l-2.5 1.5M34 15l2.5-1.5M34.7 20h2.8M34 25l2.5 1.5" opacity=".8"/></svg>';

  function achRow(a) {
    const got = M().ach[a.id];
    const v = Math.min(achValue(a), a.target);
    const prog = got
      ? `<div class="tiny m-when">Получено в день ${got.day}</div>`
      : a.target > 1
        ? `<div class="m-prog"><div class="bar"><div style="width:${v / a.target * 100}%"></div></div><span class="tiny muted">${v} / ${a.target}</span></div>`
        : '';
    return `<div class="m-ach ${got ? 'done' : ''}">
      ${MEDAL}
      <div><div class="m-an">${escH(a.name)}</div><div class="small muted">${escH(a.desc)}</div>${prog}</div>
      <div class="m-rew">${rewardText(a.reward, true) || '—'}</div>
    </div>`;
  }

  function artifactCard(id) {
    const B = ITEM_BASES[id];
    const own = M().artifacts[id];
    const notes = [B.twoHanded ? (B.ranged ? 'двуручное, стрелковое' : 'двуручное') : '', B.needsBow ? 'только с луком' : ''].filter(Boolean).join(', ');
    const who = B.classes.length >= CLASS_KEYS.length ? 'все школы' : B.classes.map(c => CLASSES[c].name).join(', ');
    return `<div class="m-art ${own ? 'own' : 'locked'}">
      <div class="m-art-h"><span class="iname ${own ? 'q4' : ''}">${escH(B.name)}</span><span class="tiny muted">${SLOTS[B.slot]}${notes ? ` · ${notes}` : ''}</span></div>
      <div class="istats">${statsText(B.stats)}</div>
      <div class="ifor">Для школ: ${who}</div>
      <div class="m-legend">${escH(B.desc)}</div>
      <div class="m-src">${own ? `Получена в день ${own.day}. ${locateArtifact(id)}` : `<span class="m-lbl">Как получить</span>${escH(B.source)}`}</div>
    </div>`;
  }

  function screenAchievements() {
    if (!ready()) return '';
    refreshScan();
    const m = M();
    const total = ACH.length;
    const got = ACH.filter(a => m.ach[a.id]).length;
    const arts = Object.keys(ARTIFACTS);
    const artsGot = arts.filter(id => m.artifacts[id]).length;
    const groups = Object.entries(GROUPS).map(([g, name]) => {
      const list = ACH.filter(a => a.group === g);
      const n = list.filter(a => m.ach[a.id]).length;
      return `<div class="panel"><h3>${name} <span class="muted small m-gcount">${n} / ${list.length}</span></h3><div class="list">${list.map(achRow).join('')}</div></div>`;
    }).join('');
    return `<div class="screen-title"><h2>Достижения</h2><p>Испытания для ланисты. За каждое — награда, а за самые трудные — реликвии великих бойцов.</p></div>
    <div class="m-sum m-total">
      <span>Открыто <b>${got} / ${total}</b></span>
      <div class="bar"><div style="width:${got / total * 100}%"></div></div>
      <span>Реликвий <b>${artsGot} / ${arts.length}</b></span>
    </div>
    <div class="scrollfill"><div class="m-groups">${groups}</div>
    <div class="screen-title mt m-relics"><h2>Реликвии</h2><p>Уникальные предметы легендарных бойцов: сильнее любого изделия кузнеца, не продаются и не выпадают с противников. Каждая существует в единственном экземпляре — погибнет боец вместе с ней или уйдёт она с продажей, вернуть её будет нельзя.</p></div>
    <div class="m-arts">${arts.map(artifactCard).join('')}</div></div>`;
  }

  return {
    // данные
    ACHIEVEMENTS: ACH, ACH_BY_ID, GROUPS, DIFFICULTY, ARTIFACTS, CONTRACT_ARTS,
    // хуки
    init, onNewDay, track, check, contractResult,
    // экраны
    screenContracts, screenAchievements,
    // помощники
    giveArtifact, generateContracts, findContract, pendingCount, isArtifact, condMet, contractRoundLimit,
  };
})();

// ------------------------------------------------------------
//  Страховка: характеристики и цена реликвий не зависят от качества.
//  (Если itemStatsFor/itemPrice уже это учитывают — обёртка ничего не меняет.)
// ------------------------------------------------------------
(function patchArtifactItems() {
  try {
    if (typeof itemStatsFor === 'function' && !itemStatsFor.metaWrapped) {
      const orig = itemStatsFor;
      const wrapped = function (baseId, q, ...rest) {
        const B = ITEM_BASES[baseId];
        return B && B.artifact ? { ...B.stats } : orig.call(this, baseId, q, ...rest);
      };
      wrapped.metaWrapped = true;
      itemStatsFor = wrapped;
    }
    if (typeof itemPrice === 'function' && !itemPrice.metaWrapped) {
      const orig = itemPrice;
      const wrapped = function (baseId, q, ...rest) {
        const B = ITEM_BASES[baseId];
        return B && B.artifact ? B.price : orig.call(this, baseId, q, ...rest);
      };
      wrapped.metaWrapped = true;
      itemPrice = wrapped;
    }
  } catch (e) { /* функции объявлены иначе — пусть их обрабатывает ядро */ }
})();

// ------------------------------------------------------------
//  Стили мета-экранов
// ------------------------------------------------------------
if (typeof document !== 'undefined' && document.head && !document.getElementById('meta-style')) {
  const st = document.createElement('style');
  st.id = 'meta-style';
  st.textContent = `
.m-sum { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 22px; margin: -6px 0 16px; font-size: 13.5px; color: var(--muted); }
.m-sum b { color: var(--bronze2); font-weight: 400; font-family: var(--font-head); font-size: 17px; }
.m-total .bar { flex: 1 1 200px; max-width: 360px; height: 8px; }
.m-lbl { display: block; font-size: 10.5px; letter-spacing: .15em; text-transform: uppercase; color: var(--dim); margin-bottom: 1px; }

.contract .m-cl { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 4px 0 6px; }
.m-diff { font-family: var(--font-body); font-size: 11px; padding: 1px 8px; border: 1px solid var(--line2); border-radius: 2px; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
.m-diff.d0 { color: #b6cf8d; border-color: var(--olive); }
.m-diff.d1 { color: var(--q1); border-color: var(--line2); }
.m-diff.d2 { color: var(--bronze2); border-color: var(--bronze); }
.m-diff.d3 { color: #f0b3a8; border-color: var(--blood); background: rgba(110,29,23,.35); }
.contract .m-desc { color: #cbc1b0; }
.contract .m-cond { margin: 8px 0; padding: 5px 9px; border-left: 2px solid var(--bronze); background: rgba(180,140,82,.08); font-size: 13.5px; }
.contract .m-heads { margin: 2px 0 6px; }
.contract .m-heads b { color: var(--text); font-weight: 400; }
.contract .m-artline { margin-top: 6px; font-size: 13.5px; }
.contract .m-fee { margin-top: 6px; }
.contract.legend { border-color: rgba(212,154,60,.75); box-shadow: inset 0 0 0 1px rgba(212,154,60,.22), 0 0 22px rgba(212,154,60,.10); }
.contract.legend.sel { border-color: var(--q4); }
.contract .m-outcome { margin-top: 8px; font-family: var(--font-head); font-size: 16px; letter-spacing: .1em; text-transform: uppercase; }
.contract .m-outcome.ok { color: var(--q2); }
.contract .m-outcome.fail { color: #e08e83; }

.m-groups { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 400px), 1fr)); align-items: start; }
.m-gcount { font-family: var(--font-body); float: right; }
.m-ach { display: grid; grid-template-columns: 38px 1fr auto; gap: 10px; align-items: center; padding: 7px 8px; border: 1px solid var(--line); background: var(--panel2); border-radius: 2px; }
.m-ach .m-medal { width: 38px; height: 38px; color: var(--dim); }
.m-ach .m-an { font-family: var(--font-head); font-size: 17px; line-height: 1.15; color: var(--text); }
.m-ach.done { border-color: #6b5434; background: linear-gradient(#2b2218, #1f1914); }
.m-ach.done .m-medal { color: var(--bronze2); filter: drop-shadow(0 0 5px rgba(217,178,118,.35)); }
.m-ach.done .m-an { color: var(--bronze2); }
.m-ach .m-prog { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.m-ach .m-prog .bar { flex: 1; max-width: 220px; }
.m-ach .m-when { color: var(--q2); margin-top: 2px; }
.m-ach .m-rew { text-align: right; font-size: 12.5px; color: var(--muted); max-width: 150px; }
.m-ach.done .m-rew { opacity: .6; }

.m-relics { margin-top: 28px; }
.m-arts { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
.m-art { border: 1px solid var(--line); border-left: 3px solid var(--q4); background: linear-gradient(var(--panel2), var(--panel)); padding: 10px 12px; border-radius: 2px; display: flex; flex-direction: column; gap: 3px; }
.m-art .m-art-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.m-art .iname { font-family: var(--font-head); font-size: 18px; }
.m-art .istats { font-size: 12.5px; color: var(--text); }
.m-art .ifor { font-size: 11.5px; color: var(--dim); }
.m-art .m-legend { font-style: italic; color: var(--muted); font-size: 12.5px; margin: 4px 0; }
.m-art .m-src { margin-top: auto; padding-top: 6px; border-top: 1px dashed var(--line); font-size: 12.5px; color: var(--bronze); }
.m-art.own { box-shadow: inset 0 0 0 1px rgba(212,154,60,.18); }
.m-art.own .m-src { color: var(--q2); }
.m-art.locked { border-left-color: var(--line2); }
.m-art.locked .iname { color: var(--muted); }
.m-art.locked .istats { color: var(--muted); }
`;
  document.head.appendChild(st);
}
