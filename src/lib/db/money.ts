/**
 * Monthly costs and revenue (migrations 0012 and 0022), in pence. A month's rows are saved together:
 * the Costs and revenue page replaces the whole month in one batch.
 *
 * Costs are in two groups: running costs (what keeps the products live) and tools I build with
 * (like the Claude subscription). A yearly row stores the yearly price; its monthly share is a
 * twelfth of it (`monthlyPence`).
 */
export type MoneyKind = "cost" | "revenue";
export type CostGroup = "running" | "tools";
export type Billing = "monthly" | "yearly";

export type MoneyRow = { kind: MoneyKind; group: CostGroup; billing: Billing; service: string; projectId: number | null; amountPence: number };

type Row = { kind: MoneyKind; cost_group: CostGroup; billing: Billing; service: string; project_id: number | null; amount_pence: number };

/** What a row costs (or earns) per month: a yearly price is split over 12 months. */
export function monthlyPence(row: { billing: Billing; amountPence: number }): number {
	return row.billing === "yearly" ? Math.round(row.amountPence / 12) : row.amountPence;
}

/** The same as `monthlyPence`, in SQL (SQLite's round() also rounds halves up for positive numbers). */
const MONTHLY_SQL = "CASE WHEN billing = 'yearly' THEN CAST(round(amount_pence / 12.0) AS INTEGER) ELSE amount_pence END";

/** Monthly totals: running costs, tools and revenue. */
export function monthTotals(rows: MoneyRow[]): { runningPence: number; toolsPence: number; revenuePence: number } {
	const total = (keep: (r: MoneyRow) => boolean) => rows.filter(keep).reduce((t, r) => t + monthlyPence(r), 0);
	return {
		runningPence: total((r) => r.kind === "cost" && r.group === "running"),
		toolsPence: total((r) => r.kind === "cost" && r.group === "tools"),
		revenuePence: total((r) => r.kind === "revenue"),
	};
}

export async function listMonth(db: D1Database, month: string): Promise<MoneyRow[]> {
	const { results } = await db
		.prepare("SELECT kind, cost_group, billing, service, project_id, amount_pence FROM money WHERE month = ?1 ORDER BY kind, cost_group, service COLLATE NOCASE, id")
		.bind(month)
		.all<Row>();
	return results.map((r) => ({ kind: r.kind, group: r.cost_group, billing: r.billing, service: r.service, projectId: r.project_id, amountPence: r.amount_pence }));
}

/** Replaces every row for the month, in one transaction. */
export async function replaceMonth(db: D1Database, month: string, rows: MoneyRow[]): Promise<void> {
	await db.batch([
		db.prepare("DELETE FROM money WHERE month = ?1").bind(month),
		...rows.map((r) =>
			db
				.prepare("INSERT INTO money (month, kind, cost_group, billing, service, project_id, amount_pence) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
				.bind(month, r.kind, r.kind === "cost" ? r.group : "running", r.billing, r.service, r.projectId, r.amountPence),
		),
	]);
}

/** Months that have any rows, newest first, with their monthly totals. */
export async function listMonths(db: D1Database): Promise<{ month: string; runningPence: number; toolsPence: number; revenuePence: number }[]> {
	const { results } = await db
		.prepare(
			`SELECT month,
				sum(CASE WHEN kind = 'cost' AND cost_group = 'running' THEN ${MONTHLY_SQL} ELSE 0 END) AS running,
				sum(CASE WHEN kind = 'cost' AND cost_group = 'tools' THEN ${MONTHLY_SQL} ELSE 0 END) AS tools,
				sum(CASE WHEN kind = 'revenue' THEN ${MONTHLY_SQL} ELSE 0 END) AS revenue
			 FROM money GROUP BY month ORDER BY month DESC`,
		)
		.all<{ month: string; running: number; tools: number; revenue: number }>();
	return results.map((r) => ({ month: r.month, runningPence: r.running, toolsPence: r.tools, revenuePence: r.revenue }));
}

/** Every service name used so far, for suggestions. */
export async function listServices(db: D1Database): Promise<string[]> {
	const { results } = await db.prepare("SELECT DISTINCT service FROM money ORDER BY service COLLATE NOCASE").all<{ service: string }>();
	return results.map((r) => r.service);
}
