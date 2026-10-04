"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthBrowserClient } from "@/lib/supabase/auth-browser";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus(mode === "signup" ? "Creating your account…" : "Signing you in…");

    const supabase = createAuthBrowserClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      if (data.session) {
        router.push("/onboarding");
        router.refresh();
        return;
      }

      setStatus("Account created. Check your email to confirm it, then sign in.");
      setMode("login");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  function changeMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setStatus("");
  }

  return (
    <main className="auth-page auth-redesign">
      <div className="auth-brand">
        <div className="brand-lockup auth-logo-lockup">
          <img className="auth-brand-logo" src="/inmotion-logo-floating.webp" alt="InMotion" />
        </div>

        <div className="auth-value">
          <div className="eyebrow">Your business, always available</div>
          <h1>An AI receptionist that actually works like one.</h1>
          <p>
            Answer customers, manage bookings, follow up on leads and hand over
            to your team when it matters.
          </p>

          <div className="auth-proof">
            <span>24/7 replies</span>
            <span>Bookings</span>
            <span>Human handover</span>
          </div>
        </div>
      </div>

      <div className="auth-form-wrap">
        <div className="auth-card">
          <div className="auth-card-brand">InMotion Agents</div>

          <div className="auth-card-copy">
            <div className="eyebrow">
              {mode === "login" ? "Welcome back" : "Start with InMotion"}
            </div>
            <h2>
              {mode === "login" ? "Sign in to your workspace" : "Create your account"}
            </h2>
            <p className="muted">
              {mode === "login"
                ? "Access your receptionist, inbox and customer activity."
                : "Set up your workspace now. We’ll configure your receptionist next."}
            </p>
          </div>

          <form onSubmit={submit} className="form-grid auth-form-grid">
            {mode === "signup" && (
              <label className="field-label">
                <span>Your name</span>
                <input
                  autoFocus
                  autoComplete="name"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              </label>
            )}

            <label className="field-label">
              <span>Work email</span>
              <input
                autoFocus={mode === "login"}
                type="email"
                autoComplete="email"
                placeholder="you@business.co.za"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label className="field-label">
              <span>Password</span>
              <input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="Enter your password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              {mode === "signup" && (
                <small className="auth-field-note">Use at least 8 characters.</small>
              )}
            </label>

            <button className="auth-submit" type="submit">
              {mode === "login" ? "Sign in to InMotion" : "Create my account"}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          {status && <p className="auth-status">{status}</p>}

          <div className="auth-mode-footer">
            <span className="auth-mode-footer-label">
              {mode === "login" ? "New to InMotion?" : "Already have an account?"}
            </span>

            <div className="auth-mode-tabs" aria-label="Authentication mode">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => changeMode("login")}
              >
                Sign in
              </button>
              <button
                type="button"
                className={mode === "signup" ? "active" : ""}
                onClick={() => changeMode("signup")}
              >
                Create account
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
