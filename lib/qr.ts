import {createHmac,timingSafeEqual} from 'crypto';
export const WINDOW=20000; // token rotates every 20 s
const win=()=>Math.floor(Date.now()/WINDOW);
export const token=(secret:string,sid:string,w=win())=>createHmac('sha256',secret).update(`${sid}:${w}`).digest('base64url').slice(0,24);
// SERVER-SIDE validation: current window, plus previous one as grace for network/scan latency.
export const valid=(secret:string,sid:string,t:string)=>typeof t==='string'&&[win(),win()-1].some(w=>{const a=Buffer.from(token(secret,sid,w)),b=Buffer.from(t);return a.length===b.length&&timingSafeEqual(a,b)});
export const dist=(a:number,b:number,c:number,d:number)=>{const r=(x:number)=>x*Math.PI/180,h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 12742000*Math.asin(Math.sqrt(h))};
export const euclid=(a:number[],b:number[])=>Math.sqrt(a.reduce((s,x,i)=>s+(x-b[i])**2,0));
