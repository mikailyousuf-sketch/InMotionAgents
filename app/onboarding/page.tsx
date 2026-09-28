import { AppShell } from "@/components/AppShell";

export default function OnboardingPage() {
  return (
    <AppShell>
      <h1>Business onboarding</h1>
      <p className="muted">Self-service onboarding skeleton for V1.</p>
      <div className="card" style={{ maxWidth: 760, marginTop: 24 }}>
        <h3>Step 1 · Business profile</h3>
        <p className="muted">This becomes the source of truth for the AI agent before external integrations are connected.</p>
        <ul>
          <li>Business details and timezone</li>
          <li>Opening hours</li>
          <li>Services and prices</li>
          <li>Policies and FAQs</li>
          <li>Agent tone and escalation rules</li>
        </ul>
      </div>
    </AppShell>
  );
}
