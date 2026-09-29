"use client";

import Image from "next/image";
import { useEffect, type RefObject } from "react";
import { animate, motion, useMotionValue, useTransform, type MotionValue } from "motion/react";

export const HERO_ICON_ANGLES = { links: -9, notes: 8, images: -7, videos: 9 };
export type HeroKind = keyof typeof HERO_ICON_ANGLES;
const KINDS = Object.keys(HERO_ICON_ANGLES) as HeroKind[];
const STAGGER = 12;
const TARGETS = [.12, .37, .63, .87];
const TARGET_DEPTHS = [.48, .58, .86, .72];
const BOWS = [-90, 62, -58, 86];
const TURNS = [-24, 22, -18, 28];

type Point = { x: number; y: number; size: number };
type FlightLayout = { start: number; travel: number; width: number; sources: Point[]; targets: Point[] };
const clamp = (value: number) => value >= 1 - 1e-9 ? 1 : Math.max(0, value);

// Layout coordinates deliberately exclude entrance, hover, and scroll transforms.
function positionIn(element: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  for (let current: HTMLElement | null = element; current && current !== root; current = current.offsetParent as HTMLElement | null) {
    x += current.offsetLeft;
    y += current.offsetTop;
  }
  return { x, y };
}

export function useHeroFlight(ref: RefObject<HTMLElement | null>, scrollY: MotionValue<number>, reducedMotion: boolean) {
  const layout = useMotionValue<FlightLayout | null>(null);
  const elapsed = useMotionValue(0);
  const distance = useTransform(() => {
    const scene = layout.get();
    const timed = elapsed.get();
    return scene ? timed * (scene.travel + (KINDS.length - 1) * STAGGER) : 0;
  });
  const headerFadeOpacity = useTransform(scrollY, [0, 120], [0, 1]);

  useEffect(() => {
    const root = ref.current;
    elapsed.set(0);
    if (reducedMotion) return;
    let destination = 0;
    let turningPoint = 0;
    let playback: ReturnType<typeof animate> | undefined;
    const library = root?.querySelector<HTMLElement>(".ka-hero-library");
    let entering = library?.getAnimations().some(animation =>
      (animation as CSSAnimation).animationName === "ka-hero-preview-arrive",
    ) ?? false;
    function update() {
      const scene = layout.get();
      if (!scene || entering) return;
      const scroll = scrollY.get();
      const trigger = Math.min(scene.start, 48);
      turningPoint = destination === 1 ? Math.max(turningPoint, scroll) : Math.min(turningPoint, scroll);
      const returning = scroll < trigger - 24 || (scroll < turningPoint - 8 && scroll < scene.start + scene.travel);
      const departing = scroll > trigger && scroll > turningPoint + 8;
      const next = destination === 1 && returning ? 0 : destination === 0 && departing ? 1 : destination;
      if (next === destination) return;
      destination = next;
      turningPoint = scroll;
      if (root) root.dataset.heroCompact = String(next === 1);
      const velocity = elapsed.getVelocity();
      playback?.stop();
      playback = animate(elapsed, next, {
        type: "spring", stiffness: 100, damping: 20, mass: .7,
        velocity, restDelta: .001, restSpeed: .01,
      });
    }
    function finishEntrance(event: AnimationEvent) {
      if (event.target !== library || event.animationName !== "ka-hero-preview-arrive") return;
      entering = false;
      update();
    }
    library?.addEventListener("animationend", finishEntrance);
    library?.addEventListener("animationcancel", finishEntrance);
    update();
    const stopScroll = scrollY.on("change", update);
    const stopLayout = layout.on("change", update);
    return () => {
      playback?.stop();
      library?.removeEventListener("animationend", finishEntrance);
      library?.removeEventListener("animationcancel", finishEntrance);
      stopScroll();
      stopLayout();
      root?.removeAttribute("data-hero-compact");
    };
  }, [elapsed, layout, reducedMotion, ref, scrollY]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const anchors = KINDS.map(kind => root.querySelector<HTMLElement>(`[data-hero-icon="${kind}"]`));
    const library = root.querySelector<HTMLElement>(".ka-hero-library");
    const heading = root.querySelector<HTMLElement>(".ka-hero-heading");
    if (!library || !heading || anchors.some(anchor => !anchor)) return;
    const sources = anchors as HTMLElement[];

    function updateSources() {
      const scene = layout.get();
      sources.forEach((source, index) => {
        const flying = scene && !reducedMotion && distance.get() > index * STAGGER;
        const visibility = flying ? "hidden" : "";
        if (source.style.visibility !== visibility) source.style.visibility = visibility;
      });
    }

    function measure() {
      if (!root || !library || !heading) return;
      // Measure the expanded sentence only on resize, never along the flight.
      const compact = root.dataset.heroCompact;
      root.setAttribute("data-hero-measuring", "");
      root.removeAttribute("data-hero-compact");
      heading.style.height = "";
      const expandedHeadingHeight = heading.offsetHeight;
      root.dataset.heroCompact = "true";
      root.style.setProperty("--ka-hero-compact-heading-height", `${heading.offsetHeight}px`);
      root.removeAttribute("data-hero-compact");
      heading.style.height = `${expandedHeadingHeight}px`;
      const copy = root.querySelector<HTMLElement>(".ka-hero-copy");
      if (copy) root.style.setProperty("--ka-hero-copy-height", `${copy.offsetHeight}px`);
      const origins = sources.map(source => {
        const point = positionIn(source, root);
        return { x: point.x + source.offsetWidth / 2, y: point.y + source.offsetHeight / 2, size: source.offsetWidth };
      });
      const libraryTop = positionIn(library, root).y;
      const libraryLeft = (root.clientWidth - library.offsetWidth) / 2;
      const left = Math.max(24, libraryLeft + library.offsetWidth * .22);
      const right = Math.min(root.clientWidth - 24, libraryLeft + library.offsetWidth - 32);
      const navBottom = document.querySelector(".ka-header")?.getBoundingClientRect().bottom ?? 92;
      const documentTop = root.getBoundingClientRect().top + window.scrollY;
      layout.set({
        start: Math.max(0, documentTop + Math.min(...origins.map(origin => origin.y - origin.size / 2)) - navBottom - 72),
        travel: Math.max(340, Math.min(520, window.innerHeight * .48)),
        width: root.clientWidth,
        sources: origins,
        targets: TARGETS.map((fraction, index) => ({ x: left + (right - left) * fraction, y: libraryTop + library.offsetHeight * TARGET_DEPTHS[index], size: 0 })),
      });
      if (compact !== undefined) root.dataset.heroCompact = compact;
      root.removeAttribute("data-hero-measuring");
      updateSources();
    }

    let active = true;
    measure();
    void document.fonts.ready.then(() => { if (active) measure(); });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(root);
    observer?.observe(library);
    window.addEventListener("resize", measure);
    const unsubscribe = distance.on("change", updateSources);
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      unsubscribe();
      sources.forEach(source => { source.style.visibility = ""; });
      heading.style.height = "";
      root.removeAttribute("data-hero-compact");
    };
  }, [ref, layout, distance, reducedMotion]);

  return { layout, distance, headerFadeOpacity };
}

type FlightProps = { layout: MotionValue<FlightLayout | null>; distance: MotionValue<number> };

function FlyingIcon({ kind, index, layout, distance }: FlightProps & { kind: HeroKind; index: number }) {
  const progress = useTransform(() => {
    const traveled = distance.get();
    const scene = layout.get();
    return scene ? clamp((traveled - index * STAGGER) / scene.travel) : 0;
  });
  const transform = useTransform(() => {
    const t = progress.get();
    const scene = layout.get();
    if (!scene) return "none";
    const from = scene.sources[index];
    const to = scene.targets[index];
    const remaining = 1 - t;
    const bow = BOWS[index] * Math.min(1, from.size / 65);
    const keepInViewport = (x: number) => Math.max(from.size * .8, Math.min(scene.width - from.size * .8, x));
    const x = remaining ** 3 * from.x + 3 * remaining ** 2 * t * keepInViewport(from.x + bow) + 3 * remaining * t ** 2 * keepInViewport(to.x + bow * .35) + t ** 3 * to.x;
    const y = from.y + (to.y - from.y) * t ** 2 - 70 * Math.sin(Math.PI * t);
    const scale = 1 + .22 * Math.sin(Math.PI * t) - .78 * t ** 3;
    const angle = HERO_ICON_ANGLES[kind] * remaining + TURNS[index] * Math.sin(Math.PI * t);
    return `translate3d(${x - from.size / 2}px, ${y - from.size / 2}px, 0) rotate(${angle}deg) scale(${scale})`;
  });
  const size = useTransform(() => layout.get()?.sources[index].size ?? 0);
  const opacity = useTransform(() => {
    const t = progress.get();
    return t === 0 || t === 1 ? 0 : 1 - clamp((t - .93) / .07);
  });
  const landingOpacity = useTransform(progress, [0, .93, .97, 1], [0, 0, .35, 0]);
  const landingTransform = useTransform(() => {
    const scene = layout.get();
    const target = scene?.targets[index];
    const scale = .5 + clamp((progress.get() - .93) / .07);
    return target ? `translate3d(${target.x - 24}px, ${target.y - 24}px, 0) scale(${scale})` : "none";
  });

  return <>
    <motion.span className="ka-hero-flight-icon" data-flight-icon={kind} style={{ width: size, height: size, transform, opacity }}>
      <Image src={`/marketing/hero-${kind}.svg`} width={112} height={112} alt="" draggable={false} />
    </motion.span>
    <motion.span className="ka-hero-flight-landing" style={{ transform: landingTransform, opacity: landingOpacity }} />
  </>;
}

export function HeroFlightLayer(props: FlightProps) {
  return <div className="ka-hero-flight-layer" aria-hidden="true">
    {KINDS.map((kind, index) => <FlyingIcon key={kind} kind={kind} index={index} {...props} />)}
  </div>;
}
