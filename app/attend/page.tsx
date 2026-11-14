'use client';
import {useEffect,useRef,useState} from 'react';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const T=<X,>(p:Promise<X>,ms:number,what:string):Promise<X>=>Promise.race([p,new Promise<X>((_,j)=>setTimeout(()=>j(new Error(what+' timed out')),ms))]);
const avg=(ds:number[][])=>ds[0].map((_,i)=>ds.reduce((s,d)=>s+d[i],0)/ds.length);
// Brightens and enlarges the camera picture so dark or blurry cameras still produce a detectable face
const enh=(vid:HTMLVideoElement,c:HTMLCanvasElement)=>{
 const w=480,h=Math.round(w*(vid.videoHeight||480)/(vid.videoWidth||640));c.width=w;c.height=h;
 const x=c.getContext('2d',{willReadFrequently:true})!;x.drawImage(vid,0,0,w,h);
 const im=x.getImageData(0,0,w,h),a=im.data;let s=0;for(let i=0;i<a.length;i+=16)s+=a[i]*.3+a[i+1]*.59+a[i+2]*.11;
 const m=s/(a.length/16),g=Math.min(2.5,Math.max(1,115/Math.max(m,1)));
 for(let i=0;i<a.length;i+=4)for(let k=0;k<3;k++){const q=(a[i+k]-m)*1.15+m*g;a[i+k]=q<0?0:q>255?255:q}
 x.putImageData(im,0,0);return c};
export default function Attend(){
 const v=useRef<HTMLVideoElement>(null),D=useRef<any>({}),loc=useRef(true);
 const [msg,setMsg]=useState('Verifying QR code…'),[step,setStep]=useState('init'),[id,setId]=useState(''),[progs,setProgs]=useState<string[]>([]),[prog,setProg]=useState(''),[slow,setSlow]=useState(false);
 useEffect(()=>{setSlow(false);const t=setTimeout(()=>setSlow(true),15000);return()=>clearTimeout(t)},[msg,step]);
 const getLoc=()=>new Promise<any>(res=>navigator.geolocation.getCurrentPosition(res,()=>res(null),{enableHighAccuracy:true,timeout:20000,maximumAge:0}));
 useEffect(()=>{(async()=>{try{
  const post=async(o:any)=>{const r=await T(fetch('/api/attend',{method:'POST',body:JSON.stringify(o)}),20000,'Server');return {ok:r.ok,j:await r.json()}};
  const p=new URLSearchParams(location.search),sid=p.get('s');
  let a=await post({step:'begin',sid,t:p.get('t')});
  if(!a.ok){setMsg(a.j.error+' Please rescan the QR code.');setStep('err');return}
  D.current={sid,ticket:a.j.ticket};setProgs(a.j.programs||[]);loc.current=a.j.loc!==false;
  if(loc.current){
   setMsg('Allow location access when asked…');
   const g=await getLoc();
   if(!g){setMsg('Location permission is required. Allow location for this site, then rescan.');setStep('err');return}
   Object.assign(D.current,{lat:g.coords.latitude,lng:g.coords.longitude,acc:g.coords.accuracy});
   setMsg('Checking that you are at the venue…');
   a=await post({step:'where',...D.current});
   if(!a.ok){setMsg(a.j.error);setStep('err');return}}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){setMsg('This browser cannot use the camera. Open the link in Safari or Chrome, then rescan.');setStep('err');return}
  setMsg('Step 1 of 4: loading the face library…');
  // @ts-ignore
  const f:any=await T(import('@vladmandic/face-api/dist/face-api.esm.js'),30000,'Face library');
  setMsg('Step 2 of 4: preparing…');
  try{await T(f.tf.setBackend('webgl'),8000,'Graphics')}catch{try{await T(f.tf.setBackend('cpu'),8000,'Graphics')}catch{}}
  try{await T(f.tf.ready(),8000,'Graphics')}catch{}
  setMsg('Step 3 of 4: loading face models (about 12 MB)…');
  const L=(u:string)=>Promise.all([f.nets.ssdMobilenetv1,f.nets.tinyFaceDetector,f.nets.faceLandmark68Net,f.nets.faceRecognitionNet].map((n:any)=>n.loadFromUri(u)));
  try{await T(L('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model'),20000,'Model download')}catch{setMsg('Step 3 of 4: loading face models (backup)…');await T(L('/models'),60000,'Model download')}
  setMsg('Step 4 of 4: starting the camera. Tap Allow if asked…');
  const s=await T(navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false}),45000,'Camera permission');
  v.current!.srcObject=s;await T(v.current!.play(),10000,'Camera preview');
  const dir=Math.random()<.5?'left':'right';setMsg(`Look straight at the camera, then slowly turn your head to your ${dir}.`);
  const c=document.createElement('canvas');
  const so=new f.SsdMobilenetv1Options({minConfidence:0.15}),to=new f.TinyFaceDetectorOptions({inputSize:416,scoreThreshold:0.1});
  const find=async()=>{if(!v.current!.videoWidth)return null;enh(v.current!,c);
   let d=await f.detectSingleFace(c,so).withFaceLandmarks().withFaceDescriptor();
   if(!d)d=await f.detectSingleFace(c,to).withFaceLandmarks().withFaceDescriptor(); // second, more tolerant finder
   return d};
  const fr:number[][]=[],rat:number[]=[];let front=0,done=false;const t0=Date.now();
  while(Date.now()-t0<90000){await sleep(100);
   let d:any=null;try{d=await T(find(),15000,'Face detection')}catch(e:any){if(/timed out/.test(e?.message))throw e;continue}
   if(!d){setMsg('No face found. Move to a brighter place, wipe the camera lens and hold the phone at eye level.');continue}
   const P=d.landmarks.positions,ratio=(P[30].x-P[0].x)/(P[16].x-P[0].x),frontal=ratio>.38&&ratio<.62;
   if(frontal){if(front<3){front++;rat.push(ratio)}if(fr.length<5)fr.push(Array.from(d.descriptor as Float32Array))} // every picture counts, any quality
   if(front<3){setMsg(frontal?'Keep looking straight…':'Look straight at the camera.');continue}
   setMsg(`Now slowly turn your head to your ${dir}.`);
   const base=rat.reduce((x,y)=>x+y,0)/rat.length;
   if(dir==='left'?ratio-base>.07:base-ratio>.07){done=true;break}}
  s.getTracks().forEach((t:any)=>t.stop());
  if(!done||!fr.length){setMsg('We could not read your face. Move to a brighter place, wipe the camera lens, and rescan the QR code to try again.');setStep('err');return}
  D.current.face=avg(fr);setMsg('');setStep('id');
 }catch(e:any){setMsg('Face check error: '+(e?.message||e)+'. Open the link in Safari or Chrome, allow the camera, and rescan the QR code.');setStep('err')}})()},[]);
 const submit=async()=>{if(step!=='id')return;if(progs.length&&!prog){setMsg('Choose your programme first.');return}setStep('wait');
  if(loc.current){setMsg('Checking your location…');
   const g=await getLoc();
   if(!g){setMsg('Could not read your location. Allow location access and try again.');setStep('id');return}
   Object.assign(D.current,{lat:g.coords.latitude,lng:g.coords.longitude,acc:g.coords.accuracy})}
  setMsg('Submitting…');
  const r=await fetch('/api/attend',{method:'POST',body:JSON.stringify({step:'submit',studentId:id,program:prog,...D.current})});const j=await r.json();setStep('done');setMsg(j.message||j.error)};
 return <div className="card" style={{maxWidth:420,margin:'20px auto'}}><video ref={v} playsInline muted style={{width:'100%',maxWidth:320,display:step==='init'?'block':'none',transform:'scaleX(-1)'}}/>
  <p>{msg}</p>
  {slow&&step==='init'&&<p style={{color:'#b36b00',fontSize:13}}>Taking long? If you opened this inside WhatsApp or another app, open the link in Safari or Chrome instead, then rescan the QR code.</p>}
  {step==='id'&&<div><input value={id} onChange={e=>setId(e.target.value)} placeholder="Student ID"/><br/>{progs.length>0&&<><select value={prog} onChange={e=>setProg(e.target.value)}><option value="">Choose your programme</option>{progs.map(p=><option key={p} value={p}>{p}</option>)}</select><br/></>}<button onClick={submit}>Submit Attendance</button></div>}</div>}
