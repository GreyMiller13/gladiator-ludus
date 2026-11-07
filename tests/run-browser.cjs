// Run screen/interaction checks against the packaged site, without screenshots.
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const serveSite = require('./site-server.cjs');

(async () => {
  const server = await serveSite(path.resolve(__dirname, '../_site'));
  let failed = 0;
  try {
    await fs.mkdir('output/playwright', { recursive: true });
    const requested = process.argv.slice(2);
    const checks = (await fs.readdir(__dirname)).filter(f => f.startsWith('check-') && f.endsWith('.cjs') && f !== 'check-release.cjs' && (!requested.length || requested.includes(f))).sort();
    for (const name of checks) {
      console.log(`\n--- ${name} ---`);
      const env = { ...process.env, SITE_URL: server.url };
      delete env.COMBAT_REPORT_SHOTS; delete env.FINAL_SHOTS;
      const code = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(__dirname, name)], { stdio: 'inherit', env });
        child.on('error', reject); child.on('exit', resolve);
      });
      if (code !== 0) failed++;
    }
    console.log(`\nBrowser suites: ${checks.length - failed} passed, ${failed} failed`);
    process.exitCode = failed ? 1 : 0;
  } finally { await server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
