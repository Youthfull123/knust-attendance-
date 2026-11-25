import {randomUUID} from 'crypto';
import {q} from '@/lib/db';import {sign,verify} from '@/lib/auth';import {valid,dist} from '@/lib/qr';
const MIN_SECONDS=3;            // a real person needs at least this long between scanning and submitting. Set 0 to turn off
const CROSS_SESSION_CHECK=true; // flag a phone that already attended this course under a different student ID. false = turn off
const J=(b:any,s=200,c?:string)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json',...(c?{'set-cookie':c}:{})}});
type E<T>={t:number,v:Promise<T>};
const memo=<T>(m:Map<string,E<T>>,k:string,ttl:number,f:()=>Promise<T>):Promise<T>=>{const e=m.get(k);if(e&&Date.now()-e.t<ttl)return e.v;const v=f();m.set(k,{t:Date.now(),v});v.catch(()=>m.delete(k));return v};
const sessC=new Map<string,E<any>>(),venC=new Map<string,E<any>>(),enrC=new Map<string,E<Set<string>>>();
const used=new Set<string>(); // one-time tickets already used, kept in the server's memory
const getSession=(sid:string)=>memo(sessC,sid,4000,async()=>(await q('select s.*,c.programs from sessions s join courses c on c.id=s.course_id where s.id=$1',[sid]))[0]);
const getVenue=(id:number)=>memo(venC,String(id),30000,async()=>(await q('select * from venues where id=$1',[id]))[0]);
const getEnrol=(cid:number)=>memo(enrC,String(cid),30000,async()=>new Set<string>((await q('select student_id from enrolments where course_id=$1',[cid])).map((r:any)=>r.student_id)));
const isOpen=(s:any)=>!!s&&s.status==='active'&&new Date(s.ends_at)>new Date();
const inside=(v:any,radius:number,b:any)=>{const d=dist(+b.lat,+b.lng,v.lat,v.lng),acc=+b.acc||9999;return {d,acc,ok:isFinite(d)&&acc<=100&&d-Math.min(acc,25)<=radius}};
const where=(w:any)=>w.acc>100?'Your location is not accurate enough. Move near a window and rescan.':`You are not at the lecture venue (${Math.round(w.d)} m away).`;

export async function POST(r:Request){const b=await r.json();const cookies=r.headers.get('cookie')||'';
 if(b.step==='begin'){const s=b.sid&&await getSession(b.sid).catch(()=>null);
  if(!isOpen(s))return J({error:'Attendance is not open.'},404);
  if(!valid(s.secret,b.sid,b.t))return J({error:'QR code expired.'},403); // server-side token check
  const dev=String(b.device||(cookies.match(/(?:^|; )devId=([^;]+)/)||[])[1]||'').slice(0,64); // phone ID kept in browser storage and a cookie
  if(dev.length<8)return J({error:'Your browser blocked storage. Open the link in Safari or Chrome (not in a private tab) and rescan.'},400);
  return J({ticket:await sign({sid:b.sid,typ:'t',dev,jti:randomUUID(),t0:Date.now()},'10m'),programs:s.programs||[]})} // phone ID is locked into the ticket
 const t=await verify(b.ticket);if(!t||t.typ!=='t'||t.sid!==b.sid||!t.dev)return J({error:'Session expired. Rescan the QR code.'},403);
 const dev=String(t.dev),jti=String(t.jti);
 if(used.has(jti))return J({error:'This attempt was already used. Rescan the QR code to try again.'},403); // one-time ticket
 const s=await getSession(b.sid);if(!isOpen(s))return J({error:'Attendance has closed.'},404);
 const w=inside(await getVenue(s.venue_id),Math.max(+s.radius||60,30),b); // allowed distance is never less than 30 m
 if(b.step==='where')return w.ok?J({ok:1}):J({error:where(w)},403); // early location check, right after scanning
 if(Date.now()-Number(t.t0)<MIN_SECONDS*1000)return J({error:'Please wait a few seconds and press Submit again.'},429); // speed check
 const id=String(b.studentId||'').trim().toUpperCase();if(!/^[A-Z0-9\/\-]{4,20}$/.test(id))return J({error:'Enter a valid student ID.'},400);
 const progs:string[]=s.programs||[],prog=String(b.program||'').trim();
 if(progs.length&&!progs.includes(prog))return J({error:'Please choose your programme.'},400);
 const rec=(st:string,why:string)=>q('insert into attendance(session_id,student_id,status,reason,dist,acc,program,device) values($1,$2,$3,$4,$5,$6,$7,$8)',[b.sid,id,st,why,isFinite(w.d)?w.d:null,isFinite(w.acc)?w.acc:null,progs.length?prog:null,dev]);
 const cookie=`att_${b.sid}=${encodeURIComponent(id)};Path=/;Max-Age=86400;HttpOnly;SameSite=Lax`;
 const enr=await getEnrol(s.course_id);
 if(enr.size>0&&!enr.has(id)){await rec('rejected','Not enrolled in this course');return J({error:'You are not enrolled in this course. Check your student ID.'},403)}
 if(!w.ok){await rec('rejected',`Outside venue (${Math.round(w.d)}m, accuracy ${Math.round(w.acc)}m)`);return J({error:'You are not at the lecture venue.'},403)}
 if(used.size>50000)used.clear();
 if((await q("select 1 from attendance where session_id=$1 and student_id=$2 and status='accepted'",[b.sid,id])).length){used.add(jti);return J({ok:1,message:'Already recorded.'})}
 const m=cookies.match(new RegExp(`att_${b.sid}=([^;]+)`)); // one-device check 1: session cookie
 if(m&&decodeURIComponent(m[1])!==id){used.add(jti);await rec('flagged',`Same device already used for ${decodeURIComponent(m[1])}`);return J({error:'This phone was already used for another student ID. Your attempt was flagged. Tell your lecturer.'},409)}
 // one-device check 2: phone ID, in this session and (optionally) anywhere in this course
 const [x]=await q(`select a.student_id,(a.session_id=$4) as same_session from attendance a join sessions s2 on s2.id=a.session_id where a.device=$2 and a.status='accepted' and a.student_id<>$3 and ((s2.course_id=$1 and $5) or a.session_id=$4) order by (a.session_id=$4) desc limit 1`,[s.course_id,dev,id,b.sid,CROSS_SESSION_CHECK]);
 if(x){used.add(jti);await rec('flagged',x.same_session?`Same device already used for ${x.student_id}`:`Phone previously used by ${x.student_id} in this course`);
  return J({error:x.same_session?'This phone was already used for another student ID. Your attempt was flagged. Tell your lecturer.':'This phone was already used by another student in this course. Your attempt was flagged. Tell your lecturer.'},409)}
 try{await rec('accepted','Verified')}catch{used.add(jti);return J({ok:1,message:'Already recorded.'})}
 used.add(jti);
 return J({ok:1,message:'Attendance recorded.'},200,cookie)}
