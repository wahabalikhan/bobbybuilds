"use client";

import type { ReactNode } from "react";

/**
 * A GET filter form that applies as soon as a choice changes (no Filter button). Without
 * JavaScript, a plain "Show" button appears instead, so it still works.
 */
export function AutoSubmitForm({ children, className = "" }: { children: ReactNode; className?: string }) {
	return (
		<form method="get" className={className} onChange={(event) => event.currentTarget.requestSubmit()}>
			{children}
			<noscript>
				<button className="btn-secondary control px-3.5 text-sm">Show</button>
			</noscript>
		</form>
	);
}
