"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthBrowserClient } from "@/lib/supabase/auth-browser";

export default function LoginPage() {
  const router = useRouter();
  const [mode,setMode]=useState<"login"|"signup">("login");
  const [fullName,setFullName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [status,setStatus]=useState("");

  async function submit(event:FormEvent){
    event.preventDefault();
    setStatus(mode==="signup"?"Creating your account…":"Signing you in…");

    const supabase=createAuthBrowserClient();

    if(mode==="signup"){
      const {data,error}=await supabase.auth.signUp({
        email,
        password,
        options:{data:{full_name:fullName}}
      });

      if(error){
        setStatus(error.message);
        return;
      }

      if(data.session){
        router.push("/onboarding");
        router.refresh();
        return;
      }

      setStatus("Account created. Check your email to confirm it, then sign in.");
      setMode("login");
      return;
    }

    const {error}=await supabase.auth.signInWithPassword({email,password});

    if(error){
      setStatus(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="auth-page auth-redesign">
      <div className="auth-brand">
        <div className="brand-lockup auth-logo-lockup">
          <img className="auth-brand-logo" src="/inmotion-logo.webp" alt="InMotion" />
        </div>

        <div className="auth-value">
          <div className="eyebrow">Your business, always available</div>
          <h1>An AI receptionist that actually works like one.</h1>
          <p>Answer customers, manage bookings, follow up on leads and hand over to your team when it matters.</p>

          <div className="auth-proof">
            <span>24/7 replies</span>
            <span>Bookings</span>
            <span>Human handover</span>
          </div>
        </div>
      </div>

      <div className="auth-form-wrap">
        <div className="auth-card">
          <div className="eyebrow">{mode==="login"?"Welcome back":"Get started"}</div>
          <h2>{mode==="login"?"Sign in to InMotion":"Create your receptionist"}</h2>
          <p className="muted">
            {mode==="login"
              ?"Your inbox, customers and receptionist are waiting."
              :"It only takes a few minutes to teach us about your business."}
          </p>

          <form onSubmit={submit} className="form-grid" style={{marginTop:24}}>
            {mode==="signup"&&(
              <label className="field-label">
                <span>Your name</span>
                <input autoFocus placeholder="Mikail" value={fullName} onChange={e=>setFullName(e.target.value)} required/>
              </label>
            )}

            <label className="field-label">
              <span>Email</span>
              <input autoFocus={mode==="login"} type="email" placeholder="you@business.co.za" value={email} onChange={e=>setEmail(e.target.value)} required/>
            </label>

            <label className="field-label">
              <span>Password</span>
              <input type="password" placeholder="At least 8 characters" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/>
            </label>

            <button className="auth-submit" type="submit">
              {mode==="login"?"Sign in":"Create account →"}
            </button>
          </form>

          {status&&<p className="auth-status">{status}</p>}

          <div className="auth-switch">
            <span>{mode==="login"?"New to InMotion?":"Already have an account?"}</span>
            <button onClick={()=>{
              setMode(mode==="login"?"signup":"login");
              setStatus("");
            }}>
              {mode==="login"?"Create account":"Sign in"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
