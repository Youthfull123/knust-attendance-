'use client';
import {useEffect,useRef,useState} from 'react';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export default function Attend(){
 const v=useRef<HTMLVideoElement>(null),D=useRef<any>({});const [msg,setMsg]=useState('Verifying QR code…'),[step,setStep]=useState('init'),[id,setId]=useState('');
 useEffect(()=>{(async()=>{try{
  const p=new URLSearchParams(location.search);const sid=p.get('s');
  const r=await fetch('/api/attend',{method:'POST',body:JSON.stringify({step:'begin',sid,t:p.get('t')})});const j=await r.json();
  if(!r.ok){setMsg(j.error+' Please rescan the QR code.');return}
  D.current={sid,ticket:j.ticket};setMsg('Loading face models…');
  // @ts-ignore
  const f=await import('@vladmandic/face-api/dist/face-api.esm.js');
  const L=(u:string)=>Promise.all([f.nets.ssdMobilenetv1,f.nets.faceLandmark68Net,f.nets.faceRecognitionNet].map((n:any)=>n.loadFromUri(u)));
try{await L('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model')}catch{await L('/models')}
  const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});v.current!.srcObject=s;await v.current!.play();
  const dir=Math.random()<.5?'left':'right';setMsg(`Look straight at the camera, then slowly turn your head to your ${dir}.`);
  let face:number[]|null=null;
  for(let i=0;i<150;i++){await sleep(200);
   const d=await f.detectSingleFace(v.current!).withFaceLandmarks().withFaceDescriptor();if(!d)continue;
   const P=d.landmarks.positions,ratio=(P[30].x-P[0].x)/(P[16].x-P[0].x);
   if(!face&&ratio>.44&&ratio<.56)face=Array.from(d.descriptor as Float32Array);
   if(face&&(dir==='left'?ratio>.64:ratio<.36)){D.current.face=face;break}}
  s.getTracks().forEach(t=>t.stop());
  if(!D.current.face){setMsg('Liveness check failed. Rescan to retry.');return}
  setMsg('Getting your location…');
  navigator.geolocation.getCurrentPosition(g=>{Object.assign(D.current,{lat:g.coords.latitude,lng:g.coords.longitude,acc:g.coords.accuracy});setMsg('');setStep('id')},
   ()=>setMsg('Location permission is required. Ask your lecturer for assisted verification.'),{enableHighAccuracy:true,timeout:20000});
 }catch(e){setMsg('Camera/face check unavailable. Ask your lecturer for assisted verification.')}})()},[]);
 const submit=async()=>{const r=await fetch('/api/attend',{method:'POST',body:JSON.stringify({step:'submit',studentId:id,...D.current})});const j=await r.json();setStep('done');setMsg(j.message||j.error)};
 return <div className="c"><video ref={v} playsInline muted style={{width:'100%',maxWidth:320,display:step==='init'?'block':'none',transform:'scaleX(-1)'}}/>
  <p>{msg}</p>{step==='id'&&<div><input value={id} onChange={e=>setId(e.target.value)} placeholder="Student ID"/><br/><button onClick={submit}>Submit Attendance</button></div>}</div>}
