"use client";

import Image from "next/image";
import { useEffect, type RefObject } from "react";
import { animate, motion, useMotionValue, useTransform, type MotionValue } from "motion/react";

export const HERO_ICON_ANGLES = { links: -9, notes: 8, images: -7, videos: 9 };
export type HeroKind = keyof typeof HERO_ICON_ANGLES;
export type HeroFlightMode = "timed" | "scroll";
export const SCROLL_RELEASE_FRACTION = .78;
const KINDS = Object.keys(HERO_ICON_ANGLES) as HeroKind[];
const STAGGER = 12;
const TARGETS = [.12, .37, .63, .87];
const BOWS = [-90, 62, -58, 86];
const TURNS = [-24, 22, -18, 28];

type Point = { x: number; y: number; size: number };
type FlightLayout = { start: number; travel: number; pinDistance: number; width: number; viewportHeight: number; previewCenter: { x: number; y: number }; sources: Point[]; targets: Point[] };
const clamp = (value: number) => value >= 1 - 1e-9 ? 1 : Math.max(0, value);

function scaledTarget(scene: FlightLayout, index: number, scale: number) {
  const target = scene.targets[index];
  return {
    x: scene.previewCenter.x + (target.x - scene.previewCenter.x) * scale,
    y: scene.previewCenter.y + (target.y - scene.previewCenter.y) * scale,
  };
}

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

export function useHeroFlight(ref: RefObject<HTMLElement | null>, scrollY: MotionValue<number>, reducedMotion: boolean | null, mode: HeroFlightMode) {
  const layout = useMotionValue<FlightLayout | null>(null);
  const elapsed = useMotionValue(0);
  const distance = useTransform(() => {
    const scroll = scrollY.get();
    const scene = layout.get();
    const timed = elapsed.get();
    if (!scene) return 0;
    return mode === "timed" ? timed * (scene.travel + (KINDS.length - 1) * STAGGER) : Math.max(0, scroll - scene.start);
  });
  const headerFadeOpacity = useTransform(() => {
    const scroll = scrollY.get();
    const scene = layout.get();
    const start = mode === "scroll" && !reducedMotion ? scene?.pinDistance ?? 0 : 0;
    return clamp((scroll - start) / 120);
  });
  const previewScale = useTransform(() => {
    const scroll = scrollY.get();
    const scene = layout.get();
    if (mode !== "scroll" || reducedMotion) return 1;
    if (!scene) return .88;
    const center = scene.previewCenter.y - Math.max(0, scroll - scene.pinDistance);
    const progress = clamp((scene.viewportHeight - center) / (scene.viewportHeight * .5));
    return .88 + .12 * progress * progress * (3 - 2 * progress);
  });

  useEffect(() => {
    const root = ref.current;
    elapsed.set(0);
    if (mode !== "timed" || reducedMotion) return;
    let destination = 0;
    let turningPoint = scrollY.get();
    let playback: ReturnType<typeof animate> | undefined;
    function update() {
      const scene = layout.get();
      if (!scene) return;
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
    update();
    const stopScroll = scrollY.on("change", update);
    const stopLayout = layout.on("change", update);
    return () => {
      playback?.stop();
      stopScroll();
      stopLayout();
      root?.removeAttribute("data-hero-compact");
    };
  }, [elapsed, layout, mode, reducedMotion, ref, scrollY]);

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
      if (root && mode === "scroll") root.dataset.heroCompact = String(!reducedMotion && distance.get() > STAGGER * (KINDS.length - 1));
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
      heading.style.minHeight = "";
      heading.style.minHeight = `${heading.offsetHeight}px`;
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
      const pinDistance = mode === "scroll" && root.parentElement
        ? Number.parseFloat(getComputedStyle(root.parentElement, "::after").height) || 0 : 0;
      layout.set({
        start: mode === "scroll" ? 24 : Math.max(0, documentTop + Math.min(...origins.map(origin => origin.y - origin.size / 2)) - navBottom - 72),
        travel: mode === "scroll" ? Math.max(840, pinDistance / SCROLL_RELEASE_FRACTION - 120) : Math.max(340, Math.min(520, window.innerHeight * .48)),
        pinDistance,
        width: root.clientWidth,
        viewportHeight: window.innerHeight,
        previewCenter: { x: root.clientWidth / 2, y: libraryTop + library.offsetHeight / 2 },
        sources: origins,
        targets: TARGETS.map((fraction, index) => ({ x: left + (right - left) * fraction, y: libraryTop + library.offsetHeight * (.25 + index % 2 * .05), size: 0 })),
      });
      if (compact !== undefined) root.dataset.heroCompact = compact;
      root.removeAttribute("data-hero-measuring");
      updateSources();
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(library);
    window.addEventListener("resize", measure);
    const unsubscribe = distance.on("change", updateSources);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      unsubscribe();
      sources.forEach(source => { source.style.visibility = ""; });
      heading.style.minHeight = "";
      root.removeAttribute("data-hero-compact");
    };
  }, [ref, layout, distance, reducedMotion, mode]);

  return { layout, distance, headerFadeOpacity, previewScale };
}

type FlightProps = { layout: MotionValue<FlightLayout | null>; distance: MotionValue<number>; previewScale: MotionValue<number>; mode: HeroFlightMode };

function FlyingIcon({ kind, index, layout, distance, previewScale, mode }: FlightProps & { kind: HeroKind; index: number }) {
  const progress = useTransform(() => {
    const traveled = distance.get();
    const scene = layout.get();
    return scene ? clamp((traveled - index * STAGGER) / scene.travel) : 0;
  });
  const transform = useTransform(() => {
    const t = progress.get();
    const scene = layout.get();
    const libraryScale = previewScale.get();
    if (!scene) return "none";
    const from = scene.sources[index];
    const to = scaledTarget(scene, index, libraryScale);
    const remaining = 1 - t;
    const bow = BOWS[index] * Math.min(1, from.size / 65);
    const keepInViewport = (x: number) => Math.max(from.size * .8, Math.min(scene.width - from.size * .8, x));
    const x = remaining ** 3 * from.x + 3 * remaining ** 2 * t * keepInViewport(from.x + bow) + 3 * remaining * t ** 2 * keepInViewport(to.x + bow * .35) + t ** 3 * to.x;
    const y = from.y + (to.y - from.y) * t ** 2 - (mode === "timed" ? 70 : 72) * Math.sin(Math.PI * t);
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
    const libraryScale = previewScale.get();
    const target = scene ? scaledTarget(scene, index, libraryScale) : null;
    const scale = (.5 + clamp((progress.get() - .93) / .07)) * libraryScale;
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
