/* Cardstead eBay listing search on Vercel (Node serverless function). The logic lives in api/_ebay-core.js and
 * is shared with the Cloudflare Pages Function (functions/api/ebay-search.js), so both hosts answer the same.
 * Keys: EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in the Vercel project's environment variables. */
'use strict';
const core=require('./_ebay-core.js');

async function handler(req,res){
 const r=await core.handle({method:req.method,url:req.url,origin:req.headers.origin,
  ip:String(req.headers['x-forwarded-for']||'').split(',')[0].trim()||'unknown',env:process.env});
 res.statusCode=r.status;for(const [k,v] of Object.entries(r.headers))res.setHeader(k,v);
 res.end(r.body==null?undefined:r.body);
}
module.exports=handler;
module.exports._test={slim:core.slim,getToken:core.getToken,configured:core.configured,limited:core.limited,reset:core.reset,
 search:(q,opts={})=>core.search(q,{...opts,env:opts.env||process.env})};
