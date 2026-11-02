"use client";

import { useId, useState } from "react";
import { ColumnChart } from "@/components/charts";
import { formatMonth, formatWhole } from "@/lib/format";
import type { Month } from "@/lib/public/snapshot";

/**
 * The big number and monthly bars. The dropdown switches between figures already in the page,
 * so it works without another request (and the page stays cacheable).
 */
export function HeadlineCard({ all, projects }: { all: Month[]; projects: { slug: string; name: string; monthly: Month[] }[] }) {
	const [choice, setChoice] = useState("");
	const id = useId();
	const chosen = projects.find((p) => p.slug === choice);
	const months = chosen?.monthly ?? all;
	const total = months.reduce((t, m) => t + m.value, 0);
	const title = `Visitors per month${chosen ? ` for ${chosen.name}` : " across all projects"}`;
	const bars = months.map((m) => ({ label: formatMonth(m.month).slice(0, 3), detail: formatMonth(m.month), value: m.value }));

	return (
		<section aria-label="Visitors in the last 12 months" className="rounded-2xl border border-line bg-card p-5">
			<div className="mb-4 flex flex-wrap items-start justify-between gap-3">
				<p className="text-ink-2" aria-live="polite">
					<span className="text-[28px] font-bold tracking-tight text-ink">{formatWhole(total)}</span> visitors in 12 months
					{chosen && <span className="text-muted"> · {chosen.name}</span>}
				</p>
				{projects.length > 1 && (
					<>
						<label htmlFor={id} className="sr-only">
							Show visitors for
						</label>
						<select
							id={id}
							value={choice}
							onChange={(event) => setChoice(event.target.value)}
							className="appearance-none rounded-full border border-line bg-card bg-[length:12px] bg-[right_12px_center] bg-no-repeat py-1.5 pl-3.5 pr-8 text-sm"
							style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5l3 3 3-3' fill='none' stroke='%2371717a' stroke-width='1.5'/%3E%3C/svg%3E\")" }}
						>
							<option value="">All projects ({projects.length})</option>
							{projects.map((p) => (
								<option key={p.slug} value={p.slug}>
									{p.name}
								</option>
							))}
						</select>
					</>
				)}
			</div>
			{/* A narrow drawing on phones (readable labels), the full one from 640px. Only one is ever displayed. */}
			<div className="sm:hidden">
				<ColumnChart title={title} bars={bars} unfinishedLast height={230} viewWidth={360} />
			</div>
			<div className="hidden sm:block">
				<ColumnChart title={title} bars={bars} unfinishedLast height={220} />
			</div>
			<p className="mt-1 text-xs text-muted">Counted without cookies; a visitor is counted once per day. This month so far is the lighter bar.</p>
		</section>
	);
}
