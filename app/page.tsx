'use client';
import {useEffect,useState} from 'react';import {QRCodeSVG} from 'qrcode.react';
const api=(u:string,m='GET',b?:any)=>fetch(u,{method:m,headers:{'content-type':'application/json'},body:b&&JSON.stringify(b)}).then(async r=>{const t=await r.text();let j:any;try{j=JSON.parse(t)}catch{j={error:`Server error ${r.status}`}}if(m==='DELETE'&&j.error)alert(j.error);return j});
const QR_WINDOW=10000; // must match WINDOW in lib/qr.ts
const RED={background:'#fdecea',color:'#c0392b'};

export default function Home(){
 const [auth,setAuth]=useState(false),[mode,setMode]=useState('login'),[busy,setBusy]=useState(false),[courses,setC]=useState<any[]>([]),[venues,setV]=useState<any[]>([]),[sid,setSid]=useState(''),[live,setL]=useState<any>(null),[err,setErr]=useState(''),[vmsg,setVmsg]=useState('');
 const load=async():Promise<boolean>=>{const c=await api('/api/courses');if(c.error||!Array.isArray(c)){setAuth(false);if(c.error&&c.error!=='auth')setErr('Could not load your account: '+c.error);return false}setAuth(true);setC(c);setV(await api('/api/venues'));return true};
 useEffect(()=>{load()},[]);
 useEffect(()=>{if(!sid){setL(null);return}let on=true,t:any;const f=async()=>{const t0=Date.now(),d=await api('/api/sessions?id='+sid);if(!on)return;setL(d);const lag=(Date.now()-t0)/2;t=setTimeout(f,d.ms!=null?Math.max(100,Math.min(2000,d.ms-lag+40)):2000)};f();return()=>{on=false;clearTimeout(t)}},[sid]);
 const fd=(f:any)=>Object.fromEntries(new FormData(f));
 const gone=(id:string)=>setSid(s=>(!id||s===id)?'':s);
 const delVenue=async(v:any)=>{if(!confirm(`Delete venue "${v.name}"?`))return;const r=await api('/api/venues','DELETE',{id:v.id});if(r.error)alert(r.error);load()};
 const delLive=async()=>{if(!confirm('Delete this session and all its attendance records?'))return;await api('/api/sessions','DELETE',{id:sid});setSid('');load()};
 const saveVenue=(e:any)=>{e.preventDefault();const f=e.target,name=String(new FormData(f).get('name')||'').trim();if(!name)return;setVmsg('Getting your location…');
  navigator.geolocation.getCurrentPosition(async g=>{await api('/api/venues','POST',{name,lat:g.coords.latitude,lng:g.coords.longitude,radius:Number(new FormData(f).get('radius'))||60});setVmsg(`Saved "${name}" (GPS accuracy ±${Math.round(g.coords.accuracy)} m).`);f.reset();load()},()=>setVmsg('Location permission denied.'),{enableHighAccuracy:true,timeout:20000})};
 const login=async(e:any)=>{e.preventDefault();setErr('');setBusy(true);
  try{const b:any=fd(e.target);b.email=String(b.email||'').trim();
   const r=await api('/api/auth','POST',{action:mode,...b});
   if(r.error){setErr(r.error);return}
   const ok=await load();
   if(!ok)setErr(p=>p||'Logged in, but your browser did not keep the login. Allow cookies for this site, or open it in Chrome or Safari directly (not inside another app).');
  }catch{setErr('Could not reach the server. Check your connection and try again.')}finally{setBusy(false)}};

 if(!auth)return <div className="hero"><div className="card auth"><div className="logo">KNUST</div><h2 style={{margin:'14px 0 4px'}}>Attendance Site</h2><p style={{color:'#666',margin:0}}>Smart, secure lecture attendance</p>
  <div className="tabs"><button type="button" className={mode==='login'?'':'sec'} onClick={()=>{setMode('login');setErr('')}}>Log in</button><button type="button" className={mode==='register'?'':'sec'} onClick={()=>{setMode('register');setErr('')}}>Register</button></div>
  <form onSubmit={login}>
   {mode==='register'&&<input name="name" placeholder="Full name" required/>}
   <input name="email" type="text" inputMode="email" autoCapitalize="none" autoComplete="email" placeholder="Email" required/>
   <input name="password" type="password" autoComplete="current-password" placeholder="Password (8+ characters)" required/>
   <button className="go" disabled={busy}>{busy?'Please wait…':mode==='login'?'Log in':'Create lecturer account'}</button></form>
  <p style={{color:'crimson',minHeight:20}}>{err}</p></div></div>;

 return <div className="wrap">
  <div className="bar"><h2 style={{color:'#0b6b3a',margin:0}}>KNUST Attendance</h2><button className="sec" onClick={async()=>{await api('/api/auth','POST',{action:'logout'});setAuth(false)}}>Log out</button></div>

  {/* 1. New course */}
  <div className="card"><h3>New course</h3><form onSubmit={async e=>{e.preventDefault();const f=e.target as any;await api('/api/courses','POST',fd(f));f.reset();load()}}><input name="code" placeholder="Course code e.g. COE 361" required/> <input name="title" placeholder="Course title"/><br/><input name="programs" placeholder="Programmes, separated by commas (optional)" style={{width:'100%',boxSizing:'border-box'}}/><br/><button>Create course</button></form></div>

  {/* 2. Venue missing or wrong location? */}
  <div className="card"><h3>Venue missing or wrong location?</h3>
