'use client';
import {useEffect,useState} from 'react';import {QRCodeSVG} from 'qrcode.react';
const api=(u:string,m='GET',b?:any)=>fetch(u,{method:m,body:b&&JSON.stringify(b)}).then(r=>r.json());
const QR_WINDOW=10000; // must match WINDOW in lib/qr.ts
const RED={background:'#fdecea',color:'#c0392b'};

export default function Home(){
 const [auth,setAuth]=useState(false),[mode,setMode]=useState('login'),[courses,setC]=useState<any[]>([]),[venues,setV]=useState<any[]>([]),[sid,setSid]=useState(''),[live,setL]=useState<any>(null),[err,setErr]=useState(''),[vmsg,setVmsg]=useState('');
 const load=async()=>{const c=await api('/api/courses');if(c.error)return setAuth(false);setAuth(true);setC(c);setV(await api('/api/venues'))};
 useEffect(()=>{load()},[]);
 useEffect(()=>{if(!sid){setL(null);return}let on=true,t:any;const f=async()=>{const t0=Date.now(),d=await api('/api/sessions?id='+sid);if(!on)return;setL(d);const lag=(Date.now()-t0)/2;t=setTimeout(f,d.ms!=null?Math.max(100,Math.min(2000,d.ms-lag+40)):2000)};f();return()=>{on=false;clearTimeout(t)}},[sid]);
 const fd=(f:any)=>Object.fromEntries(new FormData(f));
 const gone=(id:string)=>setSid(s=>(!id||s===id)?'':s);
 const delVenue=async(v:any)=>{if(!confirm(`Delete venue "${v.name}"?`))return;const r=await api('/api/venues','DELETE',{id:v.id});if(r.error)alert(r.error);load()};
 const delLive=async()=>{if(!confirm('Delete this session and all its attendance records?'))return;await api('/api/sessions','DELETE',{id:sid});setSid('');load()};
 const saveVenue=(e:any)=>{e.preventDefault();const f=e.target,name=String(new FormData(f).get('name')||'').trim();if(!name)return;setVmsg('Getting your location…');
  navigator.geolocation.getCurrentPosition(async g=>{await api('/api/venues','POST',{name,lat:g.coords.latitude,lng:g.coords.longitude,radius:Number(new FormData(f).get('radius'))||60});setVmsg(`Saved "${name}" (GPS accuracy ±${Math.round(g.coords.accuracy)} m).`);f.reset();load()},()=>setVmsg('Location permission denied.'),{enableHighAccuracy:true,timeout:20000})};

 if(!auth)return <div className="hero"><div className="card auth"><div className="logo">KNUST</div><h2 style={{margin:'14px 0 4px'}}>Attendance Site</h2><p style={{color:'#666',margin:0}}>Smart, secure lecture attendance</p>
  <div className="tabs"><button type="button" className={mode==='login'?'':'sec'} onClick={()=>{setMode('login');setErr('')}}>Log in</button><button type="button" className={mode==='register'?'':'sec'} onClick={()=>{setMode('register');setErr('')}}>Register</button></div>
  <form onSubmit={async e=>{e.preventDefault();const r=await api('/api/auth','POST',{action:mode,...fd(e.target)});r.error?setErr(r.error):load()}}>
   {mode==='register'&&<input name="name" placeholder="Full name" required/>}<input name="email" type="email" placeholder="Email" required/><input name="password" type="password" placeholder="Password (8+ characters)" required/>
   <button className="go">{mode==='login'?'Log in':'Create lecturer account'}</button></form><p style={{color:'crimson',minHeight:20}}>{err}</p></div></div>;

 return <div className="wrap">
  <div className="bar"><h2 style={{color:'#0b6b3a',margin:0}}>KNUST Attendance</h2><button className="sec" onClick={async()=>{await api('/api/auth','POST',{action:'logout'});setAuth(false)}}>Log out</button></div>

  <div className="card"><h3>New course</h3><form onSubmit={async e=>{e.preventDefault();const f=e.target as any;await api('/api/courses','POST',fd(f));f.reset();load()}}><input name="code" placeholder="Course code e.g. COE 361" required/> <input name="title" placeholder="Course title"/> <button>Create course</button></form></div>

  <div className="card"><h3>Start attendance</h3><form onSubmit={async e=>{e.preventDefault();const r=await api('/api/sessions','POST',fd(e.target));r.id?setSid(r.id):setErr(r.error)}}>
   <select name="course" required>{courses.map(c=><option key={c.id} value={c.id}>{c.code}</option>)}</select> <select name="venue" required>{venues.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select><br/>
   <input name="radius" type="number" placeholder="Allowed distance m (optional)"/> <input name="minutes" type="number" defaultValue={15} style={{width:70}}/> minutes <button>Start Attendance</button></form>
   <hr style={{border:0,borderTop:'1px solid #e3e9e5',margin:'14px 0'}}/><b>Venue missing or wrong location?</b><p style={{margin:'4px 0',color:'#555'}}>Stand inside the lecture hall, type its name, then tap the button.</p>
   <form onSubmit={saveVenue}><input name="name" placeholder="Venue name"/> <input name="radius" type="number" placeholder="Distance m (60)" style={{width:130}}/> <button className="sec">Save my current location as venue</button></form><p style={{color:'#0b6b3a'}}>{vmsg}</p></div>

  <div className="card"><h3>Venues</h3><table><tbody>{venues.map(v=><tr key={v.id}><td>{v.name}</td><td>{v.radius} m</td><td style={{textAlign:'right'}}><button style={RED} onClick={()=>delVenue(v)}>Delete</button></td></tr>)}</tbody></table></div>

  {sid&&live&&live.rows&&<div className="card"><h3>Live session ({live.status})</h3>
   {live.token&&<div style={{width:260}}><QRCodeSVG value={`${location.origin}/attend?s=${sid}&t=${live.token}`} size={260}/>{live.ms!=null&&<Timer live={live}/>}</div>}
   <p><b>Present: {live.rows.filter((r:any)=>r.status==='accepted').length}</b></p>
   {live.status==='active'&&<button onClick={()=>api('/api/sessions','PATCH',{id:sid,action:'close'})}>Close session</button>} <button style={RED} onClick={delLive}>Delete session</button>
   <table><tbody>{live.rows.map((r:any)=><tr key={r.id}><td>{r.student_id}</td><td>{r.status}</td><td>{r.reason}</td><td>{r.dist}m</td><td>{r.status==='flagged'&&<button onClick={()=>api('/api/sessions','PATCH',{id:sid,action:'approve',att:r.id})}>Approve</button>}</td></tr>)}</tbody></table></div>}

  <div className="card"><h3>Courses & reports</h3>{courses.map(c=><CourseRow key={c.id} c={c} reload={load} gone={gone}/>)}</div>
 </div>}

function CourseRow({c,reload,gone}:{c:any,reload:()=>void,gone:(id:string)=>void}){
 const [open,setOpen]=useState(false),[ss,setSs]=useState<any[]|null>(null),[sel,setSel]=useState(''),[det,setDet]=useState<any>(null);
 const toggle=async()=>{const o=!open;setOpen(o);if(o)setSs(await api('/api/sessions?course='+c.id))};
 const pick=async(id:string)=>{if(sel===id){setSel('');return}setSel(id);setDet(null);setDet(await api('/api/sessions?id='+id))};
 const delCourse=async()=>{if(!confirm(`Delete ${c.code} with ALL its sessions and attendance? This cannot be undone.`))return;await api('/api/courses','DELETE',{id:c.id});gone('');reload()};
 const delSess=async(s:any)=>{if(!confirm('Delete this session and all its attendance records?'))return;await api('/api/sessions','DELETE',{id:s.id});gone(s.id);setSel('');setSs(await api('/api/sessions?course='+c.id))};
 const delAtt=async(sessId:string,att:number)=>{if(!confirm('Remove this attendance record?'))return;await api('/api/sessions','DELETE',{id:sessId,att});setDet(await api('/api/sessions?id='+sessId));setSs(await api('/api/sessions?course='+c.id))};
 return <div style={{borderBottom:'1px solid #e3e9e5',padding:'8px 0'}}>
  <div className="bar"><button className="sec" onClick={toggle} style={{flex:1,textAlign:'left'}}>{open?'▼':'▶'} {c.code} {c.title}</button>
   <span style={{marginLeft:10,whiteSpace:'nowrap'}}><a href={`/api/reports?course=${c.id}&format=csv`}>CSV</a> · <a href={`/api/reports?course=${c.id}&format=pdf`}>PDF</a> <button style={RED} onClick={delCourse}>Delete</button></span></div>
  {open&&<div style={{paddingLeft:14}}>
   {!ss?<p>Loading…</p>:!Array.isArray(ss)||!ss.length?<p>No sessions yet.</p>:ss.map((s:any,i:number)=><div key={s.id}>
    <div className="bar"><button className="sec" style={{flex:1,textAlign:'left'}} onClick={()=>pick(s.id)}>{sel===s.id?'▼':'▶'} Session {ss.length-i} · {new Date(s.started_at).toLocaleString()} · {s.venue} · {s.present} present{s.issues?` · ${s.issues} flagged/rejected`:''}</button>
     <span style={{marginLeft:10,whiteSpace:'nowrap'}}><a href={`/api/reports?session=${s.id}&format=pdf`}>PDF</a> · <a href={`/api/reports?session=${s.id}&format=csv`}>CSV</a> <button style={RED} onClick={()=>delSess(s)}>Delete</button></span></div>
    {sel===s.id&&(!det||!det.rows?<p>Loading…</p>:<table><tbody>{det.rows.length?det.rows.map((r:any)=><tr key={r.id}><td>{r.student_id}</td><td>{r.status}</td><td>{r.reason}</td><td>{r.dist}m</td><td style={{textAlign:'right'}}><button style={RED} onClick={()=>delAtt(s.id,r.id)}>✕</button></td></tr>):<tr><td>No attempts in this session.</td></tr>}</tbody></table>)}
   </div>)}</div>}</div>}

function Timer({live}:{live:any}){
 const [end,setEnd]=useState(0),[now,setNow]=useState(Date.now());
 useEffect(()=>{setEnd(Date.now()+live.ms)},[live]);
 useEffect(()=>{const i=setInterval(()=>setNow(Date.now()),100);return()=>clearInterval(i)},[]);
 const left=Math.max(0,end-now),pct=Math.min(100,100*left/QR_WINDOW);
 return <div style={{marginTop:8}}>
  <div style={{height:8,background:'#e4ece7',borderRadius:4,overflow:'hidden'}}><div style={{height:8,width:pct+'%',background:left<1500?'#d9534f':'#0b6b3a',transition:'width .1s linear'}}/></div>
  <div style={{textAlign:'center',marginTop:4,fontWeight:600,color:left<1500?'#d9534f':'#0b6b3a'}}>New code in {(left/1000).toFixed(1)}s</div></div>}
