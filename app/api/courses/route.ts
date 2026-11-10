import {q} from '@/lib/db';import {me} from '@/lib/auth';
const parse=(s:any)=>[...new Set(String(s||'').split(/[,\n;]+/).map(x=>x.trim()).filter(Boolean))];
export async function GET(){const u:any=await me();if(!u)return Response.json({error:'auth'},{status:401});
 return Response.json(await q('select c.*,(select count(*) from sessions s where s.course_id=c.id)::int sessions,(select count(*) from enrolments e where e.course_id=c.id)::int enrolled from courses c where lecturer_id=$1 order by id desc',[u.uid]))}
export async function POST(r:Request){const u:any=await me();if(!u)return Response.json({error:'auth'},{status:401});
 const {code,title,students,programs}=await r.json();const [c]=await q('insert into courses(lecturer_id,code,title,programs) values($1,$2,$3,$4) returning id',[u.uid,code,title,parse(programs)]);
 for(const s of String(students||'').split(/[\s,;]+/).filter(Boolean))await q('insert into enrolments values($1,$2) on conflict do nothing',[c.id,s.trim().toUpperCase()]);
 return Response.json({ok:1})}
export async function PATCH(r:Request){const u:any=await me();if(!u)return Response.json({error:'auth'},{status:401});
 const {id,programs}=await r.json();await q('update courses set programs=$3 where id=$1 and lecturer_id=$2',[id,u.uid,parse(programs)]);return Response.json({ok:1})}
export async function DELETE(r:Request){const u:any=await me();if(!u)return Response.json({error:'auth'},{status:401});
 const {id}=await r.json();const [c]=await q('select id from courses where id=$1 and lecturer_id=$2',[id,u.uid]);if(!c)return Response.json({error:'404'},{status:404});
 await q('delete from attendance where session_id in (select id from sessions where course_id=$1)',[id]);
 await q('delete from sessions where course_id=$1',[id]);
 await q('delete from courses where id=$1',[id]);
 return Response.json({ok:1})}
