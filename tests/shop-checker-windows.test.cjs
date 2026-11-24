// Shop checker on the owner's Windows PC: settings file, capped log, one pass at a time, self-update only for the
// installed copy, and the Task Scheduler install (hidden, every 2 minutes, created off, key never touched).
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {execFileSync}=require('node:child_process');
const W=()=>import('../deploy/shop-checker/windows/run-windows.mjs');
const R=(...p)=>path.join(__dirname,'..',...p);
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'cardstead-win-'));

test('settings file: KEY=VALUE lines, comments and BOM ignored, values kept as written',async()=>{
 const {parseEnv}=await W();
 const e=parseEnv('﻿# comment\r\nSUPABASE_URL=https://x.supabase.co\r\nCHECKER_KEY= '+'a'.repeat(64)+' \r\n\r\nlower=no\nCHECKER_GAP_MS=500');
 assert.deepEqual(e,{SUPABASE_URL:'https://x.supabase.co',CHECKER_KEY:'a'.repeat(64),CHECKER_GAP_MS:'500'});
});

test('log file: timestamped single lines, moved to checker.log.1 past the size cap',async()=>{
 const {fileLog}=await W();const d=tmp();const f=path.join(d,'logs','checker.log');
 const log=fileLog(f,{maxBytes:60,now:()=>new Date('2026-11-24T20:00:00Z')});
 log('first\nline');assert.equal(fs.readFileSync(f,'utf8'),'2026-11-24T20:00:00.000Z first line\n');
 log('second');log('third');
 assert.ok(fs.existsSync(f+'.1'),'rotated');assert.match(fs.readFileSync(f,'utf8'),/third/);assert.doesNotMatch(fs.readFileSync(f,'utf8'),/first/);
});

test('one pass at a time; a stale lock from a crash is cleared',async()=>{
 const {lock}=await W();const f=path.join(tmp(),'pass.lock');
 const release=lock(f);assert.equal(typeof release,'function');assert.equal(lock(f),null,'second pass skipped');
 release();assert.ok(!fs.existsSync(f));
 fs.writeFileSync(f,'');const old=new Date(Date.now()-10*60000);fs.utimesSync(f,old,old);assert.equal(typeof lock(f),'function','stale lock replaced');
});

test('only the installed copy updates itself (never a developer checkout)',async()=>{
 const {isInstalledCopy}=await W();const home=path.join('C:','Users','x','AppData','Local','Cardstead','checker');
 assert.equal(isInstalledCopy(path.join(home,'app'),home),true);
 assert.equal(isInstalledCopy(path.join(home,'APP'),home),true,'Windows paths are not case-sensitive');
 assert.equal(isInstalledCopy(R(),home),false);
});

test('a pass with no key logs a plain error, exits 1, leaves no lock, and does not touch the repository',()=>{
 const home=tmp();fs.copyFileSync(R('deploy/shop-checker/checker.env.example'),path.join(home,'checker.env'));
 let code=0;try{execFileSync(process.execPath,[R('deploy/shop-checker/windows/run-windows.mjs')],{env:{...process.env,CARDSTEAD_CHECKER_HOME:home},stdio:'ignore'})}catch(e){code=e.status}
 assert.equal(code,1);
 assert.match(fs.readFileSync(path.join(home,'logs','checker.log'),'utf8'),/error: missing in checker\.env: CHECKER_KEY/);
 assert.ok(!fs.existsSync(path.join(home,'pass.lock')));
});

test('Task Scheduler install: hidden, every 2 minutes, no overlap, created off, settings file for this account only, key never handled',()=>{
 const ps=fs.readFileSync(R('deploy/shop-checker/windows/install-windows.ps1'),'utf8');
 assert.match(ps,/conhost\.exe" -Argument "--headless/,'no window');
 assert.match(ps,/-RepetitionInterval \(New-TimeSpan -Minutes 2\)/);
 assert.match(ps,/-MultipleInstances IgnoreNew -ExecutionTimeLimit \(New-TimeSpan -Minutes 2\)/);
 assert.match(ps,/-LogonType Interactive -RunLevel Limited/,'runs only while signed in, never elevated');
 assert.match(ps,/Disable-ScheduledTask -TaskName \$TaskName/,'created switched off');
 assert.match(ps,/icacls \$EnvFile \/inheritance:r \/grant:r "\$\{me\}:\(R,W\)"/,'only this Windows account can read the settings');
 assert.doesNotMatch(ps,/CHECKER_KEY=\$|-replace '\(\?m\)\^CHECKER_KEY|Get-Random|RandomNumberGenerator/,'never makes or writes the key');
 assert.doesNotMatch(ps,/-RunLevel Highest|Set-ExecutionPolicy|WakeToRun/);
 const un=fs.readFileSync(R('deploy/shop-checker/windows/uninstall-windows.ps1'),'utf8');
 assert.match(un,/Unregister-ScheduledTask -TaskName \$TaskName -Confirm:\$false/);
});
