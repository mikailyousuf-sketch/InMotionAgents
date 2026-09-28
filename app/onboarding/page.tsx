"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

const steps = [
  { number:1, eyebrow:"First things first", title:"Tell us about your business", subtitle:"Give your receptionist the basics it needs to represent you properly." },
  { number:2, eyebrow:"What do you offer?", title:"Add the things customers can book", subtitle:"Services are what your receptionist can explain, price and schedule." },
  { number:3, eyebrow:"When can customers reach you?", title:"Set your business hours", subtitle:"Your receptionist will use these when answering availability questions." },
  { number:4, eyebrow:"Teach the receptionist", title:"Add the rules and answers that matter", subtitle:"Policies and common questions help it sound like someone who already works there." },
  { number:5, eyebrow:"Almost done", title:"Meet your receptionist", subtitle:"Review what we learned. You can change any of this later." }
];

export default function OnboardingPage() {
  const router = useRouter();
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
    () => business.name.trim() && services.some(service => service.name.trim()),
    [business.name, services]
  );

  const current = steps[step - 1];

  function updateList<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number, patch: Partial<T>) {
    setter(items => items.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  async function finish() {
    if (!canFinish) return;

    setStatus("Building your workspace…");

    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business,
        services: services.filter(item => item.name.trim()),
        resources: resources.filter(item => item.name.trim()),
        hours,
        policies: policies.filter(item => item.title.trim() && item.content.trim()),
        faqs: faqs.filter(item => item.question.trim() && item.answer.trim())
      })
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "We couldn't finish setup.");
      return;
    }

    await fetch("/api/workspace/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: data.business.id })
    });

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-topbar">
        <div className="brand-lockup">
          <div className="brand-mark">IM</div>
          <div>
            <div className="brand">InMotion</div>
            <div className="brand-sub">AI Receptionist</div>
          </div>
        </div>

        <div className="onboarding-progress">
          <span>Step {step} of {steps.length}</span>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${(step / steps.length) * 100}%` }} />
          </div>
        </div>
      </header>

      <section className="onboarding-stage">
        <div className="onboarding-copy">
          <div className="eyebrow">{current.eyebrow}</div>
          <h1>{current.title}</h1>
          <p>{current.subtitle}</p>
        </div>

        <div className="onboarding-card">
          {step === 1 && (
            <div className="onboarding-fields">
              <label>
                <span>Business name</span>
                <input autoFocus placeholder="e.g. Northstar Dental" value={business.name} onChange={e=>setBusiness({...business,name:e.target.value})}/>
              </label>

              <label>
                <span>What does your business do?</span>
                <textarea placeholder="Tell us in your own words. This helps your receptionist understand the business." value={business.description} onChange={e=>setBusiness({...business,description:e.target.value})}/>
              </label>

              <div className="two-col">
                <label>
                  <span>Phone</span>
                  <input placeholder="+27…" value={business.phone} onChange={e=>setBusiness({...business,phone:e.target.value})}/>
                </label>
                <label>
                  <span>Email</span>
                  <input type="email" placeholder="hello@business.co.za" value={business.email} onChange={e=>setBusiness({...business,email:e.target.value})}/>
                </label>
              </div>

              <label>
                <span>Website <small>optional</small></span>
                <input placeholder="https://" value={business.website} onChange={e=>setBusiness({...business,website:e.target.value})}/>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-fields">
              <div className="section-mini-heading">
                <strong>Services</strong>
                <span className="muted">Add at least one.</span>
              </div>

              {services.map((service,index)=>(
                <div className="service-builder" key={index}>
                  <input autoFocus={index===0} placeholder="Service name" value={service.name} onChange={e=>updateList(setServices,index,{name:e.target.value})}/>
                  <div className="service-meta">
                    <input type="number" placeholder="30 min" value={service.durationMinutes} onChange={e=>updateList(setServices,index,{durationMinutes:Number(e.target.value)})}/>
                    <input type="number" placeholder="Price (R)" value={service.price} onChange={e=>updateList(setServices,index,{price:e.target.value===""?"":Number(e.target.value)})}/>
                  </div>
                  <input placeholder="Short description (optional)" value={service.description} onChange={e=>updateList(setServices,index,{description:e.target.value})}/>
                </div>
              ))}

              <button className="soft-button" onClick={()=>setServices(items=>[...items,{name:"",durationMinutes:30,price:"",description:""}])}>
                + Add another service
              </button>

              <div className="section-divider" />

              <div className="section-mini-heading">
                <strong>Who or what provides the service?</strong>
                <span className="muted">Optional for now.</span>
              </div>

              {resources.map((resource,index)=>(
                <div className="resource-row" key={index}>
                  <input placeholder="e.g. Dr Khan / Court 1 / Room A" value={resource.name} onChange={e=>updateList(setResources,index,{name:e.target.value})}/>
                  <select value={resource.type} onChange={e=>updateList(setResources,index,{type:e.target.value})}>
                    <option value="staff">Staff member</option>
                    <option value="room">Room</option>
                    <option value="table">Table</option>
                    <option value="court">Court</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              ))}
              <button className="soft-button" onClick={()=>setResources(items=>[...items,{name:"",type:"staff"}])}>
                + Add another
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="hours-builder">
              {hours.map((row,index)=>(
                <div className="hours-simple" key={row.dayOfWeek}>
                  <div className="day-name">{row.label}</div>
                  <label className="toggle-label">
                    <input type="checkbox" checked={!row.closed} onChange={e=>updateList(setHours,index,{closed:!e.target.checked})}/>
                    <span>{row.closed ? "Closed" : "Open"}</span>
                  </label>
                  {!row.closed && (
                    <div className="time-pair">
                      <input type="time" value={row.opensAt} onChange={e=>updateList(setHours,index,{opensAt:e.target.value})}/>
                      <span>to</span>
                      <input type="time" value={row.closesAt} onChange={e=>updateList(setHours,index,{closesAt:e.target.value})}/>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="onboarding-fields">
              <div className="section-mini-heading">
                <strong>Important policies</strong>
                <span className="muted">What should the receptionist never get wrong?</span>
              </div>

              {policies.map((policy,index)=>(
                <div className="knowledge-card" key={index}>
                  <input placeholder="Policy name" value={policy.title} onChange={e=>updateList(setPolicies,index,{title:e.target.value})}/>
                  <textarea placeholder="Explain the rule simply…" value={policy.content} onChange={e=>updateList(setPolicies,index,{content:e.target.value})}/>
                </div>
              ))}
              <button className="soft-button" onClick={()=>setPolicies(items=>[...items,{title:"",content:"",type:"general"}])}>+ Add policy</button>

              <div className="section-divider" />

              <div className="section-mini-heading">
                <strong>Common questions</strong>
                <span className="muted">Optional — you can add more later.</span>
              </div>

              {faqs.map((faq,index)=>(
                <div className="knowledge-card" key={index}>
                  <input placeholder="What do customers often ask?" value={faq.question} onChange={e=>updateList(setFaqs,index,{question:e.target.value})}/>
                  <textarea placeholder="How should your receptionist answer?" value={faq.answer} onChange={e=>updateList(setFaqs,index,{answer:e.target.value})}/>
                </div>
              ))}
              <button className="soft-button" onClick={()=>setFaqs(items=>[...items,{question:"",answer:""}])}>+ Add question</button>
            </div>
          )}

          {step === 5 && (
            <div className="receptionist-preview">
              <div className="agent-avatar">{business.agentName.slice(0,1).toUpperCase() || "A"}</div>
              <div className="eyebrow">Your receptionist</div>
              <h2>{business.agentName}</h2>
              <p className="muted">For {business.name || "your business"}</p>

              <div className="tone-picker">
                <span>How should {business.agentName} sound?</span>
                <div className="tone-options">
                  {[
                    ["friendly_professional","Friendly"],
                    ["casual","Casual"],
                    ["formal","Formal"],
                    ["luxury","Premium"]
                  ].map(([value,label])=>(
                    <button
                      key={value}
                      className={business.tone===value?"selected":""}
                      onClick={()=>setBusiness({...business,tone:value})}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="agent-name-field">
                <span>Receptionist name</span>
                <input value={business.agentName} onChange={e=>setBusiness({...business,agentName:e.target.value})}/>
              </label>

              <div className="review-chips">
                <span>{services.filter(s=>s.name).length} services</span>
                <span>{resources.filter(r=>r.name).length} resources</span>
                <span>{policies.filter(p=>p.title).length} policies</span>
                <span>{faqs.filter(f=>f.question).length} FAQs</span>
              </div>

              <button className="launch-button" disabled={!canFinish || status.startsWith("Building")} onClick={finish}>
                {status.startsWith("Building") ? status : `Launch ${business.agentName}`}
              </button>

              {status && !status.startsWith("Building") && <p className="muted">{status}</p>}
            </div>
          )}

          <div className="onboarding-actions">
            <button className="back-button" disabled={step===1} onClick={()=>setStep(value=>Math.max(1,value-1))}>Back</button>
            {step < 5 && (
              <button
                className="next-button"
                disabled={step===1 && !business.name.trim()}
                onClick={()=>setStep(value=>Math.min(5,value+1))}
              >
                Continue →
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
