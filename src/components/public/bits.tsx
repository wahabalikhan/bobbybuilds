import type { ReactNode } from "react";
import { journeyType, type JourneyTone, type JourneyType } from "@/lib/journey-types";

/** Each journey type's pill: text on its tint (globals.css, .public-theme), or the ink pill for monthly reports. */
const TONES: Record<JourneyTone, string> = {
	shipped: "bg-shipped-bg text-shipped",
	building: "bg-building-bg text-building",
	decision: "bg-decision-bg text-decision",
	inspired: "bg-inspired-bg text-inspired",
	plain: "bg-plain-bg text-plain",
	ink: "bg-ink text-white",
};

export const PILL = "inline-flex h-7 shrink-0 items-center rounded-full px-3 text-[14px] font-medium leading-none";

/** A journey entry's type as a coloured pill ("Decision"). `onBlue`: white on a translucent white, for the blue cards. */
export function TypePill({ type, onBlue = false }: { type: JourneyType; onBlue?: boolean }) {
	const t = journeyType(type);
	return <span className={`${PILL} ${onBlue ? "bg-on-accent-pill text-white" : TONES[t.tone]}`}>{t.label}</span>;
}

/** A plain pill (a project's name on a blue card). */
export function Pill({ children, onBlue = false }: { children: ReactNode; onBlue?: boolean }) {
	return <span className={`${PILL} ${onBlue ? "bg-on-accent-pill text-white" : "bg-plain-bg text-plain"}`}>{children}</span>;
}

const STATUS: Record<string, { label: string; tint: string; dot: string }> = {
	live: { label: "Live", tint: "bg-shipped-bg text-shipped", dot: "bg-live-dot" },
	building: { label: "Building", tint: "bg-building-bg text-building", dot: "bg-building" },
	paused: { label: "Paused", tint: "bg-plain-bg text-plain", dot: "bg-muted" },
};

/**
 * A project's status as a pill with its dot and word (never colour alone). Live pulses while its
 * latest uptime check is up (still with reduced motion), and reads "Down" with a grey dot when it failed.
 */
export function StatusPill({ status, up = null, onBlue = false }: { status: string; up?: boolean | null; onBlue?: boolean }) {
	const s = STATUS[status];
	if (!s) return null;
	const down = status === "live" && up === false;
	const pulse = status === "live" && up !== false;
	return (
		<span className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-[15px] font-medium ${onBlue ? "bg-on-accent-pill text-white" : down ? "bg-plain-bg text-plain" : s.tint}`}>
			<span aria-hidden className={`h-2 w-2 rounded-full ${down ? "bg-muted" : s.dot} ${pulse ? "motion-safe:animate-live" : ""}`} />
			{down ? "Down" : s.label}
		</span>
	);
}

/**
 * A link that opens its whole card: put it on the card's title, inside a `relative` card that has
 * CARD_FOCUS. Its ::after covers the card. The focus outline is drawn on the card itself (outside
 * it, so the card's overflow can't clip it); the site-wide :focus-visible rule skips [data-card-link].
 * Anything else clickable in the card needs `relative z-10`.
 */
export const STRETCHED_LINK = "outline-none after:absolute after:inset-0 after:content-['']";

/** The card's focus outline while its stretched link (STRETCHED_LINK) has keyboard focus. */
export const CARD_FOCUS =
	"has-[[data-card-link]:focus-visible]:outline-2 has-[[data-card-link]:focus-visible]:outline-offset-2 has-[[data-card-link]:focus-visible]:outline-[var(--accent)]";

/** A rounded, 44px-tall link or button: grey ("quiet"), white with an outline ("outline"), ink ("dark") or blue ("blue"). */
export function pillButton(kind: "quiet" | "outline" | "dark" | "blue" | "white" = "quiet"): string {
	const looks = {
		quiet: "bg-pill text-ink hover:bg-[#e4e6eb]",
		outline: "border border-line bg-card text-ink hover:border-[#cfd3dc]",
		dark: "bg-ink text-white hover:bg-[#2a2d35]",
		blue: "bg-accent text-white hover:bg-[#1a45c2]",
		white: "bg-card text-ink hover:bg-pill",
	};
	return `inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[15px] font-medium transition-colors ${looks[kind]}`;
}

/** For screen readers, after a link that opens in a new tab. */
export const NEW_TAB = <span className="sr-only"> (opens in a new tab)</span>;

/** Arrow → for "Read" and "See the full journey". */
export function Arrow({ className = "h-4 w-4" }: { className?: string }) {
	return (
		<svg viewBox="0 0 16 16" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
			<path d="M3 8h10M9 4l4 4-4 4" />
		</svg>
	);
}

/** Arrow ← for "Previous" and "All journey entries". */
export function ArrowLeft({ className = "h-4 w-4" }: { className?: string }) {
	return (
		<svg viewBox="0 0 16 16" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
			<path d="M13 8H3M7 4L3 8l4 4" />
		</svg>
	);
}

/** Arrow ↗ for links that open another site. */
export function ArrowOut({ className = "h-3.5 w-3.5" }: { className?: string }) {
	return (
		<svg viewBox="0 0 16 16" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
			<path d="M5 11l6-6M6 5h5v5" />
		</svg>
	);
}
