"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  Clock3,
  MessageSquareText,
  Sparkles
} from "lucide-react";

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
  {
    number:1,
    label:"Basics",
    eyebrow:"Start here",
    title:"Tell us about your business",
    subtitle:"Just the essentials. You can polish the details later.",
    icon:BriefcaseBusiness
  },
  {
    number:2,
    label:"Services",
    eyebrow:"What can customers book?",
    title:"Add your main services",
    subtitle:"One service is enough to get started.",
    icon:Sparkles
  },
  {
    number:3,
    label:"Hours",
    eyebrow:"Availability",
    title:"When are you open?",
    subtitle:"Choose a preset, then adjust anything unusual.",
    icon:CalendarClock
  },
  {
    number:4,
    label:"Knowledge",
    eyebrow:"Important answers",
    title:"Teach it what matters",
    subtitle:"Add only the rules or answers your receptionist cannot get wrong.",
    icon:MessageSquareText
  },
  {
    number:5,
    label:"Launch",
    eyebrow:"Final step",
    title:"Meet your receptionist",
    subtitle:"Choose a tone, name it, and launch your workspace.",
    icon:Check
  }
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
  const [resources, setResources] = useState<Resource[]>([]);
  const [hours, setHours] = useState(defaultHours);
  const [policies, setPolicies] = useState<Policy[]>([
    { title: "Cancellation policy", content: "Bookings may be cancelled or rescheduled more than 12 hours before the appointment.", type: "cancellation" }
  ]);
  const [faqs, setFaqs] = useState<Faq[]>([]);

  const canFinish = useMemo(
    () => business.name.trim() && services.some(service => service.name.trim()),
    [business.name, services]
  );

  const current = steps[step - 1];

  function updateList<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number, patch: Partial<T>) {
    setter(items => items.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  function applyHoursPreset(preset:"weekday"|"everyday") {
    setHours(currentHours => currentHours.map(row => {
      if (preset === "weekday") {
        return {
          ...row,
          closed: row.dayOfWeek === 0 || row.dayOfWeek === 6,
          opensAt: "08:00",
          closesAt: "17:00"
        };
      }

      return {
        ...row,
        closed:false,
        opensAt:"08:00",
        closesAt:"17:00"
      };
    }));
  }

  function goNext() {
    if (step === 1 && !business.name.trim()) return;
    if (step === 2 && !services.some(service => service.name.trim())) return;
    setStep(value => Math.min(5, value + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setStep(value => Math.max(1, value - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const stepBlocked =
    (step === 1 && !business.name.trim()) ||
    (step === 2 && !services.some(service => service.name.trim()));

  return (
    <main className="onboarding-page onboarding-app-flow">
      <header className="onboarding-topbar">
        <div className="brand-lockup onboarding-logo-lockup">
          <img className="onboarding-brand-logo" src="/inmotion-logo-floating.webp" alt="InMotion" />
        </div>

        <div className="onboarding-progress">
          <div className="onboarding-progress-copy">
            <strong>{current.label}</strong>
            <span>{step} of {steps.length}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${(step / steps.length) * 100}%` }} />
          </div>
        </div>
      </header>

      <div className="onboarding-step-rail" aria-label="Setup progress">
        {steps.map(item => {
          const Icon = item.icon;
          const complete = item.number < step;
          const active = item.number === step;
          return (
            <button
              type="button"
              key={item.number}
              className={`${complete ? "complete" : ""} ${active ? "active" : ""}`}
              onClick={() => item.number <= step && setStep(item.number)}
              disabled={item.number > step}
            >
              <span className="onboarding-step-icon">
                {complete ? <Check size={14} /> : <Icon size={14} />}
              </span>
              <small>{item.label}</small>
            </button>
          );
        })}
      </div>

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
                <input
                  autoFocus
                  placeholder="e.g. Northstar Dental"
                  value={business.name}
                  onChange={e=>setBusiness({...business,name:e.target.value})}
                />
              </label>

              <label>
                <span>What do you do? <small>optional</small></span>
                <textarea
                  placeholder="One or two sentences is enough."
                  value={business.description}
                  onChange={e=>setBusiness({...business,description:e.target.value})}
                />
              </label>

              <div className="two-col">
                <label>
                  <span>Phone <small>optional</small></span>
                  <input
                    placeholder="+27…"
                    inputMode="tel"
                    value={business.phone}
                    onChange={e=>setBusiness({...business,phone:e.target.value})}
                  />
                </label>
                <label>
                  <span>Email <small>optional</small></span>
                  <input
                    type="email"
                    inputMode="email"
                    placeholder="hello@business.co.za"
                    value={business.email}
                    onChange={e=>setBusiness({...business,email:e.target.value})}
                  />
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-fields">
              <div className="section-mini-heading">
                <div>
                  <strong>Main services</strong>
                  <span>Add what customers ask for most.</span>
                </div>
              </div>

              {services.map((service,index)=>(
                <div className="service-builder" key={index}>
                  <label>
                    <span>Service name</span>
                    <input
                      autoFocus={index===0}
                      placeholder="e.g. Consultation"
                      value={service.name}
                      onChange={e=>updateList(setServices,index,{name:e.target.value})}
                    />
                  </label>

                  <div className="service-meta">
                    <label>
                      <span>Duration</span>
                      <div className="input-with-suffix">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={service.durationMinutes}
                          onChange={e=>updateList(setServices,index,{durationMinutes:Number(e.target.value)})}
                        />
                        <small>min</small>
                      </div>
                    </label>
                    <label>
                      <span>Price <small>optional</small></span>
                      <div className="input-with-prefix">
                        <small>R</small>
                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder="0"
                          value={service.price}
                          onChange={e=>updateList(setServices,index,{price:e.target.value===""?"":Number(e.target.value)})}
                        />
                      </div>
                    </label>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="soft-button onboarding-add-button"
                onClick={()=>setServices(items=>[...items,{name:"",durationMinutes:30,price:"",description:""}])}
              >
                + Add another service
              </button>

              <details className="onboarding-optional-block">
                <summary>Assign staff, rooms or resources <span>Optional</span></summary>
                <div className="onboarding-optional-content">
                  {resources.map((resource,index)=>(
                    <div className="resource-row" key={index}>
                      <input
                        placeholder="e.g. Dr Khan / Court 1"
                        value={resource.name}
                        onChange={e=>updateList(setResources,index,{name:e.target.value})}
                      />
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

                  <button
                    type="button"
                    className="soft-button"
                    onClick={()=>setResources(items=>[...items,{name:"",type:"staff"}])}
                  >
                    + Add resource
                  </button>
                </div>
              </details>
            </div>
          )}

          {step === 3 && (
            <div className="hours-builder">
              <div className="hours-presets">
                <button type="button" onClick={()=>applyHoursPreset("weekday")}>
                  <Clock3 size={15} />
                  Mon–Fri, 08:00–17:00
                </button>
                <button type="button" onClick={()=>applyHoursPreset("everyday")}>
                  <CalendarClock size={15} />
                  Every day, 08:00–17:00
                </button>
              </div>

              <div className="hours-list">
                {hours.map((row,index)=>(
                  <div className={`hours-simple ${row.closed ? "closed" : ""}`} key={row.dayOfWeek}>
                    <div className="day-name">{row.label}</div>
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        checked={!row.closed}
                        onChange={e=>updateList(setHours,index,{closed:!e.target.checked})}
                      />
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
            </div>
          )}

          {step === 4 && (
            <div className="onboarding-fields">
              <div className="section-mini-heading">
                <div>
                  <strong>One important rule</strong>
                  <span>You can add more later.</span>
                </div>
              </div>

              {policies.map((policy,index)=>(
                <div className="knowledge-card" key={index}>
                  <input
                    placeholder="e.g. Cancellation policy"
                    value={policy.title}
                    onChange={e=>updateList(setPolicies,index,{title:e.target.value})}
                  />
                  <textarea
                    placeholder="Explain the rule simply…"
                    value={policy.content}
                    onChange={e=>updateList(setPolicies,index,{content:e.target.value})}
                  />
                </div>
              ))}

              <button
                type="button"
                className="soft-button onboarding-add-button"
                onClick={()=>setPolicies(items=>[...items,{title:"",content:"",type:"general"}])}
              >
                + Add another rule
              </button>

              <details className="onboarding-optional-block">
                <summary>Add common customer questions <span>Optional</span></summary>
                <div className="onboarding-optional-content">
                  {faqs.map((faq,index)=>(
                    <div className="knowledge-card" key={index}>
                      <input
                        placeholder="What do customers often ask?"
                        value={faq.question}
                        onChange={e=>updateList(setFaqs,index,{question:e.target.value})}
                      />
                      <textarea
                        placeholder="How should the receptionist answer?"
                        value={faq.answer}
                        onChange={e=>updateList(setFaqs,index,{answer:e.target.value})}
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    className="soft-button"
                    onClick={()=>setFaqs(items=>[...items,{question:"",answer:""}])}
                  >
                    + Add question
                  </button>
                </div>
              </details>
            </div>
          )}

          {step === 5 && (
            <div className="receptionist-preview">
              <div className="agent-avatar">{business.agentName.slice(0,1).toUpperCase() || "A"}</div>
              <div className="eyebrow">Your receptionist</div>
              <h2>{business.agentName}</h2>
              <p className="muted">Ready for {business.name || "your business"}</p>

              <div className="tone-picker">
                <span>How should it sound?</span>
                <div className="tone-options">
                  {[
                    ["friendly_professional","Friendly"],
                    ["casual","Casual"],
                    ["formal","Formal"],
                    ["luxury","Premium"]
                  ].map(([value,label])=>(
                    <button
                      type="button"
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
                <input
                  value={business.agentName}
                  onChange={e=>setBusiness({...business,agentName:e.target.value})}
                />
              </label>

              <div className="review-chips">
                <span>{services.filter(s=>s.name).length} service{services.filter(s=>s.name).length===1?"":"s"}</span>
                <span>{hours.filter(h=>!h.closed).length} open days</span>
                <span>{policies.filter(p=>p.title).length} rule{policies.filter(p=>p.title).length===1?"":"s"}</span>
              </div>

              {status && !status.startsWith("Building") && (
                <p className="onboarding-error">{status}</p>
              )}
            </div>
          )}

          <div className="onboarding-actions onboarding-actions-desktop">
            <button className="back-button" disabled={step===1} onClick={goBack}>
              <ArrowLeft size={15} />
              Back
            </button>

            {step < 5 ? (
              <button className="next-button" disabled={stepBlocked} onClick={goNext}>
                Continue
                <ArrowRight size={15} />
              </button>
            ) : (
              <button
                className="launch-button"
                disabled={!canFinish || status.startsWith("Building")}
                onClick={finish}
              >
                {status.startsWith("Building") ? status : `Launch ${business.agentName}`}
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="onboarding-mobile-actions">
        {step > 1 && (
          <button className="onboarding-mobile-back" onClick={goBack} aria-label="Go back">
            <ArrowLeft size={18} />
          </button>
        )}

        {step < 5 ? (
          <button className="onboarding-mobile-next" disabled={stepBlocked} onClick={goNext}>
            Continue
            <ArrowRight size={17} />
          </button>
        ) : (
          <button
            className="onboarding-mobile-next"
            disabled={!canFinish || status.startsWith("Building")}
            onClick={finish}
          >
            {status.startsWith("Building") ? "Creating workspace…" : `Launch ${business.agentName}`}
          </button>
        )}
      </div>
    </main>
  );
}
