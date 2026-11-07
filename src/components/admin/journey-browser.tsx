"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { inputBaseClass, selectBaseClass } from "./field-styles";
import { EntryStatus } from "./ui";

export type BrowserEntry = { id: number; href: string; title: string; type: string; typeLabel: string; emoji: string; detail: string; published: boolean; text: string };

/**
 * The journey list's one row of filters: a search field (icon inside, filtering as you type), a
 * Type dropdown and a Status dropdown, in the field style. They filter the list in the browser
 * straight away and keep the address up to date (?q=&type=&status=), so a reload or a shared link
 * shows the same. Each row: the type's emoji in a small square, the title, its details, and its
 * status as a dot and a word.
 */
export function JourneyBrowser({ entries, types, initial }: { entries: BrowserEntry[]; types: { value: string; label: string }[]; initial: { q: string; type: string; status: string } }) {
	const [q, setQ] = useState(initial.q);
	const [type, setType] = useState(initial.type);
	const [status, setStatus] = useState(initial.status);

	const update = (next: { q?: string; type?: string; status?: string }) => {
		const values = { q, type, status, ...next };
		if (next.q !== undefined) setQ(next.q);
		if (next.type !== undefined) setType(next.type);
		if (next.status !== undefined) setStatus(next.status);
		const url = new URL(window.location.href);
		for (const [key, value] of Object.entries(values)) {
			if (value.trim()) url.searchParams.set(key, value.trim());
			else url.searchParams.delete(key);
		}
		history.replaceState(history.state, "", url.pathname + url.search);
	};

	const words = q.trim().toLowerCase();
	const shown = useMemo(
		() => entries.filter((e) => (!words || e.text.includes(words)) && (!type || e.type === type) && (!status || (status === "published" ? e.published : !e.published))),
		[entries, words, type, status],
	);

	return (
		<div className="space-y-4">
			<div role="search" className="flex flex-col gap-2 sm:flex-row">
				<label className="relative min-w-0 flex-1">
					<span className="sr-only">Search entries</span>
					<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted">
						<circle cx="9" cy="9" r="5.5" />
						<path d="m13.2 13.2 3.3 3.3" />
					</svg>
					<input type="search" value={q} onChange={(event) => update({ q: event.target.value })} placeholder="Search entries" className={`${inputBaseClass} w-full pl-9`} />
				</label>
				<label className="sm:w-44">
					<span className="sr-only">Type</span>
					<select value={type} onChange={(event) => update({ type: event.target.value })} className={`${selectBaseClass} w-full`}>
						<option value="">All types</option>
						{types.map((t) => (
							<option key={t.value} value={t.value}>
								{t.label}
							</option>
						))}
					</select>
				</label>
				<label className="sm:w-40">
					<span className="sr-only">Status</span>
					<select value={status} onChange={(event) => update({ status: event.target.value })} className={`${selectBaseClass} w-full`}>
						<option value="">Any status</option>
						<option value="published">Published</option>
						<option value="draft">Draft</option>
					</select>
				</label>
			</div>

			<p className="sr-only" aria-live="polite">
				{shown.length === entries.length ? "" : `${shown.length} of ${entries.length} entries shown`}
			</p>

			{shown.length === 0 ? (
				<p className="text-sm text-muted">
					No entries match.{" "}
					<button type="button" onClick={() => update({ q: "", type: "", status: "" })} className="link">
						Clear filters
					</button>
				</p>
			) : (
				<ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
					{shown.map((e) => (
						<li key={e.id} className="relative flex items-center gap-3 px-4 py-3.5 hover:bg-surface has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-[var(--accent)]">
							<span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-pill text-base">
								{e.emoji}
							</span>
							<div className="min-w-0 flex-1">
								<Link href={e.href} className="block truncate font-semibold outline-none after:absolute after:inset-0 hover:underline">
									{e.title}
								</Link>
								<p className="mt-0.5 truncate text-[13px] text-muted">{e.detail}</p>
							</div>
							<EntryStatus published={e.published} />
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
