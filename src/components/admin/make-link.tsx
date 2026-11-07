"use client";

import { useState } from "react";
import { CopyButton } from "./copy-button";
import { Dialog } from "./dialog";
import { inputBaseClass, inputClass } from "./field-styles";
import { quietButtonClass } from "./ui";

/**
 * "Make a link": a button that opens a small dialog. Give the link a name for one post (?ref=), or
 * say where it's shared (utm_source, utm_medium, utm_campaign); the link is built as you type, with
 * Copy. Nothing is saved: the link counts once people arrive through it (Tracked links).
 */
export function MakeLink({ siteUrl }: { siteUrl: string }) {
	const [values, setValues] = useState({ url: siteUrl, ref: "", source: "", medium: "", campaign: "" });
	const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: event.target.value }));
	const clean = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "").slice(0, 50);

	let built: string | null = null;
	let problem: string | null = null;
	try {
		const url = new URL(values.url.trim());
		if (!/^https?:$/.test(url.protocol)) throw new Error();
		const ref = values.ref.trim();
		if (ref && !/^[A-Za-z0-9-]{1,40}$/.test(ref)) problem = "A name can only use letters, numbers and hyphens, up to 40.";
		else if (ref) url.searchParams.set("ref", ref);
		for (const [key, value] of [["utm_source", values.source], ["utm_medium", values.medium], ["utm_campaign", values.campaign]] as const) {
			if (clean(value)) url.searchParams.set(key, clean(value));
		}
		built = problem ? null : url.toString();
	} catch {
		problem = values.url.trim() ? "Enter a full web address, starting with https://." : null;
	}

	const field = (key: keyof typeof values, label: string, hint?: string) => (
		<label className="block text-sm">
			<span className="font-medium">{label}</span>
			<input value={values[key]} onChange={set(key)} type={key === "url" ? "url" : "text"} className={inputClass} />
			{hint && <span className="mt-1 block text-muted">{hint}</span>}
		</label>
	);

	return (
		<Dialog
			title="Make a link"
			trigger={(open) => (
				<button type="button" onClick={open} className={quietButtonClass}>
					Make a link
				</button>
			)}
		>
			{(close) => (
				<div className="space-y-4">
					<p className="text-sm text-ink-2">Give it a name for one post, or say where it&rsquo;s shared.</p>
					{field("url", "Page address")}
					{field("ref", "Name (optional)", "Like linkedin-post-12")}
					{field("source", "Site (optional)", "Like linkedin")}
					{field("medium", "Type (optional)", "Like social")}
					{field("campaign", "Campaign (optional)", "Like launch")}
					{problem && <p className="text-sm text-danger">{problem}</p>}
					{built && (
						<div className="flex flex-wrap items-center gap-2">
							<input readOnly value={built} aria-label="Your tracked link" className={`${inputBaseClass} min-w-0 flex-1 font-mono`} />
							<CopyButton text={built} />
						</div>
					)}
					<div className="flex justify-end">
						<button type="button" onClick={close} className={quietButtonClass}>
							Done
						</button>
					</div>
				</div>
			)}
		</Dialog>
	);
}
