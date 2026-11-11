import PDFDocument from 'pdfkit';import {q} from '@/lib/db';import {me} from '@/lib/auth';
const csv=(t:any[][])=>t.map(l=>l.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
async function pdf(title:string,sub:string,head:string[],data:any[]){
 const ch:Buffer[]=[];const d=new PDFDocument({margin:40});d.on('data',(x:Buffer)=>ch.push(x));
 await new Promise<void>(res=>{d.on('end',()=>res());d.fontSize(16).text(title).fontSize(9).text(sub).moveDown();
  const w=Math.floor(515/head.length);
  const row=(l:any,b=false)=>{
   if(typeof l==='string'){d.moveDown(.5);d.font('Helvetica-Bold').fontSize(11).text(l,40);d.moveDown(.2);if(d.y>740)d.addPage();return}
   const y=d.y;d.font(b?'Helvetica-Bold':'Helvetica').fontSize(9);l.forEach((v:any,i:number)=>d.text(String(v??''),40+i*w,y,{width:w-5,lineBreak:false,ellipsis:true}));d.y=y+16;if(d.y>740)d.addPage()};
  row(head,true);data.forEach(l=>row(l));d.end()});
 return new Uint8Array(Buffer.concat(ch))}
const send=(body:any,type:string,name:string)=>new Response(body,{headers:{'content-type':type,'content-disposition':`attachment; filename="${name}"`}});
// If any student has a programme: sort by programme, add a Programme column, and group the PDF under programme headings.
const shape=(rows:any[],head:string[],at:number,mk:(r:any,i:number)=>any[])=>{
 if(!rows.some(r=>r.program))return {head,flat:rows.map((r,i)=>mk(r,i)),grouped:rows.map((r,i)=>mk(r,i))};
 const s=[...rows].sort((a,b)=>String(a.program||'~').localeCompare(String(b.program||'~'))||String(a.student_id).localeCompare(String(b.student_id)));
 const ins=(a:any[],p:any)=>[...a.slice(0,at),p,...a.slice(at)];
 const flat=s.map((r,i)=>ins(mk(r,i),r.program||''));
 const grouped:any[]=[];let cur:any=null,n=0;
 for(const r of s){const g=r.program||'Programme not stated';if(g!==cur){cur=g;n=0;grouped.push(`${g} (${s.filter(x=>(x.program||'Programme not stated')===g).length})`)}grouped.push(ins(mk(r,n++),r.program||''))}
 return {head:[...head.slice(0,at),'Programme',...head.slice(at)],flat,grouped}};
export async function GET(r:Request){const u:any=await me();if(!u)return new Response('auth',{status:401});
 const p=new URL(r.url).searchParams,fmt=p.get('format'),sess=p.get('session'),prog=p.get('program')||null,sfx=prog?'-'+prog.replace(/\W+/g,'_'):'';
 if(sess){ // ---- one session (accepted students only) ----
  const [s]=await q(`select s.id,s.started_at,c.code,c.title,coalesce(v.name,'Deleted venue') venue from sessions s join courses c on c.id=s.course_id left join venues v on v.id=s.venue_id where s.id=$1 and c.lecturer_id=$2`,[sess,u.uid]);
  if(!s)return new Response('404',{status:404});
  const rows=await q("select student_id,program,round(dist) dist,created_at from attendance where session_id=$1 and status='accepted' and ($2::text is null or program=$2) order by id",[sess,prog]);
  const {head,flat,grouped}=shape(rows,['No.','Student ID','Distance (m)','Time'],2,(x,i)=>[i+1,x.student_id,x.dist,new Date(x.created_at).toLocaleTimeString()]);
  const name=`${s.code}-session-${new Date(s.started_at).toISOString().slice(0,16).replace(/[:T]/g,'-')}${sfx}`.replace(/\s+/g,'_');
  if(fmt==='csv')return send(csv([head,...flat]),'text/csv',name+'.csv');
  return send(await pdf(`${s.code} ${s.title||''} - Session Attendance`,`${new Date(s.started_at).toLocaleString()} | ${s.venue} | ${rows.length} present${prog?' | '+prog:''}`,head,grouped),'application/pdf',name+'.pdf')}
 // ---- whole course ----
 const c=p.get('course');const [co]=await q('select * from courses where id=$1 and lecturer_id=$2',[c,u.uid]);if(!co)return new Response('404',{status:404});
 let rows=await q(`with st as(select student_id from enrolments where course_id=$1 union select a.student_id from attendance a join sessions s on s.id=a.session_id where s.course_id=$1 and a.status='accepted')
  select st.student_id,(select a.program from attendance a join sessions s on s.id=a.session_id where s.course_id=$1 and a.student_id=st.student_id and a.program is not null order by a.id desc limit 1) program,
  (select count(*) from attendance a join sessions s on s.id=a.session_id where s.course_id=$1 and a.student_id=st.student_id and a.status='accepted')::int attended,(select count(*) from sessions where course_id=$1)::int total from st order by 1`,[c]);
 if(prog)rows=rows.filter((x:any)=>x.program===prog);
 const {head,flat,grouped}=shape(rows,['Student ID','Lectures held','Attended','Missed','Attendance %'],1,x=>[x.student_id,x.total,x.attended,x.total-x.attended,x.total?Math.round(100*x.attended/x.total)+'%':'0%']);
 const name=`${co.code}-attendance${sfx}`.replace(/\s+/g,'_');
 if(fmt==='csv')return send(csv([head,...flat]),'text/csv',name+'.csv');
 return send(await pdf(`${co.code} ${co.title||''} - Attendance Report${prog?' ('+prog+')':''}`,new Date().toLocaleString(),head,grouped),'application/pdf',name+'.pdf')}
