'use client';
import {useEffect,useRef,useState} from 'react';
const T=<X,>(p:Promise<X>,ms:number,what:string):Promise<X>=>Promise.race([p,new Promise<X>((_,j)=>setTimeout(()=>j(new Error(what+' timed out')),ms))]);
// Phone ID kept in browser storage AND a cookie, so clearing only one of them does not reset it
const devId=()=>{try{let d=localStorage.getItem('devId')||(document.cookie.match(/(?:^|; )devId=([^;]+)/)||[])[1];if(!d)d=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36));localStorage.setItem('devId',d);document.cookie='devId='+d+';Path=/;Max-Age=31536000;SameSite=Lax';return d}catch{return ''}};
export default function Attend(){
 const D=useRef<any>({});
 const [msg,setMsg]=useState('Verifying QR code…'),[step,setStep]=useState('init'),[id,setId]=useState(''),[progs,setProgs]=useState<string[]>([]),[prog,setProg]=useState(''),[dev,setDev]=useState('');
 const getLoc=()=>new Promise<any>(res=>navigator.geolocation.getCurrentPosition(res,()=>res(null),{enableHighAccuracy:true,timeout:20000,maximumAge:0}));
 useEffect(()=>{(async()=>{try{
  const post=async(o:any)=>{const r=await T(fetch('/api/attend',{method:'POST',body:JSON.stringify(o)}),20000,'Server');return {ok:r.ok,j:await r.json()}};
  const p=new URLSearchParams(location.search),sid=p.get('s');
  const dv=devId();setDev(dv.slice(0,8));
  let a=await post({step:'begin',sid,t:p.get('t'),device:dv});
  if(!a.ok){setMsg(a.j.error+' Please rescan the QR code.');setStep('err');return}
  if(a.j.locked){setMsg(`This phone is already logged in as ${a.j.locked} for this session. Your attendance is recorded. You cannot use another student ID until the session is closed.`);setStep('done');return}
  D.current={sid,ticket:a.j.ticket};setProgs(a.j.programs||[]);
  setMsg('Allow location access when asked…');
  const g=await getLoc();
  if(!g){setMsg('Location permission is required. Allow location for this site, then rescan.');setStep('err');return}
  Object.assign(D.current,{lat:g.coords.latitude,lng:g.coords.longitude,acc:g.coords.accuracy});
  setMsg('Checking that you are at the venue…');
  a=await post({step:'where',...D.current});
  if(!a.ok){setMsg(a.j.error);setStep('err');return}
  setMsg('');setStep('id');
 }catch(e:any){setMsg('Error: '+(e?.message||e)+'. Open the link in Safari or Chrome and rescan the QR code.');setStep('err')}})()},[]);
 const submit=async()=>{if(step!=='id')return;if(progs.length&&!prog){setMsg('Choose your programme first.');return}setStep('wait');
  setMsg('Checking your location…');
  const g=await getLoc();
  if(!g){setMsg('Could not read your location. Allow location access and try again.');setStep('id');return}
  Object.assign(D.current,{lat:g.coords.latitude,lng:g.coords.longitude,acc:g.coords.accuracy});
  setMsg('Submitting…');
  const r=await fetch('/api/attend',{method:'POST',body:JSON.stringify({step:'submit',studentId:id,program:prog,...D.current})});const j=await r.json();
  if(r.ok){setStep('done');setMsg(j.message)}
  else if(r.status===403&&/rescan|already used/i.test(j.error||'')){setStep('err');setMsg(j.error)}
  else if(r.status===400||r.status===429||/not enrolled|not at the lecture/i.test(j.error||'')){setStep('id');setMsg(j.error)} // can fix and try again
  else{setStep('done');setMsg(j.error)}};
 return <div className="card" style={{maxWidth:420,margin:'20px auto'}}>
  <p>{msg}</p>
  {step==='id'&&<div><input value={id} onChange={e=>setId(e.target.value)} placeholder="Student ID"/><br/>{progs.length>0&&<><select value={prog} onChange={e=>setProg(e.target.value)}><option value="">Choose your programme</option>{progs.map(p=><option key={p} value={p}>{p}</option>)}</select><br/></>}<button onClick={submit}>Submit Attendance</button></div>}
  {dev&&<p style={{color:'#999',fontSize:11,marginTop:16}}>Phone code: {dev}</p>}</div>}
