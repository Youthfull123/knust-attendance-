'use client';
import {useEffect,useState} from 'react';
const api=(u:string,m='GET',b?:any)=>fetch(u,{method:m,headers:{'content-type':'application/json'},body:b&&JSON.stringify(b)}).then(async r=>{const t=await r.text();try{return JSON.parse(t)}catch{return {error:'Server error '+r.status}}});
const RED={background:'#fdecea',color:'#c0392b'};
export default function Admin(){
 const [tab,setTab]=useState('lecturers'),[rows,setRows]=useState<any[]|null>(null),[st,setSt]=useState<any>(null),[denied,setDenied]=useState(false),[sel,setSel]=useState(''),[det,setDet]=useState<any[]|null>(null);
 const load=async()=>{const d=await api('/api/admin?view='+tab);if(d.error){setDenied(true);return}setRows(d);setSt(await api('/api/admin?view=stats'))};
 useEffect(()=>{setRows(null);setSel('');load()},[tab]);
 const post=async(b:any,m?:string)=>{if(m&&!confirm(m))return;const r=await api('/api/admin','POST',b);if(r.error)alert(r.error);load()};
 const openDet=async(id:string,force=false)=>{if(sel===id&&!force){setSel('');return}setSel(id);setDet(null);const d=await api('/api/admin?view=attendance&session='+id);setDet(Array.isArray(d)?d:[])};
 const del=async(type:string,id:any,m:string)=>{if(!confirm(m))return;const r=await api('/api/admin','DELETE',{type,id});if(r.error)alert(r.error);if(type==='attendance')await openDet(sel,true);load()};
 if(denied)return <div className="card"><h3>Admin only</h3><p>Log in on the <a href="/">home page</a> with an administrator account, then return to this page.</p></div>;
 const T=(p:any)=><div className="card" style={{overflowX:'auto'}}><table><tbody>{p.children}</tbody></table></div>;
 return <div className="wrap">
  <div className="bar"><h2 style={{color:'#0b6b3a',margin:0}}>Admin</h2><a href="/">Back to my page</a></div>
  {st&&<div className="card">{st.lecturers} lecturers · {st.courses} courses · {st.sessions} sessions · {st.present} students recorded present</div>}
  <div className="tabs">{['lecturers','courses','sessions','venues'].map(t=><button key={t} className={tab===t?'':'sec'} onClick={()=>setTab(t)}>{t}</button>)}</div>
  {!rows?<p>Loading…</p>:!rows.length?<p>Nothing here yet.</p>:<>
  {tab==='lecturers'&&<T>{rows.map(u=><tr key={u.id}><td>{u.name||'-'}<br/><small>{u.email}</small></td><td>{u.role}</td><td>{u.active?'Active':'Suspended'}</td><td>{u.courses} courses · {u.sessions} sessions</td><td style={{textAlign:'right'}}>
   <button className="sec" onClick={()=>post({action:'active',id:u.id,active:!u.active},`${u.active?'Suspend':'Activate'} ${u.email}?`)}>{u.active?'Suspend':'Activate'}</button>{' '}
   <button className="sec" onClick={()=>post({action:'role',id:u.id,role:u.role==='admin'?'lecturer':'admin'},`Change role of ${u.email}?`)}>{u.role==='admin'?'Make lecturer':'Make admin'}</button>{' '}
   <button className="sec" onClick={()=>{const p=prompt('New password (8+ characters) for '+u.email);if(p)post({action:'password',id:u.id,password:p})}}>Reset password</button>{' '}
   <button style={RED} onClick={()=>del('lecturer',u.id,`Delete ${u.email} and ALL their courses, sessions and attendance? This cannot be undone.`)}>Delete</button></td></tr>)}</T>}
  {tab==='courses'&&<T>{rows.map(c=><tr key={c.id}><td>{c.code} {c.title}</td><td>{c.lecturer}</td><td>{c.sessions} sessions</td><td style={{textAlign:'right'}}><button style={RED} onClick={()=>del('course',c.id,`Delete ${c.code} with all its sessions and attendance?`)}>Delete</button></td></tr>)}</T>}
  {tab==='venues'&&<T>{rows.map(v=><tr key={v.id}><td>{v.name}</td><td>{v.owner||'No owner'}</td><td>{v.radius} m</td><td style={{textAlign:'right'}}><button style={RED} onClick={()=>del('venue',v.id,`Delete venue ${v.name}?`)}>Delete</button></td></tr>)}</T>}
  {tab==='sessions'&&<div className="card">{rows.map(s=><div key={s.id} style={{borderBottom:'1px solid #e3e9e5',padding:'6px 0'}}>
   <div className="bar"><button className="sec" style={{flex:1,textAlign:'left'}} onClick={()=>openDet(s.id)}>{sel===s.id?'▼':'▶'} {s.code} · {s.lecturer} · {new Date(s.started_at).toLocaleString()} · {s.venue} · {s.present} present · {s.status}</button>
    <span style={{marginLeft:8,whiteSpace:'nowrap'}}>{s.status==='active'&&<button className="sec" onClick={()=>post({action:'close',id:s.id})}>Close</button>} <button style={RED} onClick={()=>del('session',s.id,'Delete this session and its attendance?')}>Delete</button></span></div>
   {sel===s.id&&(!det?<p>Loading…</p>:<table><tbody>{det.length?det.map(a=><tr key={a.id}><td>{a.student_id}</td><td>{a.status}</td><td>{a.reason}</td><td>{a.dist}m</td><td style={{textAlign:'right'}}>{a.status==='flagged'&&<button className="sec" onClick={async()=>{await post({action:'approve',id:a.id});openDet(s.id,true)}}>Approve</button>} <button style={RED} onClick={()=>del('attendance',a.id,'Remove this record?')}>✕</button></td></tr>):<tr><td>No attempts.</td></tr>}</tbody></table>)}
  </div>)}</div>}</>}
 </div>}
