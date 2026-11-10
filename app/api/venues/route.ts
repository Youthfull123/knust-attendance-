import {q} from '@/lib/db';import {me} from '@/lib/auth';
export async function GET(){const u:any=await me();
 if(!u){await q('select 1');return Response.json([])} // keeps the database awake for the uptime monitor
 return Response.json(await q('select id,name,radius from venues where owner_id=$1 order by name',[u.uid]))}
export async function POST(r:Request){const u:any=await me();if(!u)return Response.json({error:'auth'},{status:401});
 const {name,lat,lng,radius}=await r.json();if(!name||!isFinite(lat)||!isFinite(lng))return Response.json({error:'bad'},{status:400});
 await q('insert into venues(name,lat,lng,radius,owner_id) values($1,$2,$3,$4,$5) on conflict(owner_id,name) do update set lat=$2,lng=$3,radius=$4',[String(name).trim(),lat,lng,radius||60,u.uid]);
 return Response.json({ok:1})}
export async function DELETE(r:Request){const u:any=await me();if(!u)return Response.json({error:'auth'},{status:401});
 const {id}=await r.json();const [v]=await q('select id from venues where id=$1 and owner_id=$2',[id,u.uid]);if(!v)return Response.json({error:'404'},{status:404});
 const [n]=await q("select count(*)::int n from sessions where venue_id=$1 and status='active' and ends_at>now()",[id]);
 if(n.n>0)return Response.json({error:'A session using this venue is still open. Close it first.'},{status:409});
 await q('update sessions set venue_id=null where venue_id=$1',[id]);
 await q('delete from venues where id=$1',[id]);return Response.json({ok:1})}
