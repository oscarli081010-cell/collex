"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// A group whose children rise in one after another as it scrolls into view. Each group starts its own entrance when
// it mounts, so it can't miss it when a page arrives after the route has already changed (and stay hidden).
export default function Reveal({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const group = ref.current;
    if (!group || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(group.children, { opacity: 0, y: 14 }, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.06,
        scrollTrigger: { trigger: group, start: "top 85%", once: true },
      });
    });
    return () => ctx.revert();
  }, []);

  return <div ref={ref} className={className} data-reveal>{children}</div>;
}
