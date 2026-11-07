import PDFDocument from 'pdfkit';import {q} from '@/lib/db';import {me} from '@/lib/auth';
const csv=(t:any[][])=>t.map(l=>l.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
async function pdf(title:string,sub:string,head:string[],data:any[][]){
 const ch:Buffer[]=[];const d=new PDFDocument({margin:40});d.on('data',(x:Buffer)=>ch.push(x));
 await new Promise<void>(res=>{d.on('end',()=>res());d.fontSize(16).text(title).fontSize(9).text(sub).moveDown();
  const w=Math.floor(515/head.length);
  const row=(l:any[],b=false)=>{const y=d.y;d.font(b?'Helvetica-Bold':'Helvetica').fontSize(9);l.forEach((v,i)=>d.text(String(v??''),40+i*w,y,{width:w-5,lineBreak:false,ellipsis:true}));d.y=y+16;if(d.y>740)d.addPage()};
  row(head,true);data.forEach(l=>row(l));d.end()});
 return new Uint8Array(Buffer.concat(ch))}
const send=(body:any,type:string,name:string)=>new Response(body,{headers:{'content-type':type,'content-disposition':`attachment; filename="${name}"`}});
export async function GET(r:Request){const u:any=await me();if(!u)return new Response('auth',{status:401});
 const p=new URL(r.url).searchParams,fmt=p.get('format'),sess=p.get('session');
 if(sess){ // ---- one session ----
  const [s]=await q(`select s.id,s.started_at,c.code,c.title,v.name venue from sessions s join courses c on c.id=s.course_id join venues v on v.id=s.venue_id where s.id=$1 and c.lecturer_id=$2`,[sess,u.uid]);
  if(!s)return new Response('404',{status:404});
  const rows=await q('select student_id,status,reason,round(dist) dist,created_at from attendance where session_id=$1 order by id',[sess]);
  const head=['Student ID','Status','Reason','Distance (m)','Time'];
  const data=rows.map((x:any)=>[x.student_id,x.status,x.reason,x.dist,new Date(x.created_at).toLocaleTimeString()]);
  const name=`${s.code}-session-${new Date(s.started_at).toISOString().slice(0,16).replace(/[:T]/g,'-')}`.replace(/\s+/g,'_');
  if(fmt==='csv')return send(csv([head,...data]),'text/csv',name+'.csv');
  const present=rows.filter((x:any)=>x.status==='accepted').length;
  return send(await pdf(`${s.code} ${s.title||''} - Session Attendance`,`${new Date(s.started_at).toLocaleString()} | ${s.venue} | ${present} present, ${rows.length-present} flagged/rejected`,head,data),'application/pdf',name+'.pdf')}
 // ---- whole course ----
 const c=p.get('course');const [co]=await q('select * from courses where id=$1 and lecturer_id=$2',[c,u.uid]);if(!co)return new Response('404',{status:404});
 const rows=await q(`with st as(select student_id from enrolments where course_id=$1 union select a.student_id from attendance a join sessions s on s.id=a.session_id where s.course_id=$1 and a.status='accepted')
  select st.student_id,(select count(*) from attendance a join sessions s on s.id=a.session_id where s.course_id=$1 and a.student_id=st.student_id and a.status='accepted')::int attended,(select count(*) from sessions where course_id=$1)::int total from st order by 1`,[c]);
 const data=rows.map((x:any)=>[x.student_id,x.total,x.attended,x.total-x.attended,x.total?Math.round(100*x.attended/x.total)+'%':'0%']);
 const head=['Student ID','Lectures held','Attended','Missed','Attendance %'];const name=`${co.code}-attendance`.replace(/\s+/g,'_');
 if(fmt==='csv')return send(csv([head,...data]),'text/csv',name+'.csv');
 return send(await pdf(`${co.code} ${co.title||''} - Attendance Report`,new Date().toLocaleString(),head,data),'application/pdf',name+'.pdf')}
