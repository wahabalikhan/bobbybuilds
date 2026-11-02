"use client";

// Lives inside the admin layout, so the LIVE DATA banner shows here too.
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
	return (
		<div className="space-y-3">
			<h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
			<p className="text-ink-2">This page couldn&rsquo;t load. Nothing was changed.</p>
			<button onClick={reset} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-page">
				Try again
			</button>
		</div>
	);
}
