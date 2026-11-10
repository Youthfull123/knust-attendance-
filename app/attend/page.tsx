'use client';
import {useEffect,useRef,useState} from 'react';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export default function Attend(){
 const v=useRef<HTMLVideoElement>(null),D=useRef<any>({});const [msg,setMsg]=useState('Verifying QR code…'),[step,setStep]=useState('init'),[id,setId]=useState('');
 useEffect(()=>{(async()=>{try{
  const post=async(o:any)=>{const r=await fetch('/api/attend',{method:'POST',body:JSON.stringify(o)});return {ok:r.ok,j:await r.json()}};
  const p=new URLSearchParams(location.search),sid=p.get('s');
  let a=await post({step:'begin',sid,t:p.get('t')});
  if(!a.ok){setMsg(a.j.error+' Please rescan the QR code.');setStep('err');return}
  D.current={sid,ticket:a.j.ticket};
  setMsg('Allow location access when asked…');
  const g:any=await new Promise(res=>navigator.geolocation.getCurrentPosition(res,()=>res(null),{enableHighAccuracy:true,timeout:20000,maximumAge:0}));
  if(!g){setMsg('Location permission is required. Ask your lecturer for assisted verification.');setStep('err');return}
  Object.assign(D.current,{lat:g.coords.latitude,lng:g.coords.longitude,acc:g.coords.accuracy});
  setMsg('Checking that you are at the venue…');
  a=await post({step:'where',...D.current});
  if(!a.ok){setMsg(a.j.error);setStep('err');return}
  setMsg('Loading face check…');
  // @ts-ignore
  const f=await import('@vladmandic/face-api/dist/face-api.esm.js');
  const L=(u:string)=>Promise.all([f.nets.ssdMobilenetv1,f.nets.faceLandmark68Net,f.nets.faceRecognitionNet].map((n:any)=>n.loadFromUri(u)));
  try{await L('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model')}catch{await L('/models')}
  const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});v.current!.srcObject=s;await v.current!.play();
  const dir=Math.random()<.5?'left':'right';setMsg(`Look straight at the camera, then slowly turn your head to your ${dir}.`);
  let face:number[]|null=null;
  for(let i=0;i<300;i++){await sleep(150);
   const d=await f.detectSingleFace(v.current!).withFaceLandmarks().withFaceDescriptor();
   if(!d){setMsg('No face found. Hold the phone at eye level in good light.');continue}
   const P=d.landmarks.positions,ratio=(P[30].x-P[0].x)/(P[16].x-P[0].x);
   if(!face&&ratio>.40&&ratio<.60){face=Array.from(d.descriptor as Float32Array);setMsg(`Now slowly turn your head to your ${dir}.`)}
   if(face&&(dir==='left'?ratio>.60:ratio<.40)){D.current.face=face;break}}
  s.getTracks().forEach((t:any)=>t.stop());
  if(!D.current.face){setMsg('Liveness check failed. Rescan to retry.');setStep('err');return}
  setMsg('');setStep('id');
 }catch(e:any){setMsg('Face check error: '+(e?.message||e)+'. Close other camera apps, allow the camera, and rescan.');setStep('err')}})()},[]);
  const submit=async()=>{if(step!=='id')return;setStep('wait');setMsg('Checking your location…');
  const g:any=await new Promise(res=>navigator.geolocation.getCurrentPosition(res,()=>res(null),{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
  if(!g){setMsg('Could not read your location. Allow location access and try again.');setStep('id');return}
  Object.assign(D.current,{lat:g.coords.latitude,lng:g.coords.longitude,acc:g.coords.accuracy});
  setMsg('Submitting…');
  const r=await fetch('/api/attend',{method:'POST',body:JSON.stringify({step:'submit',studentId:id,...D.current})});const j=await r.json();setStep('done');setMsg(j.message||j.error)};
 return <div className="card" style={{maxWidth:420,margin:'20px auto'}}><video ref={v} playsInline muted style={{width:'100%',maxWidth:320,display:step==='init'?'block':'none',transform:'scaleX(-1)'}}/>
  <p>{msg}</p>{step==='id'&&<div><input value={id} onChange={e=>setId(e.target.value)} placeholder="Student ID"/><br/><button onClick={submit}>Submit Attendance</button></div>}</div>}
