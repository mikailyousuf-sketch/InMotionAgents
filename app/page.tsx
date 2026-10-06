import Link from "next/link";
import { MarketingMotion } from "@/components/MarketingMotion";
import { AnimatedGradient } from "@/components/ui/animated-gradient";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  UsersRound
} from "lucide-react";

const capabilities = [
  { icon: MessageSquareText, title: "Answers enquiries", copy: "Fast, on-brand replies from your real business knowledge." },
  { icon: CalendarDays, title: "Books appointments", copy: "Checks availability and confirms bookings inside the conversation." },
  { icon: UsersRound, title: "Qualifies leads", copy: "Captures intent and keeps the useful context attached to the customer." },
  { icon: UserRoundCheck, title: "Hands over cleanly", copy: "Moves complex conversations to your team with the context intact." }
];

const industries = [
  { name: "Dental", example: "“Can I book a cleaning tomorrow?”" },
  { name: "Padel", example: "“Any courts open after work?”" },
  { name: "Salons", example: "“Can I book colour for Saturday?”" },
  { name: "Restaurants", example: "“Table for four at 7?”" },
  { name: "Home services", example: "“Can someone come out today?”" }
];

export default function HomePage() {
  return (
    <MarketingMotion>
    <main className="marketing-page">
      <AnimatedGradient variant="aurora" speed={0.82} opacity={1} className="marketing-background" />
      <header className="marketing-nav">
        <Link href="/" className="marketing-brand" aria-label="InMotion home">
          <img src="/inmotion-logo-floating.webp" alt="InMotion" />
        </Link>

        <nav className="marketing-nav-links" aria-label="Primary">
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#industries">Industries</a>
        </nav>

        <div className="marketing-nav-actions">
          <Link href="/login" className="marketing-login">Log in</Link>
          <Link href="/login" className="marketing-primary-button">
            Start Now <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section className="marketing-hero">
        <div className="marketing-hero-glow marketing-hero-glow-one" />
        <div className="marketing-hero-glow marketing-hero-glow-two" />

        <div className="marketing-hero-energy" aria-hidden="true">
          <span className="marketing-energy-ribbon ribbon-one" />
          <span className="marketing-energy-ribbon ribbon-two" />
          <span className="marketing-energy-ribbon ribbon-three" />
          <span className="marketing-energy-beam beam-one" />
          <span className="marketing-energy-beam beam-two" />
          <span className="marketing-energy-flare flare-one" />
          <span className="marketing-energy-flare flare-two" />
        </div>

        <div className="marketing-hero-copy">
          <div className="marketing-kicker marketing-hero-kicker">
            <span className="status-orb" />
            Live AI front desk · WhatsApp-first
          </div>

          <h1>
            Your front desk.
            <span className="marketing-hero-gradient-line">Always in motion.</span>
          </h1>

          <div className="marketing-hero-rotator" aria-label="InMotion capabilities">
            <span className="marketing-hero-rotator-label">It</span>
            <div className="marketing-hero-rotator-window">
              <div className="marketing-hero-rotator-track">
                <strong>answers instantly.</strong>
                <strong>books customers.</strong>
                <strong>qualifies leads.</strong>
                <strong>remembers context.</strong>
              </div>
            </div>
          </div>

          <p>
            InMotion handles customer conversations from first message to confirmed action —
            using your business rules, availability and customer history.
          </p>

          <div className="marketing-hero-actions">
            <Link href="/login" className="marketing-primary-button large">
              Start Now <ArrowRight size={16} />
            </Link>
            <a href="#product" className="marketing-secondary-button">
              Watch it work <Sparkles size={15} />
            </a>
          </div>

          <div className="marketing-proof-strip">
            <span><Check size={13} /> 24/7 response</span>
            <span><Check size={13} /> Human takeover</span>
            <span><Check size={13} /> Booking + CRM memory</span>
          </div>
        </div>

        <div className="marketing-phone-stage" aria-label="InMotion product preview">
          <div className="marketing-stage-aura" aria-hidden="true" />
          <div className="marketing-signal-field" aria-hidden="true">
            <span className="marketing-signal-trail trail-one" />
            <span className="marketing-signal-trail trail-two" />
            <span className="marketing-signal-trail trail-three" />
            <span className="marketing-signal-glint glint-one" />
            <span className="marketing-signal-glint glint-two" />
          </div>

          <div className="marketing-stage-label" aria-hidden="true">
            <span className="status-orb" />
            Live front desk
          </div>

          <div className="marketing-phone-shell">
            <div className="marketing-phone-reflection" aria-hidden="true" />
            <div className="marketing-phone">
              <div className="marketing-phone-top">
                <div>
                  <span className="marketing-avatar"><Bot size={14} /></span>
                  <div>
                    <strong>InMotion</strong>
                    <small><i className="status-orb" /> AI receptionist online</small>
                  </div>
                </div>
              </div>

              <div className="marketing-chat">
                <div className="marketing-message incoming marketing-chat-step">
                  Hi, do you have anything available tomorrow afternoon?
                </div>
                <div className="marketing-message outgoing marketing-chat-step">
                  Yes — I have 15:30 and 16:15 available. Which works better?
                </div>
                <div className="marketing-message incoming small marketing-chat-step">
                  15:30 please.
                </div>

                <div className="marketing-booking-card marketing-chat-step">
                  <div className="marketing-booking-icon"><CalendarDays size={18} /></div>
                  <div>
                    <span>Booking confirmed</span>
                    <strong>Tomorrow · 15:30</strong>
                    <small>Customer and booking saved automatically.</small>
                  </div>
                </div>
              </div>

              <div className="marketing-phone-composer">
                <span>Message…</span>
                <Sparkles size={14} />
              </div>
            </div>
          </div>

          <div className="marketing-phone-status marketing-phone-status-top">
            <span className="status-orb" />
            17 conversations handled today
          </div>

          <div className="marketing-phone-status marketing-phone-status-bottom">
            <Sparkles size={12} />
            Booking completed in 18 sec
          </div>
        </div>

        <div className="marketing-hero-ticker" aria-hidden="true">
          <div className="marketing-hero-ticker-track">
            <span>ANSWERS</span><i>✦</i>
            <span>BOOKS</span><i>✦</i>
            <span>QUALIFIES</span><i>✦</i>
            <span>REMEMBERS</span><i>✦</i>
            <span>HANDS OVER</span><i>✦</i>
            <span>ANSWERS</span><i>✦</i>
            <span>BOOKS</span><i>✦</i>
            <span>QUALIFIES</span><i>✦</i>
            <span>REMEMBERS</span><i>✦</i>
            <span>HANDS OVER</span><i>✦</i>
          </div>
        </div>
      </section>

      <section className="marketing-product" id="product">
        <div className="marketing-section-copy">
          <div className="marketing-kicker">More than replies</div>
          <h2>Your receptionist actually does the work.</h2>
          <p>InMotion sits between the customer conversation and the systems your team uses every day.</p>
        </div>

        <div className="marketing-capability-grid">
          {capabilities.map(({ icon: Icon, title, copy }, index) => (
            <article key={title} className="marketing-capability-card">
              <div className="marketing-capability-top">
                <span><Icon size={19} strokeWidth={1.7} /></span>
                <small>0{index + 1}</small>
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-flow-section" id="how-it-works">
        <div className="marketing-flow-visual">
          <div className="marketing-flow-step active">
            <span>01</span>
            <div><strong>Connect</strong><small>Bring your WhatsApp business number into InMotion.</small></div>
          </div>
          <i />
          <div className="marketing-flow-step">
            <span>02</span>
            <div><strong>Teach</strong><small>Add your services, hours, FAQs and business rules.</small></div>
          </div>
          <i />
          <div className="marketing-flow-step">
            <span>03</span>
            <div><strong>Go live</strong><small>Let the receptionist handle routine conversations and bookings.</small></div>
          </div>
        </div>

        <div className="marketing-flow-copy">
          <div className="marketing-kicker">Simple by design</div>
          <h2>Set it up once. Then let it work.</h2>
          <p>
            Your team keeps control of the important decisions. InMotion handles the repetitive front-desk work around them.
          </p>
        </div>
      </section>

      <section className="marketing-handover">
        <div className="marketing-handover-copy">
          <div className="marketing-kicker">Human when it matters</div>
          <h2>Automation should know when to stop.</h2>
          <p>
            When a customer needs judgement, approval or a sensitive answer, InMotion hands the conversation to your team with the context already prepared.
          </p>
          <div className="marketing-handover-proof">
            <span><ShieldCheck size={16} /> Policies and guardrails</span>
            <span><UserRoundCheck size={16} /> Staff takeover</span>
          </div>
        </div>

        <div className="marketing-handover-card">
          <div className="marketing-handover-head">
            <span className="marketing-amber-led" />
            <strong>Handover ready</strong>
          </div>
          <p>Customer is asking for a refund. Policy requires staff approval.</p>
          <div className="marketing-handover-actions">
            <button type="button">Take over</button>
            <span>AI pauses automatically</span>
          </div>
        </div>
      </section>

      <section className="marketing-industries" id="industries">
        <div>
          <div className="marketing-kicker">Flexible by industry</div>
          <h2>One receptionist. Different businesses.</h2>
        </div>

        <div className="marketing-industry-list">
          {industries.map((industry) => (
            <div className="marketing-industry-row" key={industry.name}>
              <span>{industry.name}</span>
              <small>{industry.example}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="marketing-trial">
        <div className="marketing-trial-content">
          <img src="/inmotion-logo-floating.webp" alt="" aria-hidden="true" />
          <div className="marketing-kicker">Start with InMotion</div>
          <h2>Give your front desk room to breathe.</h2>
          <p>Set up your business, teach your receptionist and start handling customer conversations from one workspace.</p>
          <Link href="/login" className="marketing-primary-button large">
            Start Now <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="marketing-footer">
        <Link href="/" className="marketing-footer-brand">
          <img src="/inmotion-logo-floating.webp" alt="InMotion" />
        </Link>

        <div className="marketing-footer-links">
          <Link href="/login">Log in</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>

        <span>© {new Date().getFullYear()} InMotion Agents</span>
      </footer>
    </main>
    </MarketingMotion>
  );
}
