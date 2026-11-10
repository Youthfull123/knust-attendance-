import {q} from '@/lib/db';import {me} from '@/lib/auth';import bcrypt from 'bcryptjs';
const J=(b:any,s=200)=>Response.json(b,{status:s});
const guard=async()=>{const u:any=await me();return u?(u.role==='admin'?u:'forbidden'):'auth'};
export async function GET(r:Request){const u:any=await guard();if(typeof u==='string')return J({error:u},u==='auth'?401:403);
 const sp=new URL(r.url).searchParams,v=sp.get('view');
 if(v==='stats')return J((await q(`select (select count(*) from users where role='lecturer')::int lecturers,(select count(*) from courses)::int courses,(select count(*) from sessions)::int sessions,(select count(*) from attendance where status='accepted')::int present`))[0]);
 if(v==='lecturers')return J(await q(`select u.id,u.email,u.name,u.role,u.active,(select count(*) from courses c where c.lecturer_id=u.id)::int courses,(select count(*) from sessions s join courses c on c.id=s.course_id where c.lecturer_id=u.id)::int sessions from users u order by u.id`));
 if(v==='courses')return J(await q(`select c.id,c.code,c.title,u.email lecturer,(select count(*) from sessions s where s.course_id=c.id)::int sessions from courses c left join users u on u.id=c.lecturer_id order by c.id desc`));
 if(v==='venues')return J(await q(`select v.id,v.name,v.radius,u.email owner from venues v left join users u on u.id=v.owner_id order by v.id desc`));
 if(v==='sessions')return J(await q(`select s.id,s.status,s.started_at,c.code,u.email lecturer,coalesce(v.name,'Deleted venue') venue,(select count(*) from attendance a where a.session_id=s.id and a.status='accepted')::int present from sessions s join courses c on c.id=s.course_id left join users u on u.id=c.lecturer_id left join venues v on v.id=s.venue_id order by s.started_at desc limit 300`));
 if(v==='attendance')return J(await q('select id,student_id,status,reason,round(dist) dist,created_at from attendance where session_id=$1 order by id',[sp.get('session')]));
 return J({error:'bad view'},400)}
export async function POST(r:Request){const u:any=await guard();if(typeof u==='string')return J({error:u},u==='auth'?401:403);
 const b=await r.json();
 if(b.action==='active'){if(b.id===u.uid)return J({error:"You can't suspend yourself."},400);await q('update users set active=$2 where id=$1',[b.id,!!b.active])}
 else if(b.action==='role'){if(b.id===u.uid)return J({error:"You can't change your own role."},400);if(!['admin','lecturer'].includes(b.role))return J({error:'bad role'},400);await q('update users set role=$2 where id=$1',[b.id,b.role])}
 else if(b.action==='password'){if(String(b.password||'').length<8)return J({error:'Password must be 8+ characters.'},400);await q('update users set pass=$2 where id=$1',[b.id,await bcrypt.hash(b.password,10)])}
 else if(b.action==='close'){await q("update sessions set status='closed' where id=$1",[b.id]);await q('update attendance set face=null where session_id=$1',[b.id])}
 else if(b.action==='approve'){try{await q("update attendance set status='accepted',reason='Approved by admin' where id=$1",[b.id])}catch{}}
 return J({ok:1})}
export async function DELETE(r:Request){const u:any=await guard();if(typeof u==='string')return J({error:u},u==='auth'?401:403);
 const {type,id}=await r.json();
 if(type==='attendance')await q('delete from attendance where id=$1',[id]);
 else if(type==='session'){await q('delete from attendance where session_id=$1',[id]);await q('delete from sessions where id=$1',[id])}
 else if(type==='course'){await q('delete from attendance where session_id in (select id from sessions where course_id=$1)',[id]);await q('delete from sessions where course_id=$1',[id]);await q('delete from courses where id=$1',[id])}
 else if(type==='venue'){const [n]=await q("select count(*)::int n from sessions where venue_id=$1 and status='active' and ends_at>now()",[id]);if(n.n>0)return J({error:'A session using this venue is still open. Close it first.'},409);await q('update sessions set venue_id=null where venue_id=$1',[id]);await q('delete from venues where id=$1',[id])}
 else if(type==='lecturer'){if(id===u.uid)return J({error:"You can't delete yourself."},400);
  await q('delete from attendance where session_id in (select s.id from sessions s join courses c on c.id=s.course_id where c.lecturer_id=$1)',[id]);
  await q('delete from sessions where course_id in (select id from courses where lecturer_id=$1)',[id]);
  await q('delete from courses where lecturer_id=$1',[id]);
  await q('update sessions set venue_id=null where venue_id in (select id from venues where owner_id=$1)',[id]);
  await q('delete from venues where owner_id=$1',[id]);await q('delete from users where id=$1',[id])}
 else return J({error:'bad type'},400);
 return J({ok:1})}
