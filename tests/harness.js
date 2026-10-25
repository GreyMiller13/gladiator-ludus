// Загрузка файлов игры в отдельный vm-контекст — как скрипты на странице
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const JS = path.join(__dirname, '..', 'js');
const DEFAULT_FILES = ['data', 'core', 'debt', 'story'];

function memoryStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    clear: () => m.clear(),
  };
}

function loadGame(files = DEFAULT_FILES) {
  const ctx = vm.createContext({ console, localStorage: memoryStorage(), sessionStorage: memoryStorage() });
  for (const f of files) {
    const file = path.join(JS, f + '.js');
    if (!fs.existsSync(file)) continue; // файл появится в одной из следующих задач
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  }
  return ctx;
}

const ev = (ctx, code) => vm.runInContext(code, ctx);

module.exports = { loadGame, ev, DEFAULT_FILES };
