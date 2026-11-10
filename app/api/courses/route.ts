import {q} from '@/lib/db';import {me} from '@/lib/auth';
export async function GET(){const u:any=await me();if(!u)return Response.json({error:'auth'},{status:401});
 return Response.json(await q('select c.*,(select count(*) from sessions s where s.course_id=c.id)::int sessions,(select count(*) from enrolments e where e.course_id=c.id)::int enrolled from courses c where lecturer_id=$1 order by id desc',[u.uid]))}
export async function POST(r:Request){const u:any=await me();if(!u)return Response.json({error:'auth'},{status:401});
 const {code,title,students}=await r.json();const [c]=await q('insert into courses(lecturer_id,code,title) values($1,$2,$3) returning id',[u.uid,code,title]);
 for(const s of String(students||'').split(/[\s,;]+/).filter(Boolean))await q('insert into enrolments values($1,$2) on conflict do nothing',[c.id,s.trim().toUpperCase()]);
 return Response.json({ok:1})}
export async function DELETE(r:Request){const u:any=await me();if(!u)return Response.json({error:'auth'},{status:401});
 const {id}=await r.json();const [c]=await q('select id from courses where id=$1 and lecturer_id=$2',[id,u.uid]);if(!c)return Response.json({error:'404'},{status:404});
 await q('delete from attendance where session_id in (select id from sessions where course_id=$1)',[id]);
 await q('delete from sessions where course_id=$1',[id]);
 await q('delete from courses where id=$1',[id]); // enrolments are removed automatically
 return Response.json({ok:1})}
