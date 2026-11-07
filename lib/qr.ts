import {createHmac,timingSafeEqual} from 'crypto';
export const WINDOW=5000; // QR token changes every 10 s, on the server clock
export const GRACE=3000;   // old code still accepted for 3 s after a change (scan/network delay). Set 0 for strict.
const win=()=>Math.floor(Date.now()/WINDOW);
export const msLeft=()=>WINDOW-(Date.now()%WINDOW);
export const token=(secret:string,sid:string,w=win())=>createHmac('sha256',secret).update(`${sid}:${w}`).digest('base64url').slice(0,24);
// SERVER-SIDE validation of every token
export const valid=(secret:string,sid:string,t:string)=>{if(typeof t!=='string')return false;const w=win(),ws=[w];if(Date.now()%WINDOW<GRACE)ws.push(w-1);
 return ws.some(x=>{const a=Buffer.from(token(secret,sid,x)),b=Buffer.from(t);return a.length===b.length&&timingSafeEqual(a,b)})};
export const dist=(a:number,b:number,c:number,d:number)=>{const r=(x:number)=>x*Math.PI/180,h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 12742000*Math.asin(Math.sqrt(h))};
export const euclid=(a:number[],b:number[])=>Math.sqrt(a.reduce((s,x,i)=>s+(x-b[i])**2,0));
