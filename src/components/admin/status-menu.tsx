import Link from "next/link";
import { StatusIcon, type Status } from "@/components/charts";
import type { Attention } from "@/lib/db/dashboard";
import { adminHref } from "@/lib/site";

/** The pill's text: "Everything's running normally", or "<n> thing(s) need(s) attention". */
export function statusText(items: Attention[]): string {
	if (items.length === 0) return "Everything's running normally";
	return `${items.length} ${items.length === 1 ? "thing needs" : "things need"} attention`;
}

/** Red when something is down or a job failed, amber when it's only worth a look, green when all is well. */
export function statusTone(items: Attention[]): "good" | "warning" | "critical" {
	if (items.length === 0) return "good";
	return items.some((i) => i.level === "critical" || i.level === "serious") ? "critical" : "warning";
}

const TONE = {
	good: "bg-[color-mix(in_srgb,var(--good)_12%,transparent)] text-good-ink",
	warning: "bg-[color-mix(in_srgb,var(--warning)_22%,transparent)] text-warning-ink",
	critical: "bg-[color-mix(in_srgb,var(--critical)_14%,transparent)] text-critical-ink",
} as const;

/**
 * The top bar's status pill. When something needs attention it opens the list (a native
 * disclosure, so no script is needed). There's no separate Needs attention block on the page.
 */
export function StatusMenu({ items }: { items: Attention[] }) {
	const tone = statusTone(items);
	const pill = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${TONE[tone]}`;
	if (items.length === 0) {
		return (
			<span role="status" className={pill}>
				<span aria-hidden>●</span> {statusText(items)}
			</span>
		);
	}
	return (
		<details className="group relative">
			<summary className={`${pill} list-none [&::-webkit-details-marker]:hidden`}>
				<span aria-hidden>●</span> {statusText(items)}
				<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden className="transition-transform group-open:rotate-180">
					<path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			</summary>
			<ul className="absolute left-0 z-30 mt-2 w-[min(28rem,calc(100vw-3rem))] space-y-2 rounded-2xl border border-line bg-card p-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
				{items.map((item, i) => (
					<li key={i} className="flex items-start gap-2 text-sm">
						<span className="mt-0.5">
							<StatusIcon status={item.level as Status} />
						</span>
						{item.projectSlug ? (
							<Link className="link" href={adminHref(`/projects/${item.projectSlug}`)}>
								{item.message}
							</Link>
						) : (
							<span>{item.message}</span>
						)}
					</li>
				))}
			</ul>
		</details>
	);
}

/**
 * Home's status, at the top of the page: one clear line when everything's running normally, or
 * the list of problems shown open (each linking to its project). The top bar's pill stays too.
 */
export function StatusStrip({ items }: { items: Attention[] }) {
	const tone = statusTone(items);
	if (items.length === 0) {
		return (
			<p role="status" className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium ${TONE[tone]}`}>
				<span aria-hidden>●</span> {statusText(items)}
			</p>
		);
	}
	return (
		<section aria-labelledby="status-heading" className={`rounded-2xl px-4 py-3 ${TONE[tone]}`}>
			<h2 id="status-heading" className="flex items-center gap-2 text-sm font-medium">
				<span aria-hidden>●</span> {statusText(items)}
			</h2>
			<ul className="mt-2 space-y-2">
				{items.map((item, i) => (
					<li key={i} className="flex items-start gap-2 text-sm text-ink">
						<span className="mt-0.5">
							<StatusIcon status={item.level as Status} />
						</span>
						{item.projectSlug ? (
							<Link className="link" href={adminHref(`/projects/${item.projectSlug}`)}>
								{item.message}
							</Link>
						) : (
							<span>{item.message}</span>
						)}
					</li>
				))}
			</ul>
		</section>
	);
}
