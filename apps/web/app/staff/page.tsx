'use client';
import { useEffect, useState, type FormEvent } from 'react';
type Session={staff:{username:string;role:string};csrfToken:string;expiresAt:string};
export default function StaffPage(){
 const [session,setSession]=useState<Session|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{const r=await fetch('/api/v1/staff/me',{cache:'no-store'});setSession(r.ok?await r.json():null);}catch{setMessage('Staff service unavailable.');}}
 useEffect(()=>{void load();},[]);
 useEffect(()=>{if(!session)return;const timer=setTimeout(()=>{setSession(null);setMessage('Staff session expired.');},Math.max(0,Date.parse(session.expiresAt)-Date.now()));return()=>clearTimeout(timer);},[session]);
 async function login(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);const form=e.currentTarget;const data=new FormData(form);try{
  const r=await fetch('/api/v1/staff/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:data.get('username'),password:data.get('password')})});
  const result=await r.json();form.reset();if(r.ok){setSession(result);setMessage('');}else setMessage(result.error);
 }catch{setMessage('Staff service unavailable.');}finally{setBusy(false);}}
 async function logout(){if(!session)return;try{const r=await fetch('/api/v1/staff/logout',{method:'POST',headers:{'X-CSRF-Token':session.csrfToken}});if(r.ok||r.status===401){setSession(null);setMessage('Staff session locked.');}else setMessage('Logout failed. Please retry.');}catch{setMessage('Logout failed. Please retry.');}}
 async function workspace(){if(!session)return;try{const r=await fetch(`/api/v1/staff/workspace/${session.staff.role}`,{cache:'no-store'});const data=await r.json();if(r.status===401)setSession(null);setMessage(r.ok?data.message:data.error);}catch{setMessage('Staff service unavailable.');}}
 return <main className="container"><h1>SafeCircle staff</h1><p>Development only. Use synthetic identities. No real cases or connected support staff.</p>
 {session?<section><h2>Protected staff workspace</h2><p>{session.staff.username} · {session.staff.role.replaceAll('_',' ')}</p><p>Session expires at {new Date(session.expiresAt).toLocaleTimeString()}.</p><button onClick={()=>void workspace()}>Open role workspace</button><button onClick={()=>void logout()}>Log out staff</button><p>Professional approval, case assignment and messaging are not enabled.</p></section>:
 <form onSubmit={login}><h2>Staff login</h2><p>Accounts are provisioned by an authorised operator. There is no public staff registration.</p><label>Staff username<input name="username" autoComplete="username" required maxLength={80}/></label><label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={256}/></label><button disabled={busy}>Log in</button></form>}
 <p role="status">{message}</p><a href="/">Return to SafeCircle</a></main>;
}
