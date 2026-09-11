(()=>{'use strict';
const C=window.Zaichang,$=id=>document.getElementById(id),KEY='zaichang_plan_v1';
let r=C.responseDefaults(),p=C.planDefaults(),view='reply',edited=false,generated='',pending=null,timer,calendarURL='',exampleKey='friend',step=1,furthestStep=1,generatedFor='',aiBusy=false,aiController=null,aiRevision=0;
const apiMeta=document.querySelector('meta[name="zaichang-api"]').content;
const apiBase=new URL(apiMeta?apiMeta.replace(/\/$/,'')+'/': './api/',location.href);
const fingerprint=()=>JSON.stringify(C.response(r));
const notes={unknown:'没说清楚，就给彼此留一个问问的机会。',listen:'先听听就好。建议可以等TA想听的时候再说。',space:'那就留点空间，等TA愿意聊时再联系。',practical:'一起看看是哪件事，能帮多少，就说多少。'};
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>$('toast').classList.remove('visible'),5200);}
function ask(title,text,fn){$('confirm-title').textContent=title;$('confirm-text').textContent=text;pending=fn;$('confirm-dialog').showModal();}
$('cancel').onclick=()=>{pending=null;$('confirm-dialog').close();};$('accept').onclick=()=>{const fn=pending;pending=null;$('confirm-dialog').close();fn?.();};$('confirm-dialog').oncancel=()=>pending=null;
document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>$(b.dataset.open).showModal());document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
function go(next){view=next==='plan'?'plan':'reply';$('reply-view').hidden=view!=='reply';$('plan-view').hidden=view!=='plan';$('view-label').textContent=view==='reply'?'回一句话':'留一点时间';document.querySelectorAll('.view-nav [data-view]').forEach(b=>{if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});if(view==='plan')renderPlan();if(view==='reply'&&step>1){showStep(step);return;}window.scrollTo({top:0,behavior:'instant'});const h=$(view+'-view').querySelector('h1');h.tabIndex=-1;h.focus({preventScroll:true});}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>go(b.dataset.view));document.querySelector('.brand').onclick=e=>{e.preventDefault();go('reply');};
function renderJourney(){
  for(let n=1;n<=3;n++)$('step-'+n).hidden=n!==step;
  document.querySelectorAll('[data-step]').forEach(b=>{const n=Number(b.dataset.step);b.disabled=n>furthestStep||(n===3&&!r.capacity);b.dataset.complete=String(n<furthestStep);if(n===step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  $('step-count').textContent='0'+step+' / 03';$('make-reply').disabled=!r.capacity||!r.source.trim()||aiBusy;$('capacity-prompt').hidden=Boolean(r.capacity)&&Boolean(r.source.trim());$('capacity-prompt').textContent=!r.source.trim()?'请先返回第一步，放入朋友的原话。':'先选一个你现在的状态，就可以继续了。';
  $('reply-context').textContent=C.needs[r.need]+(r.capacity?' · '+C.capacities[r.capacity]:'');
}
function showStep(next,focus=true){
  if(![1,2,3].includes(next)||(next===3&&!r.capacity))return;
  step=next;furthestStep=Math.max(furthestStep,step);renderJourney();
  if(focus){$('workbench').scrollIntoView({block:'start',behavior:'instant'});$('step-'+step).querySelector('h2').focus({preventScroll:true});}
}
document.querySelectorAll('[data-step],[data-next],[data-back]').forEach(b=>b.onclick=()=>showStep(Number(b.dataset.step||b.dataset.next||b.dataset.back)));
$('begin').onclick=()=>showStep(step);
function button(text,cls,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls;b.onclick=fn;return b;}
Object.entries(C.needs).forEach(([key,label])=>{const b=button(label,'option',()=>{r.need=key;renderResponse();});b.dataset.need=key;$('need-options').append(b);});
Object.entries(C.capacities).forEach(([key,label],i)=>{const b=button('','capacity',()=>{r.capacity=key;renderResponse();});const icon=document.createElement('span'),text=document.createElement('span'),title=document.createElement('strong'),hint=document.createElement('small');icon.textContent=['◷','↗','−'][i];icon.setAttribute('aria-hidden','true');title.textContent=label;hint.textContent=['手边的事可以放放，陪TA一会儿。','现在走不开，找个方便的时间。','想关心TA，也需要给自己留点力气。'][i];text.append(title,hint);b.append(icon,text);b.dataset.capacity=key;$('capacity-options').append(b);});
function renderResponse(){
  document.querySelectorAll('[data-need]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.need===r.need)));
  document.querySelectorAll('[data-capacity]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.capacity===r.capacity)));
  document.querySelectorAll('[data-example]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.example===exampleKey)));
  $('source-mode').textContent=exampleKey?'虚构场景 · 可以放心试':'你的原话 · 生成前可修改';$('need-note').textContent=notes[r.need];$('source-count').textContent=r.source.length+' / 1600';
  $('now-fields').hidden=r.capacity!=='now'||r.need==='space';$('later-fields').hidden=r.capacity!=='later';
  const hasDraft=Boolean($('draft').value.trim());
  $('reply-empty').hidden=hasDraft||!aiBusy;$('reply-editor').hidden=aiBusy&&!hasDraft;
  $('draft-notice').hidden=!hasDraft||!generatedFor||fingerprint()===generatedFor;
  $('draft-mode').textContent=edited?'你改过的这一句':generatedFor?'AI 草稿 · 请核对':'还没有 AI 草稿';
  $('copy-reply').disabled=!hasDraft||aiBusy;$('draft').readOnly=aiBusy;$('reply-copied').hidden=true;
  $('retry-ai').disabled=aiBusy;$('cancel-ai').hidden=!aiBusy;$('workbench').setAttribute('aria-busy',String(aiBusy));renderJourney();
}
$('source').oninput=()=>{r.source=$('source').value;exampleKey='';renderResponse();};
for(const [id,key]of [['reply-minutes','minutes'],['later','later'],['detail','detail'],['background','background']])$(id).oninput=()=>{r=C.response({...r,[key]:$(id).value});renderResponse();};
$('draft').oninput=()=>{edited=true;$('draft-mode').textContent='你改过的这一句';$('copy-reply').disabled=!$('draft').value.trim();$('reply-copied').hidden=true;};
function cancelAI(silent=false){aiRevision++;aiController?.abort();aiController=null;aiBusy=false;if(!silent){$('ai-error').hidden=false;$('ai-error').textContent='已停止等待，原有草稿保留。';}renderResponse();}
async function generateReply(){
  if(aiBusy)return;
  let payload;try{payload=C.parseAIRequest(C.response(r));}catch(e){toast(e.message);return;}
  if(edited){ask('用 AI 重新整理这句话？','会再次发送原话、背景和当前选择。只有生成成功才替换手改草稿；取消或失败都保留原文。',()=>runGeneration(payload));return;}
  await runGeneration(payload);
}
async function runGeneration(payload){
  const revision=++aiRevision,sentFor=JSON.stringify(payload);
  const controller=new AbortController();aiController=controller;const deadline=setTimeout(()=>controller.abort(),50000);
  aiBusy=true;$('ai-error').hidden=true;showStep(3);renderResponse();
  try{
    const result=await fetch(new URL('reply',apiBase),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'omit',signal:controller.signal});
    const data=await result.json();
    if(!result.ok)throw Error(typeof data.error==='string'?data.error.slice(0,300):'生成没有完成，请稍后重试。');
    const value=C.parseAIResult(data);
    if(revision!==aiRevision)return;
    if(sentFor!==fingerprint())throw Error('生成期间输入有变化。这次结果未替换草稿，请按新条件重新生成。');
    $('draft').value=value.reply;generated=value.reply;generatedFor=sentFor;edited=false;
    $('ai-considerations').replaceChildren(...value.considerations.map(text=>{const item=document.createElement('li');item.textContent=text;return item;}));
    $('ai-readback').hidden=false;$('ai-status').textContent='已根据这次原话和背景生成，请核对措辞。';
  }catch(e){
    if(revision!==aiRevision)return;
    $('ai-error').hidden=false;$('ai-error').textContent=e.name==='AbortError'?'这次等待太久，原有草稿保留。可以稍后再试。':e instanceof TypeError||e instanceof SyntaxError?'暂时连不上生成服务。原话和草稿还在这里，请稍后再试。':e.message;
  }finally{clearTimeout(deadline);if(revision===aiRevision){aiBusy=false;aiController=null;renderResponse();}}
}
$('make-reply').onclick=generateReply;$('regenerate').onclick=generateReply;$('retry-ai').onclick=generateReply;$('cancel-ai').onclick=()=>cancelAI();
if(['http:','https:'].includes(location.protocol))fetch(new URL('status',apiBase),{credentials:'omit',cache:'no-store'}).then(res=>{if(!res.ok)throw Error();return res.json();}).then(data=>{
  $('ai-service').textContent=data.configured?'点击生成后，原话、背景和选择将发送至 '+data.provider+'（'+data.model+'）。':'AI 接口尚未配置。原话不会发送给模型，配置好后才能生成。';
}).catch(()=>$('ai-service').textContent='暂时无法连接 AI 服务。原话不会因输入或切换步骤而发送。');
function startResponse(source,key){cancelAI(true);r=C.responseDefaults();r.source=source;exampleKey=key;edited=false;generated='';generatedFor='';$('ai-readback').hidden=true;$('ai-error').hidden=true;step=1;furthestStep=1;$('source').value=source;for(const id of ['later','detail','draft','background'])$(id).value='';$('reply-minutes').value='10';document.querySelector('.own-detail').open=false;renderResponse();}
document.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{if(exampleKey===b.dataset.example)return;const fill=()=>startResponse(C.examples[b.dataset.example],b.dataset.example);if(edited||r.capacity||r.detail.trim()||(!exampleKey&&r.source.trim()))ask('换一个小场景试试？','会替换当前原话、选择和草稿。想保留写好的话，可以先取消并复制。约定不受影响。',fill);else fill();});
$('use-own').onclick=()=>{const clear=()=>{startResponse('','');$('source').focus();};if(edited||r.capacity||r.detail.trim()||(!exampleKey&&r.source.trim()))ask('换成朋友的原话？','这次练习和草稿会清空。写好的话可以先复制，约定不受影响。',clear);else clear();};
async function copy(field){if(!field.value.trim())return false;try{await navigator.clipboard.writeText(field.value);toast('已复制。去聊天里再读一遍，顺了就发给TA吧。');return true;}catch{field.focus();field.select();toast('自动复制未完成。文字已选中，请手动复制。');return false;}}
$('copy-reply').onclick=async()=>{$('reply-copied').hidden=!await copy($('draft'));};
Object.entries(C.actions).forEach(([key,label])=>{const b=button(label,'option',()=>updatePlan({action:key}));b.dataset.action=key;$('action-options').append(b);});
function revokeCalendar(){if(calendarURL){URL.revokeObjectURL(calendarURL);calendarURL='';}$('calendar-file').hidden=true;$('calendar-file').removeAttribute('href');}
function updatePlan(patch){const hadConfirmation=p.confirmed;p=C.changePlan(p,patch);revokeCalendar();renderPlan();if(hadConfirmation)toast('安排已改动，请重新与对方确认。已导入的日历不会自动更新。');}
function syncPlanFields(){for(const [id,key]of [['person','person'],['plan-detail','detail'],['plan-at','at'],['plan-minutes','minutes']])$(id).value=p[key];renderPlan();}
function renderPlan(){document.querySelectorAll('[data-action]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.action===p.action)));const d=C.startDate(p.at),valid=!C.validatePlan(p);$('pact-day').textContent=d?String(d.getDate()).padStart(2,'0'):'—';$('pact-month').textContent=d?d.toLocaleDateString('zh-CN',{month:'long',weekday:'short'}):'留一小段时间';$('pact-clock').textContent=d?d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}):'不用安排整个未来';$('pact-action').textContent=C.actions[p.action]||'从一件小事开始';$('pact-detail').textContent=p.detail.trim()||'选择一件你能做到、对方也愿意的事。';$('pact-minutes').textContent='约 '+p.minutes+' 分钟';$('pact-status').textContent=p.done?'你记录为已完成':p.confirmed?'你记录为已确认':p.action?'等待双方确认':'还没约好';$('plan-dot').hidden=!p.action;$('invitation').value=p.action&&d?C.invitation(p):'';$('copy-invitation').disabled=!valid||p.done;$('confirmed').checked=p.confirmed;$('confirmed').disabled=!valid&&!p.confirmed;$('calendar').disabled=!valid||!p.confirmed||p.done;$('complete').disabled=!p.confirmed||p.done||!d||d.getTime()>Date.now();$('complete').textContent=p.done?'已记录完成 ✓':'这次已经完成 ✓';$('done-note').hidden=!p.done;$('plan-error').hidden=!(p.at&&!valid);$('plan-error').textContent=p.at?C.validatePlan(p):'';}
for(const [id,key]of [['person','person'],['plan-detail','detail'],['plan-at','at'],['plan-minutes','minutes']])$(id).oninput=()=>{if(key==='person'){p.person=$(id).value;return;}updatePlan({[key]:$(id).value});};
$('confirmed').onchange=()=>{if($('confirmed').checked){const error=C.validatePlan(p);if(error){$('confirmed').checked=false;toast(error);return;}p.confirmed=true;p.done=false;toast('已按你的记录标记确认；应用没有收到对方回执。');}else{p.confirmed=false;p.done=false;revokeCalendar();}renderPlan();};
$('copy-invitation').onclick=()=>{const error=C.validatePlan(p);if(error){toast(error);renderPlan();return;}copy($('invitation'));};
$('calendar').onclick=()=>{try{const text=C.calendar(p,crypto.randomUUID());revokeCalendar();calendarURL=URL.createObjectURL(new Blob([text],{type:'text/calendar;charset=utf-8'}));$('calendar-file').href=calendarURL;$('calendar-file').hidden=false;$('calendar-file').focus();toast('日历文件已准备好，点击下方链接保存，再自行导入日历。');}catch(e){toast(e.message);renderPlan();}};
$('complete').onclick=()=>{const d=C.startDate(p.at);if(!p.confirmed||!d||d.getTime()>Date.now())return;ask('记录这次陪伴已经完成？','这只是你在本机的记录，不会通知对方。没有完成也不需要勉强标记。',()=>{p.done=true;revokeCalendar();renderPlan();toast('已在当前页面记录。若要下次保留，请保存到这台设备。');});};
$('save-plan').onclick=()=>{if(!p.action||!C.startDate(p.at)){toast('先选一件事，并填好有效时间。');return;}ask('在这台设备保留这一份约定？','保存昵称、具体安排、时间和确认状态。若已有本应用的约定，会被替换；聊天原话与回应不会保存。',()=>{try{const old=localStorage.getItem(KEY);if(old)C.parseSaved(old);localStorage.setItem(KEY,JSON.stringify(C.plan(p)));toast('约定已保存。后续改动需要再次保存，不会自动同步。');}catch{toast('保存未完成，原记录未覆盖。存储可能不可用或原记录损坏。');}});};
$('load-plan').onclick=()=>{let saved;try{saved=C.parseSaved(localStorage.getItem(KEY));}catch{toast('无法读取保存的约定，原记录未覆盖。');return;}if(!saved){toast('这里还没有保存的约定。');return;}ask('打开本机保存的约定？','当前未保存的安排会被替换。回应工作台的内容不受影响。',()=>{p=saved;revokeCalendar();syncPlanFields();toast('已找回约定。状态来自你之前的记录，不代表对方当前意愿。');});};
$('delete-plan').onclick=()=>ask('移除本应用保存的约定？','本机保存的这一份约定将无法在这里恢复。当前页面、EchoGlow 数据和已导入的日历不受影响。',()=>{try{localStorage.removeItem(KEY);toast('本应用保存的约定已移除，无法在这里恢复。');}catch{toast('移除失败，请检查浏览器存储权限。');}});
function reset(){startResponse('','');p=C.planDefaults();revokeCalendar();syncPlanFields();go('reply');}
$('new-session').onclick=()=>ask('开始新的一次？','当前未保存的原话、回应和安排会清空。本机已保存的约定不会删除。',reset);
const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;$('timezone-note').textContent='按当前设备时区 '+zone+' 填写；异地联系时，请先核对彼此的时间。';
// Same stage-only action as the visible controls; cannot send, save or confirm a plan.
const modelContext=document.modelContext;
if(modelContext?.registerTool){const lifecycle=new AbortController();try{Promise.resolve(modelContext.registerTool({name:'stage_reply_choices',title:'填写回应选项',description:'只填写当前页面的明确请求和余力选项。不调用 AI，不读取或返回原话和草稿，不发送、不复制、不保存；用户仍须点击生成按钮。',inputSchema:{type:'object',properties:{need:{type:'string',enum:Object.keys(C.needs)},capacity:{type:'string',enum:Object.keys(C.capacities)},minutes:{type:'integer',enum:[10,20,30]},later:{type:'string',maxLength:80},detail:{type:'string',maxLength:200}},required:['need','capacity'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){const values=C.parseReplyInput(input);if(edited)throw Error('已有手动修改的回应，请在页面中处理，不能由工具覆盖。');r=C.response({...r,...values});$('reply-minutes').value=r.minutes;$('later').value=r.later;$('detail').value=r.detail;renderResponse();go('reply');showStep(2);return{stage:'choices',generated:false,sent:false,saved:false};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
// ponytail: one active, explicitly saved local plan; no contacts database or background monitoring.
document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderPlan();});setInterval(()=>{if(view==='plan'&&!document.hidden)renderPlan();},30000);
startResponse(C.examples.friend,'friend');syncPlanFields();
})();
