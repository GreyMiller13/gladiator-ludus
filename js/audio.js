// ============================================================
//  Звук: процедурный движок на Web Audio (без файлов и библиотек)
//  Сталь, бронза, деревянные щиты, песок и ревущая толпа
// ============================================================

const SFX = (() => {
  // Локальные помощники (глобальные rnd/pick/clamp из core.js не трогаем)
  const rf = (a, b) => a + Math.random() * (b - a);
  const jit = (x, amt) => x * (1 + (Math.random() * 2 - 1) * (amt == null ? 0.06 : amt));
  const pk = arr => arr[Math.floor(Math.random() * arr.length)];
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  const STORE_KEY = 'gladiator_ludus_sound';
  const MAX_VOICES = 24;
  const THROTTLE_MS = 30;

  const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext || null) : null;

  let ctx = null;          // AudioContext, создаётся по первому жесту
  let gestured = false;    // жест пользователя уже был
  let master = null;       // громкость / мьют
  let revIn = null;        // посыл на общий ревербератор
  let bufs = null;         // заранее сгенерированные шумы
  let babbleBufs = null;   // «гомон» толпы
  let applauseBuf = null;  // аплодисменты
  let shaperCurve = null;  // мягкое насыщение для рога
  let active = 0;          // число одновременно звучащих эффектов
  const lastPlay = {};

  let crowd = null;        // текущая атмосфера толпы
  let pendingCrowd = null; // запрос crowdStart до разблокировки
  let lastExcite = 0.12;

  let musicBus = null;     // громкость музыки → пауза → мастер
  let musicPause = null;   // приглушение, пока вкладка скрыта
  let curTrack = null;     // играющая тема
  let curMusic = null;     // её имя
  let pendingMusic;        // запрос music() до разблокировки (undefined — нет)
  let musicTimer = null;   // планировщик нот

  // ------------------------------------------------------------
  //  Сохранённые настройки
  // ------------------------------------------------------------
  let volume = 0.7;
  let muted = false;
  let musicVolume = 0.3;
  let musicMuted = false;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE_KEY) : null;
    if (raw) {
      const s = JSON.parse(raw);
      if (typeof s.volume === 'number' && isFinite(s.volume)) volume = cl(s.volume, 0, 1);
      if (typeof s.muted === 'boolean') muted = s.muted;
      // старое значение по умолчанию (0.45) однажды переводим на новое
      if (typeof s.musicVolume === 'number' && isFinite(s.musicVolume)) {
        musicVolume = cl(s.rev >= 2 || s.musicVolume !== 0.45 ? s.musicVolume : 0.3, 0, 1);
      }
      if (typeof s.musicMuted === 'boolean') musicMuted = s.musicMuted;
    }
  } catch (e) { /* хранилище недоступно */ }

  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ volume, muted, musicVolume, musicMuted, rev: 2 }));
    } catch (e) { /* хранилище недоступно */ }
  }

  const masterLevel = () => (muted ? 0 : Math.pow(volume, 1.5) * 0.9);
  const MUSIC_SCALE = 2.4;
  const musicLevel = () => (musicMuted ? 0 : Math.pow(musicVolume, 1.5) * MUSIC_SCALE);

  function applyMaster() {
    if (!ctx || !master) return;
    try { master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.05); } catch (e) { /* нет */ }
  }

  function applyMusic() {
    if (!ctx || !musicBus) return;
    try { musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.08); } catch (e) { /* нет */ }
  }

  // ------------------------------------------------------------
  //  Генерация буферов: шумы, импульс зала, гомон, аплодисменты
  // ------------------------------------------------------------
  function normalizeRms(data, target) {
    let s = 0;
    for (let i = 0; i < data.length; i++) s += data[i] * data[i];
    const rms = Math.sqrt(s / data.length) || 1;
    const k = target / rms;
    for (let i = 0; i < data.length; i++) data[i] = cl(data[i] * k, -1, 1);
  }

  function makeNoise(kind, sec) {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * sec);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    if (kind === 'white') {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else if (kind === 'pink') {
      // фильтр Пола Келлета
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
      }
    } else {
      // коричневый: интеграл белого с утечкой
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = last;
      }
    }
    normalizeRms(d, 0.3);
    return buf;
  }

  // Импульс для свёртки: затухающий шум, высокие гаснут быстрее
  function makeImpulse(sec) {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * sec);
    const buf = ctx.createBuffer(2, len, sr);
    const pre = Math.floor(0.014 * sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = pre; i < len; i++) {
        const tt = (i - pre) / sr;
        const k = 0.1 + 0.85 * Math.min(1, tt / sec);
        lp += (1 - k) * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * Math.exp(-tt * 3.0);
      }
      // ранние отражения от трибун
      for (let n = 0; n < 7; n++) {
        const idx = pre + Math.floor(rf(0.004, 0.07) * sr);
        if (idx < len) d[idx] += rf(-0.5, 0.5);
      }
    }
    return buf;
  }

  // Двухполюсный резонатор для офлайн-синтеза
  function reso(f, bw, sr) {
    const r = Math.exp(-Math.PI * bw / sr);
    return { a1: 2 * r * Math.cos(2 * Math.PI * f / sr), a2: r * r, b: 1 - r };
  }

  const BABBLE_VOWELS = [[730, 1090], [270, 2290], [300, 870], [530, 1840], [570, 840], [440, 1020], [660, 1720], [390, 1990]];

  // Гомон: много невнятных голосов — слоги с формантами и тоном, шов зациклен
  function makeBabble(sec, voices) {
    const sr = 22050;
    const len = Math.floor(sr * sec);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const tail = Math.floor(0.02 * sr);
    for (let v = 0; v < voices; v++) {
      const amp = rf(0.25, 1);
      const pitch0 = Math.random() < 0.7 ? rf(95, 165) : rf(175, 290);
      let t = Math.random() * len;
      const end = t + len;
      while (t < end) {
        const sylLen = Math.floor(rf(0.07, 0.28) * sr);
        const vw = pk(BABBLE_VOWELS);
        const c1 = reso(vw[0] * rf(0.9, 1.1), 90, sr);
        const c2 = reso(vw[1] * rf(0.9, 1.1), 150, sr);
        const f0 = pitch0 * rf(0.9, 1.18);
        const sAmp = amp * rf(0.35, 1);
        const base = Math.floor(t);
        let y1a = 0, y1b = 0, y2a = 0, y2b = 0, ph = Math.random();
        for (let i = 0; i < sylLen + tail; i++) {
          const e = i < sylLen ? Math.sin(Math.PI * i / sylLen) : 0;
          ph += f0 * (1 - 0.15 * Math.min(1, i / sylLen)) / sr;
          let ex = (Math.random() * 2 - 1) * 0.35;
          if (ph >= 1) { ph -= 1; ex += 2.5; }
          ex *= e;
          const o1 = c1.b * ex + c1.a1 * y1a - c1.a2 * y1b; y1b = y1a; y1a = o1;
          const o2 = c2.b * ex + c2.a1 * y2a - c2.a2 * y2b; y2b = y2a; y2a = o2;
          out[(base + i) % len] += (o1 + 0.7 * o2) * sAmp;
        }
        t += sylLen + rf(0.02, 0.3) * sr;
      }
    }
    normalizeRms(out, 0.2);
    return buf;
  }

  // Аплодисменты: сотни коротких хлопков с резонансом ладоней
  function makeApplause(sec, clappers) {
    const sr = 24000;
    const len = Math.floor(sr * sec);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    for (let c = 0; c < clappers; c++) {
      const rate = rf(3.5, 6.5);
      const amp = rf(0.2, 1);
      const fc = rf(900, 2600);
      let t = Math.random() * sr / rate;
      while (t < len) {
        const L = rf(0.003, 0.01) * sr;
        const rs = reso(fc * rf(0.93, 1.07), rf(500, 1300), sr);
        const n = Math.floor(L * 4);
        const base = Math.floor(t);
        const a = amp * rf(0.6, 1);
        let ya = 0, yb = 0;
        for (let i = 0; i < n; i++) {
          const x = (Math.random() * 2 - 1) * Math.exp(-i / L);
          const o = rs.b * x + rs.a1 * ya - rs.a2 * yb; yb = ya; ya = o;
          out[(base + i) % len] += (o * 4 + x * 0.25) * a;
        }
        t += sr / rate * rf(0.8, 1.2);
      }
    }
    normalizeRms(out, 0.2);
    return buf;
  }

  function ensureCrowdBuffers() {
    if (!ctx) return;
    try {
      if (!babbleBufs) babbleBufs = [makeBabble(6, 22), makeBabble(6, 22)];
      if (!applauseBuf) applauseBuf = makeApplause(3, 40);
    } catch (e) { /* без гомона обойдёмся */ }
  }

  // ------------------------------------------------------------
  //  Контекст и разблокировка
  // ------------------------------------------------------------
  function initContext() {
    if (ctx || !AC) return !!ctx;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = masterLevel();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      master.connect(comp);
      comp.connect(ctx.destination);

      bufs = { white: makeNoise('white', 2), pink: makeNoise('pink', 4), brown: makeNoise('brown', 3) };

      revIn = ctx.createGain();
      const conv = ctx.createConvolver();
      conv.buffer = makeImpulse(2.4);
      const revOut = ctx.createGain();
      revOut.gain.value = 0.8;
      revIn.connect(conv); conv.connect(revOut); revOut.connect(master);

      shaperCurve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) shaperCurve[i] = Math.tanh((i / 511.5 - 1) * 2.2);
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  function onGesture() {
    try {
      if (!ctx && !initContext()) return;
      gestured = true;
      if (ctx.state !== 'running' && ctx.resume) {
        const p = ctx.resume();
        if (p && p.catch) p.catch(() => {});
      }
      if (pendingCrowd) {
        const req = pendingCrowd;
        pendingCrowd = null;
        startCrowd(req.size);
      }
      if (pendingMusic !== undefined) {
        const m = pendingMusic;
        pendingMusic = undefined;
        startMusic(m);
      }
      // гомон считаем заранее, чтобы старт боя не подтормаживал
      if (!babbleBufs) setTimeout(ensureCrowdBuffers, 250);
    } catch (e) { /* молчим */ }
  }

  if (AC && typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('pointerdown', onGesture, true);
    document.addEventListener('keydown', onGesture, true);
    document.addEventListener('touchend', onGesture, true);
  }

  const ready = () => !!(ctx && gestured && ctx.state !== 'closed');

  // ------------------------------------------------------------
  //  Строительные блоки
  // ------------------------------------------------------------
  function mkGain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }

  function mkFilter(type, f, q) {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = cl(f, 20, ctx.sampleRate * 0.45);
    if (q != null) b.Q.value = q;
    return b;
  }

  const fq = f => cl(f, 20, ctx.sampleRate * 0.45);

  function noiseSrc(kind, t, dur, rate) {
    const s = ctx.createBufferSource();
    s.buffer = bufs[kind] || bufs.white;
    s.loop = true;
    if (rate) s.playbackRate.value = rate;
    s.start(t, Math.random() * (s.buffer.duration - 0.05));
    s.stop(t + dur + 0.05);
    return s;
  }

  // Атака линейно, спад экспоненциально
  function adEnv(param, t, a, peak, d) {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    param.exponentialRampToValueAtTime(0.0001, t + a + d);
    param.setValueAtTime(0, t + a + d + 0.005);
  }

  // Ломаная огибающая [[время, уровень], ...]
  function curve(param, t, pts) {
    param.setValueAtTime(pts[0][1], t + pts[0][0]);
    for (let i = 1; i < pts.length; i++) param.linearRampToValueAtTime(pts[i][1], t + pts[i][0]);
  }

  // Шумовой всплеск через фильтр
  function burst(out, t, o) {
    const a = o.a || 0.002;
    const src = noiseSrc(o.n || 'white', t, a + o.d, o.rate);
    const f = mkFilter(o.type || 'bandpass', o.f, o.q == null ? 1 : o.q);
    if (o.f2) {
      f.frequency.setValueAtTime(fq(o.f), t);
      f.frequency.exponentialRampToValueAtTime(fq(o.f2), t + a + o.d * (o.sw || 1));
    }
    const g = ctx.createGain();
    adEnv(g.gain, t, a, o.g, o.d);
    src.connect(f); f.connect(g); g.connect(out);
  }

  // Тон с падением высоты (удар, щелчок, струна)
  function tone(out, t, o) {
    const a = o.a || 0.002;
    const os = ctx.createOscillator();
    os.type = o.w || 'sine';
    os.frequency.setValueAtTime(fq(o.f), t);
    if (o.f2) os.frequency.exponentialRampToValueAtTime(fq(o.f2), t + (o.sw || a + o.d));
    if (o.det) os.detune.value = o.det;
    const g = ctx.createGain();
    adEnv(g.gain, t, a, o.g, o.d);
    let tail = g;
    if (o.lp) {
      const lp = mkFilter('lowpass', o.lp, 0.8);
      if (o.lp2) {
        lp.frequency.setValueAtTime(fq(o.lp), t);
        lp.frequency.exponentialRampToValueAtTime(fq(o.lp2), t + a + o.d);
      }
      g.connect(lp); tail = lp;
    }
    os.connect(g); tail.connect(out);
    os.start(t);
    os.stop(t + a + o.d + 0.05);
  }

  // Поток воздуха: полосовой шум с разгоном и спадом
  function whoosh(out, t, d, fLo, fHi, g, q, kind) {
    const src = noiseSrc(kind || 'pink', t, d);
    const f = mkFilter('bandpass', fLo, q);
    f.frequency.setValueAtTime(fq(fLo), t);
    f.frequency.exponentialRampToValueAtTime(fq(fHi), t + d * 0.45);
    f.frequency.exponentialRampToValueAtTime(fq(fLo * 1.1), t + d);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(Math.max(g, 0.0002), t + d * 0.45);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    gn.gain.setValueAtTime(0, t + d + 0.005);
    src.connect(f); f.connect(gn); gn.connect(out);
  }

  // Металл: негармонические синусы, верхние гаснут быстрее; beat — биения
  function clang(out, t, base, ratios, o) {
    const nyq = ctx.sampleRate * 0.45;
    const damp = o.damp == null ? 0.5 : o.damp;
    ratios.forEach((r, i) => {
      const f = base * r * jit(1, 0.012);
      if (f > nyq) return;
      const amp = o.g * (o.amps ? o.amps[i] : 1 / (1 + i * 0.6)) * rf(0.7, 1.1);
      const d = o.d / (1 + i * damp) * rf(0.8, 1.2);
      tone(out, t, { f, a: 0.0012, d, g: amp });
      if (o.beat && i < 3) tone(out, t, { f: f + rf(1.5, 4.5) * (Math.random() < 0.5 ? -1 : 1), a: 0.0012, d: d * 0.9, g: amp * 0.5 });
    });
  }

  // Россыпь коротких шумовых зёрен (хруст, брызги, шорох верёвок)
  function grains(out, t, count, spread, o) {
    for (let i = 0; i < count; i++) {
      const k = o.fade ? 1 - (i / count) * 0.75 : 1;
      const tt = o.fade ? t + spread * Math.pow(i / count, 1.4) + rf(0, spread / count) : t + rf(0, spread);
      burst(out, tt, { n: o.n || 'white', type: o.type || 'bandpass', f: rf(o.f[0], o.f[1]), q: o.q, a: 0.001, d: rf(o.d[0], o.d[1]), g: rf(o.g[0], o.g[1]) * k });
    }
  }

  // ------------------------------------------------------------
  //  Голоса толпы: шум через гласные форманты + хор «глоток» + гомон
  // ------------------------------------------------------------
  const V_AH = [[800, 4, 1.0], [1200, 5, 0.6], [2600, 6, 0.25]];
  const V_OH = [[480, 5, 1.0], [850, 6, 0.5], [2500, 8, 0.12]];
  const V_OO = [[320, 5, 1.0], [780, 6, 0.4], [2400, 8, 0.08]];
  const V_EE = [[300, 6, 0.9], [2200, 8, 0.5], [3000, 8, 0.2]];

  function crowdVoice(out, t, o) {
    const env = mkGain(0);
    env.connect(out);
    curve(env.gain, t, o.env);
    const lp = mkFilter('lowpass', o.bright || 3200, 0.5);
    lp.connect(env);
    const feed = mkGain(1);
    const bank = o.vowel.map(([f, q, g]) => {
      const b = mkFilter('bandpass', f * jit(1, 0.04), q);
      const bg = mkGain(g);
      feed.connect(b); b.connect(bg); bg.connect(lp);
      return b;
    });
    // дыхание тысяч глоток
    if (o.noise) {
      const s = noiseSrc('pink', t, o.dur);
      const g = mkGain(o.noise);
      s.connect(g); g.connect(feed);
    }
    // невнятный гомон, разогнанный азартом
    if (o.babble && babbleBufs) {
      const s = ctx.createBufferSource();
      s.buffer = pk(babbleBufs);
      s.loop = true;
      s.playbackRate.value = (o.babbleRate || 1.1) * jit(1, 0.04);
      const g = mkGain(o.babble);
      s.connect(g); g.connect(lp);
      s.start(t, Math.random() * (s.buffer.duration - 0.1));
      s.stop(t + o.dur + 0.1);
    }
    // хор отдельных голосов
    const n = o.n || 0;
    const glide = o.glide || [[0, 1]];
    for (let i = 0; i < n; i++) {
      const os = ctx.createOscillator();
      os.type = 'sawtooth';
      const f = rf(o.f0[0], o.f0[1]);
      const off = rf(0, o.spread == null ? 0.08 : o.spread);
      os.frequency.setValueAtTime(fq(f * glide[0][1]), t + off);
      for (let k = 1; k < glide.length; k++) {
        os.frequency.linearRampToValueAtTime(fq(f * glide[k][1] * jit(1, 0.03)), t + off + glide[k][0] * jit(1, 0.08));
      }
      os.detune.value = rf(-20, 20);
      const g = mkGain((o.voice || 0.3) / Math.sqrt(n) * rf(0.5, 1));
      os.connect(g); g.connect(feed);
      os.start(t + off);
      os.stop(t + o.dur + 0.15);
    }
    return { bank, env };
  }

  // Размер текущей арены влияет на реверберацию толпы
  const crowdWet = () => 0.3 + 0.1 * (crowd ? crowd.size : 1);

  // ------------------------------------------------------------
  //  Рог (корну): натуральные обертоны, губная «подтяжка», вибрато
  // ------------------------------------------------------------
  function hornPlayer(out, t0, F, notes, gain, detCents) {
    const oscs = [
      ['sawtooth', 0, 1],
      ['sawtooth', 7, 0.8],
      ['square', -5, 0.35],
    ].map(([w, det, g]) => {
      const os = ctx.createOscillator();
      os.type = w;
      os.detune.value = det + detCents;
      const gg = mkGain(g);
      os.connect(gg);
      return [os, gg];
    });
    const mix = mkGain(0.6);
    oscs.forEach(([, gg]) => gg.connect(mix));
    const lp = mkFilter('lowpass', 600, 1.4);
    const pf1 = mkFilter('peaking', 650, 1.4); pf1.gain.value = 5;
    const pf2 = mkFilter('peaking', 1300, 2); pf2.gain.value = 4;
    const sh = ctx.createWaveShaper();
    sh.curve = shaperCurve;
    const amp = mkGain(0);
    mix.connect(lp); lp.connect(pf1); pf1.connect(pf2); pf2.connect(sh); sh.connect(amp); amp.connect(out);

    // вибрато на долгой ноте
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rf(4.8, 5.8);
    const lfoG = mkGain(0);
    lfo.connect(lfoG);
    oscs.forEach(([os]) => lfoG.connect(os.detune));

    let endT = t0;
    notes.forEach(([h, s, len], idx) => {
      const ts = t0 + s;
      const f = F * h;
      const last = idx === notes.length - 1;
      oscs.forEach(([os]) => {
        os.frequency.setValueAtTime(f * 0.955, ts);
        os.frequency.exponentialRampToValueAtTime(f, ts + 0.05);
      });
      amp.gain.setValueAtTime(0, ts);
      amp.gain.linearRampToValueAtTime(gain, ts + 0.03);
      lp.frequency.setValueAtTime(fq(f * 1.5), ts);
      lp.frequency.exponentialRampToValueAtTime(fq(f * 7), ts + 0.04);
      if (last) {
        lp.frequency.exponentialRampToValueAtTime(fq(f * 4.5), ts + 0.2);
        lp.frequency.exponentialRampToValueAtTime(fq(f * 6.5), ts + len * 0.75);
        lp.frequency.exponentialRampToValueAtTime(fq(f * 2), ts + len);
        amp.gain.linearRampToValueAtTime(gain * 0.85, ts + 0.2);
        amp.gain.linearRampToValueAtTime(gain * 1.15, ts + len * 0.75);
        amp.gain.linearRampToValueAtTime(0, ts + len);
        lfoG.gain.setValueAtTime(0, ts + 0.15);
        lfoG.gain.linearRampToValueAtTime(16, ts + len * 0.6);
      } else {
        lp.frequency.exponentialRampToValueAtTime(fq(f * 4.5), ts + len);
        amp.gain.linearRampToValueAtTime(gain * 0.8, ts + len - 0.03);
        amp.gain.linearRampToValueAtTime(0, ts + len);
      }
      // дыхание в мундштуке
      burst(out, ts, { n: 'pink', f: 1500, q: 0.8, a: 0.02, d: Math.min(len, 0.25), g: gain * 0.35 });
      endT = ts + len;
    });
    oscs.forEach(([os]) => { os.start(t0); os.stop(endT + 0.1); });
    lfo.start(t0); lfo.stop(endT + 0.1);
  }

  // ------------------------------------------------------------
  //  Каталог эффектов: dur — сколько держать узлы, wet — посыл в зал
  // ------------------------------------------------------------
  const BRONZE = [1, 1.59, 2.14, 2.83, 3.51, 4.62];
  const STEEL = [1, 1.505, 2.756, 3.98, 5.404, 7.1, 8.933];
  const HELM = [1, 1.47, 2.09, 2.56, 3.39, 4.1];

  const SOUNDS = {
    swing: { dur: 0.45, wet: 0.06, fn(out, t, r) {
      const d = jit(0.3, 0.12);
      whoosh(out, t, d, jit(380) * r, jit(1500, 0.15) * r, 2.6 * rf(0.85, 1.1), 1.1, 'pink');
      whoosh(out, t + 0.01, d * 0.8, jit(1600) * r, jit(2900) * r, 0.9, 5, 'white');
    } },

    miss: { dur: 0.35, wet: 0.05, fn(out, t, r) {
      const d = jit(0.19, 0.12);
      whoosh(out, t, d, jit(700) * r, jit(2600, 0.12) * r, 1.4, 1.4, 'white');
      whoosh(out, t, d * 0.9, jit(2200) * r, jit(3800) * r, 0.6, 6, 'white');
    } },

    hit: { dur: 0.45, wet: 0.08, fn(out, t, r) {
      tone(out, t, { f: jit(150) * r, f2: jit(55) * r, a: 0.002, d: jit(0.16), g: 0.75 });
      burst(out, t, { n: 'brown', type: 'lowpass', f: jit(900) * r, q: 0.7, d: 0.09, g: 0.9 });
      burst(out, t, { n: 'white', f: jit(2600) * r, f2: 1100 * r, q: 1.8, a: 0.001, d: jit(0.07), g: 2.0 });
      burst(out, t + 0.012, { n: 'pink', f: jit(700) * r, f2: 220 * r, q: 4, a: 0.006, d: jit(0.13), g: 2.6 });
      grains(out, t + 0.02, 3, 0.07, { f: [2500, 5000], q: 2, d: [0.006, 0.018], g: [0.3, 0.6] });
    } },

    crit: { g: 0.7, dur: 0.7, wet: 0.1, fn(out, t, r) {
      tone(out, t, { f: jit(125) * r, f2: jit(40) * r, a: 0.002, d: jit(0.24), g: 0.9 });
      burst(out, t, { n: 'brown', type: 'lowpass', f: jit(750) * r, q: 0.8, d: 0.14, g: 1.1 });
      burst(out, t, { n: 'white', f: jit(3000) * r, f2: 1000 * r, q: 1.5, a: 0.001, d: jit(0.09), g: 2.2 });
      burst(out, t + 0.01, { n: 'pink', f: jit(600) * r, f2: 180 * r, q: 3.5, a: 0.008, d: jit(0.2), g: 3.0 });
      // хруст кости
      grains(out, t + 0.008, 8, 0.075, { f: [1200, 4200], q: 2.5, d: [0.004, 0.014], g: [1.5, 3.0] });
      tone(out, t + 0.006, { w: 'triangle', f: jit(420) * r, f2: 140 * r, a: 0.001, d: 0.05, g: 0.35 });
      grains(out, t + 0.03, 4, 0.12, { f: [2500, 5500], q: 2, d: [0.006, 0.02], g: [0.3, 0.7] });
    } },

    block: { g: 0.85, dur: 0.65, wet: 0.12, fn(out, t, r) {
      tone(out, t, { f: jit(190) * r, f2: jit(95) * r, a: 0.002, d: jit(0.12), g: 0.6 });
      burst(out, t, { n: 'pink', f: jit(420) * r, q: 1.4, d: 0.08, g: 2.2 });
      burst(out, t, { n: 'white', f: jit(1300) * r, q: 3, a: 0.001, d: 0.035, g: 2.8 });
      burst(out, t, { n: 'white', type: 'highpass', f: 3500, q: 0.7, a: 0.0008, d: 0.008, g: 0.6 });
      clang(out, t + 0.002, jit(470, 0.08) * r, BRONZE, { g: 0.11, d: 0.35, damp: 0.4 });
    } },

    parry: { dur: 1.1, wet: 0.22, fn(out, t, r) {
      burst(out, t, { n: 'white', type: 'highpass', f: 2500, q: 0.7, a: 0.0008, d: 0.025, g: 0.9 });
      burst(out, t, { n: 'white', f: jit(5000) * r, f2: 3200 * r, q: 1.5, a: 0.003, d: 0.14, g: 1.4 });
      const base = jit(760, 0.1) * r;
      clang(out, t, base, STEEL, { g: 0.2, d: 0.65, damp: 0.55, beat: true });
      clang(out, t + rf(0.001, 0.006), base * rf(1.25, 1.45), STEEL.slice(0, 4), { g: 0.11, d: 0.45, damp: 0.6, beat: true });
    } },

    bash: { g: 0.75, dur: 0.75, wet: 0.12, fn(out, t, r) {
      tone(out, t, { f: jit(95) * r, f2: jit(38) * r, a: 0.002, d: jit(0.28), g: 0.95 });
      burst(out, t, { n: 'brown', type: 'lowpass', f: jit(500) * r, q: 0.8, d: 0.2, g: 1.1 });
      burst(out, t, { n: 'pink', f: jit(260) * r, q: 1, d: 0.13, g: 1.6 });
      burst(out, t, { n: 'white', f: jit(850) * r, q: 1.2, a: 0.001, d: 0.05, g: 1.8 });
      clang(out, t + 0.003, jit(320, 0.08) * r, BRONZE, { g: 0.07, d: 0.25, damp: 0.5 });
      grains(out, t + 0.04, 3, 0.15, { f: [1800, 3500], q: 3, d: [0.01, 0.03], g: [0.2, 0.5] });
    } },

    net: { dur: 0.75, wet: 0.08, fn(out, t, r) {
      for (let i = 0; i < 4; i++) {
        whoosh(out, t + i * jit(0.05, 0.3), jit(0.32, 0.12), jit(300 + i * 60) * r, jit(900 + i * 150) * r, 1.4, 0.9, 'pink');
      }
      whoosh(out, t, jit(0.4), 150 * r, 420 * r, 1.2, 0.8, 'brown');
      grains(out, t + 0.05, 7, 0.3, { n: 'pink', f: [1200, 2500], q: 1, d: [0.015, 0.04], g: [0.4, 0.9] });
    } },

    netHit: { dur: 0.65, wet: 0.08, fn(out, t, r) {
      grains(out, t, 14, 0.38, { n: 'pink', f: [1400 * r, 3500 * r], q: 1.3, d: [0.012, 0.04], g: [0.8, 1.6], fade: true });
      tone(out, t, { f: jit(130) * r, f2: 70 * r, a: 0.003, d: 0.1, g: 0.3 });
      burst(out, t, { n: 'pink', type: 'lowpass', f: 600, q: 0.7, a: 0.005, d: 0.15, g: 0.5 });
    } },

    bow: { dur: 0.55, wet: 0.08, fn(out, t, r) {
      burst(out, t, { n: 'white', type: 'highpass', f: 2200, q: 0.7, a: 0.0008, d: 0.012, g: 0.6 });
      const f = jit(145, 0.05) * r;
      tone(out, t, { w: 'sawtooth', f, f2: f * 0.84, a: 0.002, d: jit(0.28), g: 0.3, lp: 2400, lp2: 380, sw: 0.2 });
      tone(out, t, { w: 'triangle', f: f * 1.004, f2: f * 0.84, a: 0.002, d: jit(0.25), g: 0.2, det: 8, sw: 0.2 });
      tone(out, t, { f: jit(320) * r, f2: 170 * r, a: 0.001, d: 0.04, g: 0.3 });
    } },

    arrow: { dur: 0.45, wet: 0.06, fn(out, t, r) {
      burst(out, t, { n: 'white', f: jit(2600) * r, f2: jit(1700) * r, q: 9, a: 0.06, d: jit(0.24), g: 3.5 });
      whoosh(out, t, jit(0.28), 500 * r, 1200 * r, 1.0, 1, 'pink');
    } },

    arrowHit: { dur: 0.45, wet: 0.08, fn(out, t, r) {
      tone(out, t, { f: jit(240) * r, f2: jit(85) * r, a: 0.001, d: jit(0.07), g: 0.75 });
      burst(out, t, { n: 'pink', f: jit(900) * r, q: 1.8, d: 0.05, g: 2.0 });
      burst(out, t, { n: 'white', type: 'highpass', f: 3000, q: 0.7, a: 0.0006, d: 0.006, g: 0.5 });
      tone(out, t + 0.004, { w: 'triangle', f: jit(170) * r, a: 0.002, d: 0.18, g: 0.08 });
      burst(out, t + 0.006, { n: 'pink', f: jit(500) * r, f2: 250 * r, q: 3, a: 0.005, d: 0.08, g: 1.2 });
    } },

    fall: { g: 0.7, dur: 1.1, wet: 0.15, fn(out, t, r) {
      tone(out, t, { f: jit(75) * r, f2: jit(38) * r, a: 0.004, d: jit(0.32), g: 0.9 });
      burst(out, t, { n: 'brown', type: 'lowpass', f: jit(380) * r, q: 0.7, a: 0.008, d: 0.3, g: 1.1 });
      burst(out, t, { n: 'pink', f: jit(2600), q: 0.6, a: 0.02, d: jit(0.45), g: 0.7 });
      const t2 = t + jit(0.13, 0.2);
      tone(out, t2, { f: jit(90) * r, f2: 45 * r, a: 0.003, d: 0.15, g: 0.5 });
      burst(out, t2, { n: 'brown', type: 'lowpass', f: 450, q: 0.7, a: 0.005, d: 0.15, g: 0.6 });
      burst(out, t2, { n: 'white', f: 4000, q: 0.8, a: 0.01, d: 0.25, g: 0.5 });
      // звон доспеха
      const n = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        clang(out, t + rf(0.03, 0.42), rf(900, 2100) * r, [1, 2.32, 3.71, 5.1], { g: rf(0.03, 0.08), d: rf(0.06, 0.16), damp: 0.8 });
      }
    } },

    stun: { dur: 1.2, wet: 0.18, fn(out, t, r) {
      tone(out, t, { f: jit(330) * r, f2: 210 * r, a: 0.001, d: 0.05, g: 0.5 });
      burst(out, t, { n: 'pink', f: jit(700) * r, q: 1.5, d: 0.06, g: 1.8 });
      const lp = mkFilter('lowpass', 2500, 0.7);
      lp.connect(out);
      clang(lp, t, jit(255, 0.08) * r, HELM, { g: 0.17, d: 0.6, damp: 0.35, beat: true });
      tone(out, t + 0.02, { f: jit(3100, 0.05), a: 0.05, d: 0.9, g: 0.018 });
    } },

    bleed: { dur: 0.4, wet: 0.05, fn(out, t, r) {
      tone(out, t, { f: jit(1100, 0.12) * r, f2: 320 * r, a: 0.002, d: 0.045, g: 0.12 });
      burst(out, t, { n: 'pink', f: jit(450) * r, f2: 250 * r, q: 5, a: 0.01, d: 0.08, g: 0.9 });
      const t2 = t + rf(0.08, 0.15);
      tone(out, t2, { f: jit(1300, 0.12) * r, f2: 400 * r, a: 0.002, d: 0.04, g: 0.06 });
    } },

    step: { dur: 0.2, wet: 0.02, fn(out, t, r) {
      burst(out, t, { n: 'brown', type: 'lowpass', f: jit(300, 0.15) * r, q: 0.7, a: 0.006, d: jit(0.05, 0.2), g: 0.25 });
      burst(out, t, { n: 'pink', f: jit(2200, 0.15) * r, q: 0.7, a: 0.004, d: jit(0.05, 0.2), g: 0.15 });
    } },

    horn: { dur: 2.3, wet: 0.45, fn(out, t, r) {
      const F = jit(73.4, 0.015) * r;
      const notes = [[3, 0.0, 0.2], [4, 0.24, 0.18], [5, 0.46, 0.18], [6, 0.68, 1.1]];
      hornPlayer(out, t, F, notes, 0.2, 0);
      hornPlayer(out, t + rf(0.01, 0.025), F, notes, 0.14, rf(-12, 12));
    } },

    cheer: { g: 0.7, dur: 2.6, wet: -1, fn(out, t) {
      crowdVoice(out, t, {
        dur: 2.3, vowel: V_AH, noise: 1.4, babble: 0.6, babbleRate: 1.2, n: 8, f0: [180, 380], voice: 0.25,
        glide: [[0, 0.9], [0.35, 1.1], [2.2, 0.85]], spread: 0.15,
        env: [[0, 0], [0.4, 1], [0.9, 0.85], [2.25, 0]],
      });
    } },

    gasp: { dur: 1.3, wet: -1, fn(out, t) {
      burst(out, t, { n: 'pink', f: 1500, q: 0.8, a: 0.03, d: 0.15, g: 0.25 });
      crowdVoice(out, t + 0.04, {
        dur: 1.1, vowel: V_OH, noise: 1.0, babble: 0.2, babbleRate: 0.9, n: 8, f0: [200, 340], voice: 0.25,
        glide: [[0, 0.92], [0.15, 1.06], [1.0, 0.9]], spread: 0.06, bright: 2200,
        env: [[0, 0], [0.12, 1], [0.35, 0.7], [1.05, 0]],
      });
    } },

    boo: { g: 1.4, dur: 1.8, wet: -1, fn(out, t) {
      crowdVoice(out, t, {
        dur: 1.6, vowel: V_OO, noise: 0.7, n: 10, f0: [95, 170], voice: 0.35,
        glide: [[0, 1], [0.4, 1.02], [1.5, 0.88]], spread: 0.15, bright: 1100,
        env: [[0, 0], [0.3, 1], [1.1, 0.85], [1.6, 0]],
      });
    } },

    iugula: { g: 0.85, dur: 2.9, wet: -1, fn(out, t) {
      // рёв под скандированием
      crowdVoice(out, t, {
        dur: 2.6, vowel: V_AH, noise: 1.2, babble: 0.5, babbleRate: 1.25, n: 6, f0: [160, 300], voice: 0.2,
        glide: [[0, 0.95], [2.5, 1.05]], spread: 0.2,
        env: [[0, 0], [0.25, 0.6], [2.0, 0.9], [2.6, 0]],
      });
      // «ию-гу-ла!» дважды
      const syl = [[0.05, V_EE, 0.16], [0.22, V_OO, 0.17], [0.42, V_AH, 0.38], [1.0, V_EE, 0.16], [1.17, V_OO, 0.17], [1.37, V_AH, 0.55]];
      const env = [[0, 0]];
      syl.forEach(([s, , len]) => { env.push([s, 0], [s + 0.03, 1], [s + len * 0.8, 0.75], [s + len, 0]); });
      const ch = crowdVoice(out, t, {
        dur: 2.0, vowel: V_EE, noise: 0.4, n: 10, f0: [125, 210], voice: 0.45, spread: 0.03,
        glide: [[0, 1], [0.42, 1], [0.5, 1.08], [0.8, 1], [1.37, 1], [1.45, 1.1], [1.9, 0.95]],
        env,
      });
      syl.forEach(([s, vw]) => {
        ch.bank.forEach((b, i) => b.frequency.setTargetAtTime(fq(vw[i][0]), t + s, 0.015));
      });
    } },

    missio: { g: 0.75, dur: 2.9, wet: -1, fn(out, t) {
      crowdVoice(out, t, {
        dur: 2.5, vowel: V_AH, noise: 1.0, babble: 0.5, babbleRate: 1.1, n: 6, f0: [200, 380], voice: 0.2,
        glide: [[0, 0.95], [0.3, 1.08], [2.4, 0.9]], spread: 0.2,
        env: [[0, 0], [0.3, 0.8], [1.2, 0.6], [2.5, 0]],
      });
      if (applauseBuf) {
        const s = ctx.createBufferSource();
        s.buffer = applauseBuf;
        s.loop = true;
        s.playbackRate.value = jit(1, 0.05);
        const hp = mkFilter('highpass', 450, 0.7);
        const g = mkGain(0);
        curve(g.gain, t, [[0, 0], [0.15, 0.55], [1.6, 0.5], [2.6, 0]]);
        s.connect(hp); hp.connect(g); g.connect(out);
        s.start(t, Math.random() * 2);
        s.stop(t + 2.7);
      }
    } },

    heal: { dur: 1.0, wet: 0.3, fn(out, t, r) {
      tone(out, t, { f: jit(523, 0.02) * r, a: 0.12, d: 0.6, g: 0.05 });
      tone(out, t + 0.04, { f: jit(784, 0.02) * r, a: 0.16, d: 0.55, g: 0.035, det: 5 });
      burst(out, t, { n: 'white', type: 'highpass', f: 5000, q: 0.7, a: 0.15, d: 0.35, g: 0.06 });
    } },

    click: { dur: 0.08, wet: 0, fn(out, t, r) {
      tone(out, t, { f: jit(1400) * r, f2: 900 * r, a: 0.001, d: 0.018, g: 0.12 });
      burst(out, t, { n: 'white', f: jit(3200) * r, q: 1.5, a: 0.0008, d: 0.01, g: 0.5 });
    } },

    coin: { dur: 0.9, wet: 0.08, fn(out, t, r) {
      const n = 4 + Math.floor(Math.random() * 4);
      let tt = t;
      for (let i = 0; i < n; i++) {
        clang(out, tt, rf(2600, 4200) * r, [1, 1.48, 2.17, 2.93], { g: rf(0.05, 0.11) * (1 - i * 0.08), d: rf(0.08, 0.25), damp: 0.4, beat: true });
        burst(out, tt, { n: 'white', type: 'highpass', f: 6000, q: 0.7, a: 0.0006, d: 0.004, g: 0.25 });
        tt += rf(0.03, 0.11) * (i < 2 ? 1 : 0.8);
      }
    } },
  };

  // ------------------------------------------------------------
  //  Голос эффекта: громкость → панорама → мастер (+ посыл в зал)
  // ------------------------------------------------------------
  function play(name, opts) {
    try {
      const def = SOUNDS[name];
      if (!def || !ready() || muted) return;
      const o = opts || {};
      const tm = nowMs();
      if (lastPlay[name] && tm - lastPlay[name] < THROTTLE_MS) return;
      if (active >= MAX_VOICES) return;
      lastPlay[name] = tm;
      if (ctx.state === 'suspended' && ctx.resume) { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }

      const vol = cl(o.vol == null ? 1 : +o.vol || 0, 0, 2) * rf(0.88, 1.06) * (def.g || 1);
      if (vol <= 0.001) return;
      const pan = cl(+o.pan || 0, -1, 1);
      const rate = cl(o.rate == null ? 1 : +o.rate || 1, 0.25, 4);

      const out = mkGain(vol);
      let node = out;
      let pn = null;
      if (pan && ctx.createStereoPanner) {
        pn = ctx.createStereoPanner();
        pn.pan.value = pan;
        out.connect(pn);
        node = pn;
      }
      node.connect(master);
      const wet = def.wet < 0 ? crowdWet() : def.wet;
      let send = null;
      if (wet > 0) {
        send = mkGain(wet);
        node.connect(send);
        send.connect(revIn);
      }

      def.fn(out, ctx.currentTime + 0.005, rate);

      active++;
      setTimeout(() => {
        active = Math.max(0, active - 1);
        try { out.disconnect(); if (pn) pn.disconnect(); if (send) send.disconnect(); } catch (e) { /* уже */ }
      }, (def.dur + 0.4) * 1000);
    } catch (e) { /* звук не должен ронять игру */ }
  }

  // ------------------------------------------------------------
  //  Атмосфера толпы: гомон, шумовые полосы с медленными LFO, рёв, выкрики
  // ------------------------------------------------------------
  const SIZE_LVL = [0.7, 0.8, 0.9, 1.0];
  const SIZE_WET = [0.18, 0.28, 0.4, 0.55];

  function startCrowd(size) {
    ensureCrowdBuffers();
    const t = ctx.currentTime + 0.02;
    const c = { size, nodes: [], babble: [], excite: -1, lastSet: 0, timer: null, alive: true, shouts: 0 };
    c.out = mkGain(0);
    c.swell = mkGain(1);
    c.bright = mkFilter('lowpass', 1200, 0.4);
    c.bright.connect(c.swell); c.swell.connect(c.out); c.out.connect(master);
    c.send = mkGain(SIZE_WET[size]);
    c.out.connect(c.send); c.send.connect(revIn);

    const startSrc = (s, off) => { s.start(t, off || 0); c.nodes.push(s); return s; };

    // гомон: два независимых слоя по краям
    (babbleBufs || []).forEach((b, i) => {
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.loop = true;
      s.playbackRate.value = jit(1, 0.03);
      const g = mkGain(0.5 + size * 0.1);
      let tail = g;
      s.connect(g);
      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = i ? 0.55 : -0.55;
        g.connect(p); tail = p;
      }
      tail.connect(c.bright);
      startSrc(s, Math.random() * (b.duration - 0.1));
      c.babble.push(s);
    });

    // шумовые полосы: «много людей» с медленно плывущими громкостью и тембром
    [[320, 0.9, 0.55], [620, 1.1, 0.6], [1150, 1.3, 0.35]].forEach(([f, q, g]) => {
      const s = ctx.createBufferSource();
      s.buffer = bufs.pink;
      s.loop = true;
      const bp = mkFilter('bandpass', f, q);
      const gn = mkGain(g * (1.6 + size * 0.2));
      const l1 = ctx.createOscillator(); l1.frequency.value = rf(0.04, 0.17);
      const l1g = mkGain(g * 0.5);
      const l2 = ctx.createOscillator(); l2.frequency.value = rf(0.03, 0.11);
      const l2g = mkGain(f * 0.18);
      l1.connect(l1g); l1g.connect(gn.gain);
      l2.connect(l2g); l2g.connect(bp.frequency);
      s.connect(bp); bp.connect(gn); gn.connect(c.bright);
      startSrc(s, Math.random() * 3.5);
      startSrc(l1); startSrc(l2);
    });

    // рёв, проступающий при азарте
    c.roar = mkGain(0);
    {
      const s = ctx.createBufferSource();
      s.buffer = bufs.pink;
      s.loop = true;
      V_AH.forEach(([f, q, g]) => {
        const b = mkFilter('bandpass', f, q * 0.6);
        const bg = mkGain(g * 2.5);
        s.connect(b); b.connect(bg); bg.connect(c.roar);
      });
      c.roar.connect(c.bright);
      startSrc(s, Math.random() * 3.5);
    }

    // низкий гул трибун и топот
    {
      const s = ctx.createBufferSource();
      s.buffer = bufs.brown;
      s.loop = true;
      const lp = mkFilter('lowpass', 170, 0.7);
      const g = mkGain(0.25 + size * 0.12);
      s.connect(lp); lp.connect(g); g.connect(c.swell);
      startSrc(s, Math.random() * 2.5);
    }

    crowd = c;
    setExcite(c, lastExcite, true, 1.2);
    scheduleShout(c);
  }

  function setExcite(c, excite, force, tau) {
    const e = cl(+excite || 0, 0, 1.6);
    const tm = nowMs();
    if (!force && Math.abs(e - c.excite) < 0.015 && !(e !== c.excite && tm - c.lastSet > 120)) return;
    c.excite = e;
    c.lastSet = tm;
    const n = e / 1.6;
    const t = ctx.currentTime;
    const k = tau || 0.35;
    c.out.gain.setTargetAtTime(SIZE_LVL[c.size] * (0.06 + 0.2 * Math.pow(n, 1.3)), t, k);
    c.bright.frequency.setTargetAtTime(700 + 3200 * n, t, k);
    c.roar.gain.setTargetAtTime(0.6 * n * n, t, k);
    c.babble.forEach(s => s.playbackRate.setTargetAtTime(1 + 0.1 * n, t, k));
  }

  // Случайные выкрики и волны гула
  function scheduleShout(c) {
    if (!c.alive) return;
    const n = Math.max(0, c.excite) / 1.6;
    const delay = rf(0.6, 3.0) / (0.4 + n) / (1 + c.size * 0.35);
    c.timer = setTimeout(() => {
      try { if (c.alive && ctx && ctx.state === 'running' && !muted) crowdEvent(c); } catch (e) { /* молчим */ }
      scheduleShout(c);
    }, delay * 1000);
  }

  function crowdEvent(c) {
    const n = Math.max(0, c.excite) / 1.6;
    const t = ctx.currentTime + 0.02;
    if (Math.random() < 0.3) {
      // волна гула по трибунам
      c.swell.gain.setTargetAtTime(1 + rf(0.2, 0.6), t, 0.3);
      c.swell.gain.setTargetAtTime(1, t + rf(0.6, 1.2), 0.5);
      return;
    }
    if (c.shouts >= 4) return;
    const dur = rf(0.3, 0.75);
    const g = mkGain(rf(0.25, 0.6) * (0.6 + n));
    let tail = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = rf(-0.9, 0.9);
      g.connect(p); tail = p;
    }
    tail.connect(c.bright);
    crowdVoice(g, t, {
      dur, vowel: pk([V_AH, V_OH, V_EE]), noise: 0.3, n: 1 + Math.floor(Math.random() * 2), f0: [150, 330], voice: 0.45,
      glide: [[0, 0.9], [0.08, 1.1], [dur, 0.8]], spread: 0.02,
      env: [[0, 0], [0.04, 1], [dur * 0.6, 0.7], [dur, 0]],
    });
    c.shouts++;
    setTimeout(() => {
      c.shouts = Math.max(0, c.shouts - 1);
      try { g.disconnect(); if (tail !== g) tail.disconnect(); } catch (e) { /* уже */ }
    }, (dur + 0.4) * 1000);
  }

  function stopCrowd(c) {
    c.alive = false;
    if (c.timer) clearTimeout(c.timer);
    const t = ctx.currentTime;
    try {
      c.out.gain.cancelScheduledValues(t);
      c.out.gain.setValueAtTime(c.out.gain.value, t);
      c.out.gain.setTargetAtTime(0, t, 0.25);
    } catch (e) { /* нет */ }
    c.nodes.forEach(s => { try { s.stop(t + 1.2); } catch (e) { /* уже */ } });
    setTimeout(() => {
      try { c.out.disconnect(); c.send.disconnect(); } catch (e) { /* уже */ }
    }, 1300);
  }

  // ============================================================
  //  Музыка: мягкие струнные, арфа, флейта, низкие барабаны, валторны
  //  (кинематографично и спокойно для наушников; всё генерируется)
  // ============================================================
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // Сидированный генератор: каждая тема — своя, но связная
  function mkRng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function ensureMusicBus() {
    if (musicBus) return;
    musicBus = mkGain(musicLevel());
    musicPause = mkGain(typeof document !== 'undefined' && document.hidden ? 0 : 1);
    // бережный для ушей тракт: срез инфранизов, мягкий верх
    const hp = mkFilter('highpass', 40, 0.7);
    const lp = mkFilter('lowpass', 6000, 0.5);
    const shelf = mkFilter('highshelf', 3500); shelf.gain.value = -4;
    const send = mkGain(0.35);
    musicBus.connect(hp); hp.connect(lp); lp.connect(shelf); shelf.connect(musicPause);
    musicPause.connect(master);
    musicPause.connect(send);
    send.connect(revIn);
  }

  // ------------------------------------------------------------
  //  Гармония: натуральный минор, трезвучия по ступеням, плавное голосоведение
  // ------------------------------------------------------------
  // [корень в полутонах от тоники, терция: 3 — минор, 4 — мажор]
  const CHORDS = { i: [0, 3], III: [3, 4], iv: [5, 3], V: [7, 4], VI: [8, 4], VII: [10, 4] };
  const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
  const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

  const chordPcs = (key, sym) => {
    const [r, th] = CHORDS[sym];
    return [r, r + th, r + 7].map(x => (key + x) % 12);
  };
  // Над доминантой — вводный тон (гармонический минор), чтобы не было трения
  const scalePcs = (key, sym) => AEOLIAN.map(x => (key + (sym === 'V' && x === 10 ? 11 : x)) % 12);

  function inRange(pcs, lo, hi) {
    const out = [];
    for (let m = lo; m <= hi; m++) if (pcs.indexOf(((m % 12) + 12) % 12) >= 0) out.push(m);
    return out;
  }

  function nearestOf(pc, m, lo, hi) {
    let d = ((pc - m) % 12 + 12) % 12;
    if (d > 6) d -= 12;
    let n = m + d;
    while (n < lo) n += 12;
    while (n > hi) n -= 12;
    return n;
  }

  // Три голоса идут к ближайшим звукам нового аккорда
  function voiceLead(prev, pcs, lo, hi) {
    let best = null, bc = 1e9;
    PERMS.forEach(pm => {
      let cost = 0;
      const out = prev.map((p, v) => {
        const n = nearestOf(pcs[pm[v]], p, lo, hi);
        cost += Math.abs(n - p);
        return n;
      });
      if (cost < bc) { bc = cost; best = out; }
    });
    return best.sort((a, b) => a - b);
  }

  function panNode(p) {
    if (!ctx.createStereoPanner) return mkGain(1);
    const n = ctx.createStereoPanner();
    n.pan.value = cl(p, -0.3, 0.3);
    return n;
  }

  // ------------------------------------------------------------
  //  Инструменты: всё мягкое, с медленной атакой и срезанным верхом
  // ------------------------------------------------------------
  // «Струнные/хор»: синус + треугольник на голос, атака ~1 с, долгий хвост
  function padChord(dest, t, notes, dur, vel, bright, att, rel) {
    const hold = Math.max(att, dur);
    const end = t + hold + rel + 0.05;
    const out = mkGain(0);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(vel, t + att);
    out.gain.setValueAtTime(vel, t + hold);
    out.gain.linearRampToValueAtTime(0, t + hold + rel);
    const lp = mkFilter('lowpass', bright * 0.6, 0.5);
    lp.frequency.setTargetAtTime(fq(bright), t, att * 0.8);
    lp.connect(out); out.connect(dest);
    notes.forEach((m, i) => {
      const f = mtof(m);
      const vg = mkGain(0.7 / Math.sqrt(notes.length));
      const pn = panNode((i - (notes.length - 1) / 2) * 0.22);
      vg.connect(pn); pn.connect(lp);
      [['sine', 0, 0.65], ['triangle', (i % 2 ? 1 : -1) * rf(1.5, 3), 0.35]].forEach(([w, det, gg]) => {
        const os = ctx.createOscillator();
        os.type = w;
        os.frequency.value = f;
        os.detune.value = det;
        const og = mkGain(gg);
        os.connect(og); og.connect(vg);
        os.start(t); os.stop(end);
      });
    });
  }

  // Виолончельный бас: синус + немного треугольника под низким срезом
  function bassNote(dest, t, m, dur, vel) {
    const f = mtof(m);
    const g = mkGain(0);
    const hold = Math.max(0.35, dur - 0.2);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.35);
    g.gain.setValueAtTime(vel, t + hold);
    g.gain.linearRampToValueAtTime(0, t + hold + 0.9);
    const lp = mkFilter('lowpass', 320, 0.6);
    lp.connect(g); g.connect(dest);
    [['sine', 0.8], ['triangle', 0.35]].forEach(([w, gg]) => {
      const os = ctx.createOscillator();
      os.type = w;
      os.frequency.value = f;
      const og = mkGain(gg);
      os.connect(og); og.connect(lp);
      os.start(t); os.stop(t + hold + 1);
    });
  }

  // Арфа: мягкий щипок (Карплус — Стронг с тёмным возбуждением), считается раз на высоту
  const plucks = {};

  function pluckBuf(midi) {
    if (plucks[midi]) return plucks[midi];
    const sr = 24000;
    const f = mtof(midi);
    const N = Math.max(2, Math.round(sr / f));
    const dur = cl(3.0 - (midi - 45) * 0.05, 1.5, 3.0);
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    // тёмное возбуждение: дважды сглаженный шум (подушечка пальца, не ноготь)
    const line = new Float32Array(N);
    let lp = 0, mean = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < N; i++) {
        lp += 0.3 * ((pass ? line[i] : Math.random() * 2 - 1) - lp);
        line[i] = lp;
      }
    }
    for (let i = 0; i < N; i++) mean += line[i];
    mean /= N;
    for (let i = 0; i < N; i++) line[i] -= mean;
    const g = Math.pow(0.001, 1 / (2.4 * f));
    let idx = 0, peak = 0;
    for (let i = 0; i < len; i++) {
      const a = line[idx];
      const b = line[idx + 1 < N ? idx + 1 : 0];
      d[i] = a;
      line[idx] = g * 0.5 * (a + b);
      idx = idx + 1 < N ? idx + 1 : 0;
      if (Math.abs(a) > peak) peak = Math.abs(a);
    }
    const fin = Math.floor(0.006 * sr);
    const fout = Math.floor(0.3 * sr);
    const k = 0.6 / (peak || 1);
    for (let i = 0; i < len; i++) {
      let e = k;
      if (i < fin) e *= i / fin;
      if (i > len - fout) e *= (len - i) / fout;
      d[i] *= e;
    }
    // усреднение задерживает на полсэмпла — поправляем строй скоростью
    plucks[midi] = { buf, rate: f / (sr / (N + 0.5)) };
    return plucks[midi];
  }

  function harpBus(dest) {
    const g = mkGain(1);
    const lp = mkFilter('lowpass', 2600, 0.5);
    const body = mkFilter('peaking', 250, 1); body.gain.value = 2;
    g.connect(lp); lp.connect(body); body.connect(dest);
    return g;
  }

  function harpNote(bus, t, m, vel, pan) {
    const p = pluckBuf(m);
    const s = ctx.createBufferSource();
    s.buffer = p.buf;
    s.playbackRate.value = p.rate;
    const g = mkGain(vel);
    const pn = panNode(pan);
    s.connect(g); g.connect(pn); pn.connect(bus);
    s.start(t);
  }

  // Голос-флейта (или «хор» с более низким срезом): синус + чуть треугольника,
  // живёт одну фразу и сам затихает к её концу
  function makeLead(dest, t, endT, o) {
    const mix = mkGain(1);
    const parts = [['sine', 1, 0.75], ['triangle', 1, 0.2], ['sine', 2, 0.05]];
    const oscs = parts.map(([w, r, gg]) => {
      const os = ctx.createOscillator();
      os.type = w;
      os.frequency.value = 440 * r;
      const og = mkGain(gg);
      os.connect(og); og.connect(mix);
      return os;
    });
    const lp = mkFilter('lowpass', o.lp, 0.5);
    const amp = mkGain(0);
    const pn = panNode(o.pan || 0);
    mix.connect(lp); lp.connect(amp); amp.connect(pn); pn.connect(dest);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rf(4.6, 5.3);
    const lfoG = mkGain(0);
    lfo.connect(lfoG);
    oscs.forEach(os => lfoG.connect(os.detune));
    amp.gain.setValueAtTime(0, t);
    amp.gain.setTargetAtTime(0, endT, 0.3);
    oscs.concat([lfo]).forEach(n => { n.start(t); n.stop(endT + 1.8); });
    return {
      note(tt, f, dur, vel, glide) {
        oscs.forEach((os, i) => {
          const x = f * parts[i][1];
          if (glide) os.frequency.setTargetAtTime(x, tt, 0.05);
          else os.frequency.setValueAtTime(x, tt);
        });
        amp.gain.setTargetAtTime(vel, tt, o.att || 0.08);
        amp.gain.setTargetAtTime(vel * 0.75, tt + Math.min(0.5, dur * 0.5), 0.4);
        lfoG.gain.setTargetAtTime(0, tt, 0.05);
        if (dur > 0.7) lfoG.gain.setTargetAtTime(o.vib, tt + 0.35, 0.35);
      },
    };
  }

  // Мягкий низкий барабан: синус с падением высоты, атака без щелчка
  function thump(dest, t, vel, big) {
    tone(dest, t, { f: big ? 62 : 88, f2: big ? 36 : 48, sw: big ? 0.25 : 0.14, a: 0.007, d: big ? 1.0 : 0.5, g: vel });
    burst(dest, t, { n: 'brown', type: 'lowpass', f: big ? 120 : 170, q: 0.6, a: 0.006, d: big ? 0.35 : 0.18, g: vel * 0.6 });
  }

  // Тихий шейкер-шорох
  function shaker(dest, t, vel) {
    burst(dest, t, { n: 'white', f: 5000, q: 0.9, a: 0.006, d: 0.05, g: vel });
  }

  // Струнное остинато: треугольник + синус, короткая мягкая огибающая
  function ostNote(bus, t, m, vel) {
    const f = mtof(m);
    const g = mkGain(0);
    adEnv(g.gain, t, 0.012, vel, 0.22);
    g.connect(bus);
    [['triangle', 0.7], ['sine', 0.5]].forEach(([w, gg]) => {
      const os = ctx.createOscillator();
      os.type = w;
      os.frequency.value = f;
      const og = mkGain(gg);
      os.connect(og); og.connect(g);
      os.start(t); os.stop(t + 0.3);
    });
  }

  // Валторны: медленное нарастание, фильтр раскрывается и снова закрывается
  function hornSwell(dest, t, notes, dur, vel) {
    notes.forEach((m, i) => {
      const f = mtof(m);
      const g = mkGain(0);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel, t + dur * 0.55);
      g.gain.linearRampToValueAtTime(vel * 0.8, t + dur);
      g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
      const lp = mkFilter('lowpass', 350, 0.7);
      lp.frequency.setValueAtTime(350, t);
      lp.frequency.linearRampToValueAtTime(1400, t + dur * 0.55);
      lp.frequency.linearRampToValueAtTime(500, t + dur + 0.6);
      const pn = panNode(i ? 0.15 : -0.15);
      lp.connect(g); g.connect(pn); pn.connect(dest);
      [['triangle', 0, 0.6], ['triangle', 3, 0.4], ['sawtooth', -2, 0.18], ['sine', -1200, 0.3]].forEach(([w, det, gg]) => {
        const os = ctx.createOscillator();
        os.type = w;
        os.frequency.value = f;
        os.detune.value = det;
        const og = mkGain(gg);
        os.connect(og); og.connect(lp);
        os.start(t); os.stop(t + dur + 0.7);
      });
    });
  }

  // ------------------------------------------------------------
  //  Каркас темы: очередь событий по шагам, аккорд за аккордом
  // ------------------------------------------------------------
  function newTrack(bpm, perBeat, sections, firstSec, level, key) {
    const out = mkGain(0);
    out.connect(musicBus);
    return {
      // первый аккорд — после первого прохода планировщика: при быстрой смене тем
      // вытесненная тема не успевает создать ни одного узла
      out, level, key, cont: [], pos: 0, next: ctx.currentTime + 0.4,
      stepDur: 60 / bpm / perBeat,
      rng: mkRng(Math.floor(Math.random() * 4294967296)),
      sections, secName: firstSec, sec: sections[firstSec],
      ev: [], nextChordAt: 0, ci: 99, prog: null, rep: 0, started: false,
      voicing: [57, 61, 64], bassM: 45, leadM: 69, lead: null,
    };
  }

  const at = (tr, step, fn, off) => { tr.ev.push({ at: step, fn, off: off || 0 }); };
  const rpick = (tr, arr) => arr[Math.floor(tr.rng() * arr.length)];

  function pickProg(tr, list) {
    let p;
    do { p = rpick(tr, list); } while (list.length > 1 && p === tr.prog);
    return p;
  }

  function chooseNext(tr) {
    const nx = tr.sec.next;
    let r = tr.rng() * nx.reduce((s, x) => s + x[1], 0);
    let name = nx[nx.length - 1][0];
    for (const [nm, w] of nx) { r -= w; if (r <= 0) { name = nm; break; } }
    tr.secName = name;
    tr.sec = tr.sections[name];
  }

  function trackStep(tr, t, aud, compose) {
    if (tr.pos >= tr.nextChordAt) compose(tr);
    while (tr.ev.length && tr.ev[0].at <= tr.pos) {
      const e = tr.ev.shift();
      if (aud) e.fn(t + e.off);
    }
    tr.pos++;
  }

  // Нота мелодии: голос заводится на первой ноте фразы и сам гаснет к её концу
  function leadPlay(tr, t, step, endAt, m, dur, vel, glide, o) {
    if (!tr.lead || tr.lead.endAt !== endAt) {
      tr.lead = { endAt, v: makeLead(tr.out, t, t + (endAt - step) * tr.stepDur - 0.15, o) };
      glide = false;
    }
    tr.lead.v.note(t, mtof(m), dur, vel, glide);
  }

  // Мелодическая линия на один аккорд: долгие ноты — звуки аккорда, короткие — проходящие
  function leadLine(tr, sym, rhy, lo, hi) {
    const ct = chordPcs(tr.key, sym);
    const sc = scalePcs(tr.key, sym);
    let m = tr.leadM;
    let pos = 0;
    const out = [];
    rhy.forEach((d, i) => {
      const long = d >= 3 || i === rhy.length - 1;
      const reach = long ? 5 : 2;
      let c = inRange(long ? ct : sc, Math.max(lo, m - reach), Math.min(hi, m + reach));
      if (c.length > 1) c = c.filter(x => x !== m || tr.rng() < 0.25);
      let n;
      if (!c.length) n = nearestOf(ct[0], m, lo, hi);
      else {
        // ближе — вероятнее; лёгкий уклон к середине диапазона
        const mid = (lo + hi) / 2;
        const w = c.map(x => 1 / (1 + Math.abs(x - m)) * (1 + (Math.abs(x - mid) < Math.abs(m - mid) ? 0.3 : 0)));
        let r = tr.rng() * w.reduce((s, x) => s + x, 0);
        n = c[c.length - 1];
        for (let k = 0; k < c.length; k++) { r -= w[k]; if (r <= 0) { n = c[k]; break; } }
      }
      out.push({ at: pos, d, m: n });
      m = n;
      pos += d;
    });
    tr.leadM = m;
    return out;
  }

  // ------------------------------------------------------------
  //  «Лудус»: ля минор, ~64 уд/мин, восьмые; аккорд на два такта
  // ------------------------------------------------------------
  const MENU_PROGS = [
    ['i', 'VI', 'III', 'VII'], ['i', 'iv', 'VI', 'V'], ['i', 'VI', 'iv', 'V'],
    ['VI', 'VII', 'i', 'i'], ['i', 'III', 'VII', 'iv'], ['i', 'VII', 'VI', 'V'],
  ];
  const MENU_LEAD_PLANS = [[1, 1, 1, 0], [0, 1, 1, 0], [1, 1, 0, 1], [1, 0, 1, 0]];
  const MENU_RHY = [[4, 2, 2, 8], [6, 2, 8], [2, 2, 4, 8], [8, 4, 4], [3, 1, 4, 8], [4, 4, 8], [6, 2, 4, 4]];
  const HARP_THEME = [
    [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 4, 2],
    [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 5, -1, -1, -1, -1],
    [0, -1, 2, 3, 4, -1, 3, 2, 1, -1, 2, 4, 5, -1, -1, -1],
  ];
  const MENU_SECTIONS = {
    calm: { pad: 0.2, bright: 1500, bass: 0.14, harp: 'calm', next: [['theme', 1]] },
    theme: { pad: 0.19, bright: 1800, bass: 0.15, harp: 'theme', lead: true, next: [['theme', 0.4], ['breath', 0.35], ['calm', 0.25]] },
    breath: { pad: 0.13, bright: 1200, bass: 0, harp: 'breath', next: [['calm', 0.6], ['theme', 0.4]] },
  };

  function composeMenu(tr) {
    if (tr.ci >= tr.prog_len) {
      tr.ci = 0;
      if (tr.started) chooseNext(tr);
      tr.started = true;
      tr.prog = pickProg(tr, MENU_PROGS);
      tr.prog_len = tr.prog.length;
      tr.leadPlan = rpick(tr, MENU_LEAD_PLANS);
    }
    const idx = tr.ci++;
    const sym = tr.prog[idx];
    const s = tr.sec;
    const span = 16;
    const a0 = tr.pos;
    const sd = tr.stepDur;
    const dur = span * sd;
    tr.nextChordAt = a0 + span;
    const pcs = chordPcs(tr.key, sym);

    tr.voicing = voiceLead(tr.voicing, pcs, 55, 72);
    const v = tr.voicing.slice();
    at(tr, a0, t => padChord(tr.out, t, v, dur, s.pad, s.bright, 1.4, 2.6));

    if (s.bass) {
      tr.bassM = nearestOf(pcs[0], tr.bassM, 40, 52);
      const bm = tr.bassM;
      at(tr, a0, t => bassNote(tr.out, t, bm, dur * 0.95, s.bass));
    }

    // арфа: арпеджио от корня аккорда
    const arp = inRange(pcs, 45, 79);
    const r0 = Math.max(0, arp.findIndex(m => m % 12 === pcs[0]));
    const note = k => arp[Math.min(arp.length - 1, r0 + k)];
    const hp = (step, k, vel) => {
      const m = note(k);
      at(tr, a0 + step, t => harpNote(tr.harp, t, m, vel * rf(0.85, 1.05), (k - 2) * 0.07), rf(0, 0.015));
    };
    if (s.harp === 'theme') {
      rpick(tr, HARP_THEME).forEach((k, step) => { if (k >= 0) hp(step, k, step % 8 === 0 ? 0.34 : 0.27); });
    } else if (s.harp === 'calm') {
      [0, 2, 4, 2, 1, 3, 4, -1].forEach((k, i) => { if (k >= 0 && tr.rng() < 0.85) hp(i * 2, k, 0.3); });
    } else {
      [0, 5, 10].forEach(step => { if (tr.rng() < 0.7) hp(step, 2 + Math.floor(tr.rng() * 4), 0.22); });
    }

    // мелодия входит и уходит по плану прогрессии
    if (s.lead && tr.leadPlan[idx]) {
      const endAt = a0 + span;
      leadLine(tr, sym, rpick(tr, MENU_RHY), 64, 79).forEach((n, i) => {
        const step = a0 + n.at;
        const vel = n.d >= 8 ? 0.12 : 0.1;
        const glide = i > 0 && tr.rng() < 0.5;
        at(tr, step, t => leadPlay(tr, t, step, endAt, n.m, n.d * sd, vel, glide, { lp: 1800, vib: 9, pan: 0.08 }));
      });
    }
    tr.ev.sort((a, b) => a.at - b.at);
  }

  function buildMenu() {
    const tr = newTrack(64, 2, MENU_SECTIONS, 'calm', 1.0, 9); // ля минор
    tr.harp = harpBus(tr.out);
    tr.prog_len = 0;
    tr.step = (t, aud) => trackStep(tr, t, aud, composeMenu);
    return tr;
  }

  // ------------------------------------------------------------
  //  «Арена»: ре минор, ~96 уд/мин, шестнадцатые; аккорд на такт
  // ------------------------------------------------------------
  const ARENA_PROGS = [
    ['i', 'VI', 'III', 'VII'], ['i', 'VI', 'VII', 'i'], ['i', 'iv', 'VI', 'V'],
    ['VI', 'VII', 'i', 'i'], ['i', 'VII', 'VI', 'VII'],
  ];
  const ARENA_SECTIONS = {
    low: { pad: 0.16, bright: 1000, bass: 0.13, ost: 0, drums: 'low', choir: true, ostLp: 700, next: [['drive', 1]] },
    drive: { pad: 0.15, bright: 1200, bass: 0.14, ost: 8, drums: 'drive', shaker: 8, ostLp: 900, next: [['rise', 0.6], ['drive', 0.2], ['low', 0.2]] },
    rise: { pad: 0.17, bright: 1500, bass: 0.15, ost: 16, drums: 'rise', shaker: 16, ostLp: 1150, next: [['climax', 0.8], ['drive', 0.2]] },
    climax: { pad: 0.18, bright: 1800, bass: 0.16, ost: 16, drums: 'climax', shaker: 16, horns: true, ostLp: 1350, next: [['low', 0.5], ['drive', 0.3], ['climax', 0.2]] },
  };
  // шаг → [громкость, большой]
  const DRUMS = {
    low: { 0: [0.3, true], 8: [0.16] },
    drive: { 0: [0.32, true], 8: [0.26], 11: [0.13], 14: [0.16] },
    rise: { 0: [0.3], 3: [0.13], 6: [0.15], 8: [0.28], 10: [0.13], 12: [0.24], 14: [0.13], 15: [0.11] },
    climax: { 0: [0.4, true], 4: [0.25], 6: [0.13], 8: [0.3], 12: [0.25], 14: [0.15] },
  };
  const OST16 = [0, 0, 0, 0, 0, 0, 7, 7, 0, 0, 0, 0, 12, 12, 7, 7];
  const CHOIR_RHY = [[16], [8, 8], [12, 4]];

  function composeArena(tr) {
    if (tr.ci >= tr.prog_len) {
      tr.ci = 0;
      tr.rep++;
      if (tr.rep >= 2 || !tr.started) {
        tr.rep = 0;
        if (tr.started) chooseNext(tr);
        tr.started = true;
        tr.prog = pickProg(tr, ARENA_PROGS);
        tr.prog_len = tr.prog.length;
        const s0 = tr.sec;
        const lpf = s0.ostLp;
        at(tr, tr.pos, t => tr.ostLp.frequency.setTargetAtTime(lpf, t, 1.5));
      }
    }
    const idx = tr.ci++;
    const sym = tr.prog[idx];
    const s = tr.sec;
    const span = 16;
    const a0 = tr.pos;
    const sd = tr.stepDur;
    const dur = span * sd;
    const lastBar = tr.rep === 1 && tr.ci === tr.prog_len;
    tr.nextChordAt = a0 + span;
    const pcs = chordPcs(tr.key, sym);

    tr.voicing = voiceLead(tr.voicing, pcs, 53, 70);
    const v = tr.voicing.slice();
    at(tr, a0, t => padChord(tr.out, t, v, dur, s.pad, s.bright, 0.7, 1.6));

    tr.bassM = nearestOf(pcs[0], tr.bassM, 38, 50);
    const bm = tr.bassM;
    at(tr, a0, t => bassNote(tr.out, t, bm, dur * 0.95, s.bass));

    // барабаны
    const pat = DRUMS[s.drums];
    for (let st = 0; st < 16; st++) {
      const d = pat[st];
      if (!d) continue;
      if (s.drums === 'low' && st === 0 && idx % 2) continue;
      const [vel, big] = d;
      at(tr, a0 + st, t => thump(tr.drums, t, vel * rf(0.9, 1.05), !!big), rf(-0.004, 0.006));
    }
    if (s.horns && lastBar) {
      for (let st = 9; st < 16; st += 2) {
        const vel = 0.1 + (st - 9) * 0.02;
        at(tr, a0 + st, t => thump(tr.drums, t, vel, false));
      }
    }
    if (s.shaker) {
      const every = 16 / s.shaker;
      for (let st = 0; st < 16; st += every) {
        const vel = (st % 4 === 2 ? 0.05 : 0.03) * rf(0.8, 1.1);
        at(tr, a0 + st, t => shaker(tr.out, t, vel), rf(0, 0.008));
      }
    }

    // остинато струнных от корня аккорда
    if (s.ost) {
      const root = nearestOf(pcs[0], 50, 45, 56);
      const every = 16 / s.ost;
      for (let st = 0; st < 16; st += every) {
        const m = root + OST16[st];
        const vel = (st % 4 === 0 ? 0.11 : 0.07) * rf(0.92, 1.05);
        at(tr, a0 + st, t => ostNote(tr.ostBus, t, m, vel), rf(0, 0.006));
      }
    }

    // валторны в кульминации и на подъёме перед ней
    if (s.horns || (s.drums === 'rise' && lastBar)) {
      const hr = nearestOf(pcs[0], 52, 48, 57);
      const hv = s.horns ? 0.07 : 0.055;
      at(tr, a0, t => hornSwell(tr.out, t, [hr, hr + 7], dur, hv));
    }

    // далёкий «хор» в тихих разделах
    if (s.choir && tr.rng() < 0.75) {
      const endAt = a0 + span;
      leadLine(tr, sym, rpick(tr, CHOIR_RHY), 62, 74).forEach((n, i) => {
        const step = a0 + n.at;
        at(tr, step, t => leadPlay(tr, t, step, endAt, n.m, n.d * sd, 0.07, i > 0, { lp: 1300, vib: 6, pan: -0.1, att: 0.25 }));
      });
    }
    tr.ev.sort((a, b) => a.at - b.at);
  }

  function buildArena() {
    const tr = newTrack(96, 4, ARENA_SECTIONS, 'low', 0.6, 2); // ре минор
    tr.prog_len = 0;
    tr.drums = mkGain(1);
    const dlp = mkFilter('lowpass', 400, 0.6);
    tr.drums.connect(dlp); dlp.connect(tr.out);
    tr.ostBus = mkGain(1);
    tr.ostLp = mkFilter('lowpass', 700, 0.6);
    const opn = panNode(-0.12);
    tr.ostBus.connect(tr.ostLp); tr.ostLp.connect(opn); opn.connect(tr.out);
    tr.step = (t, aud) => trackStep(tr, t, aud, composeArena);
    return tr;
  }

  // ------------------------------------------------------------
  //  Планировщик: каждые 100 мс расписывает ноты на 0.3 с вперёд
  // ------------------------------------------------------------
  function musicTick() {
    try {
      const tr = curTrack;
      if (!ctx || !tr) return;
      const now = ctx.currentTime;
      const hidden = typeof document !== 'undefined' && document.hidden;
      if (hidden || ctx.state !== 'running') { tr.next = now + 0.1; return; }
      if (tr.next < now) tr.next = now + 0.05; // отстали (вкладка спала) — не догоняем
      const aud = !muted && !musicMuted && musicVolume > 0;
      let guard = 0;
      while (tr.next < now + 0.3 && guard++ < 16) {
        tr.step(tr.next, aud);
        tr.next += tr.stepDur;
      }
    } catch (e) { /* музыка не должна ронять игру */ }
  }

  function fadeOutTrack(tr) {
    const t = ctx.currentTime;
    try {
      tr.out.gain.cancelScheduledValues(t);
      tr.out.gain.setValueAtTime(tr.out.gain.value, t);
      tr.out.gain.setTargetAtTime(0, t, 0.5);
    } catch (e) { /* нет */ }
    tr.cont.forEach(n => { try { n.stop(t + 3); } catch (e) { /* уже */ } });
    setTimeout(() => { try { tr.out.disconnect(); } catch (e) { /* уже */ } }, 3300);
  }

  function startMusic(name) {
    if (!ctx) return;
    if (name === curMusic && (name === null || curTrack)) return;
    ensureMusicBus();
    if (curTrack) fadeOutTrack(curTrack);
    curTrack = null;
    curMusic = name;
    api.musicTrack = name;
    if (name === 'menu' || name === 'arena') {
      const tr = name === 'menu' ? buildMenu() : buildArena();
      const t = ctx.currentTime;
      tr.out.gain.setValueAtTime(0, t);
      tr.out.gain.setTargetAtTime(tr.level, t, 1.0); // ~3 с до полной громкости
      curTrack = tr;
      if (!musicTimer) musicTimer = setInterval(musicTick, 100);
      musicTick();
    } else if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  // Скрытая вкладка: приглушаем и не планируем, при возвращении — продолжаем
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      try {
        if (!ctx || !musicPause) return;
        musicPause.gain.setTargetAtTime(document.hidden ? 0 : 1, ctx.currentTime, 0.3);
        if (!document.hidden && curTrack) { curTrack.next = ctx.currentTime + 0.05; musicTick(); }
      } catch (e) { /* молчим */ }
    });
  }

  // ------------------------------------------------------------
  //  Публичный интерфейс
  // ------------------------------------------------------------
  const api = {
    volume,
    muted,

    setVolume(v) {
      const x = +v;
      volume = cl(isFinite(x) ? x : volume, 0, 1);
      api.volume = volume;
      persist();
      applyMaster();
    },

    toggleMute() {
      muted = !muted;
      api.muted = muted;
      persist();
      applyMaster();
      return muted;
    },

    play,

    crowdStart(opts) {
      try {
        const size = cl(Math.round(+((opts || {}).size) || 0), 0, 3);
        if (!ready()) { pendingCrowd = { size }; return; }
        if (crowd && crowd.alive) {
          if (crowd.size === size) return;
          crowd.size = size;
          crowd.send.gain.setTargetAtTime(SIZE_WET[size], ctx.currentTime, 0.5);
          setExcite(crowd, crowd.excite, true);
          return;
        }
        startCrowd(size);
      } catch (e) { /* молчим */ }
    },

    crowdSet(excite) {
      try {
        lastExcite = cl(+excite || 0, 0, 1.6);
        if (crowd && crowd.alive && ctx) setExcite(crowd, lastExcite, false);
      } catch (e) { /* молчим */ }
    },

    crowdStop() {
      try {
        pendingCrowd = null;
        if (crowd && ctx) stopCrowd(crowd);
        crowd = null;
      } catch (e) { /* молчим */ }
    },

    // Музыка: 'menu' | 'arena' | null (затихание); смена — плавная, ~2 с
    musicVolume,
    musicMuted,
    musicTrack: null,

    music(track) {
      try {
        const name = track === 'menu' || track === 'arena' ? track : null;
        if (track != null && !name) return; // неизвестная тема — игнор
        if (!ready()) { pendingMusic = name; api.musicTrack = name; return; }
        startMusic(name);
      } catch (e) { /* молчим */ }
    },

    setMusicVolume(v) {
      const x = +v;
      musicVolume = cl(isFinite(x) ? x : musicVolume, 0, 1);
      api.musicVolume = musicVolume;
      persist();
      applyMusic();
    },

    toggleMusic() {
      musicMuted = !musicMuted;
      api.musicMuted = musicMuted;
      persist();
      applyMusic();
      return musicMuted;
    },
  };

  return api;
})();
