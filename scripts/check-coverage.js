'use strict';
// Usage: node scripts/check-coverage.js <AppFolder> <prefix>   e.g. Franchise franchise
// For every controller .cs: lists public action methods, and checks each action name appears as a route path
// segment (/<prefix>/<Controller>/<Action>) in src/modules/<prefix>/<File>.js. Also node --check + require of each module.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const MAP = require('./module-name-map.json'); // legacy file name -> kebab-case module file (see PORTING_GUIDE_MVC.md)
const [app, prefix] = process.argv.slice(2);
const root = path.join('C:/Users/MY ASUS/cluster', app, process.argv[4] || '');
const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p, o) : e.name.endsWith('.cs') && o.push(p); } return o; };
const files = walk(path.join(root, 'Controllers'));
const act = /public\s+(?:virtual\s+|async\s+)*(?:Task<)?(?:ActionResult|JsonResult|ViewResult|FileResult|PartialViewResult|FileContentResult|FilePathResult|ContentResult|RedirectResult|RedirectToRouteResult|IHttpActionResult|string|void|HttpResponseMessage|PartialViewResult)>?\s+(\w+)\s*\(/g;
let totalA = 0, okA = 0, missingFiles = [], bad = [];
const gaps = [];
for (const f of files) {
  const base = path.basename(f, '.cs').trim();
  const src = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const names = [...new Set([...src.matchAll(act)].map(m => m[1]))];
  const mod = path.join('src/modules', MAP[prefix + '/' + base + '.js'] || (prefix + '/' + base + '.js'));
  if (!fs.existsSync(mod)) { missingFiles.push(base); totalA += names.length; continue; }
  const js = fs.readFileSync(mod, 'utf8').toLowerCase();
  try { cp.execFileSync('node', ['--check', mod], { stdio: 'pipe' }); } catch (e) { bad.push(base + ' (syntax)'); }
  const miss = names.filter(n => !js.includes('/' + n.toLowerCase()) && !js.includes("'" + n.toLowerCase() + "'") && !js.includes('/' + n.toLowerCase()));
  totalA += names.length; okA += names.length - miss.length;
  if (miss.length) gaps.push(`${base}: ${miss.join(', ')}`);
}
console.log(`controllers: ${files.length}, modules missing: ${missingFiles.length}`);
console.log(`actions: ${totalA}, covered: ${okA}, uncovered: ${totalA - okA}`);
if (bad.length) console.log('SYNTAX ERRORS:', bad.join(', '));
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync(`reports/coverage_${prefix}.txt`, `MISSING MODULES:\n${missingFiles.join('\n')}\n\nACTIONS NOT FOUND:\n${gaps.join('\n')}\n`);
console.log(`details: reports/coverage_${prefix}.txt`);
