const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function runtime({conflict=false,mailFailure=false}={}){
 let count=0,released=0;
 const ctx={console,Utilities:{parseDate:s=>new Date(s.replace(' ','T')+':00Z'),formatDate:(d,z,f)=>f.includes('HH')?d.toISOString().slice(0,16).replace('T',' '):d.toISOString().slice(0,10)},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>released++})},CalendarApp:{getCalendarById:()=>({getEvents:()=>conflict?[{}]:[],createEvent:()=>count++})},MailApp:{sendEmail:()=>{if(mailFailure)throw Error('mail unavailable')}},ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({body:JSON.parse(s),setMimeType(){return this}})}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('Code.gs','utf8'),ctx);
 let day=new Date(Date.now()+3*86400000);while(day.getUTCDay()===5)day.setUTCDate(day.getUTCDate()+1);
 return {ctx,data:{name:'Test Patient',phone:'01000000000',service:'جلسة علاج نفسي',date:day.toISOString().slice(0,10),time:'16:00'},count:()=>count,released:()=>released};
}
test('valid booking saves one event and releases lock',()=>{const r=runtime();assert.equal(r.ctx.bookAppointment(r.data).ok,true);assert.equal(r.count(),1);assert.equal(r.released(),1)});
test('occupied appointment never creates an event',()=>{const r=runtime({conflict:true});assert.equal(r.ctx.bookAppointment(r.data).code,'CONFLICT');assert.equal(r.count(),0);assert.equal(r.released(),1)});
test('rejects invalid and out-of-policy requests before calendar writes',()=>{for(const patch of [{name:''},{phone:'abc'},{service:'unknown'},{time:'03:00'},{date:'2026-02-30'},{date:'2020-01-01'},{date:'2099-01-01'}]){const r=runtime();assert.equal(r.ctx.bookAppointment({...r.data,...patch}).ok,false);assert.equal(r.count(),0)}});
test('malformed JSON produces safe error',()=>{const r=runtime();assert.equal(r.ctx.doPost({postData:{contents:'bad'}}).body.code,'INVALID')});
test('frontend script parses and does not use opaque no-cors responses',()=>{const html=fs.readFileSync('index.html','utf8');new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);assert.equal(html.includes('mode:"no-cors"'),false)});
