'use strict';
/**
 * Verifies the port: compares every [Route("...")] in the legacy C# controllers with the routes registered
 * in the Express app, and checks every require('../lib/X') resolves.
 *   node scripts/check-routes.js "C:\path\to\ClusterOfferAPI\ClusterOfferAPI"
 */
const fs = require('fs');
const path = require('path');

const src = process.argv[2] || 'C:\Users\MY ASUS\cluster\ClusterOfferAPI\ClusterOfferAPI';
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

// 1) legacy routes
const legacy = new Set();
for (const f of walk(path.join(src, 'Controllers')).filter((x) => x.endsWith('.cs'))) {
  const t = fs.readFileSync(f, 'utf8');
  for (const m of t.matchAll(/^(?!\s*\/\/)\s*\[Route\("([^"]+)"\)\]/gm)) legacy.add(m[1].replace(/\{(\w+)\??(:[^}]*)?\}/g, ':$1').toLowerCase());
}

// 2) express routes
const app = require('../src/app');
const mounted = new Set();
(function collect(stack, prefix) {
  for (const l of stack) {
    if (l.route) mounted.add((prefix + l.route.path).toLowerCase().replace(/\/+$/, ''));
    else if (l.name === 'router' && l.handle.stack) collect(l.handle.stack, prefix);
  }
})((app.router || app._router).stack, '');

const norm = (p) => p.replace(/^\//, '').replace(/\/:\w+\??$/, '');
const mountedN = new Set([...mounted].map((p) => norm(p).replace(/:\w+/g, ':x')));
const missing = [...legacy].filter((p) => !mountedN.has(norm(p).replace(/:\w+/g, ':x')) && !mountedN.has(p.replace(/:\w+/g, ':x').replace(/^\//, '')));
console.log(`legacy attribute routes: ${legacy.size} | express routes: ${mounted.size}`);
if (missing.length) { console.log('MISSING in express:'); missing.forEach((m) => console.log('  ' + m)); }
else console.log('All legacy attribute routes are registered.');

// 3) lib requires resolve
let bad = 0;
for (const f of walk(path.join(__dirname, '..', 'src')).filter((x) => x.endsWith('.js'))) {
  const t = fs.readFileSync(f, 'utf8');
  for (const m of t.matchAll(/require\('(\.[^']+)'\)/g)) {
    try { require.resolve(path.resolve(path.dirname(f), m[1])); } catch (_) { bad++; console.log(`UNRESOLVED require ${m[1]} in ${path.relative(process.cwd(), f)}`); }
  }
}
console.log(bad ? `${bad} unresolved requires` : 'All requires resolve.');
process.exit(missing.length || bad ? 1 : 0);
