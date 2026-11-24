/* Settings -> Discord alerts: link a Cardstead account to the Cardstead Drops Discord server for opt-in DMs about your own watches. */
(function(root){'use strict';
const core={
 cleanCode(x){const c=String(x||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return /^[A-HJ-NP-Z2-9]{8}$/.test(c)?c:''},
 statusText(s){if(!s||!s.linked)return 'Not linked. Type /link in the Cardstead Drops server to get a code.';return s.dms_enabled?'Linked. You get a DM when a drop matches one of your watches at or under your max price.':'Linked. DMs are off.'}
};
root.CardsteadDiscordCore=core;
if(typeof document==='undefined'){if(typeof module!=='undefined'&&module.exports)module.exports=core;return}
const $=id=>document.getElementById(id);
function show(t){const m=$('discordStatus');if(m)m.textContent=t}
async function rpc(name,args){const client=root.PokeFlipCloudClient&&root.PokeFlipCloudClient();if(!client)throw Error('Set up cloud sync and sign in first');const {data:u}=await client.auth.getUser();if(!u?.user)throw Error('Sign in with cloud sync first (Settings, below)');const {data,error}=await client.rpc(name,args||{});if(error)throw Error(error.message);return data}
async function refresh(){try{const rows=await rpc('discord_link_status');const s=Array.isArray(rows)?rows[0]:rows;show(core.statusText(s));const t=$('discordDms');if(t){t.disabled=!s?.linked;t.textContent=s?.dms_enabled?'Turn DMs off':'Turn DMs on';t.dataset.on=s?.dms_enabled?'1':''}const un=$('discordUnlink');if(un)un.disabled=!s?.linked}catch(e){show(e.message)}}
function wire(){if(!$('discordLink'))return;
 $('discordLink').onclick=async()=>{const code=core.cleanCode($('discordCode').value);if(!code){show('Enter the 8-character code from /link.');return}try{await rpc('discord_link_account',{p_code:code});$('discordCode').value='';await refresh()}catch(e){show(e.message)}};
 $('discordDms').onclick=async()=>{try{await rpc('discord_set_dms',{p_enabled:!$('discordDms').dataset.on});await refresh()}catch(e){show(e.message)}};
 $('discordUnlink').onclick=async()=>{try{await rpc('discord_unlink');await refresh()}catch(e){show(e.message)}};
 refresh()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})(typeof window!=='undefined'?window:globalThis);
