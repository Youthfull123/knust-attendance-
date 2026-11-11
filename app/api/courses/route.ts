import {randomBytes} from 'crypto';import {q} from '@/lib/db';import {me} from '@/lib/auth';import {token,msLeft} from '@/lib/qr';
const own=(sid:string,uid:number)=>q('select s.* from sessions s join courses c on c.id=s.course_id where s.id=$1 and c.lecturer_id=$2',[sid,uid]);
export async function GET(r:Request){const u:any=await me();if(!u)return Response.json({error:'auth'},{status:401});
 const sp=new URL(r.url).searchParams,cid=sp.get('course');
 if(cid)return Response.json(await q(`select s.id,s.status,s.started_at,coalesce(v.name,'Deleted venue') venue,
  count(a.id) filter(where a.status='accepted')::int present,count(a.id) filter(where a.status in('flagged','rejected'))::int issues
  from sessions s join courses c on c.id=s.course_id left join venues v on v.id=s.venue_id left join attendance a on a.session_id=s.id
  where s.course_id=$1 and c.lecturer_id=$2 group by s.id,v.name order by s.started_at desc`,[cid,u.uid]));
 const id=sp.get('id')!;const [s]=await own(id,u.uid);if(!s)return Response.json({error:'404'},{status:404});
 const rows=await q('select id,student_id,program,status,reason,round(dist) dist,created_at from attendance where session_id=$1 order by id',[id]);
 const [c]=await q('select count(*)::int n from enrolments where course_id=$1',[s.course_id]);
 const live=s.status==='active'&&new Date(s.ends_at)>new Date();
 return Response.json({status:live?'active':'closed',token:live?token(s.secret,id):null,ms:live?msLeft():null,rows,expected:c.n})}
export async function POST(r:Request){const u:any=await me();if(!u)return Response.json({error:'auth'},{status:401});
 const {course,venue,radius,minutes}=await r.json();const [c]=await q('select id from courses where id=$1 and lecturer_id=$2',[course,u.uid]);if(!c)return Response.json({error:'404'},{status:404});
 const [v]=await q('select radius from venues where id=$1 and owner_id=$2',[venue,u.uid]);if(!v)return Response.json({error:'Pick a venue'},{status:400});
 const [s]=await q(`insert into sessions(course_id,venue_id,radius,secret,ends_at) values($1,$2,$3,$4,now()+($5||' minutes')::interval) returning id`,[course,venue,radius||v.radius,randomBytes(32).toString('hex'),String(minutes||15)]);
 return Response.json({id:s.id})}
export async function PATCH(r:Request){const u:any=await me();if(!u)return Response.json({error:'auth'},{status:401});
 const {id,action,att}=await r.json();const [s]=await own(id,u.uid);if(!s)return Response.json({error:'404'},{status:404});
 if(action==='close'){await q("update sessions set status='closed' where id=$1",[id]);await q('update attendance set face=null where session_id=$1',[id])}
 if(action==='approve')try{await q("update attendance set status='accepted',reason='Approved by lecturer' where id=$1 and session_id=$2",[att,id])}catch{}
 return Response.json({ok:1})}
export async function DELETE(r:Request){const u:any=await me();if(!u)return Response.json({error:'auth'},{status:401});
 const {id,att}=await r.json();const [s]=await own(id,u.uid);if(!s)return Response.json({error:'404'},{status:404});
 if(att)await q('delete from attendance where id=$1 and session_id=$2',[att,id]);
 else{await q('delete from attendance where session_id=$1',[id]);await q('delete from sessions where id=$1',[id])}
 return Response.json({ok:1})}
