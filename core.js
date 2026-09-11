(function(root){'use strict';
const needs={unknown:'还没说清楚',listen:'想让我听听',space:'想自己待着',practical:'想找我帮忙'};
const capacities={now:'现在能聊',later:'晚点找TA',limited:'我也有点累'};
const actions={text:'用文字聊一会儿',call:'打个电话',walk:'一起走一走',help:'一起做一件小事'};
const examples={friend:'今天又被工作榨干了。回家坐在沙发上，连外卖都懒得点。\n我就想吐槽两句，不用帮我想办法。',partner:'我今天有点乱，想自己待一会儿。不是不想理你，就是现在不太想说话。',family:'明天要办的事挤一块儿了，我现在脑子一团乱。你有空的话，能陪我理一下先做什么吗？'};
const cut=(v,n)=>typeof v==='string'?v.slice(0,n):'';
function responseDefaults(){return{source:'',need:'unknown',capacity:'',minutes:10,later:'',detail:'',background:''};}
function response(raw){const r=raw||{},s=responseDefaults();s.source=cut(r.source,1600);s.need=Object.hasOwn(needs,r.need)?r.need:'unknown';s.capacity=Object.hasOwn(capacities,r.capacity)?r.capacity:'';s.minutes=[10,20,30].includes(Number(r.minutes))?Number(r.minutes):10;s.later=cut(r.later,80);s.detail=cut(r.detail,200);s.background=cut(r.background,400);return s;}
function parseReplyInput(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['need','capacity','minutes','later','detail'].includes(k))||!Object.hasOwn(needs,input.need)||!Object.hasOwn(capacities,input.capacity))throw Error('请选择有效的请求和余力。');if(input.minutes!==undefined&&![10,20,30].includes(input.minutes))throw Error('陪伴时间只能是 10、20 或 30 分钟。');for(const [key,max]of [['later',80],['detail',200]])if(input[key]!==undefined&&(typeof input[key]!=='string'||input[key].length>max))throw Error('补充文字格式或长度不正确。');return input;}
function parseAIRequest(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['source','background','need','capacity','minutes','later','detail'].includes(k)))throw Error('回应信息格式不正确。');
 const {source,background='',...choices}=input;
 if(typeof source!=='string'||!source.trim()||source.length>1600)throw Error('先放入朋友的一两句原话，最多 1600 字。');
 if(typeof background!=='string'||background.length>400)throw Error('背景信息最多 400 字。');
 const values=parseReplyInput(choices);
 return{...response({...values,source}),background};
}
function parseAIResult(input){
 if(!input||typeof input!=='object'||typeof input.reply!=='string'||!input.reply.trim()||input.reply.length>2000||!Array.isArray(input.considerations)||input.considerations.length<1||input.considerations.length>3||input.considerations.some(x=>typeof x!=='string'||!x.trim()||x.length>240))throw Error('AI 没有返回完整的回应，请重新试一次。');
 return{reply:input.reply.trim(),considerations:input.considerations.map(x=>x.trim())};
}
function planDefaults(){return{version:1,person:'',action:'',detail:'',at:'',minutes:20,confirmed:false,done:false};}
function plan(raw){const r=raw||{},s=planDefaults();s.person=cut(r.person,40);s.action=Object.hasOwn(actions,r.action)?r.action:'';s.detail=cut(r.detail,180);s.at=cut(r.at,16);s.minutes=[10,20,30,60].includes(Number(r.minutes))?Number(r.minutes):20;s.confirmed=r.confirmed===true;s.done=s.confirmed&&r.done===true;return s;}
function startDate(value){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return null;const d=new Date(value),[year,month,day,hour,minute]=value.split(/[-T:]/).map(Number);if(!Number.isFinite(d.getTime())||d.getFullYear()!==year||d.getMonth()+1!==month||d.getDate()!==day||d.getHours()!==hour||d.getMinutes()!==minute)return null;return d;}
function validatePlan(raw,now=Date.now()){const s=plan(raw);if(!s.action)return'先选一件你能做到的小事。';const d=startDate(s.at);if(!d)return'请填一个有效的日期和时间。';if(d.getTime()<=now)return'这个时间已经过去了，请重新和对方确认时间。';return'';}
function whenText(at){const d=startDate(at);return d?d.toLocaleString('zh-CN',{month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}):'时间还没定';}
function invitation(raw){const s=plan(raw);if(!s.action)return'';return[`${whenText(s.at)}，要不要${actions[s.action]}？大概 ${s.minutes} 分钟。`,s.detail.trim(),'到时不方便或者不想聊，跟我说一声就好，我们再改。'].filter(Boolean).join('\n\n');}
function changePlan(raw,patch){return{...plan({...raw,...patch}),confirmed:false,done:false};}
function parseSaved(text){if(!text)return null;const r=JSON.parse(text);if(!r||Array.isArray(r)||r.version!==1||typeof r.at!=='string'||!startDate(r.at)||!Object.hasOwn(actions,r.action)||![10,20,30,60].includes(r.minutes)||typeof r.confirmed!=='boolean'||typeof r.done!=='boolean'||(r.done&&!r.confirmed))throw Error('保存的约定格式不完整。没有覆盖原记录。');return plan(r);}
function escapeICS(text){return String(text).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'');}
function fold(line){const encoder=new TextEncoder();let out='',part='',bytes=0;for(const char of line){const size=encoder.encode(char).length;if(bytes+size>75){out+=part+'\r\n';part=' ';bytes=1;}part+=char;bytes+=size;}return out+part;}
function calendar(raw,uid,now=Date.now()){const s=plan(raw),error=validatePlan(s,now);if(error)throw Error(error);if(!s.confirmed||s.done)throw Error('请先与对方确认这次约定。');if(!/^[a-zA-Z0-9-]{1,80}$/.test(uid))throw Error('Invalid calendar id');const start=startDate(s.at),end=new Date(start.getTime()+s.minutes*60000),stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 // ponytail: one personal calendar event; no invitations, attendees, sync or reminders are sent.
 return['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Zaichang//Personal plan//ZH','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${uid}@zaichang.local`,`DTSTAMP:${stamp(new Date(now))}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${escapeICS('一段留出来的时间')}`,`DESCRIPTION:${escapeICS('在场：'+actions[s.action]+(s.detail.trim()?'。'+s.detail.trim():'')+'。如有变化，请自行与对方确认。')}`,'CLASS:PRIVATE','STATUS:CONFIRMED','END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
const api={needs,capacities,actions,examples,responseDefaults,response,parseReplyInput,parseAIRequest,parseAIResult,planDefaults,plan,startDate,validatePlan,whenText,invitation,changePlan,parseSaved,escapeICS,fold,calendar};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Zaichang=api;
})(typeof window==='undefined'?this:window);
