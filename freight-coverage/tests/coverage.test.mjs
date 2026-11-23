import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {regions,socalHubs,unassignedStates,stateToRegion,pathFor,resolveRoute,childEntries,pageMetadata} from '../.generated/coverageData.js';
const root=path.resolve(import.meta.dirname,'..');
const allPaths=['/coverage'];
for(const r of regions){allPaths.push(pathFor(r));for(const c of r.corridors){allPaths.push(pathFor(r,c));for(const h of c.hubs){allPaths.push(pathFor(r,c,h));}}}
test('five user-defined regions and exactly five unassigned CONUS states',()=>{
  assert.equal(regions.length,5);
  const assigned=regions.flatMap(r=>r.states);
  assert.equal(new Set(assigned).size,43);
  assert.equal(assigned.length,43);
  assert.deepEqual([...unassignedStates].sort(),['MT','ND','SD','WV','WY']);
  assert.equal(new Set([...assigned,...unassignedStates]).size,48);
  assert.equal(stateToRegion.CA,'west-coast');
});
test('every region has three corridors and each corridor has 3-4 hubs',()=>{
  for(const r of regions){assert.ok(r.corridors.length>=3&&r.corridors.length<=4);for(const c of r.corridors)assert.ok(c.hubs.length>=3&&c.hubs.length<=4);}
  assert.equal(regions.flatMap(r=>r.corridors).length,15);
  assert.equal(regions.flatMap(r=>r.corridors.flatMap(c=>c.hubs)).length,45);
});
test('SoCal contains only Gardena Commerce Riverside, with exact brief coordinates',()=>{
  const corridor=regions.find(r=>r.slug==='west-coast')?.corridors.find(c=>c.slug==='southern-california');
  assert.ok(corridor);
  assert.deepEqual(corridor.hubs.map(h=>h.slug),['gardena-ca','commerce-ca','riverside-ca']);
  assert.deepEqual(socalHubs.map(h=>[h.lat,h.lon]),[[33.8883,-118.3090],[34.0006,-118.1598],[33.9806,-117.3755]]);
  assert.ok(socalHubs.every(h=>h.status==='active-hub'&&h.capabilities.length===3));
  assert.ok(regions.flatMap(r=>r.corridors.flatMap(c=>c.hubs)).filter(h=>h.status==='active-hub').every(h=>socalHubs.includes(h)));
});
test('routing paths all valid, canonical, unique',()=>{
  assert.equal(allPaths.length,66);
  assert.equal(new Set(allPaths).size,66);
  for(const p of allPaths){const route=resolveRoute(p);assert.ok(route,`Not found: ${p}`);assert.equal(route.path,p);assert.equal(resolveRoute(p+'/')?.path,p);}
  assert.equal(resolveRoute('/coverage/west-coast/southern-california/gardena-ca')?.tier,4);
  assert.equal(resolveRoute('/coverage/west-coast/southern-california/los-angeles-ca'),null);
});
test('all key levels cap choices at 3–5',()=>{
  for(const p of allPaths){const r=resolveRoute(p);assert.ok(r);const entries=childEntries(r);assert.ok(entries.length>=3&&entries.length<=5,`Choice count ${entries.length} ${p}`);}
});
test('all 66 static pages have unique HTML title, meta description, canonical and H1',()=>{
  const titles=[];
  for(const p of allPaths){
    const route=resolveRoute(p);const html=fs.readFileSync(path.join(root,'dist',p.slice(1),'index.html'),'utf8');const meta=pageMetadata(route);
    assert.ok(html.includes(`<title>${meta.title.replaceAll('&','&amp;')}</title>`),p);
    assert.match(html,/<meta name="description" content="[^"]+">/);
    assert.ok(html.includes(`<h1>${meta.heading.replaceAll('&','&amp;')}</h1>`),p);
    assert.ok(html.includes('aria-label="Coverage Directory"'),p);
    assert.ok(html.includes(`href="https://scapegoat3plwarehouserates.com${p}/"`),p);
    titles.push(meta.title);
  }
  assert.equal(new Set(titles).size,66);
});
test('bundled state geometry supplies all 48 actual projected SVG state polygons',()=>{
  const geo=JSON.parse(fs.readFileSync(path.join(root,'dist/coverage/assets/states.json'),'utf8'));
  assert.equal(Object.keys(geo.states).length,48);
  assert.ok(Object.values(geo.states).every(v=>v.path.startsWith('M')&&v.path.endsWith('Z')));
});