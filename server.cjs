'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),C=require('./core.js'),AI=require('./ai.cjs');
// Serve only public assets. Environment files and server code are never static routes.
const assets={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/core.js':'core.js','/app.js':'app.js','/mark.svg':'mark.svg','/friendship-warm.png':'friendship-warm.png','/ambient-vignette.png':'ambient-vignette.png','/note-sticker.png':'note-sticker.png','/window-sticker.png':'window-sticker.png'};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
assets['/friendship-oil.png']='friendship-oil.png';
assets['/friendship-walk-oil.png']='friendship-walk-oil.png';
function createServer({config=AI.readConfig(),fetchModel=fetch}={}){
 let windowAt=Date.now(),requests=0,active=0;
 const server=http.createServer(async(req,res)=>{
  const json=(status,value)=>{if(!res.destroyed){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}};
  let url;try{url=new URL(req.url,'http://localhost');}catch{return json(400,{error:'请求地址不正确。'});}
  if(url.pathname.startsWith('/api/')){
   const ownOrigins=new Set([config.origin,'http://127.0.0.1:'+server.address().port,'http://localhost:'+server.address().port].filter(Boolean));
   const origin=req.headers.origin;
   if(origin&&!ownOrigins.has(origin))return json(403,{error:'此页面未获准连接生成服务。'});
   if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
   if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});return res.end();}
   if(url.pathname==='/api/status'&&req.method==='GET')return json(200,{configured:AI.configured(config),provider:config.provider,model:config.model});
   if(url.pathname!=='/api/reply'||req.method!=='POST')return json(404,{error:'这个接口不存在。'});
   if(!AI.configured(config))return json(503,{error:'AI 服务尚未配置。原话没有发送给模型，请先配置服务端接口和密钥。'});
   if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return json(415,{error:'请求必须使用 JSON。'});
   if(Date.now()-windowAt>60000){windowAt=Date.now();requests=0;}
   // ponytail: single-process caps; use the hosting platform's shared limit before scaling replicas.
   if(requests>=20||active>=3)return json(429,{error:'现在生成的人有点多，请稍后重试。'});
   const chunks=[];let bytes=0;try{for await(const chunk of req){bytes+=chunk.length;if(bytes>16000){json(413,{error:'输入内容太长。'});return;}chunks.push(chunk);}}catch{return json(400,{error:'没有收到完整的请求。'});}
   let input;try{input=C.parseAIRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(e){return json(400,{error:e instanceof SyntaxError?'请求内容格式不正确。':e.message});}
   requests++;active++;
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
   const closed=()=>controller.abort();res.on('close',closed);
   try{const result=await AI.generate(input,config,fetchModel,controller.signal);json(200,result);}catch(e){json(e.status||502,{error:controller.signal.aborted?'生成等待太久，请稍后重试。':e.status?e.message:'暂时连不上 AI 服务，请稍后再试。'});}finally{clearTimeout(timeout);res.removeListener('close',closed);active--;}
   return;
  }
  if(['GET','HEAD'].includes(req.method)&&url.pathname.startsWith('/fonts/')){
   const root=path.resolve(__dirname,'fonts'),filename=path.resolve(__dirname,'.'+url.pathname),ext=path.extname(filename);
   if(!filename.startsWith(root+path.sep)||!['.css','.woff','.woff2','.txt'].includes(ext)){res.writeHead(404);return res.end('Not found');}
   return fs.readFile(filename,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':types[ext],'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(req.method==='HEAD'?undefined:data);});
  }
  if(!['GET','HEAD'].includes(req.method)||!Object.hasOwn(assets,url.pathname)){res.writeHead(404);return res.end('Not found');}
  const filename=assets[url.pathname];
  fs.readFile(path.join(__dirname,filename),(err,data)=>{if(err){res.writeHead(500);return res.end('Asset unavailable');}res.writeHead(200,{'Content-Type':types[path.extname(filename)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(req.method==='HEAD'?undefined:data);});
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 return server;
}
if(require.main===module){
 const envFile=path.join(__dirname,'.env');if(fs.existsSync(envFile))process.loadEnvFile(envFile);
 const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||4182);
 createServer().listen(port,host,()=>console.log('Zaichang: http://'+host+':'+port+'/ (chat contents are not logged)'));
}
module.exports={createServer};
