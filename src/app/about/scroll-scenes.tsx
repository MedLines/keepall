"use client";

import { useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { ArrowLeftIcon, ArrowRightIcon, PlayIcon } from "../shell-icons";
import { RecordedDemo } from "./recorded-demo";
import { HeroFlightLayer, useHeroFlight } from "./hero-flight";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";

const SCENE = { landscapeTravel: 220, stackTop: 108, stackStep: 24, cardBottom: 786 };

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (query.addEventListener) {
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }
  query.addListener(onChange);
  return () => query.removeListener(onChange);
}

function reducedMotionPreference() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function HeroScene({ children, preview }: { children: ReactNode; preview: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionPreference, () => false);
  const { scrollY, scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const landscapeY = useTransform(scrollYProgress, [0, 1], [0, SCENE.landscapeTravel]);
  const { layout, distance, headerFadeOpacity } = useHeroFlight(ref, scrollY, reduceMotion);
  return (
    <>
    <motion.div className="ka-header-scroll-fade" aria-hidden="true" style={{ opacity: headerFadeOpacity }} />
    <section ref={ref} className="ka-hero" aria-labelledby="ka-title">
      <motion.div className="ka-landscape" aria-hidden="true" style={{ y: reduceMotion ? 0 : landscapeY }} />
      <div className="ka-hero-intro">
      <div className="ka-hero-copy" onFocusCapture={(event) => {
        // Finish once so changing focus cannot restart a phrase's entrance.
        for (const animation of event.currentTarget.getAnimations({ subtree: true })) {
          if (["ka-hero-phrase-arrive", "ka-hero-block-arrive"].includes((animation as CSSAnimation).animationName)) animation.finish();
        }
      }}>{children}</div>
      </div>
      <div className="ka-hero-preview-scroll"><div className="ka-hero-library">{preview}</div></div>
      {!reduceMotion && <HeroFlightLayer layout={layout} distance={distance} />}
      <div className="ka-hero-fade" aria-hidden="true" />
    </section>
    </>
  );
}

const views = [
  { name: "Your library", recording: "library-demo", caption: "Browse saves in grid or list view, then open Preview." },
  { name: "Collections", recording: "collections-demo", caption: "Browse your folders, peek inside, then open a collection." },
  { name: "Tags", recording: "tags-demo", caption: "Filter the library by a tag." },
  { name: "Search", recording: "search-demo", caption: "Search file contents and recognized screenshot text." },
];

export function FeatureGallery({ panels }: { panels: ReactNode[] }) {
  const [selected, selectView] = useState(0);

  // Keep recordings mounted so a slide can reverse without remounting media.
  return <div className="ka-gallery">
    <p className="ka-gallery-hint">Choose a walkthrough</p>
    <div className="ka-gallery-tabs" role="group" aria-label="Explore Keepall features">{views.map((view, index) => <button key={view.name} type="button" aria-pressed={selected === index} aria-controls="ka-gallery-panel" onClick={() => selectView(index)}><PlayIcon /><span>{view.name}</span></button>)}</div>
    <div className="ka-gallery-window" id="ka-gallery-panel" role="region" aria-label={views[selected].name}>
      {panels.map((panel, index) => <div key={views[index].name} className="ka-gallery-content" aria-hidden={selected !== index} inert={selected !== index} style={{ "--demo-offset": `${index < selected ? -105 : 105}%` } as CSSProperties}><RecordedDemo active={selected === index} name={views[index].name} src={`/marketing/${views[index].recording}`} onComplete={() => selectView(current => current === index ? (index + 1) % views.length : current)} poster={panel} /></div>)}
    </div>
    <div className="ka-gallery-foot"><span>0{selected + 1} / 0{views.length}</span><p role="status">{views[selected].caption}</p><div><button type="button" aria-label="Previous feature" onClick={() => selectView((selected + views.length - 1) % views.length)}><ArrowLeftIcon className="size-5" /></button><button type="button" aria-label="Next feature" onClick={() => selectView((selected + 1) % views.length)}><ArrowRightIcon className="size-5" /></button></div></div>
  </div>;
}

function StackCard({ children, index, progress }: { children: ReactNode; index: number; progress: MotionValue<number> }) {
  const reduceMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionPreference, () => false);
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
