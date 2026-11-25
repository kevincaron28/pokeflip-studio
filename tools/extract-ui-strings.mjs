#!/usr/bin/env node
/* Lists the English UI text Cardstead shows, for the French translation (i18n-fr.js):
 *  - static: text, placeholders, aria-labels, titles and button values in index.html;
 *  - runtime: string literals and template-literal segments in the older UI scripts, split at HTML tags,
 *    with ${…} parts as {0}, {1}… placeholders.
 * Run: node tools/extract-ui-strings.mjs > /tmp/ui-strings.json   (tests/i18n-coverage.test.cjs uses it too)
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const RUNTIME_FILES=['app.js','discord-link.js','restock-watch.js','alert-hub.js','sealed-guide.js','ebay-pricing.js','deal.js','pack-ev.js','ebay-watch.js','alert-value.js','cloud-sync.js','mobile-experience.js','market-reference.js'];
const words=s=>/[A-Za-z]{3}/.test(s)&&/\s|^[A-Z][a-z]+$/.test(s.trim());
const tidy=s=>s.replace(/\s+/g,' ').trim();
// Things that are code, not text people read.
const CODE=/^(https?:|\.\/|#|[a-z]+[A-Z]\w*$|[a-z-]+$|[a-z]+\/[a-z]|[\w.-]+\.(js|css|png|svg|json)$|\w+=)|^(GET|POST|PUT|DELETE|Content-Type|application\/|image\/|text\/)|[{}();=]|=>|^[\w-]+:\s*[\w#-]+;?$/;

export function staticStrings(html){
 const out=[];const add=s=>{s=tidy(decode(s));if(s&&/[A-Za-z]{2}/.test(s)&&!out.includes(s))out.push(s)};
 const body=html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>|<title>[\s\S]*?<\/title>/gi,'');
 for(const m of body.matchAll(/\b(placeholder|aria-label|title|alt)="([^"]+)"/g))add(m[2]);
 for(const m of body.matchAll(/<input[^>]*type="(?:button|submit)"[^>]*value="([^"]+)"/g))add(m[1]);
 for(const m of body.matchAll(/>([^<>]+)</g))add(m[1]);
 return out;
}
function decode(s){return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')}
/** Literal and template segments from a script. Template ${…} become {0},{1}… */
export function runtimeStrings(src){
 const out=[];const add=s=>{s=tidy(decode(s));if(s.length>=3&&words(s)&&!CODE.test(s)&&!out.includes(s))out.push(s)};
 // Template literals (no nesting of backticks across ${}: good enough for these files' style).
 for(const m of src.matchAll(/`((?:[^`\\]|\\.)*)`/g)){
  let t=m[1],n=0;
  t=t.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g,()=>'{'+(n++)+'}');
  for(const seg of t.split(/<[^>]*>/)){const k=renumber(seg);if(/[A-Za-z]{3}/.test(k.replace(/\{\d+\}/g,'')))add(k)}
 }
 for(const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)){const s=(m[1]??m[2]).replace(/\\'/g,"'").replace(/\\"/g,'"');if(!/[<>]/.test(s))add(s);else for(const seg of s.split(/<[^>]*>/))add(seg)}
 return out;
}
function renumber(seg){let n=0;const map={};return seg.replace(/\{(\d+)\}/g,(_,d)=>'{'+(map[d]??=n++)+'}')}
/** Strings made only of CSS class names, HTML tag names or kebab-case ids are code, not text. */
function codeTokens(){
 const css=new Set();
 for(const f of ['studio-theme.css','mobile-lab.css','index.html'])for(const m of readFileSync(path.join(ROOT,f),'utf8').matchAll(/\.([a-z][\w-]*)/gi))css.add(m[1].toLowerCase());
 for(const f of RUNTIME_FILES)for(const m of readFileSync(path.join(ROOT,f),'utf8').matchAll(/class(?:Name)?=["'`]([^"'`]+)/g))for(const c of m[1].split(/\s+/))css.add(c.toLowerCase());
 for(const t of 'main section div span button input select option label table tr td th tbody thead details summary img a li ul ol p h1 h2 h3 strong b small form dialog nav aside header'.split(' '))css.add(t);
 return css;
}
export function allStrings(){
 const html=readFileSync(path.join(ROOT,'index.html'),'utf8');
 const st=staticStrings(html),css=codeTokens();
 const noise=s=>s==='use strict'||s.split(/\s+/).every(t=>css.has(t)||/^[a-z]+-[a-z-]+$/.test(t));
 const rt=[];for(const f of RUNTIME_FILES)for(const s of runtimeStrings(readFileSync(path.join(ROOT,f),'utf8')))if(!rt.includes(s)&&!st.includes(s)&&!noise(s))rt.push(s);
 return {static:st,runtime:rt};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const a=allStrings();console.log(JSON.stringify(a,null,1));console.error(`static ${a.static.length}, runtime ${a.runtime.length}`);
}
