"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Link2,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Sparkles
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

type SessionData = {
  waba_id?: string;
  phone_number_id?: string;
};

export default function WhatsAppConnectPage() {
  const [businessId, setBusinessId] = useState("");
  const [role, setRole] = useState("");
  const [sdkReady, setSdkReady] = useState(false);
  const [status, setStatus] = useState("Checking connection…");
  const [connected, setConnected] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const sessionRef = useRef<SessionData>({});

  const appId = process.env.NEXT_PUBLIC_META_APP_ID || "";
  const configId = process.env.NEXT_PUBLIC_META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID || "";
  const graphVersion = process.env.NEXT_PUBLIC_META_GRAPH_VERSION || "v26.0";

  useEffect(() => {
    fetch("/api/workspace/current")
      .then((r) => r.json())
      .then(async (current) => {
        if (!current.business?.id) return;
        setBusinessId(current.business.id);

        const live = await fetch(`/api/integrations/whatsapp/status?businessId=${current.business.id}`, {
          cache: "no-store"
        }).then((r) => r.json());

        setRole(live.role || "");

        if (live.state === "connected") {
          setConnected({
            status: "connected",
            config: {
              ...live.meta,
              connection_mode: "coexistence"
            }
          });
          setStatus("WhatsApp is connected and ready.");
        } else {
          setConnected(null);
          setStatus(
            live.reason ||
            "Connect WhatsApp through Meta to activate this channel."
          );
        }
      })
      .catch(() => setStatus("Could not check the WhatsApp connection."))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!appId) return;

    const receiveMessage = (event: MessageEvent) => {
      if (!["https://www.facebook.com", "https://web.facebook.com"].includes(event.origin)) return;

      let data = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }

      if (data?.type !== "WA_EMBEDDED_SIGNUP") return;

      if (
        data.event === "FINISH" ||
        data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
      ) {
        sessionRef.current = {
          waba_id: data.data?.waba_id,
          phone_number_id: data.data?.phone_number_id
        };
        setStatus("Meta approved the WhatsApp selection. Finishing your connection…");
      }

      if (data.event === "CANCEL") {
        setStatus("WhatsApp connection was cancelled.");
      }

      if (data.event === "ERROR") {
        setStatus(data.data?.error_message || "Meta could not finish WhatsApp onboarding.");
      }
    };

    window.addEventListener("message", receiveMessage);

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: graphVersion
      });
      setSdkReady(true);
    };

    if (window.FB) {
      window.fbAsyncInit();
    } else if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      document.body.appendChild(script);
    }

    return () => window.removeEventListener("message", receiveMessage);
  }, [appId, graphVersion]);

  async function finishConnection(code: string) {
    const { waba_id, phone_number_id } = sessionRef.current;

    const response = await fetch("/api/integrations/whatsapp/embedded-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        code,
        wabaId: waba_id,
        phoneNumberId: phone_number_id,
        mode: "coexistence"
      })
    });

    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Could not finish WhatsApp connection.");
      return;
    }

    const live = await fetch(`/api/integrations/whatsapp/status?businessId=${businessId}`, {
      cache: "no-store"
    }).then((r) => r.json());

    if (live.state === "connected") {
      setConnected({
        status: "connected",
        config: {
          ...live.meta,
          connection_mode: "coexistence"
        }
      });
      setStatus("WhatsApp is connected and ready.");
    } else {
      setConnected(null);
      setStatus(live.reason || "Meta onboarding completed, but the phone is not usable yet.");
    }
  }

  function connect() {
    if (!window.FB || !sdkReady) {
      setStatus("Meta is still loading. Try again in a moment.");
      return;
    }
    if (!businessId) {
      setStatus("Your workspace is still loading.");
      return;
    }
    if (!configId) {
      setStatus("Embedded Signup configuration is not set yet.");
      return;
    }

    sessionRef.current = {};
    setStatus("Opening Meta secure signup…");

    window.FB.login(
      (response: any) => {
        const code = response?.authResponse?.code;
        if (!code) {
          setStatus("Meta signup closed before authorization completed.");
          return;
        }

        const waitForSession = async () => {
          for (let attempt = 0; attempt < 20; attempt += 1) {
            if (sessionRef.current.waba_id && sessionRef.current.phone_number_id) {
              await finishConnection(code);
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
          setStatus("Meta authorized the app, but did not return the WhatsApp number details. Please run the connection again.");
        };

        waitForSession();
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3"
        }
      }
    );
  }

  const editable = ["owner", "admin"].includes(role);

  return (
    <AppShell>
      <div className="whatsapp-connect-page">
        <a href="/integrations" className="whatsapp-back">
          <ArrowLeft size={14} /> Connections
        </a>

        <header className="whatsapp-connect-header">
          <div>
            <div className="eyebrow">Messaging channel</div>
            <h1>WhatsApp Business</h1>
            <p>Connect the number your customers already know. Keep using the WhatsApp Business app while InMotion handles API conversations in the background.</p>
          </div>

          <div className={`whatsapp-status-pill ${connected ? "connected" : ""}`}>
            <span />
            {checking ? "Checking" : connected ? "Connected" : "Not connected"}
          </div>
        </header>

        <div className="whatsapp-connect-layout">
          <section className="whatsapp-primary-panel glass-surface">
            <div className="whatsapp-panel-icon">
              <MessageCircle size={22} strokeWidth={1.7} />
            </div>

            <div className="whatsapp-primary-copy">
              <span>Meta Embedded Signup</span>
              <h2>{connected ? "Your WhatsApp channel is live" : "Connect your existing number"}</h2>
              <p>
                {connected
                  ? "InMotion can now use this WhatsApp Business connection for customer conversations."
                  : "Meta securely handles account selection and authorization. InMotion never asks you to paste an access token into the browser."}
              </p>
            </div>

            {connected?.config ? (
              <div className="whatsapp-connected-details">
                <div>
                  <span>Business</span>
                  <strong>{connected.config.verified_name || "WhatsApp Business"}</strong>
                </div>
                <div>
                  <span>Number</span>
                  <strong>{connected.config.display_phone_number || "Connected number"}</strong>
                </div>
                <div>
                  <span>Mode</span>
                  <strong>Business App + API</strong>
                </div>
                <div>
                  <span>Verification</span>
                  <strong><CheckCircle2 size={13} /> Verified</strong>
                </div>
              </div>
            ) : (
              <div className="whatsapp-steps">
                <div>
                  <span>1</span>
                  <div><strong>Authorize Meta</strong><small>Sign in to the business that owns the number.</small></div>
                </div>
                <div>
                  <span>2</span>
                  <div><strong>Select WhatsApp</strong><small>Choose the existing business account and phone number.</small></div>
                </div>
                <div>
                  <span>3</span>
                  <div><strong>Go live</strong><small>InMotion verifies the connection before marking it active.</small></div>
                </div>
              </div>
            )}

            <div className="whatsapp-action-row">
              <button
                className="whatsapp-connect-button"
                onClick={connect}
                disabled={!editable || !sdkReady || Boolean(connected)}
              >
                {connected ? (
                  <><Check size={15} /> WhatsApp connected</>
                ) : (
                  <><Link2 size={15} /> Connect with Meta</>
                )}
              </button>

              {!sdkReady && !connected && (
                <span className="whatsapp-sdk-state">Preparing Meta login…</span>
              )}
            </div>

            {status && (
              <div className={`whatsapp-status-message ${connected ? "success" : ""}`}>
                <Sparkles size={13} />
                <span>{status}</span>
              </div>
            )}
          </section>

          <aside className="whatsapp-side-stack">
            <section className="whatsapp-side-panel glass-surface">
              <div className="whatsapp-side-heading"><Smartphone size={16} /><strong>Keep your app</strong></div>
              <p>Your WhatsApp Business app stays installed and signed in. Coexistence lets the mobile app and InMotion work with the same business number.</p>
            </section>

            <section className="whatsapp-side-panel glass-surface">
              <div className="whatsapp-side-heading"><ShieldCheck size={16} /><strong>Secure by default</strong></div>
              <p>Meta authorization happens in Meta&apos;s own signup window. Business credentials are encrypted and kept server-side.</p>
            </section>

            <section className="whatsapp-side-panel quiet">
              <span>Before you connect</span>
              <p>Keep the WhatsApp Business app signed in on the phone. Meta may ask you to confirm the existing number during onboarding.</p>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
