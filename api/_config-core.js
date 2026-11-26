/* Public app settings, shared by the Vercel function (api/config.js) and the Cloudflare Pages Function
 * (functions/api/config.js). Only values that are public by nature belong here.
 *   AMAZON_ASSOCIATES_TAG = the Amazon.ca Associates tracking id (ends in -20). Public: it appears in every link.
 *   DISCORD_INVITE_URL    = the public invite to the drops server. Unset keeps the Discord panel hidden.
 * Files starting with "_" in api/ are not routes on Vercel. */
'use strict';
const TAG=/^[a-z0-9][a-z0-9-]{1,38}-20$/;
const BASE_ORIGINS=['https://pokeflip-studio.vercel.app','https://cardstead.pages.dev','https://localhost','capacitor://localhost','http://localhost'];
function origins(env={}){return new Set([...BASE_ORIGINS,...String(env.CARDSTEAD_ORIGINS||'').split(',').map(s=>s.trim()).filter(s=>/^https:\/\/[\w.-]+$/.test(s))])}
// VAPID_PUBLIC_KEY: the Web Push public key (tools/make-vapid-keys.mjs). Public by design; the private key stays in Supabase.
const VAPID=/^[A-Za-z0-9_-]{80,100}$/;
const INVITE=/^https:\/\/(?:discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]{2,64}$/;
function config(env={}){const t=String(env.AMAZON_ASSOCIATES_TAG||'').trim(),v=String(env.VAPID_PUBLIC_KEY||'').trim(),d=String(env.DISCORD_INVITE_URL||'').trim();return {amazonTag:TAG.test(t)?t:null,vapidPublicKey:VAPID.test(v)?v:null,discordInvite:INVITE.test(d)?d:null}}
function handle({method='GET',origin,env={}}={}){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'};
 if(origin&&origins(env).has(origin)){headers['Access-Control-Allow-Origin']=origin;headers.Vary='Origin'}
 if(method==='OPTIONS')return {status:204,headers,body:null};
 if(method!=='GET')return {status:405,headers,body:JSON.stringify({error:'GET only'})};
 return {status:200,headers,body:JSON.stringify(config(env))};
}
const core={config,handle,TAG};
module.exports=core;module.exports.default=core;
