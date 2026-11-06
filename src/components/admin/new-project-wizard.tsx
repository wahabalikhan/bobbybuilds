"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { CopyButton } from "@/components/admin/copy-button";
import { inputClass } from "@/components/admin/form";
import { buttonClass } from "@/components/admin/ui";
import type { FormState } from "@/lib/admin/form-state";
import { adminHref } from "@/lib/site";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/**
 * New project in three steps: (1) name and site address, (2) the snippet to copy (the keys are made
 * automatically; a secret key for server events can be made later under Settings → Connection),
 * (3) "Waiting for your first visit…" until one arrives.
 */
export function NewProjectWizard({ action }: { action: Action }) {
	const [state, formAction, pending] = useActionState(action, { status: "idle", version: 0 } satisfies FormState);
	const setup = state.status === "ok" ? state.setup : undefined;

	return (
		<ol className="space-y-6">
			<Step number={1} title="Name and site address" done={Boolean(setup)}>
				{setup ? (
					<div>
						<p className="text-sm text-ink-2">
							<span className="font-medium text-ink">{setup.name}</span> is set up. Its address in HQ ends in <code>{setup.slug}</code>, and only its site can send visits.
						</p>
						<p className="mt-1 text-sm text-muted">Hidden from your public page until its first visit. You can show it any time.</p>
					</div>
				) : (
					<form action={formAction} className="space-y-4" noValidate>
						<Field name="name" label="Name" placeholder="Tech Jobs" state={state} hint="Its address in HQ is made from this, like tech-jobs." />
						<Field name="site_url" label="Site address" placeholder="https://" type="url" state={state} hint="Visits are only accepted from this site, and it's checked every 5 minutes." />
						<div className="flex items-center gap-3">
							<button className={buttonClass} disabled={pending}>
								{pending ? "Setting up…" : "Continue"}
							</button>
							{state.status === "error" && state.message && (
								<p role="alert" className="text-sm text-critical-ink">
									✕ {state.message}
								</p>
							)}
						</div>
					</form>
				)}
			</Step>

			<Step number={2} title="Add the tracking code" done={false} muted={!setup}>
				{setup ? (
					<div className="space-y-3">
						<p className="text-sm text-ink-2">
							Paste this into the <code>&lt;head&gt;</code> of every page.
						</p>
						<pre className="overflow-x-auto rounded-xl bg-surface p-3 text-xs">{setup.snippet}</pre>
						<CopyButton text={setup.snippet} label="Copy code" />
					</div>
				) : (
					<p className="text-sm text-muted">The code is made for you after step 1.</p>
				)}
			</Step>

			<Step number={3} title="First visit" done={false} muted={!setup}>
				{setup ? <WaitForFirstVisit slug={setup.slug} /> : <p className="text-sm text-muted">Once the code is on the site, open any page of it.</p>}
			</Step>
		</ol>
	);
}

function Step({ number, title, done, muted = false, children }: { number: number; title: string; done: boolean; muted?: boolean; children: React.ReactNode }) {
	return (
		<li className={`rounded-2xl border border-line bg-card p-5 ${muted ? "opacity-60" : ""}`}>
			<h2 className="mb-3 flex items-center gap-2 font-medium">
				<span aria-hidden className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${done ? "bg-ink text-page" : "bg-pill text-ink"}`}>
					{done ? "✓" : number}
				</span>
				<span>
					<span className="sr-only">Step {number}: </span>
					{title}
				</span>
			</h2>
			{children}
		</li>
	);
}

function Field({ name, label, hint, placeholder, type = "text", state }: { name: string; label: string; hint: string; placeholder: string; type?: string; state: FormState }) {
	const error = state.errors?.[name];
	return (
		<label className="block text-sm">
			<span className="font-medium">{label}</span>
			<input
				name={name}
				type={type}
				defaultValue={state.values?.[name] ?? ""}
				placeholder={placeholder}
				aria-invalid={error ? true : undefined}
				aria-describedby={`${name}-hint`}
				className={inputClass}
			/>
			<span id={`${name}-hint`} className={`mt-1 block ${error ? "text-critical-ink" : "text-muted"}`}>
				{error ?? hint}
			</span>
		</label>
	);
}

/** Asks every 5 seconds whether a page view has arrived; turns into a tick when one has. */
function WaitForFirstVisit({ slug }: { slug: string }) {
	const [arrived, setArrived] = useState(false);
	useEffect(() => {
		if (arrived) return;
		let stopped = false;
		const check = async () => {
			try {
				const response = await fetch(adminHref(`/projects/${slug}/first-visit`), { cache: "no-store" });
				const body = (await response.json()) as { arrived?: boolean };
				if (!stopped && body.arrived) setArrived(true);
			} catch {
				// Try again on the next tick.
			}
		};
		check();
		const timer = setInterval(check, 5000);
		return () => {
			stopped = true;
			clearInterval(timer);
		};
	}, [slug, arrived]);

	return arrived ? (
		<div role="status" className="space-y-3">
			<p className="flex items-center gap-2 text-sm font-medium text-good-ink">
				<span aria-hidden>✓</span> The first visit has arrived. It&rsquo;s connected, and it&rsquo;ll be on your public page within a few minutes.
			</p>
			<div className="flex flex-wrap gap-3 text-sm">
				<Link href={adminHref(`/projects/${slug}`)} className={buttonClass}>
					Open its dashboard
				</Link>
				<Link href={adminHref(`/projects/${slug}?tab=settings`)} className="self-center text-muted underline underline-offset-4 hover:text-ink">
					Its settings
				</Link>
			</div>
		</div>
	) : (
		<p role="status" className="flex items-center gap-2 text-sm text-ink-2">
			<span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-[var(--warning)]" />
			Waiting for your first visit… Open any page of the site with the code on it.
		</p>
	);
}
