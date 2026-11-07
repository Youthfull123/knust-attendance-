import {q} from '@/lib/db';import {me} from '@/lib/auth';
export async function GET(){return Response.json(await q('select id,name,radius from venues order by name'))}
export async function POST(r:Request){if(!await me())return Response.json({error:'auth'},{status:401});
 const {name,lat,lng,radius}=await r.json();if(!name||!isFinite(lat)||!isFinite(lng))return Response.json({error:'bad'},{status:400});
 await q('insert into venues(name,lat,lng,radius) values($1,$2,$3,$4) on conflict(name) do update set lat=$2,lng=$3,radius=$4',[String(name).trim(),lat,lng,radius||60]);
 return Response.json({ok:1})}
