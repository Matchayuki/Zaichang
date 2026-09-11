'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),{once}=require('node:events'),{createServer}=require('./server.cjs'),AI=require('./ai.cjs');
const input={source:'今天加班回家连外卖都懒得点，我只想吐槽，不用想办法。',background:'我们是室友，上次给建议让TA不开心。',need:'unknown',capacity:'later',minutes:10,later:'今晚九点后',detail:''};
const config={...AI.readConfig({}),key:'test-only-not-a-real-key',origin:'https://matchayuki.github.io'};
const fixture={reply:'这是只用于接口测试的模拟正文。',considerations:['测试：原话明确只想吐槽。','测试：用户现在不能陪，晚点再联系。']};
async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return 'http://127.0.0.1:'+server.address().port;}
async function close(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
(async()=>{
 let calls=0,seen,mode='ok';
 const server=createServer({config,fetchModel:async(url,options)=>{calls++;seen={url:String(url),options};if(mode==='auth')return new Response('private provider error '+config.key,{status:401});if(mode==='empty')return Response.json({choices:[{message:{content:''}}]});return Response.json({choices:[{message:{content:JSON.stringify(fixture)}}]});}});
 const base=await listen(server),post=(value,headers={})=>fetch(base+'/api/reply',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(value)});
 try{
  const status=await (await fetch(base+'/api/status')).json();assert.equal(status.configured,true);assert.ok(!JSON.stringify(status).includes(config.key));assert.equal(calls,0);
  for(const route of ['/.env','/.env.example','/ai.cjs','/server.cjs','/README.md','/../.env'])assert.equal((await fetch(base+route)).status,404);
  assert.equal((await fetch(base+'/')).status,200);assert.equal(calls,0);console.log('PASS 静态文件白名单、状态查询不调用模型、不暴露密钥');
  assert.equal((await post(input,{Origin:'https://untrusted.example'})).status,403);assert.equal(calls,0);
  assert.equal((await post({...input,capacity:''})).status,400);assert.equal((await post({...input,apiKey:'secret'})).status,400);assert.equal(calls,0);
  assert.equal((await post({...input,source:'字'.repeat(17000)})).status,413);console.log('PASS 来源、输入边界和请求大小校验发生在模型调用之前');
  const accepted=await post(input,{Origin:config.origin});assert.equal(accepted.status,200);assert.equal(accepted.headers.get('Access-Control-Allow-Origin'),config.origin);assert.deepEqual(await accepted.json(),fixture);
  assert.equal(seen.url,'https://api.deepseek.com/chat/completions');assert.equal(seen.options.headers.Authorization,'Bearer '+config.key);
  const sent=JSON.parse(seen.options.body),content=JSON.parse(sent.messages[1].content);assert.equal(content.原话,input.source);assert.equal(content.关系与前情,input.background);assert.equal(content.capacity,'later');assert.equal(content.晚点方便的时间,'今晚九点后');assert.equal(sent.response_format.type,'json_object');assert.equal(sent.thinking.type,'disabled');assert.equal(sent.messages[0].role,'system');console.log('PASS 原话、前情、需求和余力进入 DeepSeek 请求，结果校验后返回');
  const bytes=Buffer.from(JSON.stringify(input));await new Promise((resolve,reject)=>{const req=http.request(base+'/api/reply',{method:'POST',headers:{'Content-Type':'application/json'}},res=>{res.resume();res.on('end',()=>{try{assert.equal(res.statusCode,200);resolve();}catch(e){reject(e);}});});req.on('error',reject);for(let i=0;i<bytes.length;i+=2)req.write(bytes.subarray(i,i+2));req.end();});assert.equal(JSON.parse(JSON.parse(seen.options.body).messages[1].content).原话,input.source);console.log('PASS 分块传输不会损坏中文');
  mode='auth';const failed=await post(input);assert.equal(failed.status,502);assert.ok(!(await failed.text()).includes(config.key));mode='empty';assert.equal((await post(input)).status,502);console.log('PASS 上游认证和空结果错误不会泄漏内容或冒充成功');
 }finally{await close(server);}
 const off=createServer({config:{...config,key:''},fetchModel:()=>{throw Error('Must not call model without configuration');}}),offURL=await listen(off);
 try{assert.equal((await (await fetch(offURL+'/api/status')).json()).configured,false);const reply=await fetch(offURL+'/api/reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(reply.status,503);assert.ok((await reply.text()).includes('尚未配置'));}finally{await close(off);}
 console.log('PASS 无密钥时明确不可用，不调用模型');
})().catch(error=>{console.error(error);process.exitCode=1;});
