const {chromium}=require('playwright');const {pathToFileURL}=require('url');const path=require('path');const assert=require('assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE || undefined});try{
 const p=await b.newPage({viewport:{width:1920,height:1080}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://**/*',r=>r.abort());await p.clock.install({time:new Date('2026-01-01T00:00:00Z')});await p.goto(pathToFileURL(path.resolve('app/index.html')).href);await p.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
 await p.evaluate(()=>{window.extCalls=[];window.visits={};window.NetDoH.probe=function(url,timeout,done){var i=window.NetDNSExtended.map(function(p){return p.url;}).indexOf(url);var n=(window.visits[url]||0)+1;window.visits[url]=n;window.extCalls.push(url);var timer=setTimeout(function(){done({reason:n>1&&i===5?'dnsTimeout':'ok',ms:n===1?i+1:20-i,httpStatus:0});},1);return{cancel:function(){clearTimeout(timer);}};};});
 const click=sel=>p.evaluate(sel=>document.querySelector(sel).click(),sel);
 await click('[data-page=dns]');await click('#dns-extended');await p.clock.runFor(22000);
 assert.match(await p.locator('#dns-status').textContent(),/Done/);assert.equal(await p.evaluate(()=>new Set(extCalls.slice(0,100)).size),100);assert.equal(await p.evaluate(()=>extCalls.length),158);
 const names=await p.locator('.dns-provider:not(.hidden) strong').allTextContents();assert.equal(names.length,10);const expected=await p.evaluate(()=>NetDNSExtended[19].name);assert.equal(names[0],'1. '+expected);
 const retestUrl = await p.evaluate(() => {
  window.originalProbe = NetDoH.probe;
  window.retestReply = { reason: 'ok', ms: 1000 };
  NetDoH.probe = function(url, timeout, done) {
   var timer = setTimeout(function() { done(window.retestReply); }, 1);
   return { cancel: function() { clearTimeout(timer); } };
  };
  return NetDNSExtended[19].url;
 });
 const rankedNames = () => p.locator('.dns-provider:not(.hidden) strong').allTextContents();
 const expectedNames = indices => p.evaluate(indices => indices.map((i, rank) => (rank + 1) + '. ' + NetDNSExtended[i].name), indices);
 await click('#dns-provider-0'); await p.clock.runFor(1000);
 assert.deepEqual(await rankedNames(), await expectedNames([18,17,16,15,14,13,12,11,10,9]), 'A slow retest must reorder the ranking and promote the next finalist');
 assert.ok((await p.locator('#dns-best').textContent()).includes((await rankedNames())[0].slice(3)));
 await p.evaluate(() => { window.retestReply = { reason: 'dnsTimeout', ms: 3000 }; });
 await click('#dns-provider-0'); await p.clock.runFor(1000);
 assert.deepEqual(await rankedNames(), await expectedNames([17,16,15,14,13,12,11,10,9,8]), 'A failed retest must leave the top ten');
 await p.evaluate(() => { window.retestReply = { reason: 'ok', ms: 1 }; });
 await p.locator('#dns-address').fill(retestUrl); await click('#dns-custom-test'); await p.clock.runFor(1000);
 assert.deepEqual(await rankedNames(), await expectedNames([19,17,16,15,14,13,12,11,10,9]), 'Retesting a finalist through its custom URL must also update the ranking');
 await p.evaluate(() => { NetDoH.probe = window.originalProbe; });
 assert.equal(await p.locator('#dns-stop').isEnabled(),true);await click('#dns-stop');const count=await p.evaluate(()=>extCalls.length);await p.clock.runFor(65000);assert.equal(await p.evaluate(()=>extCalls.length),count);
 await click('#dns-quick');await click('#dns-extended');await p.clock.runFor(5);await click('#dns-stop');const stopped=await p.evaluate(()=>extCalls.length);await p.clock.runFor(65000);assert.equal(await p.evaluate(()=>extCalls.length),stopped);
 await p.evaluate(()=>{window.visits={};});await click('#dns-extended');await p.clock.runFor(12500);assert.match(await p.locator('#dns-status').textContent(),/Confirming/);await click('#dns-stop');const confirmedStop=await p.evaluate(()=>extCalls.length);await p.clock.runFor(65000);assert.equal(await p.evaluate(()=>extCalls.length),confirmedStop);
 await click('[data-page=settings]');await click('#setting-language');await click('[data-page=dns]');await click('#dns-next');assert.match(await p.locator('#dns-page').textContent(),/2\/10/);
 const bounds=await p.evaluate(()=>({note:document.getElementById('dns-note').getBoundingClientRect().bottom,footer:document.querySelector('footer').getBoundingClientRect().top}));console.log(bounds);assert.ok(bounds.note<bounds.footer);assert.deepEqual(errors,[]);await p.screenshot({path:path.join('artifacts',require('../package.json').version,'dns-extended-preview.png')});console.log('Verified 100 unique screening targets, 20 finalists, top-10 updates after retests, failed finalist exclusion, pagination and Stop in both phases.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
