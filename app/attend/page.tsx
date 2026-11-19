'use client';
import {useEffect,useRef,useState} from 'react';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const T=<X,>(p:Promise<X>,ms:number,what:string):Promise<X>=>Promise.race([p,new Promise<X>((_,j)=>setTimeout(()=>j(new Error(what+' timed out')),ms))]);
const CDN='https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model';
// Phone ID kept in browser storage AND a cookie, so clearing only one of them does not reset it
const devId=()=>{try{let d=localStorage.getItem('devId')||(document.cookie.match(/(?:^|; )devId=([^;]+)/)||[])[1];if(!d)d=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36));localStorage.setItem('devId',d);document.cookie='devId='+d+';Path=/;Max-Age=31536000;SameSite=Lax';return d}catch{return ''}};
// Brightens and enlarges the camera picture. Only used when the plain picture finds no face
const enh=(vid:HTMLVideoElement,c:HTMLCanvasElement)=>{
 const w=480,h=Math.round(w*(vid.videoHeight||480)/(vid.videoWidth||640));c.width=w;c.height=h;
 const x=c.getContext('2d',{willReadFrequently:true})!;x.drawImage(vid,0,0,w,h);
 const im=x.getImageData(0,0,w,h),a=im.data;let s=0;for(let i=0;i<a.length;i+=16)s+=a[i]*.3+a[i+1]*.59+a[i+2]*.11;
 const m=s/(a.length/16),g=Math.min(2.5,Math.max(1,115/Math.max(m,1)));
 for(let i=0;i<a.length;i+=4)for(let k=0;k<3;k++){const q=(a[i+k]-m)*1.15+m*g;a[i+k]=q<0?0:q>255?255:q}
 x.putImageData(im,0,0);return c};
export default function Attend(){
 const v=useRef<HTMLVideoElement>(null),D=useRef<any>({}),loc=useRef(true);
 const [msg,setMsg]=useState('Verifying QR code…'),[dbg,setDbg]=useState(''),[step,setStep]=useState('init'),[id,setId]=useState(''),[progs,setProgs]=useState<string[]>([]),[prog,setProg]=useState(''),[slow,setSlow]=useState(false);
 useEffect(()=>{setSlow(false);const t=setTimeout(()=>setSlow(true),15000);return()=>clearTimeout(t)},[msg,step]);
 const getLoc=()=>new Promise<any>(res=>navigator.geolocation.getCurrentPosition(res,()=>res(null),{enableHighAccuracy:true,timeout:20000,maximumAge:0}));
 useEffect(()=>{let tick:any;(async()=>{try{
  const post=async(o:any)=>{const r=await T(fetch('/api/attend',{method:'POST',body:JSON.stringify(o)}),20000,'Server');return {ok:r.ok,j:await r.json()}};
  const p=new URLSearchParams(location.search),sid=p.get('s');
  let a=await post({step:'begin',sid,t:p.get('t')});
  if(!a.ok){setMsg(a.j.error+' Please rescan the QR code.');setStep('err');return}
  D.current={sid,ticket:a.j.ticket,device:devId()};setProgs(a.j.programs||[]);loc.current=a.j.loc!==false;
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
  setMsg('Step 3 of 4: loading face models…');
  const need=(u:string)=>Promise.all([f.nets.tinyFaceDetector,f.nets.faceLandmark68Net,f.nets.faceRecognitionNet].map((n:any)=>n.loadFromUri(u)));
  let base=CDN;
  try{await T(need(CDN),20000,'Model download')}catch{setMsg('Step 3 of 4: loading face models (backup)…');await T(need('/models'),60000,'Model download');base='/models'}
  let ssdOk=false;try{await T(f.nets.ssdMobilenetv1.loadFromUri(base),15000,'Extra detector');ssdOk=true}catch{} // optional, helps very blurry cameras
  setMsg('Step 4 of 4: starting the camera. Tap Allow if asked…');
  const s=await T(navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false}),45000,'Camera permission');
  v.current!.srcObject=s;await T(v.current!.play(),10000,'Camera preview');
  setMsg('Look straight at the camera, then slowly turn your head to one side. The first check can take up to 30 seconds on some phones.');
  const c=document.createElement('canvas');
  const oT=new f.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:0.3}),oL=new f.TinyFaceDetectorOptions({inputSize:416,scoreThreshold:0.1}),oS=new f.SsdMobilenetv1Options({minConfidence:0.2});
  const run=(inp:any,o:any)=>f.detectSingleFace(inp,o).withFaceLandmarks().withFaceDescriptor();
  let lastErr='',frames=0,faces=0;
  const find=async()=>{const vv=v.current!;if(!vv.videoWidth)return null;
   try{const d=await run(vv,oT);if(d)return d}catch(e:any){lastErr=String(e?.message||e)} // 1) fast finder on the plain picture
   try{enh(vv,c);const d=await run(c,oL);if(d)return d}catch(e:any){lastErr=String(e?.message||e)} // 2) brightened picture, more tolerant
   if(ssdOk&&frames%3===0){try{const d=await run(vv,oS);if(d)return d}catch(e:any){lastErr=String(e?.message||e)}} // 3) heavy finder, last resort
   return null};
  const fr:number[][]=[],side:number[][]=[],rat:number[]=[];let front=0,done=false;const t0=Date.now();
  tick=setInterval(()=>setDbg(`Checking… ${Math.round((Date.now()-t0)/1000)}s · faces found: ${faces}`),500);
  while(Date.now()-t0<90000){await sleep(100);frames++;
   let d:any=null;try{d=await T(find(),frames<=1?45000:20000,'Face detection')}catch(e:any){if(/timed out/.test(e?.message))throw e;lastErr=String(e?.message||e);continue}
   if(!d){setMsg('No face found. Move to a brighter place, wipe the camera lens and hold the phone at eye level.');continue}
   faces++;
   const P=d.landmarks.positions,ratio=(P[30].x-P[0].x)/(P[16].x-P[0].x),frontal=ratio>.35&&ratio<.65,desc=Array.from(d.descriptor as Float32Array);
   if(frontal){if(front<3){front++;rat.push(ratio)}if(fr.length<4)fr.push(desc)} // straight-on pictures
   if(front<3){setMsg(frontal?'Keep looking straight…':'Look straight at the camera.');continue}
   setMsg('Now slowly turn your head to one side (left or right).');
   const b0=rat.reduce((x,y)=>x+y,0)/rat.length,dv=Math.abs(ratio-b0);
   if(dv>.04&&side.length<2)side.push(desc); // pictures from a different angle
   if(dv>.08){if(side.length<3)side.push(desc);done=true;break}} // a turn to either side passes, so mirrored cameras work
  clearInterval(tick);s.getTracks().forEach((t:any)=>t.stop());
  if(!done||!fr.length){setMsg(`We could not read your face (frames ${frames}, faces found ${faces}${lastErr?', error: '+lastErr:''}). Move to a brighter place, wipe the camera lens, and rescan the QR code to try again.`);setDbg('');setStep('err');return}
  D.current.faces=[...fr,...side].slice(0,6);setMsg('');setDbg('');setStep('id');
 }catch(e:any){clearInterval(tick);setDbg('');setMsg('Face check error: '+(e?.message||e)+'. Open the link in Safari or Chrome, allow the camera, and rescan the QR code.');setStep('err')}})();return()=>clearInterval(tick)},[]);
 const submit=async()=>{if(step!=='id')return;if(progs.length&&!prog){setMsg('Choose your programme first.');return}setStep('wait');
  if(loc.current){setMsg('Checking your location…');
   const g=await getLoc();
   if(!g){setMsg('Could not read your location. Allow location access and try again.');setStep('id');return}
   Object.assign(D.current,{lat:g.coords.latitude,lng:g.coords.longitude,acc:g.coords.accuracy})}
  setMsg('Submitting…');
  const r=await fetch('/api/attend',{method:'POST',body:JSON.stringify({step:'submit',studentId:id,program:prog,...D.current})});const j=await r.json();setStep('done');setMsg(j.message||j.error)};
 return <div className="card" style={{maxWidth:420,margin:'20px auto'}}><video ref={v} playsInline muted style={{width:'100%',maxWidth:320,display:step==='init'?'block':'none',transform:'scaleX(-1)'}}/>
  <p>{msg}</p>
  {step==='init'&&dbg&&<p style={{color:'#777',fontSize:12}}>{dbg}</p>}
  {slow&&step==='init'&&<p style={{color:'#b36b00',fontSize:13}}>Taking long? If you opened this inside WhatsApp or another app, open the link in Safari or Chrome instead, then rescan the QR code.</p>}
  {step==='id'&&<div><input value={id} onChange={e=>setId(e.target.value)} placeholder="Student ID"/><br/>{progs.length>0&&<><select value={prog} onChange={e=>setProg(e.target.value)}><option value="">Choose your programme</option>{progs.map(p=><option key={p} value={p}>{p}</option>)}</select><br/></>}<button onClick={submit}>Submit Attendance</button></div>}</div>}
