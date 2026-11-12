'use client';
import {useEffect,useRef,useState} from 'react';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const T=<X,>(p:Promise<X>,ms:number,what:string):Promise<X>=>Promise.race([p,new Promise<X>((_,j)=>setTimeout(()=>j(new Error(what+' timed out')),ms))]);
const avg=(ds:number[][])=>ds[0].map((_,i)=>ds.reduce((s,d)=>s+d[i],0)/ds.length);
export default function Attend(){
 const v=useRef<HTMLVideoElement>(null),D=useRef<any>({}),stop=useRef(false),cam=useRef<any>(null);
 const [msg,setMsg]=useState('Verifying QR code…'),[step,setStep]=useState('init'),[id,setId]=useState(''),[progs,setProgs]=useState<string[]>([]),[prog,setProg]=useState(''),[slow,setSlow]=useState(false),[skipOk,setSkipOk]=useState(false),[skipped,setSkipped]=useState(false);
 useEffect(()=>{setSlow(false);const t=setTimeout(()=>setSlow(true),15000);return()=>clearTimeout(t)},[msg,step]);
 useEffect(()=>{(async()=>{try{
  const post=async(o:any)=>{const r=await T(fetch('/api/attend',{method:'POST',body:JSON.stringify(o)}),20000,'Server');return {ok:r.ok,j:await r.json()}};
  const p=new URLSearchParams(location.search),sid=p.get('s');
  let a=await post({step:'begin',sid,t:p.get('t')});
  if(!a.ok){setMsg(a.j.error+' Please rescan the QR code.');setStep('err');return}
  D.current={sid,ticket:a.j.ticket};setProgs(a.j.programs||[]);
  setMsg('Allow location access when asked…');
  const g:any=await new Promise(res=>navigator.geolocation.getCurrentPosition(res,()=>res(null),{enableHighAccuracy:true,timeout:20000,maximumAge:0}));
  if(!g){setMsg('Location permission is required. Allow location for this site, then rescan.');setStep('err');return}
  Object.assign(D.current,{lat:g.coords.latitude,lng:g.coords.longitude,acc:g.coords.accuracy});
  setMsg('Checking that you are at the venue…');
  a=await post({step:'where',...D.current});
  if(!a.ok){setMsg(a.j.error);setStep('err');return}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){setMsg('This browser cannot use the camera. Open the link in Safari or Chrome, then rescan.');setStep('err');setSkipOk(true);return}
  setMsg('Step 1 of 4: loading the face library…');
  // @ts-ignore
  const f:any=await T(import('@vladmandic/face-api/dist/face-api.esm.js'),30000,'Face library');
  setMsg('Step 2 of 4: preparing…');
  try{await T(f.tf.setBackend('webgl'),8000,'Graphics')}catch{try{await T(f.tf.setBackend('cpu'),8000,'Graphics')}catch{}}
  try{await T(f.tf.ready(),8000,'Graphics')}catch{}
  setMsg('Step 3 of 4: loading face models (about 12 MB)…');
  const L=(u:string)=>Promise.all([f.nets.ssdMobilenetv1,f.nets.faceLandmark68Net,f.nets.faceRecognitionNet].map((n:any)=>n.loadFromUri(u)));
  try{await T(L('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model'),20000,'Model download')}catch{setMsg('Step 3 of 4: loading face models (backup)…');await T(L('/models'),60000,'Model download')}
  setMsg('Step 4 of 4: starting the camera. Tap Allow if asked…');
  const s=await T(navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false}),45000,'Camera permission');
  cam.current=s;v.current!.srcObject=s;await T(v.current!.play(),10000,'Camera preview');
  const dir=Math.random()<.5?'left':'right';setMsg(`Look straight at the camera, then slowly turn your head to your ${dir}.`);
  const opt=new f.SsdMobilenetv1Options({minConfidence:0.3}); // more tolerant of dim or blurry cameras
  const fr:number[][]=[],rat:number[]=[];const t0=Date.now();let done=false;
  while(!stop.current&&Date.now()-t0<75000){await sleep(120);
   if(Date.now()-t0>25000)setSkipOk(true);
   let d:any=null;try{d=await T(f.detectSingleFace(v.current!,opt).withFaceLandmarks().withFaceDescriptor(),15000,'Face detection')}catch(e:any){if(/timed out/.test(e?.message))throw e;continue}
   if(stop.current)break;
   if(!d){setMsg('No face found. Move to a brighter place, wipe the camera lens and hold the phone at eye level.');continue}
   const P=d.landmarks.positions,ratio=(P[30].x-P[0].x)/(P[16].x-P[0].x);
   if(fr.length<3){ // collect 3 frontal frames and average them, which steadies the fingerprint on poor cameras
    if(ratio>.38&&ratio<.62){fr.push(Array.from(d.descriptor as Float32Array));rat.push(ratio);if(fr.length===3)setMsg(`Now slowly turn your head to your ${dir}.`)}else setMsg('Look straight at the camera.');
    continue}
   const base=rat.reduce((x,y)=>x+y,0)/rat.length;
   if(dir==='left'?ratio-base>.08:base-ratio>.08){D.current.face=avg(fr);done=true;break}}
  if(stop.current)return;
  s.getTracks().forEach((t:any)=>t.stop());
  if(!done){setMsg('Face check did not complete. Try again in brighter light, or use the button below.');setSkipOk(true);setStep('err');return}
  setMsg('');setStep('id');
 }catch(e:any){setMsg('Face check error: '+(e?.message||e)+'. Open the link in Safari or Chrome, allow the camera, and rescan the QR code.');setStep('err');if(D.current.lat!==undefined)setSkipOk(true)}})()},[]);
 const skip=()=>{stop.current=true;cam.current?.getTracks().forEach((t:any)=>t.stop());D.current.noFace=true;D.current.face=null;setSkipped(true);setMsg('Face check skipped. Enter your ID below. Your attendance will be sent to your lecturer for approval.');setStep('id')};
 const submit=async()=>{if(step!=='id')return;if(progs.length&&!prog){setMsg('Choose your programme first.');return}setStep('wait');setMsg('Checking your location…');
  const g:any=await new Promise(res=>navigator.geolocation.getCurrentPosition(res,()=>res(null),{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
  if(!g){setMsg('Could not read your location. Allow location access and try again.');setStep('id');return}
  Object.assign(D.current,{lat:g.coords.latitude,lng:g.coords.longitude,acc:g.coords.accuracy});
  setMsg('Submitting…');
  const r=await fetch('/api/attend',{method:'POST',body:JSON.stringify({step:'submit',studentId:id,program:prog,...D.current})});const j=await r.json();setStep('done');setMsg(j.message||j.error)};
 return <div className="card" style={{maxWidth:420,margin:'20px auto'}}><video ref={v} playsInline muted style={{width:'100%',maxWidth:320,display:step==='init'?'block':'none',transform:'scaleX(-1)'}}/>
  <p>{msg}</p>
  {slow&&step==='init'&&<p style={{color:'#b36b00',fontSize:13}}>Taking long? If you opened this inside WhatsApp or another app, open the link in Safari or Chrome instead, then rescan the QR code.</p>}
  {skipOk&&!skipped&&(step==='init'||step==='err')&&<button className="sec" onClick={skip}>My camera can't read my face: send for lecturer review</button>}
  {step==='id'&&<div><input value={id} onChange={e=>setId(e.target.value)} placeholder="Student ID"/><br/>{progs.length>0&&<><select value={prog} onChange={e=>setProg(e.target.value)}><option value="">Choose your programme</option>{progs.map(p=><option key={p} value={p}>{p}</option>)}</select><br/></>}<button onClick={submit}>Submit Attendance</button></div>}</div>}
