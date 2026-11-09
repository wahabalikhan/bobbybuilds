import type { ReactNode } from "react";

/**
 * One colour rule for every admin message, after RealTechJobs (tokens in globals.css):
 *   success  green  something worked ("Saved", "Published")
 *   info     blue   information (BobbyBuilds' accent)
 *   warning  amber  needs attention, but isn't a failure
 *   error    red    something failed
 * Never colour alone: each tone has its own icon too (ToneIcon). Where they go: confirmations
 * after an action are toasts (showToast); an error about one field sits under it; a problem with a
 * form sits above its buttons (Notice); the Home problems list uses Notice's look.
 */
export type Tone = "success" | "info" | "warning" | "error";

/** Tone text on its tint, with its thin border. */
export const toneBox: Record<Tone, string> = {
	success: "border border-success-line bg-success-bg text-success",
	info: "border border-info-line bg-info-bg text-info",
	warning: "border border-notice-line bg-notice-bg text-notice",
	error: "border border-danger-line bg-danger-bg text-danger",
};

/** A tick in a circle, "i", a triangle, or "!" in a circle, in the tone's colour (currentColor). */
export function ToneIcon({ tone, className = "h-[18px] w-[18px]" }: { tone: Tone; className?: string }) {
	const common = { viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, className: `shrink-0 ${className}` };
	if (tone === "warning") {
		return (
			<svg {...common}>
				<path d="M10 3.2 17.6 16.4H2.4Z" />
				<path d="M10 8.2v3.6M10 14.1v.1" />
			</svg>
		);
	}
	return (
		<svg {...common}>
			<circle cx="10" cy="10" r="7.6" />
			{tone === "success" && <path d="m6.8 10.2 2.2 2.2 4.3-4.6" />}
			{tone === "info" && <path d="M10 9.2v4.4M10 6.4v.1" />}
			{tone === "error" && <path d="M10 6.2v4.6M10 13.6v.1" />}
		</svg>
	);
}

/**
 * A message in place: a form's problem above its buttons, or a note on a page. Errors are
 * announced straight away (role="alert"); others politely when `live`, or not at all when
 * they're part of the page as it loads.
 */
export function Notice({ tone, children, className = "", live = tone === "error" ? "alert" : undefined }: { tone: Tone; children: ReactNode; className?: string; live?: "alert" | "status" }) {
	return (
		<div role={live} className={`flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm ${toneBox[tone]} ${className}`}>
			<ToneIcon tone={tone} className="mt-px h-[18px] w-[18px]" />
			<div className="min-w-0 flex-1">{children}</div>
		</div>
	);
}
