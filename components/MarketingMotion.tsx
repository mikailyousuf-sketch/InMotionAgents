"use client";

import { ReactNode, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type Props = { children: ReactNode };

export function MarketingMotion({ children }: Props) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root.current) return;
    if (typeof window === "undefined") return;

    gsap.registerPlugin(ScrollTrigger);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const ctx = gsap.context(() => {
      gsap.from(".marketing-nav", {
        y: -18,
        autoAlpha: 0,
        duration: 0.8,
        ease: "power3.out"
      });

      const hero = gsap.timeline({ defaults: { ease: "power3.out" } });
      hero
        .from(".marketing-hero-kicker", { y: 14, autoAlpha: 0, duration: 0.55 })
        .from(".marketing-hero h1", { y: 34, autoAlpha: 0, duration: 0.9 }, "-=0.25")
        .from(".marketing-hero-rotator", { y: 16, autoAlpha: 0, duration: 0.55 }, "-=0.5")
        .from(".marketing-hero-copy > p", { y: 18, autoAlpha: 0, duration: 0.65 }, "-=0.45")
        .from(".marketing-hero-actions", { y: 14, autoAlpha: 0, duration: 0.55 }, "-=0.45")
        .from(".marketing-proof-strip", { y: 10, autoAlpha: 0, duration: 0.5 }, "-=0.4")
        .from(".marketing-phone-shell", {
          x: 72,
          y: 30,
          rotateY: -20,
          scale: .94,
          autoAlpha: 0,
          duration: 1.15
        }, "-=0.9")
        .from(".marketing-chat-step", {
          y: 14,
          autoAlpha: 0,
          stagger: 0.11,
          duration: 0.45
        }, "-=0.55")
        .from(".marketing-phone-status", {
          y: 10,
          autoAlpha: 0,
          stagger: 0.12,
          duration: 0.55
        }, "-=0.42")
        .from(".marketing-energy-ribbon", {
          scaleX: .72,
          autoAlpha: 0,
          stagger: 0.08,
          duration: 1.1,
          ease: "power2.out"
        }, "-=1.05");

      gsap.to(".marketing-phone-shell", {
        yPercent: -5,
        rotateY: -3,
        ease: "none",
        scrollTrigger: {
          trigger: ".marketing-hero",
          start: "top top",
          end: "bottom top",
          scrub: true
        }
      });

      gsap.to(".ribbon-one", {
        xPercent: 12,
        yPercent: -8,
        rotate: 5,
        ease: "none",
        scrollTrigger: {
          trigger: ".marketing-hero",
          start: "top top",
          end: "bottom top",
          scrub: 1.2
        }
      });

      gsap.to(".ribbon-two", {
        xPercent: -16,
        yPercent: 10,
        rotate: -4,
        ease: "none",
        scrollTrigger: {
          trigger: ".marketing-hero",
          start: "top top",
          end: "bottom top",
          scrub: 1.4
        }
      });

      gsap.to(".marketing-signal-field", {
        yPercent: -9,
        scale: 1.055,
        ease: "none",
        scrollTrigger: {
          trigger: ".marketing-hero",
          start: "top top",
          end: "bottom top",
          scrub: 1.1
        }
      });

      gsap.to(".marketing-phone-status-top", {
        y: -26,
        x: 8,
        ease: "none",
        scrollTrigger: {
          trigger: ".marketing-hero",
          start: "top center",
          end: "bottom top",
          scrub: 1
        }
      });

      gsap.to(".marketing-phone-status-bottom", {
        y: 22,
        x: -10,
        ease: "none",
        scrollTrigger: {
          trigger: ".marketing-hero",
          start: "top center",
          end: "bottom top",
          scrub: 1
        }
      });

      gsap.to(".marketing-hero-backdrop-word", {
        xPercent: -9,
        autoAlpha: .075,
        ease: "none",
        scrollTrigger: {
          trigger: ".marketing-hero",
          start: "top top",
          end: "bottom top",
          scrub: 1.4
        }
      });

      gsap.utils.toArray<HTMLElement>(".marketing-capability-card").forEach((card, index) => {
        gsap.from(card, {
          y: 26,
          autoAlpha: 0,
          duration: 0.65,
          delay: index * 0.04,
          ease: "power3.out",
          scrollTrigger: {
            trigger: card,
            start: "top 88%"
          }
        });
      });

      gsap.from(".marketing-flow-step", {
        x: -24,
        autoAlpha: 0,
        stagger: 0.12,
        duration: 0.65,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".marketing-flow-section",
          start: "top 78%"
        }
      });

      gsap.from(".marketing-handover-card", {
        x: 38,
        y: 12,
        rotate: 1.5,
        autoAlpha: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".marketing-handover",
          start: "top 78%"
        }
      });

      gsap.from(".marketing-industry-list span", {
        y: 18,
        autoAlpha: 0,
        stagger: 0.07,
        duration: 0.55,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".marketing-industries",
          start: "top 80%"
        }
      });

      gsap.from(".marketing-trial-content", {
        y: 28,
        scale: 0.985,
        autoAlpha: 0,
        duration: 0.85,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".marketing-trial",
          start: "top 82%"
        }
      });

      const page = root.current?.querySelector<HTMLElement>(".marketing-page");
      const heroEl = root.current?.querySelector<HTMLElement>(".marketing-hero");
      const phone = root.current?.querySelector<HTMLElement>(".marketing-phone");

      const handlePointerMove = (event: PointerEvent) => {
        if (!page) return;
        const x = (event.clientX / window.innerWidth) * 100;
        const y = (event.clientY / window.innerHeight) * 100;
        page.style.setProperty("--hero-pointer-x", `${x}%`);
        page.style.setProperty("--hero-pointer-y", `${y}%`);

        if (heroEl && phone && window.innerWidth > 900) {
          const rect = heroEl.getBoundingClientRect();
          const nx = Math.max(-1, Math.min(1, (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)));
          const ny = Math.max(-1, Math.min(1, (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)));
          gsap.to(phone, {
            rotateY: -7 + nx * 4.5,
            rotateX: 1.5 - ny * 3.5,
            duration: .9,
            ease: "power3.out",
            overwrite: "auto"
          });
        }
      };

      window.addEventListener("pointermove", handlePointerMove, { passive: true });

      ScrollTrigger.refresh();

      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
      };
    }, root);

    return () => ctx.revert();
  }, []);

  return <div ref={root}>{children}</div>;
}
