import { useEffect, useState } from "react";

/** Fullscreen kinetic intro: letters slam in, get scratched, then split open to reveal the store. */
export function Intro() {
  const [phase, setPhase] = useState<"in" | "cut" | "open" | "done">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("cut"), 1300);
    const t2 = setTimeout(() => setPhase("open"), 2300);
    const t3 = setTimeout(() => setPhase("done"), 3300);
    document.body.style.overflow = "hidden";
    return () => { [t1, t2, t3].forEach(clearTimeout); document.body.style.overflow = ""; };
  }, []);

  useEffect(() => { if (phase === "done") document.body.style.overflow = ""; }, [phase]);
  if (phase === "done") return null;

  const letters = "5ADSH".split("");
  const open = phase === "open";
  const cut = phase !== "in";

  const word = (
    <div className="flex font-display text-[30vw] uppercase leading-[0.8] md:text-[26vw]">
      {letters.map((l, i) => (
        <span key={i} className="intro-letter inline-block" style={{ animationDelay: `${i * 90}ms` }}>{l}</span>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] cursor-pointer" onClick={() => setPhase("done")} aria-hidden>
      {/* top half */}
      <div
        className="absolute inset-0 grid place-items-center overflow-hidden bg-primary text-primary-foreground transition-transform duration-[900ms] ease-[cubic-bezier(.8,0,.2,1)]"
        style={{ clipPath: "polygon(0 0,100% 0,100% 44%,0 56%)", transform: open ? "translate(-4%,-100%) rotate(-4deg)" : "none" }}
      >
        <div className={cut ? "intro-glitch" : ""}>{word}</div>
      </div>
      {/* bottom half */}
      <div
        className="absolute inset-0 grid place-items-center overflow-hidden bg-primary text-primary-foreground transition-transform duration-[900ms] ease-[cubic-bezier(.8,0,.2,1)]"
        style={{ clipPath: "polygon(0 56%,100% 44%,100% 100%,0 100%)", transform: open ? "translate(4%,100%) rotate(-4deg)" : "none" }}
      >
        <div className={cut ? "intro-glitch-alt" : ""}>{word}</div>
      </div>

      {/* scratch slash */}
      <div
        className="pointer-events-none absolute left-0 top-1/2 h-[3px] w-full origin-left -translate-y-1/2 -rotate-[6deg] bg-primary-foreground transition-all duration-300"
        style={{ transform: `translateY(-50%) rotate(-6deg) scaleX(${cut && !open ? 1 : 0})`, opacity: open ? 0 : 1 }}
      />

      {!open && (
        <>
          <span className="font-arabic intro-ar absolute bottom-[12%] right-[8%] text-6xl text-primary-foreground md:text-9xl">خدش</span>
          <div className="absolute left-6 top-6 font-mono text-[10px] tracking-[0.3em] text-primary-foreground/60">DROP 07 / CAIRO / FW26</div>
          <div className="absolute bottom-6 left-6 font-mono text-[10px] tracking-[0.3em] text-primary-foreground/60">LEAVE A MARK ///</div>
          <div className="absolute right-6 top-6 font-mono text-[10px] tracking-[0.3em] text-primary-foreground/60">SKIP →</div>
        </>
      )}
    </div>
  );
}
