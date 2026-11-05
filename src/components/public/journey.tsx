"use client";

import { useState } from "react";
import { formatDay } from "@/lib/format";
import { JOURNEY_TYPES, journeyType, type JourneyType } from "@/lib/journey-types";
import type { PublicEntry } from "@/lib/public/snapshot";
import { ArrowIcon } from "./icons";

const PAGE_SIZE = 10;

function domain(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "Link";
	}
}

/**
 * The journey: short dated entries, newest first, each with its type's emoji and label. Filter
 * chips (only for types that have entries) and "Show more" (10 at a time). Without JavaScript,
 * the first 10 are shown. Entry bodies are already sanitised (renderMarkdown, in the snapshot).
 */
export function Journey({ entries }: { entries: Pick<PublicEntry, "slug" | "type" | "day" | "title" | "html" | "linkUrl" | "projectName">[] }) {
	const [type, setType] = useState<JourneyType | null>(null);
	const [shown, setShown] = useState(PAGE_SIZE);
	const types = JOURNEY_TYPES.filter((t) => entries.some((e) => e.type === t.value));
	const matching = type ? entries.filter((e) => e.type === type) : entries;
	const visible = matching.slice(0, shown);

	const chip = (value: JourneyType | null, label: string, emoji?: string) => (
		<button
			key={value ?? "all"}
			type="button"
			aria-pressed={type === value}
			onClick={() => {
				setType(value);
				setShown(PAGE_SIZE);
			}}
			className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink-2 hover:bg-pill hover:text-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-page"
		>
			{emoji && <span aria-hidden>{emoji}</span>}
			{label}
		</button>
	);

	return (
		<>
			{types.length > 1 && (
				<div role="group" aria-label="Show entries of one type" className="mb-6 flex flex-wrap gap-2">
					{chip(null, "All")}
					{types.map((t) => chip(t.value, t.label, t.emoji))}
				</div>
			)}
			<ol className="space-y-6 border-l border-line pl-6 sm:pl-8">
				{visible.map((e) => {
					const t = journeyType(e.type);
					return (
						<li key={e.slug} className="relative">
							<span aria-hidden className="absolute -left-[29px] top-2 h-2 w-2 rounded-full border border-line bg-page ring-4 ring-page sm:-left-[37px]" />
							<p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
								<time dateTime={e.day}>{formatDay(e.day, true)}</time>
								<span aria-hidden>·</span>
								<span className="text-ink-2">
									<span aria-hidden>{t.emoji} </span>
									{t.label}
								</span>
								{e.projectName && (
									<>
										<span aria-hidden>·</span>
										<span>{e.projectName}</span>
									</>
								)}
							</p>
							<h3 className="mt-1 text-lg font-semibold tracking-tight">{e.title}</h3>
							{e.html && (
								// Safe: renderMarkdown never passes raw HTML through (src/lib/markdown.ts).
								<div className="prose-bobby mt-1.5 max-w-[65ch] text-ink-2" dangerouslySetInnerHTML={{ __html: e.html }} />
							)}
							{e.linkUrl && (
								<a href={e.linkUrl} target="_blank" rel="noopener noreferrer" className="link mt-2 inline-flex items-center gap-1 text-sm">
									{domain(e.linkUrl)} <ArrowIcon />
									<span className="sr-only">(opens in a new tab)</span>
								</a>
							)}
						</li>
					);
				})}
			</ol>
			{matching.length > shown && (
				<button type="button" onClick={() => setShown((n) => n + PAGE_SIZE)} className="mt-8 inline-flex items-center rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-pill">
					Show more <span className="sr-only">&nbsp;entries</span>
					<span className="ml-1.5 text-muted">({matching.length - shown})</span>
				</button>
			)}
		</>
	);
}
