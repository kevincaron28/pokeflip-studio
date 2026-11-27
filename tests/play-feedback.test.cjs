const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const A=require('../app-actions.js'),H=require('../help.js'),R=require('../routes.js'),Nav=require('../nav.js');

test('the contact address comes from the privacy policy, written in one place only',()=>{
 const page=read('privacy.html'),to=A.contactFrom(page);
 assert.match(to,/^[^@\s?"]+@[^@\s?"]+\.[a-z]+$/i);
 assert.equal(A.contactFrom('<p>no link</p>'),'');
 for(const f of ['app-actions.js','help.js','index.html'])assert.ok(!read(f).includes(to),f+' does not repeat the address');
});

test('a problem report is a mail draft: nothing but what the person wrote and chose to add',()=>{
 const m=A.draft({to:'a@example.com',kind:'price',message:'  Wrong price & name #1  ',details:'Cardstead: Website',lang:'en'});
 assert.equal(m.subject,'Cardstead: A price or card is wrong');
 assert.equal(m.body,'Wrong price & name #1\n\n---\nCardstead: Website');
 assert.ok(m.href.startsWith('mailto:a@example.com?subject=Cardstead%3A%20A%20price'));
 assert.ok(!/[&#]name|\s/.test(m.href),'the text is encoded');
 assert.equal(A.draft({to:'a@example.com',kind:'nope',message:'x',details:'',lang:'fr'}).subject,'Cardstead: Autre chose');
 assert.equal(A.draft({to:'a@example.com',kind:'bug',message:'x',details:'',lang:'en'}).body,'x');
});

test('Help & FAQ covers the same topics in English and French, with "tu"',()=>{
 const ids=l=>H.HELP[l].topics.map(t=>t.id+':'+t.a.length).join();
 assert.equal(ids('fr'),ids('en'));
 for(const id of ['prices','alerts','feed','sets','push'])assert.ok(H.HELP.en.topics.some(t=>t.id===id),id);
 assert.deepEqual(Object.keys(H.HELP.fr).sort(),Object.keys(H.HELP.en).sort());
 assert.deepEqual(Object.keys(A.TEXT.fr).sort(),Object.keys(A.TEXT.en).sort());
 assert.deepEqual(Object.keys(A.KINDS.fr),Object.keys(A.KINDS.en));
 assert.ok(!/\bvous\b|\bvotre\b|\bvos\b/i.test(JSON.stringify([H.HELP.fr,H.TOUR.fr,A.TEXT.fr])));
});

test('Help has its own address inside the Settings tab',()=>{
 assert.equal(R.toHash('help'),'#/help');assert.deepEqual(R.parse('#/help'),{page:'help'});
 assert.equal(Nav.groupOf('help').id,'settings');
 assert.match(read('index.html'),/<section id="help" class="hidden" data-no-translate>/);
 const shell=read('sw.js').match(/const SHELL=\[([^\]]+)\]/)[1];
 for(const f of ['help.js','app-actions.js','privacy.html'])assert.ok(shell.includes("'./"+f+"'"),f+' works offline and ships in the Android app');
});

test('the walkthrough is short and opens by itself only once, in the Android app',()=>{
 for(const l of ['en','fr']){const n=H.TOUR[l].steps.length;assert.ok(n>=3&&n<=4,l)}
 assert.equal(H.opensByItself({native:true,seen:false,hash:''}),true);
 assert.equal(H.opensByItself({native:true,seen:false,hash:'#/'}),true);
 assert.equal(H.opensByItself({native:true,seen:true,hash:''}),false);
 assert.equal(H.opensByItself({native:false,seen:false,hash:''}),false,'never over the website');
 assert.equal(H.opensByItself({native:true,seen:false,hash:'#/drops'}),false,'not over a link someone followed');
});

test('Back on the first page asks once, and leaves only on a second press right after',async()=>{
 let now=100000,exits=0;const said=[],vm=require('node:vm');
 const root={document:{querySelector:s=>s==='main section:not(.hidden)'?{id:'prices'}:null,getElementById:()=>null},
  Capacitor:{isNativePlatform:()=>false,Plugins:{App:{exitApp:async()=>{exits++}}}},pokeflipToast:m=>said.push(m),CardsteadRoutes:{back:()=>false}};
 const ctx={window:root,URL,URLSearchParams,Date:{now:()=>now}};vm.runInNewContext(read('mobile/web-overlay/native-bridge.js'),ctx);
 const back=()=>root.PokeFlipNative.handleBack();
 await back();assert.deepEqual([exits,said.length],[0,1]);
 now+=5000;await back();assert.deepEqual([exits,said.length],[0,2],'too late: it asks again');
 now+=1000;await back();assert.deepEqual([exits,said.length],[1,2]);
});

test('Android: the keyboard resizes the page, and rating and sharing are wired in',()=>{
 const manifest=read('mobile/android/app/src/main/AndroidManifest.xml');
 assert.ok(manifest.includes('android:windowSoftInputMode="adjustResize"'));
 const main=read('mobile/android/app/src/main/java/top/kcaron/cardstudio/MainActivity.java');
 assert.ok(main.indexOf('registerPlugin(AppReviewPlugin.class)')<main.indexOf('super.onCreate('));
 assert.ok(read('mobile/android/app/build.gradle').includes('com.google.android.play:review:'));
 assert.ok(read('mobile/android/app/capacitor.build.gradle').includes(':capacitor-share'));
 assert.ok(JSON.parse(read('mobile/package.json')).dependencies['@capacitor/share']);
 // The Rate button goes to the store page: Google asks apps not to put the rating card behind a button.
 assert.ok(read('app-actions.js').includes("closest?.('[data-rate]')){e.preventDefault();root.PokeFlipNative?.openStore?.()}"));
});

test('Android: the status and navigation bars follow the phone’s light or dark theme',()=>{
 const res='mobile/android/app/src/main/res/';
 const colour=folder=>read(res+folder+'/colors.xml').match(/<color name="system_bars">#([0-9a-f]{6})<\/color>/i)[1];
 const light=hex=>parseInt(hex.slice(0,2),16)+parseInt(hex.slice(2,4),16)+parseInt(hex.slice(4),16)>3*128;
 assert.ok(light(colour('values')),'light theme: a light bar behind dark icons');
 assert.ok(!light(colour('values-night')),'dark theme: a dark bar behind light icons');
 // Capacitor paints the area behind both bars with the window background.
 assert.ok(read(res+'values/styles.xml').includes('<item name="android:windowBackground">@color/system_bars</item>'));
 // Forcing one icon colour or bar colour from the page is what left white icons on a white bar.
 assert.ok(!/StatusBar\??\.(setStyle|setBackgroundColor)|SystemBars/.test(read('mobile/web-overlay/native-bridge.js')));
 assert.ok(!/"(StatusBar|SystemBars)"/.test(read('mobile/capacitor.config.json')));
 // The activity is not recreated on a theme change, so it sets both again itself, after the plugins.
 const main=read('mobile/android/app/src/main/java/top/kcaron/cardstudio/MainActivity.java');
 const changed=main.slice(main.indexOf('public void onConfigurationChanged('));
 const order=['super.onConfigurationChanged(','R.color.system_bars','setAppearanceLightStatusBars(light)','setAppearanceLightNavigationBars(light)'].map(s=>changed.indexOf(s));
 assert.ok(order.every((at,i)=>at>=0&&(!i||at>order[i-1])),'MainActivity.onConfigurationChanged');
});
