import type { ReactNode } from "react";
import { AdminKeyboardShortcut, AdminTaps } from "@/components/public/admin-shortcut";
import { owner } from "@/lib/site";
import { PAGE } from "@/lib/layout";

// Every tool icon sits in the same 16px invisible box, in its own shape (no box, border or clipping).
// In their own colours (each has its name as alt text and on hover).
const ICON = "block h-4 w-4 object-contain";

const icon = (src: string, alt: string) => (
	// eslint-disable-next-line @next/next/no-img-element -- tiny local icons
	<img src={src} alt={alt} width={16} height={16} className={ICON} />
);

function NextIcon() {
	return (
		<svg role="img" aria-label="Next.js" viewBox="0 0 24 24" className="block h-4 w-4 text-ink">
			<path fill="currentColor" d="M18.665 21.978C16.758 23.255 14.465 24 12 24 5.377 24 0 18.623 0 12S5.377 0 12 0s12 5.377 12 12c0 3.583-1.574 6.801-4.067 9.001L9.219 7.2H7.2v9.596h1.615V9.251l9.85 12.727Zm-3.332-8.533 1.6 2.061V7.2h-1.6v6.245Z" />
		</svg>
	);
}

/** The tools this site was made with, as small icons (all served from this site). */
const TOOLS: { label: string; icon: ReactNode }[] = [
	{ label: "Me", icon: icon("/made-with/me.png", "Me") },
	{ label: "Figma", icon: icon("/made-with/figma.png", "Figma") },
	{ label: "Next.js", icon: <NextIcon /> },
	{ label: "Claude", icon: icon("/made-with/claude.svg", "Claude") },
	{ label: "VS Code", icon: icon("/made-with/vs-code.png", "VS Code") },
	{ label: "Cloudflare", icon: icon("/made-with/cloudflare.png", "Cloudflare") },
	{ label: "Supabase", icon: icon("/made-with/supabase.jpeg", "Supabase") },
];

/** "Made with 🫶🏼 using" the tools, then the copyright, as on the portfolio. */
export function SiteFooter({ year }: { year: number }) {
	return (
		<footer className={`${PAGE} pb-20 sm:pb-24`}>
			<AdminKeyboardShortcut />
			<div className="flex flex-wrap items-center gap-x-2 gap-y-2 pt-4 sm:pt-8 text-sm text-muted">
				<span>
					Made with <span aria-label="love">🫶🏼</span> using
				</span>
				<ul className="flex items-center gap-1.5" aria-label="Tools">
					{TOOLS.map((tool) => (
						<li key={tool.label} className="group relative flex">
							{tool.icon}
							<span aria-hidden className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-card px-2 py-1 text-xs text-ink opacity-0 shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-opacity group-hover:opacity-100">
								{tool.label}
							</span>
						</li>
					))}
				</ul>
				<AdminTaps>
					© {year} {owner.fullName}
				</AdminTaps>
			</div>
		</footer>
	);
}
