/* Cardstead public settings on Vercel. Logic shared with Cloudflare Pages: api/_config-core.js.
 * Setting: AMAZON_ASSOCIATES_TAG in the Vercel project's environment variables. */
'use strict';
const core=require('./_config-core.js');
module.exports=function handler(req,res){
 const r=core.handle({method:req.method,origin:req.headers.origin,env:process.env});
 res.statusCode=r.status;for(const [k,v] of Object.entries(r.headers))res.setHeader(k,v);
 res.end(r.body==null?undefined:r.body);
};
