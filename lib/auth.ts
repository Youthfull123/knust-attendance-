import {SignJWT,jwtVerify} from 'jose';import {cookies} from 'next/headers';import {q} from '@/lib/db';
const k=new TextEncoder().encode(process.env.AUTH_SECRET||'dev-secret');
export const sign=(p:any,exp='8h')=>new SignJWT(p).setProtectedHeader({alg:'HS256'}).setExpirationTime(exp).sign(k);
export const verify=async(t:string):Promise<any>=>{try{return (await jwtVerify(t,k)).payload}catch{return null}};
export const me=async()=>{const t=(await cookies()).get('tok')?.value;const p=t&&await verify(t);if(!p?.uid)return null;
 const [u]=await q('select role,active from users where id=$1',[p.uid]);if(!u||u.active===false)return null; // suspended or deleted accounts lose access at once
 return {...p,role:u.role}};
