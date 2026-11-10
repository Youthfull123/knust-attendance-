import {q} from '@/lib/db';import {sign,verify} from '@/lib/auth';import {valid,dist,euclid} from '@/lib/qr';
const FACE_THRESHOLD=0.5; // face-api 128-d descriptors: distance <0.5 ≈ same person
const cache=new Map<string,Promise<any[]>>(); // per-session faces kept in memory
const J=(b:any,s=200)=>Response.json(b,{status:s});
const active=async(sid:string)=>(await q("select * from sessions where id=$1 and status='active' and ends_at>now()",[sid]))[0];
export async function POST(r:Request){const b=await r.json();
 if(b.step==='begin'){const s=b.sid&&await active(b.sid).catch(()=>null);
  if(!s)return J({error:'Attendance is not open.'},404);
  if(!valid(s.secret,b.sid,b.t))return J({error:'QR code expired.'},403); // server-side token validation
  return J({ticket:await sign({sid:b.sid,typ:'t'},'5m')})}
 const t=await verify(b.ticket);if(!t||t.typ!=='t'||t.sid!==b.sid)return J({error:'Session expired. Rescan the QR code.'},403);
 const s=await active(b.sid);if(!s)return J({error:'Attendance has closed.'},404);
 const id=String(b.studentId||'').trim().toUpperCase();if(!/^[A-Z0-9\/\-]{4,20}$/.test(id))return J({error:'Enter a valid student ID.'},400);
 const face=b.face;const okFace=Array.isArray(face)&&face.length===128&&face.every((x:any)=>typeof x==='number'&&isFinite(x));
 const [v]=await q('select * from venues where id=$1',[s.venue_id]);const d=dist(+b.lat,+b.lng,v.lat,v.lng),acc=+b.acc||9999;
 const rec=async(status:string,reason:string,keep=false)=>{await q('insert into attendance(session_id,student_id,status,reason,dist,acc,face) values($1,$2,$3,$4,$5,$6,$7)',[b.sid,id,status,reason,isFinite(d)?d:null,acc,keep?face:null])};
 const [en]=await q('select count(*)::int n,count(*) filter(where student_id=$2)::int me from enrolments where course_id=$1',[s.course_id,id]);
 if(en.n>0&&!en.me){await rec('rejected','Not enrolled in this course');return J({error:'You are not enrolled in this course.'},403)}
 if(!okFace){await rec('rejected','No valid face data');return J({error:'Face check failed.'},400)}
 if(!isFinite(d)||acc>200||d-Math.min(acc,100)>s.radius){await rec('rejected',`Outside venue (${Math.round(d)}m, accuracy ${Math.round(acc)}m)`);return J({error:'You are not at the lecture venue.'},403)}
 const [done]=await q("select 1 from attendance where session_id=$1 and student_id=$2 and status='accepted'",[b.sid,id]);if(done)return J({ok:1,message:'Already recorded.'});
 let p=cache.get(b.sid);if(!p){p=q("select student_id id,face f from attendance where session_id=$1 and status='accepted' and face is not null",[b.sid]);cache.set(b.sid,p)}
 const fc=await p;const hit=fc.find((o:any)=>o.id!==id&&euclid(face,o.f)<FACE_THRESHOLD);
 if(hit){await rec('flagged',`Same face as ${hit.id}`);return J({error:'This face was already used for another student ID. Your attempt was flagged for lecturer review.'},409)}
 fc.push({id,f:face});await rec('accepted','Verified',true);return J({ok:1,message:'Attendance recorded.'})}
