// Запуск тестов: node tests/run.js [фильтр]
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

const filter = process.argv[2] || '';
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
let pass = 0, fail = 0;
for (const f of files) {
  for (const t of require(path.join(__dirname, f))) {
    if (filter && !t.name.includes(filter) && !f.includes(filter)) continue;
    try {
      t.fn(loadGame());
      pass++;
      console.log(`PASS ${t.name}`);
    } catch (e) {
      fail++;
      console.log(`FAIL ${t.name}\n     ${String(e && e.message || e).split('\n').join('\n     ')}`);
    }
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
