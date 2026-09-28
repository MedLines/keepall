"use client";

import Image from "next/image";
import { Tooltip } from "@base-ui/react/tooltip";
import { useId, useRef, type PointerEvent } from "react";
import { motion, useAnimate, useReducedMotion, useSpring } from "motion/react";
import { HERO_ICON_ANGLES, type HeroKind } from "./hero-flight";

function HeroWord({ kind }: { kind: HeroKind }) {
  const tooltipId = useId();
  const reduceMotion = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const playing = useRef(false);
  const rotateX = useSpring(0, { stiffness: 260, damping: 22 });
  const rotateY = useSpring(0, { stiffness: 260, damping: 22 });

  function tilt(event: PointerEvent<HTMLButtonElement>) {
    if (reduceMotion || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    rotateX.set((.5 - (event.clientY - box.top) / box.height) * 24);
    rotateY.set(((event.clientX - box.left) / box.width - .5) * 24);
  }

  function settle() {
    rotateX.set(0);
    rotateY.set(0);
  }

  async function play() {
    if (reduceMotion || playing.current) return;
    playing.current = true;
    try {
      await animate(scope.current, kind === "links" || kind === "videos"
        ? { rotateY: [0, 360], y: [0, -12, 0] }
        : { rotateZ: [0, -18, 14, -6, 0], y: [0, -12, 0] },
      { duration: .65, ease: [.22, 1, .36, 1] });
    } finally {
      playing.current = false;
    }
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger className="ka-hero-word" type="button" aria-describedby={tooltipId} onPointerMove={tilt} onPointerLeave={settle} onPointerCancel={settle} onBlur={settle} onClick={play}>
        {kind}
        <span className="ka-hero-toy-anchor" data-hero-icon={kind}>
          <motion.span className="ka-hero-toy" style={{ rotateX: reduceMotion ? 0 : rotateX, rotateY: reduceMotion ? 0 : rotateY, rotateZ: HERO_ICON_ANGLES[kind] }}>
            <span ref={scope} className="ka-hero-toy-turn">
              <Image src={`/marketing/hero-${kind}.svg`} width={112} height={112} alt="" loading="eager" draggable={false} />
            </span>
          </motion.span>
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={12} className="ka-hero-tooltip-positioner">
          <Tooltip.Popup id={tooltipId} role="tooltip" className="ka-hero-tooltip">
            Give it a <span>{kind === "links" || kind === "videos" ? "spin" : "wiggle"}</span>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function HeroHeading() {
  return (
    <Tooltip.Provider delay={100}>
      <h1 id="ka-title" className="ka-hero-heading">
        <span className="ka-hero-term ka-hero-phrase">Save <HeroWord kind="links" />,</span>{" "}
        <span className="ka-hero-term ka-hero-phrase"><HeroWord kind="notes" />,</span>{" "}
        <span className="ka-hero-term ka-hero-phrase"><HeroWord kind="images" />,</span>
        <br className="ka-hero-heading-break" />{" "}
        <span className="ka-hero-term ka-hero-phrase">and <HeroWord kind="videos" /></span>{" "}
        <span className="ka-hero-term ka-hero-phrase">in <span className="ka-brand-highlight">one place.</span></span>
      </h1>
    </Tooltip.Provider>
  );
}
