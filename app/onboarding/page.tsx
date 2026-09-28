"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";

const defaultHours = [
  { dayOfWeek: 0, label: "Sunday", opensAt: "08:00", closesAt: "17:00", closed: true },
  { dayOfWeek: 1, label: "Monday", opensAt: "08:00", closesAt: "17:00", closed: false },
  { dayOfWeek: 2, label: "Tuesday", opensAt: "08:00", closesAt: "17:00", closed: false },
  { dayOfWeek: 3, label: "Wednesday", opensAt: "08:00", closesAt: "17:00", closed: false },
  { dayOfWeek: 4, label: "Thursday", opensAt: "08:00", closesAt: "17:00", closed: false },
  { dayOfWeek: 5, label: "Friday", opensAt: "08:00", closesAt: "17:00", closed: false },
  { dayOfWeek: 6, label: "Saturday", opensAt: "08:00", closesAt: "13:00", closed: false }
];

type Service = { name: string; durationMinutes: number; price: number | ""; description: string };
type Resource = { name: string; type: string };
type Policy = { title: string; content: string; type: string };
type Faq = { question: string; answer: string };

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState("");
  const [business, setBusiness] = useState({
    name: "",
    description: "",
    phone: "",
    email: "",
    website: "",
    timezone: "Africa/Johannesburg",
    tone: "friendly_professional",
    agentName: "Ava"
  });
  const [services, setServices] = useState<Service[]>([
    { name: "", durationMinutes: 30, price: "", description: "" }
  ]);
  const [resources, setResources] = useState<Resource[]>([
    { name: "", type: "staff" }
  ]);
  const [hours, setHours] = useState(defaultHours);
  const [policies, setPolicies] = useState<Policy[]>([
    { title: "Cancellation policy", content: "Bookings may be cancelled or rescheduled more than 12 hours before the appointment.", type: "cancellation" }
  ]);
  const [faqs, setFaqs] = useState<Faq[]>([
    { question: "", answer: "" }
  ]);

  const canFinish = useMemo(
    () => business.name.trim() && services.some((service) => service.name.trim()),
    [business.name, services]
  );

  function updateList<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number, patch: Partial<T>) {
    setter((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  async function finish() {
    if (!canFinish) return;
    setStatus("Saving...");

    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business,
        services: services.filter((item) => item.name.trim()),
        resources: resources.filter((item) => item.name.trim()),
        hours,
        policies: policies.filter((item) => item.title.trim() && item.content.trim()),
        faqs: faqs.filter((item) => item.question.trim() && item.answer.trim())
      })
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not save onboarding");
      return;
    }

    setStatus(`Workspace created: ${data.business.slug}`);
  }

  return (
    <AppShell>
      <h1>Business onboarding</h1>
      <p className="muted">Create a complete AI-ready workspace without touching code.</p>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="muted">Step {step} of 5</div>

        {step === 1 && (
          <div className="form-grid">
            <h3>Business profile</h3>
            <input placeholder="Business name" value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} />
            <textarea placeholder="What does the business do?" value={business.description} onChange={(e) => setBusiness({ ...business, description: e.target.value })} />
            <input placeholder="Phone" value={business.phone} onChange={(e) => setBusiness({ ...business, phone: e.target.value })} />
            <input placeholder="Email" value={business.email} onChange={(e) => setBusiness({ ...business, email: e.target.value })} />
            <input placeholder="Website" value={business.website} onChange={(e) => setBusiness({ ...business, website: e.target.value })} />
            <select value={business.tone} onChange={(e) => setBusiness({ ...business, tone: e.target.value })}>
              <option value="friendly_professional">Friendly & professional</option>
              <option value="luxury">Luxury</option>
              <option value="casual">Casual</option>
              <option value="formal">Formal</option>
            </select>
            <input placeholder="Agent name" value={business.agentName} onChange={(e) => setBusiness({ ...business, agentName: e.target.value })} />
          </div>
        )}

        {step === 2 && (
          <div className="form-grid">
            <h3>Services</h3>
            {services.map((service, index) => (
              <div className="repeat-row" key={index}>
                <input placeholder="Service name" value={service.name} onChange={(e) => updateList(setServices, index, { name: e.target.value })} />
                <input type="number" placeholder="Minutes" value={service.durationMinutes} onChange={(e) => updateList(setServices, index, { durationMinutes: Number(e.target.value) })} />
                <input type="number" placeholder="Price (R)" value={service.price} onChange={(e) => updateList(setServices, index, { price: e.target.value === "" ? "" : Number(e.target.value) })} />
                <input placeholder="Description" value={service.description} onChange={(e) => updateList(setServices, index, { description: e.target.value })} />
              </div>
            ))}
            <button onClick={() => setServices((current) => [...current, { name: "", durationMinutes: 30, price: "", description: "" }])}>+ Add service</button>

            <h3>Staff / resources</h3>
            {resources.map((resource, index) => (
              <div className="repeat-row" key={index}>
                <input placeholder="Name" value={resource.name} onChange={(e) => updateList(setResources, index, { name: e.target.value })} />
                <select value={resource.type} onChange={(e) => updateList(setResources, index, { type: e.target.value })}>
                  <option value="staff">Staff</option>
                  <option value="room">Room</option>
                  <option value="table">Table</option>
                  <option value="court">Court</option>
                  <option value="vehicle">Vehicle</option>
                  <option value="other">Other</option>
                </select>
              </div>
            ))}
            <button onClick={() => setResources((current) => [...current, { name: "", type: "staff" }])}>+ Add resource</button>
          </div>
        )}

        {step === 3 && (
          <div className="form-grid">
            <h3>Opening hours</h3>
            {hours.map((row, index) => (
              <div className="hours-row" key={row.dayOfWeek}>
                <strong>{row.label}</strong>
                <label><input type="checkbox" checked={!row.closed} onChange={(e) => updateList(setHours, index, { closed: !e.target.checked })} /> Open</label>
                <input type="time" disabled={row.closed} value={row.opensAt} onChange={(e) => updateList(setHours, index, { opensAt: e.target.value })} />
                <input type="time" disabled={row.closed} value={row.closesAt} onChange={(e) => updateList(setHours, index, { closesAt: e.target.value })} />
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="form-grid">
            <h3>Policies</h3>
            {policies.map((policy, index) => (
              <div className="repeat-row" key={index}>
                <input placeholder="Policy title" value={policy.title} onChange={(e) => updateList(setPolicies, index, { title: e.target.value })} />
                <textarea placeholder="Policy content" value={policy.content} onChange={(e) => updateList(setPolicies, index, { content: e.target.value })} />
              </div>
            ))}
            <button onClick={() => setPolicies((current) => [...current, { title: "", content: "", type: "general" }])}>+ Add policy</button>

            <h3>FAQs</h3>
            {faqs.map((faq, index) => (
              <div className="repeat-row" key={index}>
                <input placeholder="Question" value={faq.question} onChange={(e) => updateList(setFaqs, index, { question: e.target.value })} />
                <textarea placeholder="Answer" value={faq.answer} onChange={(e) => updateList(setFaqs, index, { answer: e.target.value })} />
              </div>
            ))}
            <button onClick={() => setFaqs((current) => [...current, { question: "", answer: "" }])}>+ Add FAQ</button>
          </div>
        )}

        {step === 5 && (
          <div>
            <h3>Review</h3>
            <p><strong>{business.name || "Unnamed business"}</strong></p>
            <p className="muted">{services.filter((s) => s.name).length} services · {resources.filter((r) => r.name).length} resources · {faqs.filter((f) => f.question).length} FAQs</p>
            <p className="muted">Agent: {business.agentName} · Tone: {business.tone}</p>
            <button disabled={!canFinish} onClick={finish}>Create workspace</button>
            {status && <p className="muted">{status}</p>}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          <button disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>Back</button>
          {step < 5 && <button onClick={() => setStep((current) => Math.min(5, current + 1))}>Next</button>}
        </div>
      </div>
    </AppShell>
  );
}
