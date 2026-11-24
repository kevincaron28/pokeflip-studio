/* Public app settings, shared by the Vercel function (api/config.js) and the Cloudflare Pages Function
 * (functions/api/config.js). Only values that are public by nature belong here.
 *   AMAZON_ASSOCIATES_TAG = the Amazon.ca Associates tracking id (ends in -20). Public: it appears in every link.
 * Files starting with "_" in api/ are not routes on Vercel. */
'use strict';
const TAG=/^[a-z0-9][a-z0-9-]{1,38}-20$/;
const BASE_ORIGINS=['https://pokeflip-studio.vercel.app','https://localhost','capacitor://localhost','http://localhost'];
function origins(env={}){return new Set([...BASE_ORIGINS,...String(env.CARDSTEAD_ORIGINS||'').split(',').map(s=>s.trim()).filter(s=>/^https:\/\/[\w.-]+$/.test(s))])}
function config(env={}){const t=String(env.AMAZON_ASSOCIATES_TAG||'').trim();return {amazonTag:TAG.test(t)?t:null}}
function handle({method='GET',origin,env={}}={}){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'};
 if(origin&&origins(env).has(origin)){headers['Access-Control-Allow-Origin']=origin;headers.Vary='Origin'}
 if(method==='OPTIONS')return {status:204,headers,body:null};
 if(method!=='GET')return {status:405,headers,body:JSON.stringify({error:'GET only'})};
 return {status:200,headers,body:JSON.stringify(config(env))};
}
const core={config,handle,TAG};
module.exports=core;module.exports.default=core;
