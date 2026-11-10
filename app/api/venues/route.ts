import {q} from '@/lib/db';import {me} from '@/lib/auth';
export async function GET(){return Response.json(await q('select id,name,radius from venues order by name'))}
export async function POST(r:Request){if(!await me())return Response.json({error:'auth'},{status:401});
 const {name,lat,lng,radius}=await r.json();if(!name||!isFinite(lat)||!isFinite(lng))return Response.json({error:'bad'},{status:400});
 await q('insert into venues(name,lat,lng,radius) values($1,$2,$3,$4) on conflict(name) do update set lat=$2,lng=$3,radius=$4',[String(name).trim(),lat,lng,radius||60]);
 return Response.json({ok:1})}
export async function DELETE(r:Request){if(!await me())return Response.json({error:'auth'},{status:401});
 const {id}=await r.json();const [n]=await q("select count(*)::int n from sessions where venue_id=$1 and status='active' and ends_at>now()",[id]);
 if(n.n>0)return Response.json({error:'A session using this venue is still open. Close it first.'},{status:409});
 await q('update sessions set venue_id=null where venue_id=$1',[id]);
 await q('delete from venues where id=$1',[id]);return Response.json({ok:1})}
