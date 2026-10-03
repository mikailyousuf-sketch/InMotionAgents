"use client";

import { useEffect, useRef, useState } from "react";
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
  const [status, setStatus] = useState("");
  const [connected, setConnected] = useState<any>(null);
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

        const integrations = await fetch(`/api/integrations?businessId=${current.business.id}`).then((r) => r.json());
        setRole(integrations.role || "");
        const existing = (integrations.integrations || []).find((item: any) => item.provider === "whatsapp");
        const isEmbeddedSignupConnection =
          existing?.status === "connected" &&
          ["coexistence", "cloud_api"].includes(existing?.config?.connection_mode) &&
          Boolean(existing?.config?.phone_number_id);

        if (isEmbeddedSignupConnection) {
          setConnected(existing);
        } else if (existing?.status === "connected") {
          setStatus("Legacy WhatsApp setup detected. Reconnect with Meta to finish the new coexistence setup.");
        }
      })
      .catch(() => {});
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
        setStatus("Meta approved the WhatsApp selection. Finishing the secure connection…");
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

    setConnected(data.integration);
    setStatus("WhatsApp is connected to InMotion.");
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
      <div style={{ maxWidth: 900 }}>
        <div className="eyebrow">Channel connection</div>
        <h1 style={{ marginBottom: 8 }}>Connect WhatsApp</h1>
        <p className="muted" style={{ maxWidth: 680 }}>
          Keep your existing WhatsApp Business app number and connect it to InMotion through Meta&apos;s official Embedded Signup flow.
        </p>

        <div className="card" style={{ marginTop: 24, padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ maxWidth: 620 }}>
              <h2 style={{ marginTop: 0 }}>WhatsApp Business App + InMotion</h2>
              <p className="muted">
                Meta handles the account selection, phone verification and coexistence approval. You keep using the WhatsApp Business app while InMotion receives API events and can automate customer conversations.
              </p>

              <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
                <div>✓ Keep your existing business number</div>
                <div>✓ Keep using the WhatsApp Business mobile app</div>
                <div>✓ Connect Meta webhooks to the InMotion agent</div>
                <div>✓ Store business credentials encrypted server-side</div>
              </div>
            </div>

            <span className="integration-status">
              {connected ? "connected" : "not connected"}
            </span>
          </div>

          {connected?.config && (
            <div className="card" style={{ marginTop: 22, padding: 18 }}>
              <strong>{connected.config.display_phone_number || "WhatsApp connected"}</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {connected.config.verified_name || "Business"} · {connected.config.connection_mode || "coexistence"}
              </div>
            </div>
          )}

          <div style={{ marginTop: 26, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={connect}
              disabled={!editable || !sdkReady || Boolean(connected)}
              style={{ minWidth: 220 }}
            >
              {connected ? "WhatsApp connected" : "Connect with Meta"}
            </button>
            <a className="link-button" href="/integrations">Back to integrations</a>
          </div>

          {!editable && role && (
            <p className="muted" style={{ marginTop: 16 }}>Owner or admin access is required to connect WhatsApp.</p>
          )}

          {status && <p className="muted" style={{ marginTop: 16 }}>{status}</p>}
        </div>

        <div className="card" style={{ marginTop: 18, padding: 22 }}>
          <strong>Before connecting</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            Keep the WhatsApp Business app installed and signed in on the phone. Meta may ask you to confirm the existing number or scan a QR code during coexistence onboarding.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
