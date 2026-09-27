"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";

// Scroll storyboard (native scrolling, reversible at every point):
// Hero leaves the viewport → landscape travels 220px; library travels 120px.
// Statement crosses the viewport → each phrase brightens in reading order.
// Feature cards reach 108px → pin; earlier cards recede as the next arrives.
const SCENE = { landscapeTravel: 220, libraryTravel: 120, stackTop: 108, cardBottom: 736 };

export function HeroScene({ children, preview }: { children: ReactNode; preview: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const landscapeY = useTransform(scrollYProgress, [0, 1], [0, SCENE.landscapeTravel]);
  const previewY = useTransform(scrollYProgress, [0, 1], [0, SCENE.libraryTravel]);
  return (
    <section ref={ref} className="ka-hero" aria-labelledby="ka-title">
      <motion.div className="ka-landscape" aria-hidden="true" style={{ y: reduceMotion ? 0 : landscapeY }} />
      <div className="ka-hero-copy">{children}</div>
      <motion.div className="ka-hero-library" style={{ y: reduceMotion ? 0 : previewY }}>{preview}</motion.div>
      <div className="ka-hero-fade" aria-hidden="true" />
    </section>
  );
}

const phrases = ["A link that sends you somewhere.", "An image that stays with you.", "A thought you don’t want to lose.", "Keep them close.", "See where they take you."];

function RevealedPhrase({ text, index, progress }: { text: string; index: number; progress: MotionValue<number> }) {
  const reduceMotion = useReducedMotion();
  const color = useTransform(progress, [index / phrases.length, (index + 1) / phrases.length], ["#777477", "#f3eeea"]);
  return <motion.span style={{ color: reduceMotion ? "#f3eeea" : color }}>{text}{" "}</motion.span>;
}

export function ScrollStatement() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  return <div ref={ref} className="ka-statement ka-wrap"><p className="ka-eyebrow">A place for what stays with you</p><p className="ka-statement-text">{phrases.map((text, index) => <RevealedPhrase key={text} text={text} index={index} progress={scrollYProgress} />)}</p><p className="ka-statement-note">Links, notes, images, and videos.<br />A personal library, made for coming back.</p></div>;
}

const views = [
  { name: "Your library", caption: "Everything you save, in a space of your own." },
  { name: "Collections", caption: "Bring related finds together. Leave the rest in Unsorted." },
  { name: "Search", caption: "Start with a word you remember. Pick up where you left off." },
];

export function FeatureGallery({ panels }: { panels: ReactNode[] }) {
  const [selected, setSelected] = useState(0);
  const reduceMotion = useReducedMotion();
  return <div className="ka-gallery">
    <div className="ka-gallery-tabs" role="group" aria-label="Explore Keepall features">{views.map((view, index) => <button key={view.name} type="button" aria-pressed={selected === index} aria-controls="ka-gallery-panel" onClick={() => setSelected(index)}>{view.name}</button>)}</div>
    <div className="ka-gallery-window" id="ka-gallery-panel" role="region" aria-label={views[selected].name}>
      <motion.div className="ka-gallery-content" key={selected} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25, ease: [.22, 1, .36, 1] }}>{panels[selected]}</motion.div>
    </div>
    <div className="ka-gallery-foot"><span>0{selected + 1} / 03</span><p role="status">{views[selected].caption}</p><div><button type="button" aria-label="Previous feature" onClick={() => setSelected((selected + views.length - 1) % views.length)}>←</button><button type="button" aria-label="Next feature" onClick={() => setSelected((selected + 1) % views.length)}>→</button></div></div>
  </div>;
}

function StackCard({ children, index, progress }: { children: ReactNode; index: number; progress: MotionValue<number> }) {
  const reduceMotion = useReducedMotion();
  const scale = useTransform(progress, [index / 3, 1], [1, 1 - (2 - index) * .05]);
  const y = useTransform(progress, [index / 3, 1], [0, -(2 - index) * 12]);
  return <div className="ka-stack-card"><motion.div className="ka-stack-surface" style={{ scale: reduceMotion ? 1 : scale, y: reduceMotion ? 0 : y }}>{children}</motion.div></div>;
}

export function FeatureStack({ children }: { children: ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: [`start ${SCENE.stackTop}px`, `end ${SCENE.cardBottom}px`] });
  return <div ref={ref} className="ka-stack">{children.map((child, index) => <StackCard key={index} index={index} progress={scrollYProgress}>{child}</StackCard>)}</div>;
}
