'use strict';
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
const read=f=>fs.readFileSync(f,'utf8');
const html=read('index.html'),css=read('studio-theme.css');
test('no text is styled under 12 px',()=>{
  for(const f of ['index.html','studio-theme.css','mobile-lab.css']){
    const small=[...read(f).matchAll(/font-size:\s*([\d.]+)px/g)].filter(m=>Number(m[1])<12).map(m=>m[0]);
    assert.deepStrictEqual(small,[],f);
  }
});
test('the footer shows the version in package.json',()=>{
  const [major,minor]=require('../package.json').version.split('.');
  assert.match(html,new RegExp('class="footer">Cardstead '+major+'\\.'+minor+' ·'));
});
test('the Drops page says what alerts really do',()=>{
  assert.match(html,/<section id="restock"[^>]*><h1 data-i18n="nav.drops">Drops<\/h1>/);
  assert.doesNotMatch(html,/Restock Watch|does not monitor inventory while closed|genuine always-on/);
  assert.match(html,/never guarantee stock/);
});
test('Add card floats only where cards are looked up or listed; navigation is plain buttons',()=>{
  assert.match(css,/body:not\(\[data-group="prices"\]\):not\(\[data-group="mycards"\]\) \.add-card-fab\{display:none\}/);
  assert.doesNotMatch(html,/role="tablist"/);
  for(const id of ['pushGood','pushChains'])assert.match(html,new RegExp('<label class="checkline"><input type="checkbox" id="'+id+'"'));
});
test('the Discord panel stays hidden until there is a real invite or a linked account',()=>{
  assert.match(html,/<div class="panel" id="discordPanel" hidden>/);
  const D=require('../discord-link.js'),C=require('../api/_config-core.js');
  assert.equal(D.invite('https://discord.gg/abc123'),'https://discord.gg/abc123');
  assert.equal(D.invite('https://discord.com/invite/abc123'),'https://discord.com/invite/abc123');
  for(const bad of [null,'','javascript:alert(1)','https://discord.gg.evil.example/x','http://discord.gg/abc','https://discord.com/channels/1'])assert.equal(D.invite(bad),null,String(bad));
  assert.equal(C.config({}).discordInvite,null);
  assert.equal(C.config({DISCORD_INVITE_URL:' https://discord.gg/abc123 '}).discordInvite,'https://discord.gg/abc123');
  assert.equal(C.config({DISCORD_INVITE_URL:'https://evil.example/abc'}).discordInvite,null);
});
test('empty-state pictures exist and are cached with the app',()=>{
  const sw=read('sw.js');
  for(const n of ['deals','lots','watches']){const f='assets/empty/empty-'+n+'.webp';assert.ok(fs.existsSync(f),f);assert.ok(sw.includes("'./"+f+"'"),f)}
});
