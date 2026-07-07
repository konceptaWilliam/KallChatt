// Subtle UI sounds (message send / receive). Synthesised with the Web Audio
// API — no asset files, zero bundle cost. On by default; the toggle in settings
// lets a user turn them off. Device-local (localStorage), like the theme
// preference — only an explicit "off" is stored, so a fresh device defaults on.

const KEY = "coldsoup:sound";

export function isSoundEnabled(): boolean {
  try {
    // Default on: enabled unless the user explicitly turned it off.
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, "0");
  } catch {
    /* localStorage unavailable — ignore */
  }
}

// One shared AudioContext for the tab (creating one per sound leaks). Lazily
// created on first play so we never touch AudioContext during SSR.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  // Autoplay policy may leave it suspended until a user gesture — resume best-
  // effort so send (gesture-driven) plays immediately and receive starts
  // working after the first interaction.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

// A short sine blip with a soft attack/decay envelope so it doesn't click.
function tone(freq: number, ms: number, gain = 0.04): void {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const now = c.currentTime;
  const end = now + ms / 1000;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(now);
  osc.stop(end + 0.02);
}

// Sent: a short, bright upward blip. Received: a softer, lower note.
export function playSend(): void {
  if (!isSoundEnabled()) return;
  tone(660, 90);
}

export function playReceive(): void {
  if (!isSoundEnabled()) return;
  tone(440, 120);
}
