import bcrypt from 'bcryptjs';import {q} from '@/lib/db';import {sign} from '@/lib/auth';
export async function POST(r:Request){const {action,email,password,name}=await r.json();
 const res=(b:any,s=200,c?:string)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json',...(c?{'set-cookie':c}:{})}});
 if(action==='logout')return res({ok:1},200,'tok=;Path=/;Max-Age=0');
 let u;if(action==='register'){if(!email||!password||password.length<8)return res({error:'Email and 8+ char password required'},400);
  try{[u]=await q('insert into users(email,name,pass) values($1,$2,$3) returning *',[email.toLowerCase(),name,await bcrypt.hash(password,10)])}catch{return res({error:'Email already registered'},409)}}
 eelse{[u]=await q('select * from users where email=$1',[String(email).toLowerCase()]);if(!u||!await bcrypt.compare(password,u.pass))return res({error:'Invalid credentials'},401);if(u.active===false)return res({error:'This account is suspended.'},403)}
 return res({ok:1},200,`tok=${await sign({uid:u.id,role:u.role})};Path=/;HttpOnly;SameSite=Lax;Max-Age=28800`)}
