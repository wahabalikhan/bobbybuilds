"use client";

import { Breadcrumb, buttonClass } from "@/components/admin/ui";
import { adminHref } from "@/lib/site";

// Lives inside the admin layout, so the LIVE DATA banner shows here too.
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
	return (
		<div className="space-y-3">
			<Breadcrumb items={[{ label: "Home", href: adminHref() }, { label: "Something went wrong" }]} />
			<h1 className="text-3xl font-bold tracking-tight">Something went wrong</h1>
			<p className="text-ink-2">This page couldn&rsquo;t load. Nothing was changed.</p>
			<button onClick={reset} className={buttonClass}>
				Try again
			</button>
		</div>
	);
}
