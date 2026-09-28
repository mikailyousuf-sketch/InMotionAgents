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
    setStatus("Working...");

    const supabase = createAuthBrowserClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Account created. Check your email if confirmation is enabled, then log in.");
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

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="brand" style={{ marginBottom: 8 }}>InMotion Agents</div>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="muted">Manage your AI agent, customers and bookings.</p>

        <form onSubmit={submit} className="form-grid" style={{ marginTop: 24 }}>
          {mode === "signup" && (
            <input
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">{mode === "login" ? "Log in" : "Sign up"}</button>
        </form>

        {status && <p className="muted" style={{ marginTop: 14 }}>{status}</p>}

        <button
          className="link-button"
          style={{ marginTop: 16 }}
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setStatus("");
          }}
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
      </div>
    </main>
  );
}
