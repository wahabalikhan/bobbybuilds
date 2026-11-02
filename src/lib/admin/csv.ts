import { eachEvent, type EventFilter } from "@/lib/db/dashboard";

/**
 * One CSV cell. Quotes when needed, and stops spreadsheets treating text as a formula
 * (cells starting with = + - @, tab or carriage return get a leading apostrophe).
 */
export function csvCell(value: string | number | null): string {
	if (value === null) return "";
	let text = String(value);
	if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const EVENT_CSV_COLUMNS = ["time_utc", "source", "name", "path", "props"] as const;

/** Streams matching events as CSV, newest first. No visitor IDs. */
export function eventsCsv(db: D1Database, filter: EventFilter): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	const rows = eachEvent(db, filter);
	let headerSent = false;
	return new ReadableStream({
		async pull(controller) {
			if (!headerSent) {
				headerSent = true;
				controller.enqueue(encoder.encode(`${EVENT_CSV_COLUMNS.join(",")}\r\n`));
				return;
			}
			const lines: string[] = [];
			for (let i = 0; i < 200; i += 1) {
				const next = await rows.next();
				if (next.done) {
					if (lines.length) controller.enqueue(encoder.encode(lines.join("")));
					controller.close();
					return;
				}
				const event = next.value;
				lines.push(
					[new Date(event.ts).toISOString(), event.source, event.name, event.path, event.props].map(csvCell).join(",") + "\r\n",
				);
			}
			controller.enqueue(encoder.encode(lines.join("")));
		},
	});
}
