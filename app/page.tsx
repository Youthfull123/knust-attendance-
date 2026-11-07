'use client';
import {useEffect,useState} from 'react';import {QRCodeSVG} from 'qrcode.react';
const api=(u:string,m='GET',b?:any)=>fetch(u,{method:m,body:b&&JSON.stringify(b)}).then(r=>r.json());
export default function Home(){
 const [auth,setAuth]=useState(false),[courses,setC]=useState<any[]>([]),[venues,setV]=useState<any[]>([]),[sid,setSid]=useState(''),[live,setL]=useState<any>(null),[err,setErr]=useState('');
 const load=async()=>{const c=await api('/api/courses');if(c.error)return setAuth(false);setAuth(true);setC(c);setV(await api('/api/venues'))};
 useEffect(()=>{load()},[]);
 useEffect(()=>{if(!sid)return;const f=async()=>setL(await api('/api/sessions?id='+sid));f();const i=setInterval(f,4000);return()=>clearInterval(i)},[sid]);
 const fd=(f:any)=>Object.fromEntries(new FormData(f));
 const go=async(action:string,f:any)=>{const r=await api('/api/auth','POST',{action,...fd(f)});r.error?setErr(r.error):load()};
 if(!auth)return <div className="c"><h3>Lecturer login / register</h3><form onSubmit={e=>{e.preventDefault();go('login',e.target)}}><input name="email" placeholder="Email"/><br/><input name="password" type="password" placeholder="Password"/><br/><input name="name" placeholder="Name (register only)"/><br/><button>Log in</button> <button type="button" onClick={e=>go('register',(e.target as any).form)}>Register</button></form><p style={{color:'crimson'}}>{err}</p></div>;
 return <div>
  <button onClick={async()=>{await api('/api/auth','POST',{action:'logout'});setAuth(false)}}>Log out</button>
  <div className="c"><h3>New course</h3><form onSubmit={async e=>{e.preventDefault();const f=e.target as any;await api('/api/courses','POST',fd(f));f.reset();load()}}><input name="code" placeholder="Course code e.g. COE 361" required/> <input name="title" placeholder="Title"/><br/><textarea name="students" placeholder="Enrolled student IDs (separated by commas/spaces/lines)" rows={3} style={{width:'100%'}}/><button>Create course</button></form></div>
  <div className="c"><h3>Start attendance</h3><form onSubmit={async e=>{e.preventDefault();const r=await api('/api/sessions','POST',fd(e.target));r.id?setSid(r.id):setErr(r.error)}}>
   <select name="course" required>{courses.map(c=><option key={c.id} value={c.id}>{c.code}</option>)}</select> <select name="venue" required>{venues.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select><br/>
   <input name="radius" type="number" placeholder="Radius m (default: venue)"/> <input name="minutes" type="number" defaultValue={15}/> min <button>Start Attendance</button></form></div>
  {sid&&live&&<div className="c"><h3>Live session ({live.status})</h3>
   {live.token&&<QRCodeSVG value={`${location.origin}/attend?s=${sid}&t=${live.token}`} size={260}/>}
   <p>Present: {live.rows.filter((r:any)=>r.status==='accepted').length} / {live.expected} expected</p>
   {live.status==='active'&&<button onClick={()=>api('/api/sessions','PATCH',{id:sid,action:'close'})}>Close session</button>}
   <table><tbody>{live.rows.map((r:any)=><tr key={r.id}><td>{r.student_id}</td><td>{r.status}</td><td>{r.reason}</td><td>{r.dist}m</td><td>{r.status==='flagged'&&<button onClick={()=>api('/api/sessions','PATCH',{id:sid,action:'approve',att:r.id})}>Approve</button>}</td></tr>)}</tbody></table></div>}
  <div className="c"><h3>Courses & reports</h3><table><tbody>{courses.map(c=><tr key={c.id}><td>{c.code} {c.title}</td><td>{c.enrolled} enrolled, {c.sessions} sessions</td><td><a href={`/api/reports?course=${c.id}&format=csv`}>CSV</a> · <a href={`/api/reports?course=${c.id}&format=pdf`}>PDF</a></td></tr>)}</tbody></table></div></div>}
