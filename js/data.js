// ============================================================
//  Статические данные игры: характеристики, школы, умения, предметы
// ============================================================

const ATTRS = {
  str: { name: 'Сила',         short: 'СИЛ', desc: 'Урон оружием (+1.2 к урону за очко)' },
  agi: { name: 'Ловкость',     short: 'ЛОВ', desc: 'Уклонение: −1.5% к шансу попасть по бойцу за очко. Инициатива: +1' },
  end: { name: 'Выносливость', short: 'ВЫН', desc: 'Здоровье (+7 за очко)' },
  skl: { name: 'Мастерство',   short: 'МАС', desc: 'Точность: +1.5% к шансу попасть за очко. Крит: +0.8%' },
  wil: { name: 'Воля',         short: 'ВОЛ', desc: 'Сопротивление оглушению и сети (+3%), расположение толпы (+1.5% к помилованию)' },
};
const ATTR_KEYS = Object.keys(ATTRS);

// Уровни, на которых открываются ступени специализации
const TIER_LEVEL = { 1: 5, 2: 8, 3: 11, 4: 14 };
const MAX_LEVEL = 20;

// ------------------------------------------------------------
//  Школы (специализации) гладиаторов
//  Каждая школа: базовые характеристики, приоритет роста (для ИИ),
//  фирменное оружие, активное умение и древо мастерства.
//  Перк: tier — ступень, max — рангов, v/v2 — значения по рангам.
// ------------------------------------------------------------
const CLASSES = {
  murmillo: {
    name: 'Мурмиллон', latin: 'Murmillo',
    desc: 'Тяжёлый пехотинец с гладиусом и скутумом. Принимает удары на щит, бьёт в ответ и прикрывает соратников.',
    base: { str: 6, agi: 3, end: 7, skl: 4, wil: 5 },
    weights: { str: 3, agi: 1, end: 4, skl: 2, wil: 2 },
    start: { weapon: 'gladius', offhand: 'scutum', helmet: 'galea', arms: 'manica', legs: 'ocrea', belt: 'balteus' },
    ability: { id: 'shieldBash', name: 'Удар щитом', cd: 3, target: 'enemy',
      desc: 'Удар кромкой щита: 80% урона, 60% шанс оглушить цель на 1 ход.' },
    perks: [
      { id: 'mur_wall', tier: 1, max: 3, name: 'Стена щитов', v: [8, 16, 24],
        desc: r => `+${r.v}% к шансу блока.` },
      { id: 'mur_heavy', tier: 1, max: 3, name: 'Тяжёлая рука', v: [8, 16, 24],
        desc: r => `+${r.v}% к урону.` },
      { id: 'mur_iron', tier: 2, max: 3, name: 'Несокрушимость', v: [10, 20, 30],
        desc: r => `+${r.v}% к максимальному здоровью.` },
      { id: 'mur_counter', tier: 2, max: 3, name: 'Контрудар', v: [30, 60, 90],
        desc: r => `После блока — ${r.v}% шанс немедленно ударить в ответ.` },
      { id: 'mur_guard', tier: 3, max: 3, name: 'Защитник', v: [8, 14, 20],
        desc: r => `Пока стоит на ногах, союзники получают на ${r.v}% меньше урона. Враги чаще выбирают его целью.` },
      { id: 'mur_last', tier: 3, max: 3, name: 'Последний рубеж', v: [25, 40, 55], v2: [10, 15, 20],
        desc: r => `При здоровье ниже 35%: +${r.v}% к урону и −${r.v2}% к получаемому урону.` },
      { id: 'mur_cap', tier: 4, max: 1, name: 'Легион одного', v: [1],
        desc: () => 'Удар щитом наносит 130% урона, оглушает всегда (если цель не сопротивляется) и перезаряжается на 1 ход быстрее.' },
    ],
  },

  retiarius: {
    name: 'Ретиарий', latin: 'Retiarius',
    desc: 'Лёгкий боец с трезубцем и сетью. Без шлема и щита, живёт за счёт подвижности и контроля.',
    base: { str: 5, agi: 7, end: 6, skl: 6, wil: 4 },
    weights: { str: 2, agi: 4, end: 2, skl: 3, wil: 1 },
    start: { weapon: 'trident', offhand: 'rete', arms: 'galerus', legs: 'fasciae', belt: 'balteus' },
    ability: { id: 'netThrow', name: 'Бросок сети', cd: 3, target: 'enemy',
      desc: 'Опутывает цель: она пропускает следующий ход и не может уклоняться. Шанс зависит от Воли цели.' },
    perks: [
      { id: 'ret_dance', tier: 1, max: 3, name: 'Танец с сетью', v: [5, 10, 15],
        desc: r => `+${r.v}% к уклонению.` },
      { id: 'ret_reach', tier: 1, max: 3, name: 'Длинное древко', v: [40, 80, 120],
        desc: r => `Первая атака в бою наносит +${r.v}% урона.` },
      { id: 'ret_hunter', tier: 2, max: 3, name: 'Ловчий', v: [15, 30, 45], v2: [10, 20, 30],
        desc: r => `Опутанные цели получают +${r.v}% урона от всех. Шанс броска сети +${r.v2}%.` },
      { id: 'ret_evade', tier: 2, max: 3, name: 'Ускользание', v: [25, 50, 75],
        desc: r => `После уклонения — ${r.v}% шанс контратаки.` },
      { id: 'ret_sting', tier: 3, max: 3, name: 'Жало трезубца', v: [15, 30, 45],
        desc: r => `${r.v}% шанс при попадании вызвать кровотечение (3 хода).` },
      { id: 'ret_calm', tier: 3, max: 3, name: 'Хладнокровие', v: [5, 10, 15],
        desc: r => `+${r.v}% к точности и шансу крита.` },
      { id: 'ret_cap', tier: 4, max: 1, name: 'Хозяин арены', v: [1],
        desc: () => 'Сеть набрасывается на всех противников сразу.' },
    ],
  },

  secutor: {
    name: 'Секутор', latin: 'Secutor',
    desc: 'Преследователь в гладком шлеме с большим скутумом. Тяжёлая броня, неумолимый натиск и добивание ослабших.',
    base: { str: 6, agi: 3, end: 7, skl: 4, wil: 4 },
    weights: { str: 3, agi: 1, end: 4, skl: 2, wil: 2 },
    start: { weapon: 'gladius', offhand: 'parma', helmet: 'galea', arms: 'manica', legs: 'ocrea', belt: 'balteus' },
    ability: { id: 'onslaught', name: 'Натиск', cd: 3, target: 'enemy',
      desc: 'Сокрушительный удар: 150% урона, +15% точности, игнорирует половину брони.' },
    perks: [
      { id: 'sec_skin', tier: 1, max: 3, name: 'Железная кожа', v: [3, 6, 9],
        desc: r => `+${r.v} к броне.` },
      { id: 'sec_pursuit', tier: 1, max: 3, name: 'Преследователь', v: [6, 12, 18],
        desc: r => `+${r.v}% к точности.` },
      { id: 'sec_relent', tier: 2, max: 3, name: 'Неумолимость', v: [35, 70, 100],
        desc: r => `${r.v}% сопротивления оглушению и сети.` },
      { id: 'sec_crush', tier: 2, max: 3, name: 'Сокрушение', v: [1, 2, 3],
        desc: r => `Каждое попадание снижает броню цели на ${r.v} (до −12).` },
      { id: 'sec_wind', tier: 3, max: 3, name: 'Второе дыхание', v: [20, 30, 40],
        desc: r => `Один раз за бой при здоровье ниже 40% восстанавливает ${r.v}% здоровья.` },
      { id: 'sec_exec', tier: 3, max: 3, name: 'Палач', v: [20, 40, 60],
        desc: r => `+${r.v}% урона по целям со здоровьем ниже 50%.` },
      { id: 'sec_cap', tier: 4, max: 1, name: 'Охотник', v: [1],
        desc: () => 'Повергнув противника, сразу получает дополнительный ход.' },
    ],
  },

  thraex: {
    name: 'Фракиец', latin: 'Thraex',
    desc: 'Боец с изогнутой сикой и малым щитом. Ищет щели в броне, режет и пускает кровь.',
    base: { str: 5, agi: 6, end: 6, skl: 6, wil: 3 },
    weights: { str: 2, agi: 3, end: 2, skl: 4, wil: 1 },
    start: { weapon: 'sica', offhand: 'parma', helmet: 'galea', arms: 'manica', legs: 'ocreaeHigh', belt: 'balteus' },
    ability: { id: 'slash', name: 'Подрез', cd: 3, target: 'enemy',
      desc: 'Режущий удар: 70% урона и гарантированное сильное кровотечение на 3 хода.' },
    perks: [
      { id: 'thr_blade', tier: 1, max: 3, name: 'Изогнутый клинок', v: [5, 10, 15],
        desc: r => `+${r.v}% к шансу крита.` },
      { id: 'thr_quick', tier: 1, max: 3, name: 'Быстрота', v: [3, 6, 9], v2: [2, 4, 6],
        desc: r => `+${r.v}% к уклонению, +${r.v2} к инициативе.` },
      { id: 'thr_blood', tier: 2, max: 3, name: 'Кровопускание', v: [35, 70, 100],
        desc: r => `Критические удары с шансом ${r.v}% вызывают кровотечение.` },
      { id: 'thr_death', tier: 2, max: 3, name: 'Смертельный удар', v: [15, 30, 45],
        desc: r => `+${r.v}% к множителю критического урона.` },
      { id: 'thr_thirst', tier: 3, max: 3, name: 'Жажда крови', v: [15, 30, 45], v2: [10, 15, 20],
        desc: r => `По кровоточащим целям: +${r.v}% урона и вампиризм ${r.v2}%.` },
      { id: 'thr_flank', tier: 3, max: 3, name: 'Обход', v: [15, 30, 45],
        desc: r => `Игнорирует ${r.v}% брони цели.` },
      { id: 'thr_cap', tier: 4, max: 1, name: 'Вскрыть артерию', v: [1],
        desc: () => 'Наносимое кровотечение вдвое сильнее, кровотечение от Подреза длится 5 ходов.' },
    ],
  },

  dimachaerus: {
    name: 'Димахер', latin: 'Dimachaerus',
    desc: 'Мастер двух клинков. Без щита, только сталь в обеих руках — серии ударов и ярость.',
    base: { str: 6, agi: 6, end: 6, skl: 5, wil: 3 },
    weights: { str: 3, agi: 3, end: 2, skl: 3, wil: 1 },
    start: { weapon: 'gladius', offhand: 'pugio', helmet: 'leatherHelm', armor: 'leather', arms: 'vambraces', legs: 'fasciae', belt: 'cingulum' },
    ability: { id: 'whirl', name: 'Вихрь клинков', cd: 4, target: 'all',
      desc: 'Атакует всех противников, нанося каждому 75% урона.' },
    perks: [
      { id: 'dim_twin', tier: 1, max: 3, name: 'Парные клинки', v: [20, 34, 48],
        desc: r => `${r.v}% шанс нанести второй удар при атаке.` },
      { id: 'dim_fury', tier: 1, max: 3, name: 'Ярость', v: [3, 4, 5],
        desc: r => `+${r.v}% урона за каждое попадание в этом бою (до 10 раз).` },
      { id: 'dim_steel', tier: 2, max: 3, name: 'Танец стали', v: [3, 6, 9],
        desc: r => `+${r.v}% к уклонению и точности.` },
      { id: 'dim_reckless', tier: 2, max: 3, name: 'Безрассудство', v: [12, 24, 36], v2: [5, 10, 15],
        desc: r => `+${r.v}% к урону, но получает на ${r.v2}% больше урона.` },
      { id: 'dim_storm', tier: 3, max: 3, name: 'Буря', v: [25, 50, 75],
        desc: r => `Вихрь клинков наносит +${r.v}% урона.` },
      { id: 'dim_reap', tier: 3, max: 3, name: 'Жатва', v: [15, 30, 45],
        desc: r => `Повергнув противника, восстанавливает ${r.v}% здоровья.` },
      { id: 'dim_cap', tier: 4, max: 1, name: 'Тысяча порезов', v: [1],
        desc: () => 'Шанс второго удара +15%, и каждый дополнительный удар может породить следующий.' },
    ],
  },

  hoplomachus: {
    name: 'Гопломах', latin: 'Hoplomachus',
    desc: 'Копейщик греческого образца: длинное копьё, малый круглый щит и высокие поножи. Держит врага на острие и бьёт первым.',
    base: { str: 5, agi: 5, end: 6, skl: 7, wil: 4 },
    weights: { str: 3, agi: 2, end: 2, skl: 4, wil: 1 },
    start: { weapon: 'spear', offhand: 'parma', helmet: 'galea', arms: 'manica', legs: 'ocreaeHigh', belt: 'balteus' },
    ability: { id: 'spearWall', name: 'Копейный заслон', cd: 3, target: 'enemy',
      desc: 'Длинный выпад: 140% урона, щит цели не спасает. До своего следующего хода гопломах встречает каждого, кто идёт на него врукопашную, ударом копья (80% урона) — раньше, чем тот ударит.' },
    perks: [
      { id: 'hop_reach', tier: 1, max: 3, name: 'Длина копья', v: [15, 30, 45],
        desc: r => `${r.v}% шанс встретить любого атакующего врукопашную ударом копья (80% урона) прежде, чем он ударит.` },
      { id: 'hop_aim', tier: 1, max: 3, name: 'Точный выпад', v: [5, 10, 15], v2: [1, 2, 3],
        desc: r => `+${r.v}% к точности, +${r.v2} к инициативе.` },
      { id: 'hop_pierce', tier: 2, max: 3, name: 'Сквозь щит', v: [10, 20, 30],
        desc: r => `Шанс противника заблокировать удар гопломаха снижается на ${r.v}%.` },
      { id: 'hop_parmula', tier: 2, max: 3, name: 'Пармула', v: [6, 12, 18], v2: [2, 4, 6],
        desc: r => `+${r.v}% к блоку и +${r.v2}% к уклонению.` },
      { id: 'hop_pin', tier: 3, max: 3, name: 'Пригвоздить', v: [12, 20, 28],
        desc: r => `${r.v}% шанс при попадании оглушить цель на 1 ход.` },
      { id: 'hop_phalanx', tier: 3, max: 3, name: 'Фаланга', v: [5, 7, 9],
        desc: r => `−${r.v}% к получаемому урону и ещё −${r.v}% за каждого союзника на ногах (до двух).` },
      { id: 'hop_cap', tier: 4, max: 1, name: 'Мастер копья', v: [1],
        desc: () => 'Встречные удары копьём наносят 110% урона и могут быть критическими. Копейный заслон перезаряжается на 1 ход быстрее.' },
    ],
  },

  sagittarius: {
    name: 'Сагиттарий', latin: 'Sagittarius',
    desc: 'Лучник с Востока. Бьёт издалека и не подходит к противнику, поэтому его не достают контратаки. Лёгкая броня, мало здоровья.',
    base: { str: 4, agi: 7, end: 5, skl: 7, wil: 3 },
    weights: { str: 2, agi: 3, end: 2, skl: 4, wil: 1 },
    start: { weapon: 'arcus', offhand: 'pharetra', helmet: 'conicHelm', armor: 'leather', arms: 'vambraces', legs: 'fasciae', belt: 'cingulum' },
    ability: { id: 'aimedShot', name: 'Прицельный выстрел', cd: 3, target: 'enemy',
      desc: 'Долгое прицеливание: 150% урона, +20% точности, +10% шанса крита. Стрелу нельзя принять на щит.' },
    perks: [
      { id: 'sag_eye', tier: 1, max: 3, name: 'Зоркий глаз', v: [5, 10, 15],
        desc: r => `+${r.v}% к точности.` },
      { id: 'sag_light', tier: 1, max: 3, name: 'Лёгкий шаг', v: [4, 8, 12],
        desc: r => `+${r.v}% к уклонению.` },
      { id: 'sag_barb', tier: 2, max: 3, name: 'Зазубренные стрелы', v: [20, 40, 60],
        desc: r => `${r.v}% шанс при попадании вызвать кровотечение (3 хода).` },
      { id: 'sag_quick', tier: 2, max: 3, name: 'Быстрая тетива', v: [12, 24, 36],
        desc: r => `${r.v}% шанс сразу выпустить вторую стрелу (70% урона) в случайного противника.` },
      { id: 'sag_weak', tier: 3, max: 3, name: 'Слабое место', v: [20, 35, 50],
        desc: r => `Стрелы игнорируют ${r.v}% брони цели.` },
      { id: 'sag_volley', tier: 3, max: 3, name: 'Залп', v: [30, 45, 60],
        desc: r => `Прицельный выстрел сопровождается залпом по всем остальным противникам (${r.v}% урона).` },
      { id: 'sag_cap', tier: 4, max: 1, name: 'Парфянский выстрел', v: [1],
        desc: () => 'Прицельный выстрел всегда критический и перезаряжается на 1 ход быстрее.' },
    ],
  },

  gallus: {
    name: 'Галл', latin: 'Gallus',
    desc: 'Варвар с двуручным мечом или секирой. Без щита — обе руки на рукояти. Страшные удары, толстая шкура и ярость, растущая с ранами.',
    base: { str: 7, agi: 4, end: 7, skl: 4, wil: 4 },
    weights: { str: 4, agi: 1, end: 3, skl: 2, wil: 1 },
    start: { weapon: 'longsword', helmet: 'gallicHelm', arms: 'vambraces', legs: 'caligae', belt: 'cingulum' },
    ability: { id: 'cleave', name: 'Рассекающий удар', cd: 3, target: 'enemy',
      desc: 'Удар с плеча: 140% урона цели и 60% урона ещё одному противнику рядом. Щит от него не спасает.' },
    perks: [
      { id: 'gal_heft', tier: 1, max: 3, name: 'Двуручный хват', v: [10, 20, 30],
        desc: r => `+${r.v}% к урону.` },
      { id: 'gal_hide', tier: 1, max: 3, name: 'Толстая шкура', v: [6, 12, 18],
        desc: r => `+${r.v}% к максимальному здоровью.` },
      { id: 'gal_rage', tier: 2, max: 3, name: 'Ярость берсерка', v: [3, 5, 7],
        desc: r => `+${r.v}% к урону за каждые 10% потерянного здоровья.` },
      { id: 'gal_crush', tier: 2, max: 3, name: 'Сокрушающий удар', v: [8, 14, 20],
        desc: r => `${r.v}% шанс при попадании оглушить цель на 1 ход.` },
      { id: 'gal_cry', tier: 3, max: 3, name: 'Боевой клич', v: [5, 10, 15],
        desc: r => `Пока галл стоит на ногах, его союзники наносят на ${r.v}% больше урона.` },
      { id: 'gal_feast', tier: 3, max: 3, name: 'Кровавый пир', v: [10, 15, 20],
        desc: r => `Восстанавливает ${r.v}% нанесённого урона как здоровье.` },
      { id: 'gal_cap', tier: 4, max: 1, name: 'Неистовство', v: [1],
        desc: () => 'Рассекающий удар задевает всех противников, а каждое убийство сразу перезаряжает его.' },
    ],
  },
};
const CLASS_KEYS = Object.keys(CLASSES);

// Быстрый доступ к перку по id
const PERKS = {};
for (const ck of CLASS_KEYS) for (const p of CLASSES[ck].perks) PERKS[p.id] = { ...p, cls: ck };

// ------------------------------------------------------------
//  Новобранец: боец без школы. Школу выбирают в лудусе.
// ------------------------------------------------------------
const TIRO = {
  name: 'Новобранец', latin: 'Tiro',
  desc: 'Раб без выучки. Пока он не посвящён в школу, у него нет умения и древа специализации — очки специализации копятся и ждут выбора.',
  base: { str: 5, agi: 5, end: 5, skl: 5, wil: 5 },
  weights: { str: 1, agi: 1, end: 1, skl: 1, wil: 1 },
  start: {}, ability: null, perks: [],
};
const clsOf = g => (g && CLASSES[g.cls]) || TIRO;

// ------------------------------------------------------------
//  Предметы: базовые шаблоны
//  classes — школы, которым предмет подходит («школьная выучка»:
//  +25% ко всем положительным характеристикам предмета).
//  bonus — дополнительные свойства, которые появляются начиная с
//  добротного качества: первое — с добротного, второе — с мастерского,
//  третье — с легендарного. Характеристики одного качества всегда одинаковы.
// ------------------------------------------------------------
const SLOTS = {
  weapon:  'Оружие',
  offhand: 'Вторая рука',
  helmet:  'Шлем',
  armor:   'Доспех',
  arms:    'Руки и плечи',
  legs:    'Поножи и обувь',
  belt:    'Пояс',
};
const SLOT_KEYS = Object.keys(SLOTS);
const emptyEquip = () => Object.fromEntries(SLOT_KEYS.map(k => [k, null]));

const ITEM_BASES = {
  // Оружие
  gladius:   { slot: 'weapon', name: 'Гладиус', price: 40, stats: { dmgMin: 6, dmgMax: 10, acc: 5 },
    classes: ['murmillo', 'secutor', 'dimachaerus'], bonus: [['acc', 3], ['str', 1], ['crit', 3]] },
  sica:      { slot: 'weapon', name: 'Сика', price: 40, stats: { dmgMin: 5, dmgMax: 9, crit: 6 },
    classes: ['thraex', 'dimachaerus'], bonus: [['crit', 2], ['agi', 1], ['skl', 1]] },
  spatha:    { slot: 'weapon', name: 'Спата', price: 55, stats: { dmgMin: 8, dmgMax: 12 },
    classes: ['murmillo', 'dimachaerus'], bonus: [['str', 1], ['acc', 3], ['crit', 3]] },
  trident:   { slot: 'weapon', name: 'Трезубец', price: 45, stats: { dmgMin: 8, dmgMax: 12, dodge: 4 },
    classes: ['retiarius'], bonus: [['agi', 1], ['acc', 3], ['crit', 3]] },
  spear:     { slot: 'weapon', name: 'Копьё', price: 40, stats: { dmgMin: 8, dmgMax: 13, init: 3, crit: 4 },
    classes: ['hoplomachus', 'retiarius'], bonus: [['init', 2], ['skl', 1], ['crit', 3]] },
  mace:      { slot: 'weapon', name: 'Булава', price: 45, stats: { dmgMin: 8, dmgMax: 13, acc: -5, stun: 8 },
    classes: ['secutor'], bonus: [['stun', 3], ['str', 1], ['end', 1]] },
  longsword: { slot: 'weapon', name: 'Галльский длинный меч', price: 70, twoHanded: true, stats: { dmgMin: 12, dmgMax: 18, acc: -2 },
    classes: ['gallus'], bonus: [['str', 1], ['crit', 3], ['end', 1]] },
  axe:       { slot: 'weapon', name: 'Секира', price: 75, twoHanded: true, stats: { dmgMin: 12, dmgMax: 19, acc: -6, stun: 5 },
    classes: ['gallus'], bonus: [['str', 1], ['stun', 3], ['crit', 3]] },
  arcus:     { slot: 'weapon', name: 'Лук', price: 50, twoHanded: true, ranged: true, stats: { dmgMin: 6, dmgMax: 10, acc: 6 },
    classes: ['sagittarius'], bonus: [['acc', 3], ['agi', 1], ['crit', 3]] },
  compBow:   { slot: 'weapon', name: 'Составной лук', price: 85, twoHanded: true, ranged: true, stats: { dmgMin: 8, dmgMax: 12, acc: 4, crit: 4 },
    classes: ['sagittarius'], bonus: [['skl', 1], ['crit', 3], ['acc', 3]] },
  // Вторая рука
  scutum:    { slot: 'offhand', name: 'Скутум', price: 45, stats: { block: 20, armor: 2, dodge: -4 },
    classes: ['murmillo', 'secutor'], bonus: [['block', 3], ['end', 1], ['armor', 1]] },
  parma:     { slot: 'offhand', name: 'Парма', price: 35, stats: { block: 12 },
    classes: ['thraex', 'hoplomachus', 'secutor'], bonus: [['dodge', 2], ['block', 3], ['agi', 1]] },
  rete:      { slot: 'offhand', name: 'Сеть', price: 30, stats: { dodge: 6, acc: 3 },
    classes: ['retiarius'], bonus: [['agi', 1], ['wil', 1], ['acc', 3]] },
  pugio:     { slot: 'offhand', name: 'Второй клинок', price: 40, stats: { dmgMin: 4, dmgMax: 7, crit: 3, dodge: 3 },
    classes: ['dimachaerus'], bonus: [['crit', 2], ['agi', 1], ['acc', 3]] },
  pharetra:  { slot: 'offhand', name: 'Колчан', price: 30, needsBow: true, stats: { acc: 4, crit: 2 },
    classes: ['sagittarius'], bonus: [['crit', 2], ['skl', 1], ['acc', 3]] },
  // Шлемы
  leatherHelm: { slot: 'helmet', name: 'Кожаный шлем', price: 20, stats: { armor: 1 },
    classes: ['dimachaerus', 'sagittarius'], bonus: [['dodge', 2], ['wil', 1], ['hp', 8]] },
  galea:       { slot: 'helmet', name: 'Галея', price: 40, stats: { armor: 3, acc: -2 },
    classes: ['murmillo', 'secutor', 'thraex', 'hoplomachus'], bonus: [['wil', 1], ['armor', 1], ['hp', 10]] },
  crestHelm:   { slot: 'helmet', name: 'Гребенчатый шлем', price: 60, stats: { armor: 5, acc: -4, wil: 1 },
    classes: ['murmillo'], bonus: [['armor', 1], ['wil', 1], ['hp', 12]] },
  conicHelm:   { slot: 'helmet', name: 'Остроконечный шлем', price: 35, stats: { armor: 2, acc: 2 },
    classes: ['sagittarius'], bonus: [['acc', 2], ['wil', 1], ['armor', 1]] },
  gallicHelm:  { slot: 'helmet', name: 'Галльский шлем', price: 45, stats: { armor: 3, wil: 1 },
    classes: ['gallus'], bonus: [['str', 1], ['armor', 1], ['hp', 10]] },
  // Доспехи
  leather: { slot: 'armor', name: 'Кожаный доспех', price: 45, stats: { armor: 4, dodge: -1 },
    classes: ['sagittarius', 'dimachaerus', 'gallus'], bonus: [['hp', 8], ['dodge', 2], ['armor', 1]] },
  mail:    { slot: 'armor', name: 'Кольчуга', price: 70, stats: { armor: 6, dodge: -3 },
    classes: ['gallus', 'dimachaerus'], bonus: [['end', 1], ['armor', 1], ['hp', 12]] },
  squama:  { slot: 'armor', name: 'Чешуйчатый доспех', price: 80, stats: { armor: 7, dodge: -5 },
    classes: ['murmillo', 'secutor', 'hoplomachus'], bonus: [['armor', 1], ['end', 1], ['hp', 12]] },
  // Руки и плечи
  manica:    { slot: 'arms', name: 'Стёганая маника', price: 25, stats: { armor: 2 },
    classes: ['murmillo', 'secutor', 'thraex', 'hoplomachus', 'dimachaerus'], bonus: [['armor', 1], ['end', 1], ['hp', 8]] },
  lamManica: { slot: 'arms', name: 'Пластинчатая маника', price: 55, stats: { armor: 4, dodge: -2 },
    classes: ['murmillo', 'secutor', 'thraex', 'hoplomachus'], bonus: [['armor', 1], ['str', 1], ['hp', 10]] },
  galerus:   { slot: 'arms', name: 'Галер', price: 35, stats: { armor: 2, dodge: 3 },
    classes: ['retiarius'], bonus: [['dodge', 2], ['armor', 1], ['agi', 1]] },
  vambraces: { slot: 'arms', name: 'Кожаные наручи', price: 25, stats: { armor: 1, acc: 3 },
    classes: ['sagittarius', 'gallus', 'dimachaerus'], bonus: [['acc', 2], ['crit', 2], ['agi', 1]] },
  // Поножи и обувь
  fasciae:    { slot: 'legs', name: 'Обмотки', price: 15, stats: { dodge: 2 },
    classes: ['retiarius', 'dimachaerus', 'sagittarius'], bonus: [['agi', 1], ['dodge', 2], ['init', 2]] },
  ocrea:      { slot: 'legs', name: 'Поножа', price: 30, stats: { armor: 2 },
    classes: ['murmillo', 'secutor'], bonus: [['armor', 1], ['end', 1], ['hp', 8]] },
  ocreaeHigh: { slot: 'legs', name: 'Высокие поножи', price: 45, stats: { armor: 3, dodge: -1 },
    classes: ['thraex', 'hoplomachus'], bonus: [['armor', 1], ['agi', 1], ['hp', 8]] },
  caligae:    { slot: 'legs', name: 'Галльские сапоги', price: 25, stats: { armor: 1, init: 2 },
    classes: ['gallus', 'sagittarius'], bonus: [['init', 2], ['end', 1], ['dodge', 2]] },
  // Пояса
  cingulum: { slot: 'belt', name: 'Кожаный пояс', price: 15, stats: { hp: 6 },
    classes: ['sagittarius', 'gallus', 'dimachaerus'], bonus: [['wil', 1], ['hp', 6], ['agi', 1]] },
  balteus:  { slot: 'belt', name: 'Бронзовый бальтеус', price: 40, stats: { hp: 10, armor: 1 },
    classes: ['murmillo', 'secutor', 'thraex', 'hoplomachus', 'retiarius'], bonus: [['wil', 1], ['end', 1], ['hp', 8]] },
};

// ------------------------------------------------------------
//  Редкие изделия «Лавки редкостей» (открывается при славе лудуса 50).
//  Единственные в своём роде: характеристики заданы окончательно,
//  каждую вещь можно купить лишь однажды. Стоят в разы дороже кузнечных.
// ------------------------------------------------------------
const RARE_SHOP_FAME = 50;
const RARE_BASES = {
  rare_praetor:   { slot: 'weapon', look: 'gladius', name: 'Гладиус преторианца', price: 1600,
    stats: { dmgMin: 13, dmgMax: 21, acc: 16, str: 3, crit: 5 }, classes: ['murmillo', 'secutor', 'dimachaerus'],
    desc: 'Клинок из личной стражи легата: сталь норикской ковки, рукоять из слоновой кости.' },
  rare_damascus:  { slot: 'weapon', look: 'sica', name: 'Сика из восточной стали', price: 1500,
    stats: { dmgMin: 11, dmgMax: 19, crit: 15, agi: 2, acc: 6 }, classes: ['thraex', 'dimachaerus'],
    desc: 'Узорчатый клинок, привезённый караваном из Дамаска. Режет кожу, как папирус.' },
  rare_sarissa:   { slot: 'weapon', look: 'spear', name: 'Македонское копьё', price: 1500,
    stats: { dmgMin: 14, dmgMax: 22, init: 6, crit: 8, acc: 5 }, classes: ['hoplomachus', 'retiarius'],
    desc: 'Ясеневое древко ветерана фаланги — говорят, оно помнит Гавгамелы.' },
  rare_trident:   { slot: 'weapon', look: 'trident', name: 'Позолоченный трезубец', price: 1450,
    stats: { dmgMin: 13, dmgMax: 20, dodge: 8, acc: 8, agi: 2 }, classes: ['retiarius'],
    desc: 'Дар храма Нептуна в Остии: зубцы отлиты с примесью золота.' },
  rare_mace:      { slot: 'weapon', look: 'mace', name: 'Булава ликтора', price: 1400,
    stats: { dmgMin: 14, dmgMax: 22, stun: 15, str: 2, acc: -2 }, classes: ['secutor'],
    desc: 'Окованная навершием из фасций — ею, по слухам, усмиряли мятежных рабов.' },
  rare_parthian:  { slot: 'weapon', look: 'compBow', name: 'Парфянский лук', price: 1800, twoHanded: true, ranged: true,
    stats: { dmgMin: 15, dmgMax: 23, acc: 12, crit: 10 }, classes: ['sagittarius'],
    desc: 'Клеёный из рога и жил лук всадников Ктесифона. Бьёт дальше и сильнее любого римского.' },
  rare_arverni:   { slot: 'weapon', look: 'axe', name: 'Секира арвернов', price: 1800, twoHanded: true,
    stats: { dmgMin: 20, dmgMax: 31, stun: 12, str: 2, acc: -4 }, classes: ['gallus'],
    desc: 'Трофей галльских войн. Лезвие ещё хранит зарубки от римских щитов.' },
  rare_scutum:    { slot: 'offhand', look: 'scutum', name: 'Скутум Тринадцатого легиона', price: 1500,
    stats: { block: 32, armor: 5, end: 2, dodge: -3 }, classes: ['murmillo', 'secutor'],
    desc: 'Щит, переживший переход через Рубикон. Молнии на нём выкрашены заново.' },
  rare_parma:     { slot: 'offhand', look: 'parma', name: 'Парма с эгидой', price: 1300,
    stats: { block: 22, dodge: 6, wil: 2 }, classes: ['thraex', 'hoplomachus', 'secutor'],
    desc: 'Малый щит с ликом Горгоны в центре — противники отводят взгляд.' },
  rare_gorytos:   { slot: 'offhand', look: 'pharetra', name: 'Скифский горит', price: 1100, needsBow: true,
    stats: { acc: 10, crit: 8, agi: 2 }, classes: ['sagittarius'],
    desc: 'Футляр для лука и стрел с золотой обкладкой, работа понтийских мастеров.' },
  rare_crest:     { slot: 'helmet', look: 'crestHelm', name: 'Шлем с золотой насечкой', price: 1400,
    stats: { armor: 8, wil: 3, hp: 14, acc: -2 }, classes: ['murmillo'],
    desc: 'Парадный шлем чемпиона Капуи. Гребень украшен перьями цапли.' },
  rare_sarmat:    { slot: 'helmet', look: 'conicHelm', name: 'Сарматский шлем', price: 1200,
    stats: { armor: 5, acc: 8, wil: 2, hp: 8 }, classes: ['sagittarius'],
    desc: 'Сегментный шлем степных всадников с кольчужной бармицей.' },
  rare_lorica:    { slot: 'armor', look: 'squama', name: 'Лорика с позолотой', price: 2200,
    stats: { armor: 12, end: 2, hp: 16, dodge: -4 }, classes: ['murmillo', 'secutor', 'hoplomachus'],
    desc: 'Чешуйчатый доспех трибуна: каждая чешуйка прошита бронзовой проволокой.' },
  rare_linothorax:{ slot: 'armor', look: 'leather', name: 'Льняной линоторакс', price: 1600,
    stats: { armor: 7, dodge: 4, hp: 12, agi: 2 }, classes: ['sagittarius', 'dimachaerus', 'gallus'],
    desc: 'Склеенный из двадцати слоёв льна панцирь — лёгкий, как туника, и прочный, как бронза.' },
  rare_manica:    { slot: 'arms', look: 'lamManica', name: 'Маника с золотыми пластинами', price: 1300,
    stats: { armor: 7, str: 2, hp: 12 }, classes: ['murmillo', 'secutor', 'thraex', 'hoplomachus'],
    desc: 'Пластины на шёлковой подкладке. Говорят, её заказывал сам Коммод.' },
  rare_greaves:   { slot: 'legs', look: 'ocreaeHigh', name: 'Коринфские поножи', price: 1300,
    stats: { armor: 6, agi: 2, hp: 12, init: 2 }, classes: ['thraex', 'hoplomachus', 'murmillo', 'secutor'],
    desc: 'Бронзовые поножи, выкованные точно по ноге, — не звенят на бегу.' },
  rare_belt:      { slot: 'belt', look: 'balteus', name: 'Пояс чемпиона Капуи', price: 1250,
    stats: { hp: 24, wil: 3, mercy: 8 }, classes: ['murmillo', 'secutor', 'thraex', 'hoplomachus', 'retiarius', 'dimachaerus', 'sagittarius', 'gallus'],
    desc: 'Широкий пояс с серебряными бляхами — толпа узнаёт его издалека.' },
};
for (const [id, b] of Object.entries(RARE_BASES)) ITEM_BASES[id] = { bonus: [], rare: true, ...b };

const QUALITIES = [
  { name: 'Грубое',      mult: 0.8,  price: 0.6, cls: 'q0' },
  { name: 'Обычное',     mult: 1.0,  price: 1.0, cls: 'q1' },
  { name: 'Добротное',   mult: 1.25, price: 2.4, cls: 'q2' },
  { name: 'Мастерское',  mult: 1.55, price: 5.0, cls: 'q3' },
  { name: 'Легендарное', mult: 1.9,  price: 10,  cls: 'q4' },
];
// Школьная выучка: предмет, подходящий школе бойца, даёт +25% к своим
// положительным характеристикам, оружие — ещё и +5% точности
const FIT_MULT = 1.25, FIT_ACC = 5;

const STAT_NAMES = {
  dmgMin: 'Урон мин', dmgMax: 'Урон макс', acc: 'Точность', dodge: 'Уклонение', armor: 'Броня',
  crit: 'Крит', block: 'Блок', init: 'Инициатива', stun: 'Оглушение', hp: 'Здоровье',
  str: 'Сила', agi: 'Ловкость', end: 'Выносливость', skl: 'Мастерство', wil: 'Воля',
};
// Статы, которые выражены в процентах
const PCT_STATS = new Set(['acc', 'dodge', 'crit', 'block', 'stun']);

// ------------------------------------------------------------
//  Арены
// ------------------------------------------------------------
const TIERS = [
  { name: 'Провинциальные игры', place: 'Арена Помпей', lvl: [1, 3], quality: [0, 1], gold: 45, fame: 3, xp: 1.0, mercy: 5, fameReq: 0,
    mood: 'Публика провинции снисходительна.' },
  { name: 'Игры в Капуе', place: 'Амфитеатр Капуи', lvl: [3, 6], quality: [1, 2], gold: 100, fame: 8, xp: 1.6, mercy: 0, fameReq: 40,
    mood: 'Капуя видела многое и ценит мастерство.' },
  { name: 'Большие игры Рима', place: 'Статилиев амфитеатр', lvl: [6, 10], quality: [2, 3], gold: 230, fame: 20, xp: 2.4, mercy: -10, fameReq: 150,
    mood: 'Римская чернь жаждет крови.' },
  { name: 'Игры Императора', place: 'Колизей', lvl: [10, 15], quality: [3, 4], gold: 480, fame: 45, xp: 3.5, mercy: -15, fameReq: 400,
    mood: 'Император редко поднимает палец вверх.' },
];
const FORMAT_MULT = { 1: 1, 2: 1.7, 3: 2.4 };

// ------------------------------------------------------------
//  Имена
// ------------------------------------------------------------
const NAMES = [
  'Спикул', 'Фламма', 'Приск', 'Вер', 'Крикс', 'Эномай', 'Ганник', 'Тетраит', 'Карпофор', 'Келад',
  'Гермес', 'Триумф', 'Аттилий', 'Астеропей', 'Батон', 'Мемнон', 'Феликс', 'Тигрис', 'Урс', 'Скорп',
  'Аквила', 'Децим', 'Луций', 'Кассий', 'Тит', 'Варрон', 'Сабин', 'Корвин', 'Арминий', 'Бренн',
  'Таур', 'Марк', 'Гай', 'Квинт', 'Сикст', 'Агрон', 'Бойорикс', 'Дурий', 'Ликс', 'Нарцисс',
  'Пугнакс', 'Кастор', 'Полидевк', 'Виталис', 'Мирмекс', 'Ахилла', 'Гектор', 'Стефан', 'Ромул',
];
const ORIGINS = ['из Галлии', 'из Фракии', 'из Германии', 'из Нумидии', 'из Иберии', 'из Дакии', 'из Британии',
  'из Сирии', 'из Греции', 'из Иллирии', 'из Египта', 'из Скифии', 'римлянин'];

// ------------------------------------------------------------
//  Долг отца: платежи раз в DEBT_EVERY дней, списываются сами в день срока
// ------------------------------------------------------------
const DEBT_TOTAL = 5000;
const DEBT_EVERY = 7;
// Подбор: node tests/sim.js (40 прогонов, автобой). Игрок-автомат слабее живого и даёт нижнюю границу:
// при почти нулевом долге он открывает Капую к ~20-му дню, Рим к ~58-му, а доход по неделям растёт так:
// 170 · 320 · 340–480 · 460–640 · 570–890 · 780–960 · 660–1210 · 860–1150 · 1200–1480 …
// Поэтому платежи растут вслед за доходом (≈ 40% недельного дохода), а первый — не больше половины
// стартовой казны: новичок, потративший половину денег на снаряжение, всё равно расплатится.
const DEBT_PLAN = [100, 150, 200, 250, 300, 350, 450, 500, 550, 650, 700, 800];
const DEBT_RAISE = 1.2; // Гней Вар выкупает долг в Капуе и поднимает оставшиеся платежи
