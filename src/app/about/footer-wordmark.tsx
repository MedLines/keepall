"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";

export function FooterWordmark({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pull = useMotionValue(0);
  const transform = useTransform(pull, value => `translateY(${-value}px)`);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      pull.jump(0);
      return;
    }
    let spring: ReturnType<typeof animate> | undefined;
    let releaseTimer: ReturnType<typeof setTimeout> | undefined;
    let touchY: number | undefined;
    const atBottom = () => {
      const page = document.scrollingElement;
      return page !== null && page.scrollHeight - page.scrollTop - window.innerHeight <= 2;
    };
    function release() {
      clearTimeout(releaseTimer);
      spring?.stop();
      spring = animate(pull, 0, { type: "spring", stiffness: 230, damping: 22, mass: .9 });
    }
    function stretch(delta: number) {
      const limit = stage.current?.clientHeight ?? 0;
      if (!limit) return;
      spring?.stop();
      clearTimeout(releaseTimer);
      // Recover the live pull before applying resistance, including mid-return.
      const current = Math.max(0, Math.min(pull.get(), limit * .999));
      const distance = -limit * 1.2 * Math.log(1 - current / limit);
      pull.set(limit * (1 - Math.exp(-(distance + delta) / (limit * 1.2))));
    }
    function onWheel(event: WheelEvent) {
      if (event.defaultPrevented || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (event.deltaY <= 0 || !atBottom()) {
        if (pull.get() > 0) release();
        return;
      }
      if (event.target instanceof Element && event.target.closest('textarea, input, [contenteditable="true"], [role="dialog"]')) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      event.preventDefault();
      stretch(Math.min(event.deltaY * unit, 240));
      // Wheel gestures have no release event; settle after their last impulse.
      releaseTimer = setTimeout(release, 120);
    }
    function onTouchStart(event: TouchEvent) {
      touchY = event.touches.length === 1 ? event.touches[0].clientY : undefined;
    }
    function onTouchMove(event: TouchEvent) {
      if (event.touches.length !== 1 || touchY === undefined) return;
      const nextY = event.touches[0].clientY;
      const delta = touchY - nextY;
      touchY = nextY;
      if (event.defaultPrevented || !atBottom() || delta <= 0) {
        if (pull.get() > 0) release();
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
      if (!atBottom() && pull.get() > 0) release();
    }
    const element = frame.current;
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    element?.addEventListener("touchstart", onTouchStart, { passive: true });
    element?.addEventListener("touchmove", onTouchMove, { passive: false });
    element?.addEventListener("touchend", onTouchEnd);
    element?.addEventListener("touchcancel", onTouchEnd);
    return () => {
      clearTimeout(releaseTimer);
      spring?.stop();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      element?.removeEventListener("touchstart", onTouchStart);
      element?.removeEventListener("touchmove", onTouchMove);
      element?.removeEventListener("touchend", onTouchEnd);
      element?.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [pull, reduceMotion]);

  return <div ref={frame} className="ka-footer-elastic">
    <div ref={stage} className="ka-footer-wordmark-clip" aria-hidden="true">
      <p className="ka-footer-wordmark">keepall</p>
    </div>
    <motion.div className="ka-footer-wordmark-cover" style={{ transform }}>{children}</motion.div>
  </div>;
}
