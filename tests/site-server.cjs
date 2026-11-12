const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');

module.exports = async function serveSite(root, { cacheImages = false } = {}) {
  root = path.resolve(root);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };
  const prefix = '/gladiator-ludus/';
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (!url.pathname.startsWith(prefix)) throw Error('Wrong prefix');
      const target = path.resolve(root, decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html');
      if (!target.startsWith(root + path.sep)) throw Error('Invalid path');
      const body = await fs.readFile(target);
      res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': cacheImages && /\.(jpg|png|webp)$/i.test(target) ? 'public, max-age=600' : 'no-store' });
      res.end(body);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}${prefix}`, close: () => new Promise(resolve => server.close(resolve)) };
};
