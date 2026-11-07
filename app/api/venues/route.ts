import {q} from '@/lib/db';
export async function GET(){return Response.json(await q('select id,name,radius from venues order by name'))}
