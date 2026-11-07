import PDFDocument from 'pdfkit';import {q} from '@/lib/db';import {me} from '@/lib/auth';
export async function GET(r:Request){const u:any=await me();if(!u)return new Response('auth',{status:401});
 const p=new URL(r.url).searchParams,c=p.get('course');const [co]=await q('select * from courses where id=$1 and lecturer_id=$2',[c,u.uid]);if(!co)return new Response('404',{status:404});
 const rows=await q(`with st as(select student_id from enrolments where course_id=$1 union select a.student_id from attendance a join sessions s on s.id=a.session_id where s.course_id=$1 and a.status='accepted')
  select st.student_id,(select count(*) from attendance a join sessions s on s.id=a.session_id where s.course_id=$1 and a.student_id=st.student_id and a.status='accepted')::int attended,(select count(*) from sessions where course_id=$1)::int total from st order by 1`,[c]);
 const data=rows.map((x:any)=>[x.student_id,x.total,x.attended,x.total-x.attended,x.total?Math.round(100*x.attended/x.total)+'%':'0%']);
 const head=['Student ID','Lectures held','Attended','Missed','Attendance %'];const name=`${co.code}-attendance`.replace(/\s+/g,'_');
 if(p.get('format')==='csv')return new Response([head,...data].map(l=>l.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n'),{headers:{'content-type':'text/csv','content-disposition':`attachment; filename="${name}.csv"`}});
 const ch:Buffer[]=[];const d=new PDFDocument({margin:40});d.on('data',(x:Buffer)=>ch.push(x));
 await new Promise<void>(res=>{d.on('end',()=>res());d.fontSize(16).text(`${co.code} ${co.title||''} - Attendance Report`).fontSize(9).text(new Date().toLocaleString()).moveDown();
  const row=(l:any[],b=false)=>{const y=d.y;d.font(b?'Helvetica-Bold':'Helvetica').fontSize(10);l.forEach((v,i)=>d.text(String(v),40+i*100,y,{width:95}));d.y=y+16;if(d.y>740)d.addPage()};
  row(head,true);data.forEach((l:any[])=>row(l));d.end()});
 return new Response(new Uint8Array(Buffer.concat(ch)),{headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="${name}.pdf"`}})}
