// ============================================================
//  Покадровые клипы анимации (30 кадров/с)
//  Каждый клип — набор ключевых поз с номерами кадров и сглаживанием.
//  e: 'io' — плавно, 'i' — разгон, 'o' — торможение, 'l' — линейно, 'h' — удержание.
//  impact — кадр попадания, smear — диапазон кадров со «смазом» клинка.
// ============================================================

const CLIP_FPS = 30;

// Ключевые позы-состояния
const FALLEN = { r: -1.5, lean: 0.05, chest: 0.05, head: -0.3, nU: 0.4, nK: 0.55, nF: 0.6, fU: 0.08, fK: 0.25, fF: 0.4, nA: 2.4, nE: 0.4, fA: 2.75, fE: 0.5, dx: 0, dy: 0 };
const KNEEL = { r: 0, lean: 0.3, chest: 0.22, head: 0.55, nU: 1.45, nK: 1.55, nF: 0, fU: 0.12, fK: 1.75, fF: -1.2, nA: 0.12, nE: 0.25, fA: 0.05, fE: 0.3, dx: 0, dy: 0 };
const GUARD = { nK: 0.7, fK: 0.66, lean: 0.18, chest: 0.1, nA: 0.95, nE: 0.8, fA: 0.2, fE: 1.25, head: 0.1 };

const CLIPS = {
  // --- циклы ---
  idle: { len: 40, loop: true, keys: [
    { f: 20, e: 'io', p: { nK: '+0.08', fK: '+0.08', lean: '+0.02', chest: '+0.02', fA: '+0.06', nA: '+0.04', head: '+0.03', fW: '+0.05' } },
    { f: 40, e: 'io', p: {} },
  ] },
  guard: { len: 40, loop: true, keys: [
    { f: 0, p: GUARD },
    { f: 20, e: 'io', p: { ...GUARD, nK: 0.78, fK: 0.74, lean: 0.2 } },
    { f: 40, e: 'io', p: GUARD },
  ] },
  run: { len: 20, loop: true, keys: [
    { f: 0, p: { nU: 0.72, nK: 0.15, nF: 0.25, fU: -0.55, fK: 0.55, fF: -0.5, lean: 0.2, chest: 0.06 } },
    { f: 3, e: 'o', p: { nU: 0.45, nK: 0.5, nF: 0, fU: -0.3, fK: 1.25, fF: -0.4, lean: 0.22 } },
    { f: 6, e: 'io', p: { nU: 0.0, nK: 0.3, nF: 0, fU: 0.2, fK: 1.65, fF: -0.2, lean: 0.22 } },
    { f: 8, e: 'io', p: { nU: -0.35, nK: 0.2, nF: -0.6, fU: 0.65, fK: 0.9, fF: 0, lean: 0.2 } },
    { f: 10, e: 'i', p: { nU: -0.55, nK: 0.55, nF: -0.5, fU: 0.72, fK: 0.15, fF: 0.25, lean: 0.2 } },
    { f: 13, e: 'o', p: { nU: -0.3, nK: 1.25, nF: -0.4, fU: 0.45, fK: 0.5, fF: 0, lean: 0.22 } },
    { f: 16, e: 'io', p: { nU: 0.2, nK: 1.65, nF: -0.2, fU: 0.0, fK: 0.3, fF: 0, lean: 0.22 } },
    { f: 18, e: 'io', p: { nU: 0.65, nK: 0.9, nF: 0, fU: -0.35, fK: 0.2, fF: -0.6, lean: 0.2 } },
    { f: 20, e: 'i', p: { nU: 0.72, nK: 0.15, nF: 0.25, fU: -0.55, fK: 0.55, fF: -0.5, lean: 0.2, chest: 0.06 } },
  ] },
  stagger: { len: 32, loop: true, keys: [
    { f: 0, p: { head: 0.42, fA: 0.1, nA: 0.3, nK: 0.5 } },
    { f: 8, e: 'io', p: { lean: -0.22, chest: -0.1, head: 0.55, dx: -5, fA: 0.0, nA: 0.25, nK: 0.55 } },
    { f: 16, e: 'io', p: { lean: 0.2, chest: 0.15, head: 0.3, dx: 3, fA: 0.15, nA: 0.35, nK: 0.45 } },
    { f: 24, e: 'io', p: { lean: -0.1, head: 0.5, dx: -2, fA: 0.05, nK: 0.55 } },
    { f: 32, e: 'io', p: { head: 0.42, fA: 0.1, nA: 0.3, nK: 0.5 } },
  ] },
  struggle: { len: 24, loop: true, keys: [
    { f: 0, p: { nA: 0.3, nE: 1.4, fA: 0.2, fE: 1.4, lean: 0.12, head: 0.3, nK: 0.6 } },
    { f: 6, e: 'io', p: { nA: 0.95, nE: 0.6, fA: 0.7, fE: 0.6, lean: -0.08, head: 0.1, dx: -3 } },
    { f: 12, e: 'io', p: { nA: 0.2, nE: 1.6, fA: 0.3, fE: 1.2, lean: 0.18, head: 0.4, nK: 0.7 } },
    { f: 18, e: 'io', p: { nA: 0.8, nE: 0.8, fA: 0.85, fE: 0.5, lean: -0.05, head: 0.15, dx: 3 } },
    { f: 24, e: 'io', p: { nA: 0.3, nE: 1.4, fA: 0.2, fE: 1.4, lean: 0.12, head: 0.3, nK: 0.6 } },
  ] },
  lie: { len: 60, loop: true, base: FALLEN, keys: [
    { f: 30, e: 'io', p: { chest: 0.1, head: -0.26 } },
    { f: 60, e: 'io', p: {} },
  ] },
  kneel: { len: 60, loop: true, base: KNEEL, keys: [
    { f: 30, e: 'io', p: { lean: 0.33, chest: 0.26, head: 0.6 } },
    { f: 60, e: 'io', p: {} },
  ] },

  // --- атаки ---
  swing: { len: 18, impact: 9, smear: [7, 10], keys: [
    { f: 4, e: 'io', p: { lean: -0.08, chest: -0.12, fA: 2.5, fE: 0.9, fW: -0.3, grip: 0.9, nA: 0.75, nK: 0.5, fK: 0.5 } },
    { f: 6, e: 'o', p: { lean: -0.06, chest: -0.18, head: -0.05, fA: 2.95, fE: 0.5, fW: -0.5, grip: 0.9, nA: 0.75, nK: 0.5, fK: 0.5 } },
    { f: 8, e: 'i', p: { fA: 1.6, fE: 0.2, fW: 0.2, grip: 0.4, lean: 0.2, chest: 0.15, nU: 0.85, nK: 0.55, fU: -0.6, dx: 10, nA: 0.25, nE: 0.7 } },
    { f: 9, e: 'o', p: { fA: 0.75, fE: 0.15, fW: 0.35, grip: 0.1, lean: 0.32, chest: 0.25, nU: 0.95, nK: 0.62, fU: -0.7, fK: 0.3, dx: 16, head: 0.12, nA: 0.15, nE: 0.6 } },
    { f: 12, e: 'o', p: { fA: 0.45, fE: 0.35, fW: 0.5, grip: 0.1, lean: 0.34, chest: 0.28, nU: 0.95, nK: 0.62, fU: -0.7, fK: 0.3, dx: 16, head: 0.12, nA: 0.15, nE: 0.6 } },
    { f: 18, e: 'io', p: {} },
  ] },
  thrust: { len: 16, impact: 8, smear: [7, 9], keys: [
    { f: 4, e: 'io', p: { fA: -0.15, fE: 1.95, fW: 0, grip: 0, lean: -0.06, chest: -0.1, nA: 0.9, nE: 0.9, nK: 0.45, fK: 0.5, dx: -4 } },
    { f: 6, e: 'o', p: { fA: -0.2, fE: 2.05, fW: 0, grip: 0, lean: -0.08, chest: -0.12, nA: 0.9, nE: 0.9, nK: 0.48, fK: 0.52, dx: -5 } },
    { f: 8, e: 'i', p: { fA: 1.45, fE: 0.06, fW: 0.05, grip: 0.05, lean: 0.3, chest: 0.2, nU: 1.0, nK: 0.65, fU: -0.75, fK: 0.2, dx: 18, nA: 0.15, nE: 0.7 } },
    { f: 10, e: 'o', p: { fA: 1.4, fE: 0.1, fW: 0.05, grip: 0.05, lean: 0.3, chest: 0.2, nU: 1.0, nK: 0.65, fU: -0.75, fK: 0.2, dx: 18, nA: 0.15, nE: 0.7 } },
    { f: 16, e: 'io', p: {} },
  ] },
  slash: { len: 18, impact: 9, smear: [7, 10], keys: [
    { f: 4, e: 'io', p: { fA: 2.4, fE: 1.1, fW: -0.4, grip: 1.0, lean: 0.05, chest: -0.15, nK: 0.5 } },
    { f: 6, e: 'o', p: { fA: 2.7, fE: 0.8, fW: -0.4, grip: 1.0, lean: 0.02, chest: -0.18, nK: 0.52 } },
    { f: 9, e: 'i', p: { fA: 0.3, fE: 0.45, fW: 0.3, grip: -0.5, lean: 0.45, chest: 0.3, nU: 1.15, nK: 0.95, fU: -0.75, fK: 0.55, dx: 20, nA: 0.2, nE: 0.6 } },
    { f: 12, e: 'o', p: { fA: 0.0, fE: 0.5, fW: 0.3, grip: -0.7, lean: 0.42, chest: 0.3, nU: 1.15, nK: 0.95, fU: -0.75, fK: 0.55, dx: 20, nA: 0.2, nE: 0.6 } },
    { f: 18, e: 'io', p: {} },
  ] },
  heavy: { len: 26, impact: 16, smear: [14, 17], keys: [
    { f: 5, e: 'io', p: { nK: 0.95, fK: 0.95, lean: 0.12, chest: -0.1, fA: 2.2, fE: 1.0, nA: 0.7 } },
    { f: 9, e: 'o', p: { dy: 40, dx: 14, nU: 0.9, nK: 1.4, fU: 0.1, fK: 1.2, fA: 3.05, fE: 0.35, fW: -0.6, grip: 0.6, chest: -0.2, lean: -0.05, nA: 0.9 } },
    { f: 12, e: 'io', p: { dy: 46, dx: 24, nU: 0.8, nK: 1.3, fU: 0.0, fK: 1.1, fA: 3.1, fE: 0.3, fW: -0.6, grip: 0.6, chest: -0.22, lean: -0.05, nA: 0.9 } },
    { f: 15, e: 'i', p: { dy: 10, dx: 34, fA: 1.2, fE: 0.15, fW: 0.2, grip: 0.2, chest: 0.3, lean: 0.35, nU: 1.0, nK: 0.8, fU: -0.5, fK: 0.6, nA: 0.3, nE: 0.7 } },
    { f: 16, e: 'o', p: { dy: 0, dx: 36, fA: 0.6, fE: 0.1, fW: 0.3, grip: 0, lean: 0.5, chest: 0.35, nU: 1.1, nK: 0.95, fU: -0.75, fK: 0.5, nA: 0.2, nE: 0.6 } },
    { f: 20, e: 'o', p: { dx: 36, fA: 0.55, fE: 0.12, fW: 0.3, lean: 0.48, chest: 0.34, nU: 1.1, nK: 0.9, fU: -0.75, fK: 0.5, nA: 0.2, nE: 0.6 } },
    { f: 26, e: 'io', p: {} },
  ] },
  bash: { len: 16, impact: 8, keys: [
    { f: 4, e: 'io', p: { nA: 0.05, nE: 1.75, lean: -0.12, chest: -0.1, dx: -8, nK: 0.5 } },
    { f: 8, e: 'i', p: { nA: 1.55, nE: 0.05, lean: 0.42, chest: 0.2, nU: 1.0, nK: 0.6, fU: -0.8, dx: 22, fA: 0.1 } },
    { f: 10, e: 'o', p: { nA: 1.5, nE: 0.08, lean: 0.4, chest: 0.2, nU: 1.0, nK: 0.6, fU: -0.8, dx: 22, fA: 0.1 } },
    { f: 16, e: 'io', p: {} },
  ] },
  offhand: { len: 12, impact: 6, smearN: [5, 7], keys: [
    { f: 3, e: 'io', p: { nA: 0.1, nE: 1.9, chest: -0.08 } },
    { f: 6, e: 'i', p: { nA: 1.5, nE: 0.08, nGrip: 0, lean: 0.32, chest: 0.2, nU: 0.9, nK: 0.5, dx: 12 } },
    { f: 12, e: 'io', p: {} },
  ] },
  spin: { len: 20, impact: 10, smear: [3, 17], smearN: [3, 17], keys: [
    { f: 3, e: 'o', p: { sx: 0.2, fA: 1.65, fE: 0.05, nA: 1.6, nE: 0.05, grip: 0, nGrip: 0, lean: 0.12, nU: 0.7, fU: -0.5 } },
    { f: 7, e: 'l', p: { sx: -1, fA: 1.65, fE: 0.05, nA: 1.6, nE: 0.05, grip: 0, nGrip: 0, lean: 0.12, nU: 0.7, fU: -0.5 } },
    { f: 11, e: 'l', p: { sx: 1, fA: 1.65, fE: 0.05, nA: 1.6, nE: 0.05, grip: 0, nGrip: 0, lean: 0.12, nU: 0.7, fU: -0.5 } },
    { f: 15, e: 'l', p: { sx: -1, fA: 1.65, fE: 0.05, nA: 1.6, nE: 0.05, grip: 0, nGrip: 0, lean: 0.12, nU: 0.7, fU: -0.5 } },
    { f: 18, e: 'l', p: { sx: 1, fA: 1.4, fE: 0.4, nA: 1.3, nE: 0.4, lean: 0.1 } },
    { f: 20, e: 'io', p: {} },
  ] },
  throw: { len: 20, impact: 10, keys: [
    { f: 6, e: 'io', p: { nA: -1.0, nE: 0.5, lean: -0.18, chest: -0.15, fU: -0.55, nK: 0.5 } },
    { f: 10, e: 'i', p: { nA: 2.3, nE: 0.2, lean: 0.3, chest: 0.2, nU: 0.95, nK: 0.45, dx: 8 } },
    { f: 13, e: 'o', p: { nA: 2.0, nE: 0.3, lean: 0.25, chest: 0.15, nU: 0.95, nK: 0.45, dx: 8 } },
    { f: 20, e: 'io', p: {} },
  ] },
  execute: { len: 30, impact: 17, smear: [15, 18], keys: [
    { f: 8, e: 'io', p: { fA: 2.9, fE: 0.5, fW: -0.4, grip: -3.0, lean: -0.06, chest: -0.12, head: -0.1 } },
    { f: 13, e: 'io', p: { fA: 2.95, fE: 0.45, fW: -0.45, grip: -3.0, lean: -0.08, chest: -0.14, head: -0.12 } },
    { f: 17, e: 'i', p: { fA: 1.2, fE: 0.05, fW: 0.1, grip: -0.8, lean: 0.45, chest: 0.3, nU: 0.95, nK: 0.65, fU: -0.6, head: 0.3, nA: 0.25, nE: 0.6 } },
    { f: 22, e: 'o', p: { fA: 1.15, fE: 0.08, fW: 0.1, grip: -0.8, lean: 0.45, chest: 0.3, nU: 0.95, nK: 0.65, fU: -0.6, head: 0.3, nA: 0.25, nE: 0.6 } },
    { f: 30, e: 'io', p: {} },
  ] },
  // Выстрел из лука: подъём, натяжение до уха, спуск и выход
  shoot: { len: 30, impact: 17, keys: [
    { f: 6, e: 'io', p: { nA: 1.45, nE: 0.1, nW: -0.05, draw: 0.15, lean: 0.0, chest: 0.0, head: 0.08, nU: 0.5, fU: -0.4 } },
    { f: 13, e: 'o', p: { nA: 1.52, nE: 0.04, nW: -0.05, draw: 1, lean: -0.04, chest: -0.06, head: 0.12, nU: 0.52, fU: -0.42 } },
    { f: 16, e: 'io', p: { nA: 1.52, nE: 0.04, nW: -0.05, draw: 1, lean: -0.04, chest: -0.06, head: 0.12, nU: 0.52, fU: -0.42 } },
    { f: 17, e: 'l', p: { nA: 1.5, nE: 0.05, nW: -0.05, draw: 0, fA: -0.55, fE: 1.95, lean: -0.05, chest: -0.07, head: 0.12, nU: 0.52, fU: -0.42 } },
    { f: 22, e: 'o', p: { nA: 1.45, nE: 0.08, draw: 0, fA: -0.7, fE: 1.7, lean: -0.04, chest: -0.05, head: 0.1, nU: 0.52, fU: -0.42 } },
    { f: 30, e: 'io', p: {} },
  ] },
  aimed: { len: 46, impact: 33, keys: [
    { f: 8, e: 'io', p: { nA: 1.45, nE: 0.1, draw: 0.15, head: 0.08, nU: 0.55, fU: -0.45, nK: 0.45, fK: 0.5 } },
    { f: 18, e: 'o', p: { nA: 1.55, nE: 0.03, draw: 1, lean: -0.06, chest: -0.08, head: 0.14, nU: 0.56, fU: -0.46, nK: 0.5, fK: 0.55 } },
    { f: 26, e: 'io', p: { nA: 1.56, nE: 0.03, draw: 1, lean: -0.07, chest: -0.09, head: 0.15, nU: 0.56, fU: -0.46, nK: 0.52, fK: 0.56 } },
    { f: 32, e: 'io', p: { nA: 1.55, nE: 0.03, draw: 1, lean: -0.07, chest: -0.09, head: 0.15, nU: 0.56, fU: -0.46, nK: 0.52, fK: 0.56 } },
    { f: 33, e: 'l', p: { nA: 1.52, nE: 0.05, draw: 0, fA: -0.6, fE: 2.0, lean: -0.08, chest: -0.1, head: 0.14, nU: 0.56, fU: -0.46 } },
    { f: 38, e: 'o', p: { nA: 1.46, nE: 0.08, draw: 0, fA: -0.75, fE: 1.7, lean: -0.06, head: 0.1, nU: 0.56, fU: -0.46 } },
    { f: 46, e: 'io', p: {} },
  ] },
  // Двуручный удар с плеча
  cleave: { len: 28, impact: 15, smear: [12, 16], keys: [
    { f: 6, e: 'io', p: { fA: 2.85, fE: 0.65, fW: -0.35, grip: 0.9, lean: -0.1, chest: -0.2, head: -0.08, nK: 0.5, fK: 0.55, dx: -4 } },
    { f: 11, e: 'o', p: { fA: 3.15, fE: 0.45, fW: -0.45, grip: 0.95, lean: -0.14, chest: -0.24, head: -0.1, nK: 0.55, fK: 0.6, dx: -6 } },
    { f: 14, e: 'i', p: { fA: 1.5, fE: 0.15, fW: 0.1, grip: 0.4, lean: 0.4, chest: 0.3, head: 0.18, nU: 0.95, nK: 0.7, fU: -0.7, fK: 0.4, dx: 18 } },
    { f: 15, e: 'o', p: { fA: 0.75, fE: 0.15, fW: 0.25, grip: 0.15, lean: 0.55, chest: 0.36, head: 0.22, nU: 1.05, nK: 0.85, fU: -0.75, fK: 0.45, dx: 26 } },
    { f: 20, e: 'o', p: { fA: 0.6, fE: 0.2, fW: 0.3, grip: 0.1, lean: 0.52, chest: 0.34, head: 0.2, nU: 1.05, nK: 0.85, fU: -0.75, fK: 0.45, dx: 26 } },
    { f: 28, e: 'io', p: {} },
  ] },
  // Глубокий выпад копьём
  lunge: { len: 22, impact: 11, smear: [10, 12], keys: [
    { f: 5, e: 'io', p: { fA: -0.1, fE: 1.9, grip: 0.2, lean: -0.08, chest: -0.1, nA: 0.8, nE: 0.95, nK: 0.5, fK: 0.55, dx: -6 } },
    { f: 8, e: 'o', p: { fA: -0.15, fE: 2.0, grip: 0.2, lean: -0.1, chest: -0.12, nA: 0.8, nE: 0.95, nK: 0.52, fK: 0.58, dx: -8 } },
    { f: 11, e: 'i', p: { fA: 1.5, fE: 0.05, grip: 0.1, lean: 0.42, chest: 0.24, head: 0.12, nU: 1.2, nK: 0.95, fU: -0.85, fK: 0.2, dx: 30, nA: 0.9, nE: 0.9 } },
    { f: 15, e: 'o', p: { fA: 1.45, fE: 0.08, grip: 0.1, lean: 0.4, chest: 0.24, head: 0.12, nU: 1.2, nK: 0.95, fU: -0.85, fK: 0.2, dx: 30, nA: 0.9, nE: 0.9 } },
    { f: 22, e: 'io', p: {} },
  ] },
  salute: { len: 44, keys: [
    { f: 12, e: 'io', p: { fA: 2.95, fE: 0.2, fW: 0, grip: 0, head: -0.25, chest: -0.12, lean: -0.04, nK: 0.2, fK: 0.25 } },
    { f: 30, e: 'io', p: { fA: 3.0, fE: 0.15, fW: 0, grip: 0, head: -0.3, chest: -0.14, lean: -0.05, nK: 0.2, fK: 0.25 } },
    { f: 44, e: 'io', p: {} },
  ] },

  // --- реакции ---
  hit: { len: 12, keys: [
    { f: 3, e: 'o', p: { lean: -0.3, chest: -0.25, head: -0.4, dx: -12, fA: 0.05, nA: 0.4, nK: 0.5 } },
    { f: 12, e: 'io', p: {} },
  ] },
  hitHard: { len: 18, keys: [
    { f: 3, e: 'o', p: { lean: -0.5, chest: -0.35, head: -0.6, dx: -24, fA: -0.3, nA: 0.2, nK: 0.6, fK: 0.7 } },
    { f: 7, e: 'io', p: { lean: -0.45, chest: -0.3, head: -0.5, dx: -27, fA: -0.25, nA: 0.25, nK: 0.65, fK: 0.75 } },
    { f: 18, e: 'io', p: {} },
  ] },
  // Блок щитом: щит навстречу удару, корпус подаётся В щит, колени гасят толчок
  block: { len: 18, keys: [
    { f: 2, e: 'o', p: { nA: 1.05, nE: 0.85, lean: 0.16, chest: 0.12, head: 0.22, nK: 0.55, fK: 0.6, fU: -0.42, fA: 0.15, fE: 1.4 } },
    { f: 4, e: 'o', p: { nA: 1.0, nE: 0.95, lean: 0.06, chest: 0.06, head: 0.2, dx: -9, nK: 0.62, fK: 0.72, fU: -0.46, fA: 0.12, fE: 1.45 } },
    { f: 8, e: 'io', p: { nA: 1.0, nE: 0.92, lean: 0.12, chest: 0.1, head: 0.2, dx: -8, nK: 0.58, fK: 0.66, fU: -0.44, fA: 0.15, fE: 1.4 } },
    { f: 18, e: 'io', p: {} },
  ] },
  // Парирование клинком: оружие поперёк линии удара, затем отвод в сторону
  parry: { len: 18, keys: [
    { f: 3, e: 'o', p: { fA: 1.55, fE: 1.25, fW: 0.2, grip: 1.25, lean: 0.02, chest: -0.04, head: 0.08, nK: 0.5, nA: 0.35, nE: 1.3 } },
    { f: 5, e: 'o', p: { fA: 1.35, fE: 0.8, fW: 0.35, grip: 0.65, lean: -0.06, chest: -0.08, dx: -7, nK: 0.55, fK: 0.55, nA: 0.35, nE: 1.3 } },
    { f: 9, e: 'io', p: { fA: 1.2, fE: 0.75, fW: 0.35, grip: 0.55, lean: -0.03, chest: -0.05, dx: -6, nK: 0.52, nA: 0.4, nE: 1.25 } },
    { f: 18, e: 'io', p: {} },
  ] },
  // Уклонение назад: вес на заднюю ногу, корпус отклоняется, передняя нога остаётся на месте
  dodge: { len: 20, keys: [
    { f: 3, e: 'o', p: { dx: -10, lean: -0.2, chest: -0.16, head: -0.2, nU: 0.56, nK: 0.24, fU: -0.3, fK: 0.62, fA: 0.05, fE: 1.4, nA: 0.75, nE: 0.9 } },
    { f: 6, e: 'o', p: { dx: -16, lean: -0.28, chest: -0.2, head: -0.26, nU: 0.62, nK: 0.2, fU: -0.28, fK: 0.72, fA: 0.0, fE: 1.45, nA: 0.8, nE: 0.85 } },
    { f: 10, e: 'io', p: { dx: -14, lean: -0.2, chest: -0.14, head: -0.16, nU: 0.6, nK: 0.24, fU: -0.3, fK: 0.66, fA: 0.05, fE: 1.4, nA: 0.75, nE: 0.9 } },
    { f: 20, e: 'io', p: {} },
  ] },
  // Нырок под удар: присед, голова уходит вниз
  dodgeDuck: { len: 20, keys: [
    { f: 3, e: 'o', p: { lean: 0.3, chest: 0.2, head: 0.3, nK: 0.62, fK: 0.7, nU: 0.55, fU: -0.3, dx: -4, fA: 0.25, fE: 1.55, nA: 0.9, nE: 1.0 } },
    { f: 6, e: 'o', p: { lean: 0.4, chest: 0.26, head: 0.36, nK: 0.78, fK: 0.86, nU: 0.62, fU: -0.28, dx: -6, fA: 0.2, fE: 1.6, nA: 1.0, nE: 0.95 } },
    { f: 10, e: 'io', p: { lean: 0.34, chest: 0.22, head: 0.3, nK: 0.7, fK: 0.78, nU: 0.58, fU: -0.29, dx: -5, fA: 0.25, fE: 1.55, nA: 0.95, nE: 1.0 } },
    { f: 20, e: 'io', p: {} },
  ] },
  // Заслон гопломаха: копьё вперёд, щит у плеча
  brace: { len: 16, keys: [
    { f: 8, e: 'io', p: { fA: 1.0, fE: 0.55, grip: 0.4, nA: 0.9, nE: 0.95, lean: 0.14, nU: 0.62, nK: 0.55, fU: -0.5, fK: 0.55, head: 0.12 } },
    { f: 16, e: 'io', p: {} },
  ] },

  // --- переходы между состояниями ---
  fall: { len: 26, end: FALLEN, keys: [
    { f: 5, e: 'o', p: { nK: 0.95, fK: 1.0, lean: 0.25, chest: 0.2, head: 0.4, fA: 0.3, nA: 0.3 } },
    { f: 12, e: 'i', p: { r: -0.6, lean: -0.2, chest: -0.1, head: -0.3, nK: 0.6, fK: 0.5, nA: 1.2, fA: 1.4 } },
    { f: 20, e: 'i', p: FALLEN },
    { f: 23, e: 'o', p: { ...FALLEN, r: -1.4, head: -0.15 } },
    { f: 26, e: 'io', p: FALLEN },
  ] },
  kneelUp: { len: 34, start: FALLEN, end: KNEEL, keys: [
    { f: 0, p: FALLEN },
    { f: 10, e: 'io', p: { r: -0.9, lean: 0.6, chest: 0.3, head: 0.2, nU: 1.3, nK: 1.7, fU: 0.9, fK: 1.8, nA: 0.4, nE: 0.5, fA: 0.2, fE: 0.5 } },
    { f: 22, e: 'io', p: { ...KNEEL, lean: 0.6, chest: 0.3, head: 0.4 } },
    { f: 34, e: 'io', p: KNEEL },
  ] },
  toKneel: { len: 22, end: KNEEL, keys: [
    { f: 10, e: 'io', p: { nK: 1.0, fK: 1.1, lean: 0.3, chest: 0.2, head: 0.3, nA: 0.3, fA: 0.2 } },
    { f: 22, e: 'io', p: KNEEL },
  ] },
  rise: { len: 26, start: KNEEL, keys: [
    { f: 0, p: KNEEL },
    { f: 12, e: 'io', p: { lean: 0.5, chest: 0.3, nU: 1.0, nK: 1.0, fU: -0.1, fK: 0.8, head: 0.25, nA: 0.3, fA: 0.2 } },
    { f: 26, e: 'io', p: {} },
  ] },
  fallFromKneel: { len: 24, start: KNEEL, end: FALLEN, keys: [
    { f: 0, p: KNEEL },
    { f: 6, e: 'o', p: { ...KNEEL, lean: -0.2, chest: -0.3, head: -0.6, nA: 0.8, fA: 0.9 } },
    { f: 16, e: 'i', p: { ...FALLEN, r: -1.3 } },
    { f: 20, e: 'o', p: { ...FALLEN, r: -1.42, head: -0.15 } },
    { f: 24, e: 'io', p: FALLEN },
  ] },
};

const EASE = {
  io: t => t * t * (3 - 2 * t),
  i: t => t * t,
  o: t => 1 - (1 - t) * (1 - t),
  l: t => t,
  h: () => 0,
};

// Поза клипа на кадре frame (дробный кадр допускается для плавности)
function sampleClip(name, frame, base) {
  const clip = CLIPS[name];
  const b = clip.base ? { ...base, ...clip.base } : base;
  const keys = clip.keys;
  const val = (key, k) => {
    if (!key) return b[k];
    const v = key.p[k];
    if (v === undefined) return b[k];
    if (typeof v === 'string') return b[k] + parseFloat(v);
    return v;
  };
  const K = keys[0].f === 0 ? keys : [{ f: 0, p: clip.start || {} }, ...keys];
  let a = K[K.length - 1], z = a;
  for (let i = 0; i < K.length - 1; i++) {
    if (frame < K[i + 1].f) { a = K[i]; z = K[i + 1]; break; }
  }
  const span = Math.max(1e-6, z.f - a.f);
  const t = clamp((frame - a.f) / span, 0, 1);
  const e = (EASE[z.e || 'io'] || EASE.io)(t);
  const out = { ...b };
  const ks = new Set([...Object.keys(a.p), ...Object.keys(z.p)]);
  for (const k of ks) {
    const v0 = val(a, k), v1 = val(z, k);
    out[k] = v0 + (v1 - v0) * e;
  }
  return out;
}

function lerpPose(a, b, t) {
  const out = { ...b };
  for (const k in b) if (typeof a[k] === 'number') out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

const inRange = (r, f) => r && f >= r[0] && f <= r[1];
