/**
 * Monthly costs and revenue (migration 0012), in pence. A month's rows are saved together:
 * the Costs and revenue page replaces the whole month in one batch.
 */
export type MoneyKind = "cost" | "revenue";

export type MoneyRow = { kind: MoneyKind; service: string; projectId: number | null; amountPence: number };

type Row = { kind: MoneyKind; service: string; project_id: number | null; amount_pence: number };

export async function listMonth(db: D1Database, month: string): Promise<MoneyRow[]> {
	const { results } = await db
		.prepare("SELECT kind, service, project_id, amount_pence FROM money WHERE month = ?1 ORDER BY kind, service COLLATE NOCASE, id")
		.bind(month)
		.all<Row>();
	return results.map((r) => ({ kind: r.kind, service: r.service, projectId: r.project_id, amountPence: r.amount_pence }));
}

/** Replaces every row for the month, in one transaction. */
export async function replaceMonth(db: D1Database, month: string, rows: MoneyRow[]): Promise<void> {
	await db.batch([
		db.prepare("DELETE FROM money WHERE month = ?1").bind(month),
		...rows.map((r) =>
			db.prepare("INSERT INTO money (month, kind, service, project_id, amount_pence) VALUES (?1, ?2, ?3, ?4, ?5)").bind(month, r.kind, r.service, r.projectId, r.amountPence),
		),
	]);
}

/** Months that have any rows, newest first. */
export async function listMonths(db: D1Database): Promise<{ month: string; costPence: number; revenuePence: number }[]> {
	const { results } = await db
		.prepare(
			`SELECT month, sum(CASE WHEN kind = 'cost' THEN amount_pence ELSE 0 END) AS cost, sum(CASE WHEN kind = 'revenue' THEN amount_pence ELSE 0 END) AS revenue
			 FROM money GROUP BY month ORDER BY month DESC`,
		)
		.all<{ month: string; cost: number; revenue: number }>();
	return results.map((r) => ({ month: r.month, costPence: r.cost, revenuePence: r.revenue }));
}

/** Every service name used so far, for suggestions. */
export async function listServices(db: D1Database): Promise<string[]> {
	const { results } = await db.prepare("SELECT DISTINCT service FROM money ORDER BY service COLLATE NOCASE").all<{ service: string }>();
	return results.map((r) => r.service);
}
