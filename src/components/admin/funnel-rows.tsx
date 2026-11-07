"use client";

import { useState, type ReactNode } from "react";

/**
 * Funnel steps: the saved ones (at least one row), then "Add a step" for more, up to 8. Rows not
 * yet shown are still in the form, empty, so saving works the same; without JavaScript every row
 * shows.
 */
export function FunnelRows({ rows, saved }: { rows: ReactNode[]; saved: number }) {
	const [shown, setShown] = useState(Math.max(1, saved));
	return (
		<div className="space-y-3">
			{rows.map((row, i) => (
				<div key={i} hidden={i >= shown}>
					{row}
				</div>
			))}
			{shown < rows.length && (
				<button type="button" onClick={() => setShown((n) => n + 1)} className="btn-secondary control inline-flex items-center gap-1.5 px-3.5 text-sm">
					<span aria-hidden>+</span> Add a step
				</button>
			)}
		</div>
	);
}
