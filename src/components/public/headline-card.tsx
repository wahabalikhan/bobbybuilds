"use client";

import { useState } from "react";
import { MonthBars, ProjectSelect, type ChartProject } from "@/components/public/charts";
import { formatMonth, formatWhole } from "@/lib/format";
import type { Month } from "@/lib/public/snapshot";

/**
 * The big number and monthly bars. The dropdown switches between figures already in the page,
 * so it works without another request (and the page stays cacheable).
 */
export function HeadlineCard({ projects }: { projects: (ChartProject & { monthly: Month[] })[] }) {
	const [choice, setChoice] = useState("");
	const chosen = projects.find((p) => p.slug === choice);
	const shown = chosen ? [chosen] : projects;
	const months = (projects[0]?.monthly ?? []).map((m) => formatMonth(m.month));
	const total = shown.reduce((t, p) => t + p.monthly.reduce((s, m) => s + m.value, 0), 0);
	const title = `Visitors per month${chosen ? ` for ${chosen.name}` : " across all projects"}`;

	return (
		<section aria-label="Visitors in the last 12 months" className="rounded-2xl border border-line bg-card p-5">
			<div className="mb-4 flex flex-wrap items-start justify-between gap-3">
				<p className="flex items-baseline gap-2 text-ink-2" aria-live="polite">
					<span className="text-[28px] font-bold tracking-tight text-ink">{formatWhole(total)}</span>
					<span>visitors in 12 months</span>
				</p>
				{projects.length > 1 && <ProjectSelect projects={projects} value={choice} onChange={setChoice} allLabel="All projects" label="Show visitors for" />}
			</div>
			<MonthBars months={months} projects={shown.map((p) => ({ ...p, values: p.monthly.map((m) => m.value) }))} title={title} />
		</section>
	);
}
