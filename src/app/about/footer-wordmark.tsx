"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

const FOOTER_ICONS = ["links", "notes", "images", "videos"];

export function FooterWordmark({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const cover = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!frame.current || !cover.current) return;
    const element = frame.current;
    const content = cover.current;
    const icons = [...element.querySelectorAll<HTMLElement>(".ka-footer-icon")];
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let releaseTimer: ReturnType<typeof setTimeout> | undefined;
    let touchY: number | undefined;
    let targetPull = 0;
    let returning = false;
    let lastInputAt = 0;
    let gestureSpeed = 0;
    let flightsRemaining = 0;
    const atBottom = () => {
      const page = document.scrollingElement;
      return page !== null && page.scrollHeight - page.scrollTop - window.innerHeight <= 2;
    };
    const isEditable = (target: EventTarget | null) => target instanceof Element && target.closest('textarea, input, [contenteditable="true"], [role="dialog"]');
    function release(launch = true) {
      clearTimeout(releaseTimer);
      if (launch && targetPull > 0 && !motionPreference.matches) {
        const freshness = Math.exp(-(performance.now() - lastInputAt) / 240);
        icons.forEach((icon, index) => {
          const position = new DOMMatrixReadOnly(getComputedStyle(icon).transform);
          const height = Math.max(0, -position.m42);
          const velocity = Math.min(650, (100 + gestureSpeed * 180 + Math.sqrt(height) * 7) * freshness);
          const seconds = Math.max(.18, Math.min(.42, (velocity + Math.sqrt(velocity ** 2 + 10000 * height)) / 5000));
          const gravity = 2 * (height + velocity * seconds) / seconds ** 2;
          const direction = index % 2 ? 1 : -1;
          const drift = direction * Math.min(32, 8 + gestureSpeed * 5);
          icon.style.setProperty("--footer-flight-duration", `${seconds * 1000}ms`);
          for (const fraction of [0, .15, .3, .5, .7, .85, 1]) {
            const time = seconds * fraction;
            icon.style.setProperty(`--footer-flight-x-${Math.round(fraction * 100)}`, `${position.m41 + drift * fraction}px`);
            icon.style.setProperty(`--footer-flight-y-${Math.round(fraction * 100)}`, `${fraction === 1 ? 0 : -height - velocity * time + gravity * time ** 2 / 2}px`);
          }
          icon.style.setProperty("--footer-icon-origin-x", `${position.m41 + drift}px`);
          icon.style.setProperty("--footer-icon-origin-y", "0px");
        });
        flightsRemaining = icons.length;
        element.setAttribute("data-footer-launched", "");
      }
      targetPull = 0;
      returning = true;
      element.style.setProperty("--footer-pull", "0px");
      element.removeAttribute("data-footer-pulled");
    }
    function stretch(delta: number) {
      const limit = Math.min(180, stage.current?.clientHeight ?? 0);
      if (!limit) return;
      clearTimeout(releaseTimer);
      if (element.hasAttribute("data-footer-launched")) {
        icons.forEach(icon => {
          const position = new DOMMatrixReadOnly(getComputedStyle(icon).transform);
          icon.style.setProperty("--footer-icon-origin-x", `${position.m41}px`);
          icon.style.setProperty("--footer-icon-origin-y", `${position.m42}px`);
        });
        element.removeAttribute("data-footer-launched");
        flightsRemaining = 0;
        // Commit the caught positions before the CSS tether resumes.
        void element.offsetWidth;
      }
      const now = performance.now();
      const interval = lastInputAt ? Math.max(16, now - lastInputAt) : 60;
      gestureSpeed = delta / interval * .7 + (targetPull > 0 ? gestureSpeed * .3 : 0);
      lastInputAt = now;
      // A new gesture can interrupt the CSS return at its current position.
      const current = returning ? element.getBoundingClientRect().top - content.getBoundingClientRect().top : targetPull;
      const distance = -limit * 1.2 * Math.log(1 - Math.max(0, Math.min(current, limit * .999)) / limit);
      targetPull = limit * (1 - Math.exp(-(distance + delta * 2.5) / (limit * 1.2)));
      returning = false;
      element.style.setProperty("--footer-pull", `${targetPull}px`);
      if (!element.hasAttribute("data-footer-revealed")) {
        element.setAttribute("data-footer-revealed", "");
      }
      element.setAttribute("data-footer-pulled", "");
    }
    function onWheel(event: WheelEvent) {
      if (motionPreference.matches || event.defaultPrevented || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || isEditable(event.target)) return;
      if (event.deltaY <= 0 || !atBottom()) {
        if (targetPull > 0) release();
        return;
      }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      event.preventDefault();
      stretch(Math.min(event.deltaY * unit, 240));
      releaseTimer = setTimeout(release, 90);
    }
    function onTouchStart(event: TouchEvent) {
      lastInputAt = performance.now();
      touchY = event.touches.length === 1 && !isEditable(event.target) ? event.touches[0].clientY : undefined;
    }
    function onTouchMove(event: TouchEvent) {
      if (motionPreference.matches || event.touches.length !== 1 || touchY === undefined) return;
      const nextY = event.touches[0].clientY;
      const delta = touchY - nextY;
      touchY = nextY;
      if (event.defaultPrevented || !atBottom() || delta <= 0) {
        if (targetPull > 0) release();
        return;
      }
      event.preventDefault();
      stretch(delta);
    }
    function onTouchEnd() {
      touchY = undefined;
      release();
    }
    function onScroll() {
      if (!atBottom() && targetPull > 0) release();
    }
    function finishReturn(event: TransitionEvent) {
      if (event.target !== content || event.propertyName !== "transform" || targetPull > 0) return;
      if (flightsRemaining === 0) element.removeAttribute("data-footer-revealed");
      returning = false;
    }
    function finishFlight(event: AnimationEvent) {
      if (event.animationName !== "ka-footer-icon-projectile" || !element.hasAttribute("data-footer-launched")) return;
      flightsRemaining = Math.max(0, flightsRemaining - 1);
      if (flightsRemaining > 0) return;
      element.removeAttribute("data-footer-launched");
      if (targetPull === 0 && !returning) element.removeAttribute("data-footer-revealed");
    }
    function cancel() {
      release(false);
      flightsRemaining = 0;
      element.removeAttribute("data-footer-launched");
      element.removeAttribute("data-footer-revealed");
    }
    function resetMotion() {
      if (!motionPreference.matches) return;
      cancel();
      touchY = undefined;
      returning = false;
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", cancel);
    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    element.addEventListener("touchend", onTouchEnd);
    element.addEventListener("touchcancel", cancel);
    element.addEventListener("animationend", finishFlight);
    content.addEventListener("transitionend", finishReturn);
    if (motionPreference.addEventListener) motionPreference.addEventListener("change", resetMotion);
    else motionPreference.addListener(resetMotion);
    return () => {
      clearTimeout(releaseTimer);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", cancel);
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
      element.removeEventListener("touchcancel", cancel);
      element.removeEventListener("animationend", finishFlight);
      content.removeEventListener("transitionend", finishReturn);
      if (motionPreference.removeEventListener) motionPreference.removeEventListener("change", resetMotion);
      else motionPreference.removeListener(resetMotion);
      element.style.removeProperty("--footer-pull");
      element.removeAttribute("data-footer-pulled");
      element.removeAttribute("data-footer-revealed");
      element.removeAttribute("data-footer-launched");
    };
  }, []);

  return <div ref={frame} className="ka-footer-elastic">
    <div ref={stage} className="ka-footer-wordmark-clip" aria-hidden="true">
      <p className="ka-footer-wordmark">keepall</p>
    </div>
    <div ref={cover} className="ka-footer-wordmark-cover">{children}</div>
    <div className="ka-footer-icon-layer" aria-hidden="true">
      {FOOTER_ICONS.map((kind, index) => <span key={kind} className={`ka-footer-icon ka-footer-icon-${kind}`} style={{ "--footer-icon-index": index } as CSSProperties}>
        <Image src={`/marketing/hero-${kind}.svg`} width={112} height={112} alt="" draggable={false} />
      </span>)}
    </div>
  </div>;
}
