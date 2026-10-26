import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showWordmark?: boolean;
  href?: string;
}

export function LogoIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("flex-shrink-0 transition-transform duration-300 group-hover:scale-105", className)}
    >
      <defs>
        <linearGradient id="tl-gradient-primary" x1="2" y1="34" x2="34" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="tl-gradient-glow" x1="0" y1="36" x2="36" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.9" />
        </linearGradient>
        <filter id="tl-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background soft glowing aura */}
      <circle cx="18" cy="18" r="14" fill="#10b981" fillOpacity="0.08" />

      {/* Base Link Segment (Left / Bottom loop) */}
      <path
        d="M13 24H9.5C6.46 24 4 21.54 4 18.5C4 15.46 6.46 13 9.5 13H14"
        stroke="url(#tl-gradient-primary)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Secondary interlocking loop connecting upward */}
      <path
        d="M23 12H26.5C29.54 12 32 14.46 32 17.5C32 20.54 29.54 23 26.5 23H22"
        stroke="url(#tl-gradient-primary)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dynamic Trading Arrow cutting diagonally upward through the link */}
      <path
        d="M11 25L17.5 17L22 21.5L30 8"
        stroke="url(#tl-gradient-glow)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Arrowhead */}
      <path
        d="M23.5 8H30V14.5"
        stroke="url(#tl-gradient-glow)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  iconClassName = "h-7 w-7",
  textClassName,
  showWordmark = true,
  href = "/",
}: LogoProps) {
  const content = (
    <div className={cn("group inline-flex items-center gap-2.5 font-bold tracking-tight select-none", className)}>
      <LogoIcon className={iconClassName} />
      {showWordmark && (
        <span className={cn("text-lg font-bold tracking-tight text-text", textClassName)}>
          TradeLinked
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md">
        {content}
      </Link>
    );
  }

  return content;
}
