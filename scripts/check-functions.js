'use strict';
// Usage: node scripts/check-functions.js  -> for each legacy app, lists public C# methods and whether the name appears in src/**/*.js
const fs = require('fs'), path = require('path');
const ROOT = 'C:/Users/MY ASUS/cluster';
const APPS = ['ClusterOfferAPI','Franchise','Member','MLM_Adminpanel','Payment Gateway','Shoping Portal Merchant Panel','ClusterofferShopingPortal'];
const skip = /[\/](obj|bin|packages|\.git|\.vs|node_modules)[\/]/;
function walk(d, ext, out = []) { let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return out; }
  for (const e of es) { const p = path.join(d, e.name); if (skip.test(p + '/')) continue; e.isDirectory() ? walk(p, ext, out) : e.name.endsWith(ext) && out.push(p); } return out; }
const js = walk('src', '.js').map(f => fs.readFileSync(f, 'utf8')).join('\n').toLowerCase();
const re = /public\s+(?:static\s+|async\s+|virtual\s+|override\s+)*[\w<>\[\],.? ]+?\s+(\w+)\s*\(([^)]*)\)\s*(?:\r?\n\s*)?\{/g;
const ignore = new Set(['if','for','while','switch','using','lock','catch','get','set']);
const rows = [];
for (const app of APPS) {
  const files = walk(path.join(ROOT, app), '.cs').filter(f => !/(\.designer|AssemblyInfo|Reference)\.cs$/i.test(f));
  const seen = new Set(); let total = 0, found = 0; const missing = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/class\s+\w+\s*:\s*DbContext|ctor/.test('') ) continue;
    let m; re.lastIndex = 0;
    while ((m = re.exec(src))) {
      const name = m[1]; if (ignore.has(name)) continue;
      const key = path.basename(f) + '::' + name; if (seen.has(key)) continue; seen.add(key);
      total++; if (js.includes(name.toLowerCase())) found++; else missing.push(key);
    }
  }
  rows.push({ app, files: files.length, methods: total, found, missing: missing.length });
  fs.writeFileSync(`missing_${app.replace(/\W+/g,'_')}.txt`, missing.join('\n'));
}
console.table(rows);
