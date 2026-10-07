import { cn } from "@/lib/utils";

/** 5ADSH wordmark: heavy condensed letters sliced by scratch cuts. */
export function Wordmark({
  className,
  arabic = true,
  animate = false,
}: {
  className?: string;
  arabic?: boolean;
  animate?: boolean;
}) {
  return (
    <span className={cn("relative inline-flex items-end leading-none select-none", className)}>
      <span className={cn("relative font-display uppercase", animate && "animate-slash")}>
        5ADSH
        {/* scratch cuts — use background color to "cut" through letters */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M-2 14 L38 9 L62 13 L102 6" stroke="var(--background)" strokeWidth="1.3" fill="none" />
          <path d="M8 31 L44 26 L70 29 L104 23" stroke="var(--background)" strokeWidth="0.8" fill="none" />
          <path d="M55 -2 L49 42" stroke="var(--background)" strokeWidth="0.7" fill="none" />
        </svg>
      </span>
      {arabic && (
        <span className="font-arabic ml-[0.08em] -rotate-6 text-[0.42em] leading-none opacity-90">خدش</span>
      )}
    </span>
  );
}
