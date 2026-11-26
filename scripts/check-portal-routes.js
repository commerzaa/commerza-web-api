'use strict';
// Usage: node scripts/check-portal-routes.js [Controller ...]  -> loads every src/modules/portal/*.js, lists the routes it registers and
// compares them with the public actions of ClusterofferShopingPortalControllers (file matched by name with punctuation/case ignored).
// With controller names (e.g. Product_Detail CustomerPanel/KYC) only those are printed. Full report: reports/coverage_portal.txt
const fs=require('fs'),path=require('path');
const only=process.argv.slice(2).map(s=>s.toLowerCase().replace(/[^a-z0-9]/g,''));
const root='C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers';
const walk=(d,o=[])=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);e.isDirectory()?walk(p,o):e.name.endsWith('.cs')&&o.push(p);}return o;};
const act=/public\s+(?:virtual\s+|async\s+)*(?:Task<)?(?:ActionResult|JsonResult|ViewResult|FileResult|PartialViewResult|FileContentResult|FilePathResult|ContentResult|RedirectResult|RedirectToRouteResult|IHttpActionResult|string|void|HttpResponseMessage)>?\s+(\w+)\s*\(/g;
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const dir=path.resolve('src/modules/portal');const mods={};for(const f of fs.readdirSync(dir))if(f.endsWith('.js'))mods[norm(f.slice(0,-3))]=path.join(dir,f);
const routesOf=r=>{const out=[];(r&&r.stack||[]).forEach(l=>{if(l.route)out.push(String(l.route.path).toLowerCase());else if(l.handle&&l.handle.stack)out.push(...routesOf(l.handle));});return out;};
let missing=[],gaps=[],loadErr=[],tot=0,ok=0,used=new Set();
for(const f of walk(root)){const rel=path.relative(root,f);const sub=path.dirname(rel)==='.'?'':path.dirname(rel);
 const base=path.basename(f,'.cs').trim();const b2=base.replace(/Controller$/,'');
 const src=fs.readFileSync(f,'utf8').replace(/\/\/.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'');
 const names=[...new Set([...src.matchAll(act)].map(m=>m[1]))];tot+=names.length;
 const mod=mods[norm(sub+b2)];
 if(!mod){missing.push(`${sub?sub+'/':''}${base} (${names.length} actions, ${src.split('\n').length} lines)`);continue;}used.add(mod);
 let r;try{const m=require(mod);if(typeof (m&&m.router?m.router:m)!=='function')throw new Error('module does not export an express.Router');r=m&&m.router?m.router:m;}catch(e){loadErr.push((sub?sub+'/':'')+b2+' ['+path.basename(mod)+']'+': '+e.message.split('\n')[0]);continue;}
 const rs=routesOf(r).join(' ');
 const miss=names.filter(n=>!rs.includes('/'+n.toLowerCase()));ok+=names.length-miss.length;
 if(miss.length)gaps.push(`${sub?sub+'/':''}${b2} [${path.basename(mod)}]: ${miss.join(', ')}`);}
const extra=Object.values(mods).filter(m=>!used.has(m)).map(m=>path.basename(m));
console.log(JSON.stringify({tot,ok,missing:missing.length,gaps:gaps.length,loadErr:loadErr.length,extra}));
fs.writeFileSync('reports/coverage_portal.txt',`Checked by loading each module and listing its registered routes.\n\nMISSING MODULES:\n${missing.join('\n')}\n\nLOAD ERRORS:\n${loadErr.join('\n')}\n\nACTIONS WITHOUT A ROUTE:\n${gaps.join('\n')}\n`);
if(only.length){const pick=l=>only.some(o=>l.toLowerCase().replace(/[^a-z0-9]/g,'').startsWith(o)||l.toLowerCase().replace(/[^a-z0-9]/g,'').includes(o));
 console.log('MISSING:',missing.filter(pick));console.log('LOAD ERRORS:',loadErr.filter(pick));console.log('GAPS:',gaps.filter(pick));}
