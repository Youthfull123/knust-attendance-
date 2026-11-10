import {q} from '@/lib/db';import {sign,verify} from '@/lib/auth';import {valid,dist,euclid} from '@/lib/qr';
const FACE_THRESHOLD=0.5; // lower = stricter. If the same person is NOT caught, raise to 0.55
const J=(b:any,s=200,c?:string)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json',...(c?{'set-cookie':c}:{})}});
type E<T>={t:number,v:Promise<T>};
const memo=<T>(m:Map<string,E<T>>,k:string,ttl:number,f:()=>Promise<T>):Promise<T>=>{const e=m.get(k);if(e&&Date.now()-e.t<ttl)return e.v;const v=f();m.set(k,{t:Date.now(),v});v.catch(()=>m.delete(k));return v};
const sessC=new Map<string,E<any>>(),venC=new Map<string,E<any>>(),enrC=new Map<string,E<Set<string>>>(),faceC=new Map<string,Promise<any[]>>();
const getSession=(sid:string)=>memo(sessC,sid,4000,async()=>(await q('select s.*,c.programs from sessions s join courses c on c.id=s.course_id where s.id=$1',[sid]))[0]);
const getVenue=(id:number)=>memo(venC,String(id),30000,async()=>(await q('select * from venues where id=$1',[id]))[0]);
const getEnrol=(cid:number)=>memo(enrC,String(cid),30000,async()=>new Set<string>((await q('select student_id from enrolments where course_id=$1',[cid])).map((r:any)=>r.student_id)));
const isOpen=(s:any)=>!!s&&s.status==='active'&&new Date(s.ends_at)>new Date();
const inside=(v:any,radius:number,b:any)=>{const d=dist(+b.lat,+b.lng,v.lat,v.lng),acc=+b.acc||9999;return {d,acc,ok:isFinite(d)&&acc<=100&&d-Math.min(acc,25)<=radius}};
const ticketOk=async(b:any)=>{const t=await verify(b.ticket);return !!t&&t.typ==='t'&&t.sid===b.sid};
const where=(w:any)=>w.acc>100?'Your location is not accurate enough. Move near a window and rescan.':`You are not at the lecture venue (${Math.round(w.d)} m away).`;

export async function POST(r:Request){const b=await r.json();
 if(b.step==='begin'){const s=b.sid&&await getSession(b.sid).catch(()=>null);
  if(!isOpen(s))return J({error:'Attendance is not open.'},404);
  if(!valid(s.secret,b.sid,b.t))return J({error:'QR code expired.'},403); // server-side token check
    return J({ticket:await sign({sid:b.sid,typ:'t'},'10m'),programs:s.programs||[]})}
 if(!await ticketOk(b))return J({error:'Session expired. Rescan the QR code.'},403);
 const s=await getSession(b.sid);if(!isOpen(s))return J({error:'Attendance has closed.'},404);
 const w=inside(await getVenue(s.venue_id),s.radius,b);
 if(b.step==='where')return w.ok?J({ok:1}):J({error:where(w)},403); // early location check, right after scanning
 const id=String(b.studentId||'').trim().toUpperCase();if(!/^[A-Z0-9\/\-]{4,20}$/.test(id))return J({error:'Enter a valid student ID.'},400);
 const face=b.face,okFace=Array.isArray(face)&&face.length===128&&face.every((x:any)=>typeof x==='number'&&isFinite(x));
  const progs:string[]=s.programs||[],prog=String(b.program||'').trim();
 if(progs.length&&!progs.includes(prog))return J({error:'Please choose your programme.'},400);
 const rec=(st:string,why:string,keep=false)=>q('insert into attendance(session_id,student_id,status,reason,dist,acc,face,program) values($1,$2,$3,$4,$5,$6,$7,$8)',[b.sid,id,st,why,isFinite(w.d)?w.d:null,w.acc,keep?face:null,progs.length?prog:null]);
 const enr=await getEnrol(s.course_id);
 if(enr.size>0&&!enr.has(id)){await rec('rejected','Not enrolled in this course');return J({error:'You are not enrolled in this course.'},403)}
 if(!okFace){await rec('rejected','No valid face data');return J({error:'Face check failed.'},400)}
 if(!w.ok){await rec('rejected',`Outside venue (${Math.round(w.d)}m, accuracy ${Math.round(w.acc)}m)`);return J({error:'You are not at the lecture venue.'},403)}
 const m=(r.headers.get('cookie')||'').match(new RegExp(`att_${b.sid}=([^;]+)`)); // same-device check
 if(m&&decodeURIComponent(m[1])!==id){await rec('flagged',`Same device already used for ${decodeURIComponent(m[1])}`);return J({error:'This device was already used for another student ID. Your attempt was flagged.'},409)}
 let p=faceC.get(b.sid);if(!p){p=q("select student_id id,face f from attendance where session_id=$1 and status='accepted' and face is not null",[b.sid]);faceC.set(b.sid,p)}
 const fc=await p; // faces kept in memory for the session
 if(fc.some((o:any)=>o.id===id))return J({ok:1,message:'Already recorded.'});
 const hit=fc.find((o:any)=>euclid(face,o.f)<FACE_THRESHOLD); // real face matching
 if(hit){await rec('flagged',`Same face as ${hit.id}`);return J({error:'This face was already used for another student ID. Your attempt was flagged for lecturer review.'},409)}
 fc.push({id,f:face});await rec('accepted','Verified',true);
 return J({ok:1,message:'Attendance recorded.'},200,`att_${b.sid}=${encodeURIComponent(id)};Path=/;Max-Age=86400;HttpOnly;SameSite=Lax`)}
