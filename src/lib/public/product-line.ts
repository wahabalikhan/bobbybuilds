import { addDays } from "@/lib/days";
import { formatWhole } from "@/lib/format";
import type { PublicNumber } from "./snapshot";

/** How old the latest value can be and still show ("hide the line if there's no recent value"). */
export const RECENT_DAYS = 7;

/**
 * The public card's line of product numbers, e.g. "1,240 open jobs · 300 companies": each public
 * product number's latest daily value, with commas, labelled in lower case. Null when there's
 * nothing recent to show.
 */
export function productLine(numbers: Pick<PublicNumber, "kind" | "label" | "figure" | "latestDay">[], today: string): string | null {
	const earliest = addDays(today, -RECENT_DAYS);
	const parts = numbers
		.filter((n) => n.kind === "latest" && n.figure !== null && n.latestDay !== null && n.latestDay >= earliest)
		.map((n) => `${formatWhole(n.figure!)} ${n.label.toLowerCase()}`);
	return parts.length ? parts.join(" · ") : null;
}
