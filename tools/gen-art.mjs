// Генерация графики по промптам из art-prompts/ через Gemini API.
//
//   $env:GEMINI_API_KEY = "ключ"                       (PowerShell; ключ — в Google AI Studio)
//   node tools/gen-art.mjs --dry                       план без запросов и расходов
//   node tools/gen-art.mjs --only ferox                только файлы, в пути которых есть «ferox»
//   node tools/gen-art.mjs                             всё, что ещё не сгенерировано
//
// Ключи: --only <часть пути> (можно несколько через запятую), --limit <N>, --model <id>,
//        --size 1K|2K|4K, --jobs <N> (параллельных запросов, по умолчанию 3), --force (перегенерировать).
// Картинки ложатся в art/ с теми же подпапками, что у промптов, под именем из строки «Сохранить как».
// Готовые файлы пропускаются — прерванный прогон можно просто запустить снова.
// Сначала делаются базовые картинки (без референса), потом правки — к ним прикладывается база.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'art-prompts');
const OUT = path.join(ROOT, 'art');
const API = 'https://generativelanguage.googleapis.com/v1beta/interactions';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const flag = name => args.includes(`--${name}`);
const MODEL = opt('model', 'gemini-nano-banana-2.1');
const SIZE = opt('size', '1K');
const JOBS = +opt('jobs', 3);
const LIMIT = +opt('limit', Infinity);
const ONLY = (opt('only', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const DRY = flag('dry'), FORCE = flag('force');
const KEY = process.env.GEMINI_API_KEY;

// ---------- разбор файлов с промптами ----------
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith('.md') ? [p] : [];
  });
}
function parse(file) {
  const md = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const save = (md.match(/\*\*Сохранить как:\*\* `([^`]+)`/) || [])[1];
  const prompt = (md.match(/```text\n([\s\S]*?)\n```/) || [])[1];
  if (!save || !prompt) return null;
  const format = (md.match(/\*\*Формат:\*\* (.*)/) || [])[1] || '';
  const refLine = (md.match(/\*\*Референс:\*\* (.*)/) || [])[1] || '';
  // обязательный референс — «приложите `файл`»; «по желанию» пропускаем
  const ref = /^приложите `([^`]+)`/.exec(refLine);
  const aspect = (format.match(/\b(21:9|16:9|4:3|3:4|1:1)\b/) || [])[1] || '1:1';
  const rel = path.relative(SRC, path.dirname(file));
  return { file: path.relative(ROOT, file), dir: rel, save, prompt: prompt.trim(), aspect, ref: ref ? ref[1] : null, out: path.join(OUT, rel, save) };
}

// ---------- запрос к Gemini ----------
// Ищем в ответе последнюю картинку: { type: 'image', data: <base64>, mime_type }
function findImage(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (Array.isArray(node)) { node.forEach(n => findImage(n, found)); return found; }
  if (typeof node.data === 'string' && node.data.length > 1000 && (node.type === 'image' || /^image\//.test(node.mime_type || node.mimeType || ''))) found.push(node);
  if (node.inline_data || node.inlineData) findImage(node.inline_data || node.inlineData, found);
  for (const [k, v] of Object.entries(node)) if (k !== 'data' && typeof v === 'object') findImage(v, found);
  return found;
}
async function generate(job) {
  const input = [{ type: 'text', text: job.prompt }];
  if (job.ref) {
    const refPath = path.join(OUT, job.dir, job.ref);
    input.push({ type: 'image', mime_type: refPath.endsWith('.jpg') ? 'image/jpeg' : 'image/png', data: fs.readFileSync(refPath).toString('base64') });
  }
  const body = { model: MODEL, input, response_format: { type: 'image', aspect_ratio: job.aspect, image_size: SIZE } };
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(body) });
    const text = await res.text();
    if (res.ok) {
      let json; try { json = JSON.parse(text); } catch { throw new Error(`ответ не JSON: ${text.slice(0, 200)}`); }
      const img = findImage(json).pop();
      if (!img) {
        fs.mkdirSync(path.join(OUT, '_errors'), { recursive: true });
        fs.writeFileSync(path.join(OUT, '_errors', job.save + '.json'), text);
        throw new Error('в ответе нет картинки (ответ сохранён в art/_errors)');
      }
      return { buf: Buffer.from(img.data, 'base64'), mime: img.mime_type || img.mimeType || 'image/png' };
    }
    // перегрузка и лимиты — ждём и пробуем снова; остальное — ошибка сразу
    if ((res.status === 429 || res.status >= 500) && attempt < 4) { await new Promise(r => setTimeout(r, 5000 * attempt * attempt)); continue; }
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
}
// PNG и JPEG различаем по первым байтам: если пришёл JPEG, сохраняем с расширением .jpg
const isJpeg = buf => buf[0] === 0xff && buf[1] === 0xd8;
const existing = job => [job.out, job.out.replace(/\.png$/, '.jpg')].find(p => fs.existsSync(p));

// ---------- план и запуск ----------
const all = walk(SRC).map(parse).filter(Boolean)
  .filter(j => !ONLY.length || ONLY.some(s => j.file.replace(/\\/g, '/').includes(s)));
const todo = all.filter(j => FORCE || !existing(j)).slice(0, LIMIT);
const base = todo.filter(j => !j.ref), edits = todo.filter(j => j.ref);
console.log(`Промптов: ${all.length}, сделать: ${todo.length} (базовых ${base.length}, правок ${edits.length}). Модель ${MODEL}, ${SIZE}.`);
if (DRY) { for (const j of todo) console.log(`  ${j.ref ? '↳' : '•'} ${path.relative(ROOT, j.out)}  [${j.aspect}]${j.ref ? `  ← ${j.ref}` : ''}`); process.exit(0); }
if (!KEY) { console.error('Нет ключа: задайте переменную окружения GEMINI_API_KEY (см. начало файла).'); process.exit(1); }

let done = 0, failed = 0;
async function run(list) {
  const queue = list.slice();
  const worker = async () => {
    while (queue.length) {
      const job = queue.shift();
      if (job.ref && !fs.existsSync(path.join(OUT, job.dir, job.ref)) && !fs.existsSync(path.join(OUT, job.dir, job.ref.replace(/\.png$/, '.jpg')))) {
        failed++; console.log(`✗ ${job.save}: нет референса ${job.ref} — сначала нужна базовая картинка`); continue;
      }
      if (job.ref && !fs.existsSync(path.join(OUT, job.dir, job.ref))) job.ref = job.ref.replace(/\.png$/, '.jpg');
      try {
        const { buf } = await generate(job);
        const out = isJpeg(buf) ? job.out.replace(/\.png$/, '.jpg') : job.out;
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, buf);
        done++; console.log(`✓ [${done + failed}/${todo.length}] ${path.relative(ROOT, out)}`);
      } catch (e) { failed++; console.log(`✗ ${job.save}: ${e.message}`); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, JOBS) }, worker));
}
await run(base);
await run(edits);
console.log(`Готово: ${done}, с ошибками: ${failed}.${failed ? ' Запустите ещё раз — сделанное пропустится.' : ''}`);
