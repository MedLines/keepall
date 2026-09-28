"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "../shell-icons";
import { RecordedDemo } from "./recorded-demo";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";

// Scroll storyboard (native scrolling, reversible at every point):
// Hero leaves the viewport → copy lifts; library recedes; landscape travels 220px.
// Statement crosses the viewport → each phrase brightens in reading order.
// Feature cards reach 108px → pin; earlier cards recede as the next arrives.
const SCENE = { landscapeTravel: 220, libraryTravel: 120, stackTop: 108, stackStep: 24, cardBottom: 786 };

export function HeroScene({ children, preview }: { children: ReactNode; preview: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const landscapeY = useTransform(scrollYProgress, [0, 1], [0, SCENE.landscapeTravel]);
  const copyTransform = useTransform(scrollYProgress, [0, .5], ["translateY(0px)", "translateY(-64px)"]);
  const copyOpacity = useTransform(scrollYProgress, [0, .2, .5], [1, 1, 0]);
  const previewTransform = useTransform(scrollYProgress, [0, 1], ["translateY(0px) scale(1)", `translateY(${SCENE.libraryTravel}px) scale(.96)`]);
  const previewOpacity = useTransform(scrollYProgress, [0, .35, .85], [1, 1, 0]);
  return (
    <section ref={ref} className="ka-hero" aria-labelledby="ka-title">
      <motion.div className="ka-landscape" aria-hidden="true" style={{ y: reduceMotion ? 0 : landscapeY }} />
      <motion.div className="ka-hero-copy" style={{ transform: reduceMotion ? "none" : copyTransform, opacity: reduceMotion ? 1 : copyOpacity }}>{children}</motion.div>
      <motion.div className="ka-hero-preview-scroll" style={{ transform: reduceMotion ? "none" : previewTransform, opacity: reduceMotion ? 1 : previewOpacity }}><div className="ka-hero-library">{preview}</div></motion.div>
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
  { name: "Your library", recording: "library-demo", caption: "Browse the same library in grid or list view." },
  { name: "Collections", recording: "collections-demo", caption: "Bring related finds together. Leave the rest in Unsorted." },
  { name: "Tags", recording: "tags-demo", caption: "Add a tag to a save. Choose that tag to find it again." },
  { name: "Search", recording: "search-demo", caption: "Start with a word you remember. Pick up where you left off." },
];

export function FeatureGallery({ panels }: { panels: ReactNode[] }) {
  const [selected, selectView] = useState(0);
  const reduceMotion = useReducedMotion();

  // Keep recordings mounted so a slide can reverse without remounting media.
  return <div className="ka-gallery">
    <div className="ka-gallery-tabs" role="group" aria-label="Explore Keepall features">{views.map((view, index) => <button key={view.name} type="button" aria-pressed={selected === index} aria-controls="ka-gallery-panel" onClick={() => selectView(index)}>{selected === index && <motion.span className="ka-gallery-tab-marker" layoutId="gallery-tab-marker" transition={{ type: "spring", duration: reduceMotion ? 0 : .3, bounce: 0 }} />}<span>{view.name}</span></button>)}</div>
    <div className="ka-gallery-window" id="ka-gallery-panel" role="region" aria-label={views[selected].name}>
      {panels.map((panel, index) => <div key={views[index].name} className="ka-gallery-content" aria-hidden={selected !== index} inert={selected !== index} style={{ "--demo-offset": `${index < selected ? -105 : 105}%` } as CSSProperties}><RecordedDemo active={selected === index} name={views[index].name} src={`/marketing/${views[index].recording}`} poster={panel} /></div>)}
    </div>
    <div className="ka-gallery-foot"><span>0{selected + 1} / 0{views.length}</span><p role="status">{views[selected].caption}</p><div><button type="button" aria-label="Previous feature" onClick={() => selectView((selected + views.length - 1) % views.length)}><ArrowLeftIcon className="size-5" /></button><button type="button" aria-label="Next feature" onClick={() => selectView((selected + 1) % views.length)}><ArrowRightIcon className="size-5" /></button></div></div>
  </div>;
}

function StackCard({ children, index, progress }: { children: ReactNode; index: number; progress: MotionValue<number> }) {
  const reduceMotion = useReducedMotion();
  const scale = useTransform(progress, [index / 3, 1], [1, 1 - (2 - index) * .05]);
  // Match each sticky offset with its remaining stack depth so all three edges
  // stay separated when the cards reach their container's bottom boundary.
  const position = { "--stack-top": `${SCENE.stackTop + index * SCENE.stackStep}px`, "--stack-gap": `${(2 - index) * SCENE.stackStep}px` } as CSSProperties;
  return <div className="ka-stack-card" style={position}><motion.div className="ka-stack-surface" style={{ scale: reduceMotion ? 1 : scale }}>{children}</motion.div></div>;
}

export function FeatureStack({ children }: { children: ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: [`start ${SCENE.stackTop}px`, `end ${SCENE.cardBottom}px`] });
  return <div ref={ref} className="ka-stack">{children.map((child, index) => <StackCard key={index} index={index} progress={scrollYProgress}>{child}</StackCard>)}</div>;
}
