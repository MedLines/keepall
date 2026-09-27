import { execFileSync } from "node:child_process";
import { join } from "node:path";

// Camera storyboard: approach → settle → hold on the action → follow feedback → pull back.
// A critically damped spring keeps screen text steady without overshooting the crop.
const CAMERA = { fps: 60, zoom: 1.45, stiffness: 324, mass: 1, enter: .6, focus: .55, exit: .45, loopHold: .18 };

export function encodeExtensionDemo(raw, kind, output, { focusAt, editorAt, saveClickedAt, confirmationAt, trimStart = 0 } = {}) {
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", raw]).toString()) - trimStart;
  const spring = (start, seconds) => {
    const omega = Math.sqrt(CAMERA.stiffness / CAMERA.mass);
    const t = `clip(on/${CAMERA.fps}-${start},0,${seconds})`;
    const end = 1 - (1 + omega * seconds) * Math.exp(-omega * seconds);
    return `((1-(1+${omega}*${t})*exp(-${omega}*${t}))/${end})`;
  };
  const enter = spring(kind === "notes" ? editorAt + .25 : .85, CAMERA.enter);
  const leave = spring(duration - CAMERA.exit - CAMERA.loopHold, CAMERA.exit);
  const saved = spring(focusAt ?? duration - 2.62, CAMERA.focus);
  const zoom = `1+${(kind === "notes" ? 1.35 : CAMERA.zoom) - 1}*${enter}*(1-${leave})`;
  const x = kind === "text" ? `(iw-iw/zoom)*(.1+.9*${saved})` : "iw-iw/zoom";
  const y = kind === "notes"
    ? `(ih-ih/zoom)*(.35+.65*${spring(saveClickedAt - .65, .5)}-.5*${spring(confirmationAt, .45)})`
    : ["page", "organize", "undo"].includes(kind) ? "0" : `(ih-ih/zoom)*.55*(1-${saved})`;
  // Duplicate source frames before moving the camera so zooms render at 60 fps.
  const filter = `fps=${CAMERA.fps},scale=2000:1600,zoompan=z='${zoom}':x='${x}':y='${y}':d=1:s=1000x800:fps=${CAMERA.fps}`;
  for (const format of ["mp4", "webm"]) {
    const codec = format === "mp4" ? ["-c:v", "libx264", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart"] : ["-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "-cpu-used", "4"];
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-ss", String(trimStart), "-i", raw, "-an", "-vf", filter, ...codec, "-threads", "2", join(output, `capture-${kind}-demo.${format}`)]);
  }
}
